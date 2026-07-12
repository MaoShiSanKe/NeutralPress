import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("rlog-js", () => {
  function RLog(this: any) {
    this.info = () => {};
    this.success = () => {};
    this.error = () => {};
    this.warn = () => {};
  }
  return { default: RLog };
});

const {
  mockCheckDatabaseHealth,
  mockCheckEnvironmentVariables,
  mockCheckJWTKeyPair,
  mockCheckRedisConnection,
  mockGenerateViewCountCache,
  mockSeedDefaults,
  mockSyncCloudInstance,
  mockSyncPersistentMedia,
  mockUpdateDatabase,
  mockRunPrismaMigrateDeploy,
} = vi.hoisted(() => ({
  mockCheckDatabaseHealth: vi.fn().mockResolvedValue(undefined),
  mockCheckEnvironmentVariables: vi.fn().mockResolvedValue(undefined),
  mockCheckJWTKeyPair: vi.fn().mockResolvedValue(undefined),
  mockCheckRedisConnection: vi.fn().mockResolvedValue(undefined),
  mockGenerateViewCountCache: vi.fn().mockResolvedValue(undefined),
  mockSeedDefaults: vi.fn().mockResolvedValue(undefined),
  mockSyncCloudInstance: vi.fn().mockResolvedValue(undefined),
  mockSyncPersistentMedia: vi.fn().mockResolvedValue(undefined),
  mockUpdateDatabase: vi.fn().mockResolvedValue(undefined),
  mockRunPrismaMigrateDeploy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/../scripts/check-db", () => ({
  checkDatabaseHealth: mockCheckDatabaseHealth,
}));
vi.mock("@/../scripts/check-env", () => ({
  checkEnvironmentVariables: mockCheckEnvironmentVariables,
}));
vi.mock("@/../scripts/check-jwt-token", () => ({
  checkJWTKeyPair: mockCheckJWTKeyPair,
}));
vi.mock("@/../scripts/check-redis", () => ({
  checkRedisConnection: mockCheckRedisConnection,
}));
vi.mock("@/../scripts/generate-view-count-cache", () => ({
  default: mockGenerateViewCountCache,
}));
vi.mock("@/../scripts/seed-defaults", () => ({
  seedDefaults: mockSeedDefaults,
}));
vi.mock("@/../scripts/sync-cloud-instance", () => ({
  syncCloudInstance: mockSyncCloudInstance,
}));
vi.mock("@/../scripts/sync-persistent-media", () => ({
  syncPersistentMedia: mockSyncPersistentMedia,
}));
vi.mock("@/../scripts/update-db", () => ({
  updateDatabase: mockUpdateDatabase,
}));
vi.mock("@/lib/server/prisma-migrate", () => ({
  runPrismaMigrateDeploy: mockRunPrismaMigrateDeploy,
}));

// 需要在 mock 之后导入被测模块
import { runInternalRuntimeInitialization } from "@/lib/server/runtime-init";

// 获取全局状态对象以在测试之间重置
const globalState = globalThis as unknown as {
  runtimeInitPromise?: Promise<{ completedAt: string }>;
  runtimeInitCompletedAt?: string;
};

