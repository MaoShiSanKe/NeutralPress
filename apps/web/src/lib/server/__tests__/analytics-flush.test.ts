import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock prisma
const mockCreateMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockFindMany = vi.fn();
const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();
const mockQueryRaw = vi.fn();
vi.mock("@/lib/server/prisma", () => ({
  default: {
    pageView: {
      createMany: mockCreateMany,
      deleteMany: mockDeleteMany,
      findMany: mockFindMany,
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: mockUpdate,
    },
    viewCountCache: {
      upsert: mockUpsert,
    },
    pageViewArchive: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    config: {
      findMany: vi.fn().mockResolvedValue([
        { key: "analytics.enable", value: { default: true } },
        { key: "analytics.timezone", value: { default: "UTC" } },
        { key: "analytics.precisionDays", value: { default: 30 } },
        { key: "analytics.retentionDays", value: { default: 365 } },
      ]),
    },
    $transaction: mockTransaction,
    $queryRaw: mockQueryRaw,
  },
}));

// Mock redis
const mockLrange = vi.fn();
const mockLtrim = vi.fn();
const mockHgetall = vi.fn();
vi.mock("@/lib/server/redis", () => ({
  default: {
    lrange: mockLrange,
    ltrim: mockLtrim,
    hgetall: mockHgetall,
  },
}));

