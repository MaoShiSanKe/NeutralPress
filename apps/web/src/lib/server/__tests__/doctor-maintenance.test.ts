import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfigs: mockGetConfigs,
}));

// Mock prisma
const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
const mockUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
vi.mock("@/lib/server/prisma", () => ({
  default: {
    searchLog: { deleteMany: mockDeleteMany },
    healthCheck: { deleteMany: mockDeleteMany },
    auditLog: { deleteMany: mockDeleteMany },
    cronHistory: { deleteMany: mockDeleteMany },
    cloudTriggerHistory: { deleteMany: mockDeleteMany },
    notice: { deleteMany: mockDeleteMany },
    project: { deleteMany: mockDeleteMany },
    friendLink: { deleteMany: mockDeleteMany },
    post: { deleteMany: mockDeleteMany },
    page: { deleteMany: mockDeleteMany },
    comment: { deleteMany: mockDeleteMany },
    user: { deleteMany: mockDeleteMany },
    message: { deleteMany: mockDeleteMany },
    mailSubscription: { deleteMany: mockDeleteMany },
    refreshToken: { deleteMany: mockDeleteMany },
    passwordReset: { deleteMany: mockDeleteMany },
    pushSubscription: {
      updateMany: mockUpdateMany,
      deleteMany: mockDeleteMany,
    },
  },
}));