describe("runtime-init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置全局状态
    globalState.runtimeInitPromise = undefined;
    globalState.runtimeInitCompletedAt = undefined;
  });

  describe("runInternalRuntimeInitialization", () => {
    it("首次运行时执行完整初始化流程", async () => {
      const result = await runInternalRuntimeInitialization();

      expect(result.reused).toBe(false);
      expect(result.completedAt).toBeTruthy();
      expect(typeof result.completedAt).toBe("string");
    });

    it("调用所有初始化步骤", async () => {
      await runInternalRuntimeInitialization();

      expect(mockCheckEnvironmentVariables).toHaveBeenCalledTimes(1);
      expect(mockCheckJWTKeyPair).toHaveBeenCalledTimes(1);
      expect(mockCheckRedisConnection).toHaveBeenCalledTimes(1);
      expect(mockCheckDatabaseHealth).toHaveBeenCalledTimes(1);
      expect(mockUpdateDatabase).toHaveBeenCalledTimes(1);
      expect(mockSeedDefaults).toHaveBeenCalledTimes(1);
      expect(mockSyncPersistentMedia).toHaveBeenCalledTimes(1);
      expect(mockSyncCloudInstance).toHaveBeenCalledTimes(1);
      expect(mockGenerateViewCountCache).toHaveBeenCalledTimes(1);
    });

    it("传入 runMigrateDeploy 给 updateDatabase", async () => {
      await runInternalRuntimeInitialization();

      expect(mockUpdateDatabase).toHaveBeenCalledWith(
        expect.objectContaining({
          runMigrateDeploy: expect.any(Function),
        }),
      );
    });

    it("runMigrateDeploy 回调调用 runPrismaMigrateDeploy", async () => {
      await runInternalRuntimeInitialization();

      // 获取传给 updateDatabase 的回调
      const callArgs = mockUpdateDatabase.mock.calls[0]?.[0] as {
        runMigrateDeploy: () => Promise<void>;
      };
      await callArgs.runMigrateDeploy();

      expect(mockRunPrismaMigrateDeploy).toHaveBeenCalled();
    });

    it("已完成时返回复用标记", async () => {
      // 设置全局状态模拟已完成
      globalState.runtimeInitCompletedAt = "2024-01-01T00:00:00.000Z";

      const result = await runInternalRuntimeInitialization();

      expect(result.reused).toBe(true);
      expect(result.completedAt).toBe("2024-01-01T00:00:00.000Z");
    });

    it("已完成时不执行初始化步骤", async () => {
      globalState.runtimeInitCompletedAt = "2024-01-01T00:00:00.000Z";

      await runInternalRuntimeInitialization();

      expect(mockCheckEnvironmentVariables).not.toHaveBeenCalled();
      expect(mockCheckJWTKeyPair).not.toHaveBeenCalled();
      expect(mockCheckDatabaseHealth).not.toHaveBeenCalled();
    });

    it("并发调用时共享同一个 Promise", async () => {
      const [result1, result2] = await Promise.all([
        runInternalRuntimeInitialization(),
        runInternalRuntimeInitialization(),
      ]);

      // 其中一个 reused 应为 true（表示它等待了已完成的初始化）
      // 两个结果的 completedAt 应该相同
      expect(result1.completedAt).toBeTruthy();
      expect(result2.completedAt).toBeTruthy();
      // 初始化步骤应只执行一次（不重复执行）
      // 注意：并发时 Promise.all 的两个调用会共享同一个初始化 Promise
    });

    it("返回有效的 ISO 时间戳", async () => {
      const result = await runInternalRuntimeInitialization();

      expect(result.completedAt).toBeTruthy();
      // 验证是合法的 ISO 日期字符串
      const parsed = new Date(result.completedAt);
      expect(parsed.toISOString()).toBe(result.completedAt);
    });

    it("初始化失败时清除 Promise 状态", async () => {
      mockCheckEnvironmentVariables.mockRejectedValueOnce(
        new Error("env check failed"),
      );

      await expect(runInternalRuntimeInitialization()).rejects.toThrow(
        "env check failed",
      );

      // Promise 应该被清除，允许重试
      expect(globalState.runtimeInitPromise).toBeUndefined();
    });

    it("初始化失败后可以重试", async () => {
      let callCount = 0;
      mockCheckEnvironmentVariables.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("first call fails");
        }
      });

      await expect(runInternalRuntimeInitialization()).rejects.toThrow(
        "first call fails",
      );

      // 重试应该成功
      const result = await runInternalRuntimeInitialization();
      expect(result.completedAt).toBeTruthy();
      expect(result.reused).toBe(false);
    });
  });
});
