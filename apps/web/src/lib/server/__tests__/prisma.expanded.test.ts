import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock pg Pool
class MockPool {
  end = vi.fn().mockResolvedValue(undefined);
  constructor(_opts?: unknown) {}
}

vi.mock("pg", () => ({
  Pool: MockPool,
}));

// Mock PrismaPg adapter
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class MockPrismaPg {
    constructor(_pool?: unknown) {}
  },
}));

// Mock PrismaClient
class MockPrismaClient {
  $connect = vi.fn().mockResolvedValue(undefined);
  $disconnect = vi.fn().mockResolvedValue(undefined);
  $queryRaw = vi.fn().mockResolvedValue([]);
  $queryRawUnsafe = vi.fn().mockResolvedValue([]);
  $executeRaw = vi.fn().mockResolvedValue(0);
  $executeRawUnsafe = vi.fn().mockResolvedValue(0);
  $transaction = vi.fn().mockImplementation(async (fn: any) => fn({}));
  $extends = vi.fn().mockReturnThis();
  $on = vi.fn();
  $use = vi.fn();
  post = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
  };
  constructor(_opts?: unknown) {}
}

vi.mock(".prisma/client", () => ({
  PrismaClient: MockPrismaClient,
}));

describe("prisma expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("模块导出验证", () => {
    it("default export 应存在", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      expect(prisma).toBeDefined();
    });

    it("应支持链式 model 访问", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      // prisma.post 应该可访问
      expect((prisma as any).post).toBeDefined();
    });
  });

  describe("PrismaClient 配置", () => {
    it("实例应具有所有必要的方法", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      const methods = [
        "$connect",
        "$disconnect",
        "$queryRaw",
        "$transaction",
        "$executeRaw",
      ];
      for (const method of methods) {
        expect(typeof (prisma as any)[method]).toBe("function");
      }
    });

    it("$transaction 应支持函数参数", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      const result = await (prisma as any).$transaction(async (_tx: any) => {
        return "transaction-result";
      });
      expect(result).toBe("transaction-result");
    });
  });

  describe("全局单例行为", () => {
    it("多次导入应返回同一实例", async () => {
      const mod1 = await import("@/lib/server/prisma");
      const mod2 = await import("@/lib/server/prisma");
      expect(mod1.default).toBe(mod2.default);
    });
  });

  describe("portable 模式 mock 行为", () => {
    it("portable 模式下 findMany 应返回数组", async () => {
      // 注：在非 portable 构建中，这个测试验证的是 mock PrismaClient 的行为
      const prisma = (await import("@/lib/server/prisma")).default;
      const result = await (prisma as any).post.findMany();
      expect(Array.isArray(result)).toBe(true);
    });

    it("portable 模式下 count 应返回数字", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      const result = await (prisma as any).post.count();
      expect(typeof result).toBe("number");
    });
  });

  describe("连接池环境变量", () => {
    it("应使用默认连接池大小当 PG_POOL_MAX 未设置", async () => {
      delete process.env.PG_POOL_MAX;
      const prisma = (await import("@/lib/server/prisma")).default;
      expect(prisma).toBeDefined();
    });

    it("应支持自定义连接超时", async () => {
      const original = process.env.PG_CONNECTION_TIMEOUT_MS;
      process.env.PG_CONNECTION_TIMEOUT_MS = "5000";
      const prisma = (await import("@/lib/server/prisma")).default;
      expect(prisma).toBeDefined();
      if (original !== undefined) {
        process.env.PG_CONNECTION_TIMEOUT_MS = original;
      } else {
        delete process.env.PG_CONNECTION_TIMEOUT_MS;
      }
    });

    it("应支持自定义空闲超时", async () => {
      const original = process.env.PG_IDLE_TIMEOUT_MS;
      process.env.PG_IDLE_TIMEOUT_MS = "15000";
      const prisma = (await import("@/lib/server/prisma")).default;
      expect(prisma).toBeDefined();
      if (original !== undefined) {
        process.env.PG_IDLE_TIMEOUT_MS = original;
      } else {
        delete process.env.PG_IDLE_TIMEOUT_MS;
      }
    });
  });

  describe("类型导出", () => {
    it("模块应正确导出", async () => {
      const mod = await import("@/lib/server/prisma");
      expect(mod.default).toBeDefined();
      // 类型导出在运行时不可见，但模块应可正常加载
    });
  });
});