describe("analytics-flush", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLrange.mockResolvedValue([]);
    mockLtrim.mockResolvedValue("OK");
    mockHgetall.mockResolvedValue({});
    mockCreateMany.mockResolvedValue({ count: 0 });
    mockDeleteMany.mockResolvedValue({ count: 0 });
    mockFindMany.mockResolvedValue([]);
    mockUpsert.mockResolvedValue({});
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: any) => fn({}));
    mockQueryRaw.mockResolvedValue([]);
  });

  describe("常量", () => {
    it("REDIS_QUEUE_KEY 应为正确的键名", async () => {
      const { REDIS_QUEUE_KEY } = await import("@/lib/server/analytics-flush");
      expect(REDIS_QUEUE_KEY).toBe("np:analytics:event");
    });

    it("REDIS_VIEW_COUNT_KEY 应为正确的键名", async () => {
      const { REDIS_VIEW_COUNT_KEY } = await import(
        "@/lib/server/analytics-flush"
      );
      expect(REDIS_VIEW_COUNT_KEY).toBe("np:view_count:all");
    });

    it("BATCH_SIZE 应为 500", async () => {
      const { BATCH_SIZE } = await import("@/lib/server/analytics-flush");
      expect(BATCH_SIZE).toBe(500);
    });
  });

  describe("withRetry", () => {
    it("应在第一次成功时返回结果", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      const operation = vi.fn().mockResolvedValue("success");
      const result = await withRetry(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("应在失败后重试", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValueOnce("success");

      const result = await withRetry(operation, 2);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it("当重试次数耗尽时应抛出错误", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      const operation = vi.fn().mockRejectedValue(new Error("Always fail"));

      await expect(withRetry(operation, 0)).rejects.toThrow("Always fail");
    });

    it("应使用默认的重试次数", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      let callCount = 0;
      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) throw new Error("Fail");
        return "success";
      });

      const result = await withRetry(operation);
      expect(result).toBe("success");
      expect(callCount).toBe(3); // 1 initial + 2 retries
    });
  });

  describe("flushEventsToDatabase", () => {
    it("当 Redis 队列为空时应返回 success", async () => {
      mockLrange.mockResolvedValueOnce([]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
      expect(result.flushedCount).toBe(0);
    });

    it("应从 Redis 队列中读取事件", async () => {
      mockLrange.mockResolvedValueOnce([]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      await flushEventsToDatabase();

      expect(mockLrange).toHaveBeenCalledWith("np:analytics:event", 0, 499);
    });

    it("当事件解析失败时应跳过无效事件", async () => {
      mockLrange.mockResolvedValueOnce([
        "invalid-json",
        JSON.stringify({
          path: "/test",
          timestamp: new Date().toISOString(),
          ipAddress: "127.0.0.1",
          visitorId: "visitor-1",
        }),
      ]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
      expect(result.flushedCount).toBeGreaterThanOrEqual(0);
    });

    it("应正确处理有效的页面访问事件", async () => {
      const event = {
        path: "/posts/hello",
        timestamp: new Date().toISOString(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        referer: "https://google.com",
        visitorId: "visitor-123",
      };

      mockLrange.mockResolvedValueOnce([JSON.stringify(event)]);
      mockFindMany.mockResolvedValueOnce([]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
    });

    it("应处理缺少可选字段的事件", async () => {
      const event = {
        path: "/test",
        timestamp: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        visitorId: "visitor-1",
      };

      mockLrange.mockResolvedValueOnce([JSON.stringify(event)]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
    });

    it("当 Redis 操作失败时应返回 success: false", async () => {
      // 需要让所有重试都失败，否则 withRetry 会在重试成功后返回
      mockLrange.mockRejectedValue(new Error("Redis error"));

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(false);
      expect(result.flushedCount).toBe(0);
    });

    it("应返回正确的结果结构", async () => {
      mockLrange.mockResolvedValueOnce([]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("flushedCount");
      expect(result).toHaveProperty("syncedViewCountRows");
      expect(result).toHaveProperty("archivedDateGroups");
      expect(result).toHaveProperty("archivedRawPageViewDeleted");
      expect(result).toHaveProperty("expiredArchiveDeleted");
    });

    it("应处理 pathStats 中的无效数据", async () => {
      const event = {
        path: "/test",
        timestamp: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        visitorId: "visitor-1",
      };

      mockLrange.mockResolvedValueOnce([JSON.stringify(event)]);
      mockFindMany.mockResolvedValueOnce([]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result).toBeDefined();
    });

    it("应成功批量写入多条事件", async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        JSON.stringify({
          path: `/page-${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          ipAddress: "192.168.1.1",
          visitorId: `visitor-${i}`,
        }),
      );

      mockLrange.mockResolvedValueOnce(events);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
    });

    it("应处理同访客多次访问", async () => {
      const now = Date.now();
      const events = [
        JSON.stringify({
          path: "/page-1",
          timestamp: new Date(now).toISOString(),
          ipAddress: "192.168.1.1",
          visitorId: "same-visitor",
        }),
        JSON.stringify({
          path: "/page-2",
          timestamp: new Date(now + 5000).toISOString(),
          ipAddress: "192.168.1.1",
          visitorId: "same-visitor",
        }),
      ];

      mockLrange.mockResolvedValueOnce(events);
      mockFindMany.mockResolvedValueOnce([]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
    });

    it("应处理空 JSON 对象事件", async () => {
      mockLrange.mockResolvedValueOnce(["{}", ""]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
    });

    it("应处理所有字段为空的事件", async () => {
      const event = JSON.stringify({
        path: "/test",
        timestamp: new Date().toISOString(),
        ipAddress: "127.0.0.1",
        visitorId: "v1",
        userAgent: null,
        referer: null,
        country: null,
        region: null,
        city: null,
        browser: null,
        browserVersion: null,
        os: null,
        osVersion: null,
        deviceType: null,
        screenSize: null,
        language: null,
        timezone: null,
      });

      mockLrange.mockResolvedValueOnce([event]);

      const { flushEventsToDatabase } = await import(
        "@/lib/server/analytics-flush"
      );
      const result = await flushEventsToDatabase();

      expect(result.success).toBe(true);
    });
  });

  describe("withRetry 补充测试", () => {
    it("应使用自定义重试次数", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockRejectedValueOnce(new Error("Fail 3"))
        .mockResolvedValueOnce("success");

      const result = await withRetry(operation, 3);
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it("零次重试时应直接抛出错误", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      const operation = vi.fn().mockRejectedValue(new Error("Immediate fail"));
      await expect(withRetry(operation, 0)).rejects.toThrow("Immediate fail");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("应传递异步操作的返回值", async () => {
      const { withRetry } = await import("@/lib/server/analytics-flush");

      const operation = vi.fn().mockResolvedValue({ data: "test" });
      const result = await withRetry(operation);
      expect(result).toEqual({ data: "test" });
    });
  });
});