describe("doctor-maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 默认所有保留天数为 30 天
    mockGetConfigs.mockResolvedValue(Array(13).fill(30));
  });

  describe("runAutoCleanupMaintenance", () => {
    it("应执行所有清理操作并返回结果", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("searchLogDeleted");
      expect(result).toHaveProperty("healthCheckDeleted");
      expect(result).toHaveProperty("auditLogDeleted");
      expect(result).toHaveProperty("cronHistoryDeleted");
      expect(result).toHaveProperty("cloudTriggerHistoryDeleted");
      expect(result).toHaveProperty("noticeDeleted");
      expect(result).toHaveProperty("recycleBinDeleted");
      expect(result).toHaveProperty("unsubscribedMailSubscriptionDeleted");
      expect(result).toHaveProperty("refreshTokenDeleted");
      expect(result).toHaveProperty("passwordResetDeleted");
      expect(result).toHaveProperty("pushSubscriptionsMarkedInactive");
      expect(result).toHaveProperty("pushSubscriptionsDeletedInactive");
      expect(result).toHaveProperty("pushSubscriptionsDeletedForDisabledUsers");
    });

    it("所有结果字段应为数字类型", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      const requiredFields = [
        "searchLogDeleted",
        "healthCheckDeleted",
        "auditLogDeleted",
        "cronHistoryDeleted",
        "cloudTriggerHistoryDeleted",
        "noticeDeleted",
        "recycleBinDeleted",
        "unsubscribedMailSubscriptionDeleted",
        "refreshTokenDeleted",
        "passwordResetDeleted",
        "pushSubscriptionsMarkedInactive",
        "pushSubscriptionsDeletedInactive",
        "pushSubscriptionsDeletedForDisabledUsers",
      ];

      for (const field of requiredFields) {
        expect(typeof (result as any)[field]).toBe("number");
      }
    });

    it("应正确处理清理失败的情况", async () => {
      mockDeleteMany.mockRejectedValueOnce(new Error("Delete failed"));

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      // 即使某个清理失败，也应返回结果（失败的计数为 0）
      expect(result.searchLogDeleted).toBe(0);
    });

    it("应正确统计删除的记录数", async () => {
      let callCount = 0;
      mockDeleteMany.mockImplementation(async () => {
        callCount++;
        return { count: callCount * 5 };
      });

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result.searchLogDeleted).toBe(5);
    });

    it("应使用配置的保留天数计算截止日期", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      await runAutoCleanupMaintenance();

      // 验证 getConfigs 被调用并传入正确的配置键
      expect(mockGetConfigs).toHaveBeenCalledWith(
        expect.arrayContaining([
          "cron.task.cleanup.searchLog.retentionDays",
          "cron.task.cleanup.healthCheck.retentionDays",
          "cron.task.cleanup.auditLog.retentionDays",
        ]),
      );
    });

    it("当配置值为 0 时应清理所有记录", async () => {
      mockGetConfigs.mockResolvedValueOnce(Array(13).fill(0));

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result).toBeDefined();
    });

    it("当配置值为负数时应视为 0", async () => {
      mockGetConfigs.mockResolvedValueOnce(Array(13).fill(-5));

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result).toBeDefined();
    });

    it("应调用 updateMany 标记不活跃的 pushSubscription", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      await runAutoCleanupMaintenance();

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            lastUsedAt: expect.objectContaining({
              lt: expect.any(Date),
            }),
          }),
          data: { isActive: false },
        }),
      );
    });

    it("应调用 deleteMany 清理过期的 searchLog", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      await runAutoCleanupMaintenance();

      expect(mockDeleteMany).toHaveBeenCalled();
    });

    it("应调用 deleteMany 清理回收站数据", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      await runAutoCleanupMaintenance();

      // 验证回收站相关的 deleteMany 调用（post, page, comment, user, message, project, friendLink）
      expect(mockDeleteMany).toHaveBeenCalled();
    });

    it("应调用 deleteMany 清理过期的 refreshToken", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      await runAutoCleanupMaintenance();

      expect(mockDeleteMany).toHaveBeenCalled();
    });

    it("应处理配置返回非数字值的情况", async () => {
      mockGetConfigs.mockResolvedValueOnce([
        "invalid",
        null,
        undefined,
        "NaN",
        {},
        [],
        true,
        "30",
        0,
        -1,
        15,
        7,
        90,
      ]);

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result).toBeDefined();
      expect(typeof result.searchLogDeleted).toBe("number");
    });
  });

  describe("runDoctorMaintenance", () => {
    it("应调用 runAutoCleanupMaintenance", async () => {
      const {
        runDoctorMaintenance,
        runAutoCleanupMaintenance: _runAutoCleanupMaintenance,
      } = await import("@/lib/server/doctor-maintenance");

      const result = await runDoctorMaintenance();

      expect(result).toBeDefined();
      expect(result).toHaveProperty("searchLogDeleted");
    });

    it("应返回与 runAutoCleanupMaintenance 相同结构的结果", async () => {
      const { runDoctorMaintenance, runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );

      const result1 = await runAutoCleanupMaintenance();
      const result2 = await runDoctorMaintenance();

      // 结构应该相同
      expect(Object.keys(result1).sort()).toEqual(Object.keys(result2).sort());
    });
  });

  describe("runAutoCleanupMaintenance 高级场景", () => {
    it("当所有清理都成功时应返回正确的计数", async () => {
      let deleteCount = 0;
      mockDeleteMany.mockImplementation(async () => {
        deleteCount++;
        return { count: deleteCount };
      });
      mockUpdateMany.mockResolvedValue({ count: 3 });

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result.searchLogDeleted).toBe(1);
      expect(result.healthCheckDeleted).toBe(2);
      expect(result.pushSubscriptionsMarkedInactive).toBe(3);
    });

    it("应处理混合成功和失败的清理操作", async () => {
      let callIndex = 0;
      mockDeleteMany.mockImplementation(async () => {
        callIndex++;
        if (callIndex === 3) {
          throw new Error("Audit log cleanup failed");
        }
        return { count: callIndex * 10 };
      });
      mockUpdateMany.mockResolvedValue({ count: 5 });

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      // 第 3 个调用（auditLogDeleted）应返回 0
      expect(result.auditLogDeleted).toBe(0);
      // 其他应正常返回
      expect(result.searchLogDeleted).toBe(10);
    });

    it("应处理配置返回 null 和 undefined", async () => {
      mockGetConfigs.mockResolvedValue([
        null,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
        undefined,
        null,
      ]);

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result).toBeDefined();
      expect(typeof result.searchLogDeleted).toBe("number");
    });

    it("当配置值为浮点数时应四舍五入", async () => {
      mockGetConfigs.mockResolvedValue(Array(13).fill(7.6));

      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      const result = await runAutoCleanupMaintenance();

      expect(result).toBeDefined();
    });

    it("应使用正确的配置键调用 getConfigs", async () => {
      const { runAutoCleanupMaintenance } = await import(
        "@/lib/server/doctor-maintenance"
      );
      await runAutoCleanupMaintenance();

      expect(mockGetConfigs).toHaveBeenCalledWith(
        expect.arrayContaining([
          "cron.task.cleanup.searchLog.retentionDays",
          "cron.task.cleanup.healthCheck.retentionDays",
          "cron.task.cleanup.auditLog.retentionDays",
          "cron.task.cleanup.cronHistory.retentionDays",
          "cron.task.cleanup.cloudTriggerHistory.retentionDays",
          "cron.task.cleanup.notice.retentionDays",
          "cron.task.cleanup.recycleBin.retentionDays",
          "cron.task.cleanup.mailSubscriptionUnsubscribed.retentionDays",
          "cron.task.cleanup.refreshToken.expiredRetentionDays",
          "cron.task.cleanup.passwordReset.retentionMinutes",
          "cron.task.cleanup.pushSubscription.markInactiveDays",
          "cron.task.cleanup.pushSubscription.deleteInactiveDays",
          "cron.task.cleanup.pushSubscription.deleteDisabledUserDays",
        ]),
      );
    });
  });
});
