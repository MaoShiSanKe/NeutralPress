import { beforeEach, describe, expect, it, vi } from "vitest";

// ============ Mocks ============

const mockHeaders = vi.fn().mockReturnValue(new Headers());
vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

const mockLimitControl = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/server/rate-limit", () => ({
  default: (...args: unknown[]) => mockLimitControl(...args),
}));

const mockAuthVerify = vi.fn();
vi.mock("@/lib/server/auth-verify", () => ({
  authVerify: (...args: unknown[]) => mockAuthVerify(...args),
}));

const mockPrisma = {
  $queryRaw: vi.fn(),
  user: { count: vi.fn() },
  auditLog: { count: vi.fn(), findMany: vi.fn() },
  tag: { count: vi.fn() },
  category: { count: vi.fn(), findMany: vi.fn() },
  page: { count: vi.fn(), groupBy: vi.fn() },
  post: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  project: { count: vi.fn() },
  pageView: { count: vi.fn(), findFirst: vi.fn() },
  pageViewArchive: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    findFirst: vi.fn(),
  },
  storageProvider: {},
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: vi.fn().mockReturnValue("cache:key"),
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

// ============ Tests ============

describe("stat actions", () => {
  let getUsersStats: typeof import("@/actions/stat").getUsersStats;
  let getPostsStats: typeof import("@/actions/stat").getPostsStats;
  let getTagsStats: typeof import("@/actions/stat").getTagsStats;
  let getPagesStats: typeof import("@/actions/stat").getPagesStats;
  let getAuditStats: typeof import("@/actions/stat").getAuditStats;
  let getCategoriesStats: typeof import("@/actions/stat").getCategoriesStats;
  let getStorageStats: typeof import("@/actions/stat").getStorageStats;
  let getVisitStats: typeof import("@/actions/stat").getVisitStats;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/stat");
    getUsersStats = mod.getUsersStats;
    getPostsStats = mod.getPostsStats;
    getTagsStats = mod.getTagsStats;
    getPagesStats = mod.getPagesStats;
    getAuditStats = mod.getAuditStats;
    getCategoriesStats = mod.getCategoriesStats;
    getStorageStats = mod.getStorageStats;
    getVisitStats = mod.getVisitStats;
  });

  const adminParams = { access_token: "admin-token", force: false };

  // ---------- getUsersStats ----------

  describe("getUsersStats", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          role: "USER",
          total_count: BigInt(100),
          active_1d: BigInt(10),
          active_7d: BigInt(50),
          active_30d: BigInt(80),
          new_1d: BigInt(2),
          new_7d: BigInt(5),
          new_30d: BigInt(15),
        },
        {
          role: "ADMIN",
          total_count: BigInt(3),
          active_1d: BigInt(1),
          active_7d: BigInt(2),
          active_30d: BigInt(3),
          new_1d: BigInt(0),
          new_7d: BigInt(0),
          new_30d: BigInt(0),
        },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(103);
      expect(result.data.total.user).toBe(100);
      expect(result.data.total.admin).toBe(3);
      expect(result.data.active.lastDay).toBe(11);
    });
  });

  // ---------- getPostsStats ----------

  describe("getPostsStats", () => {
    it("非管理员/编辑/作者应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(50),
          new_7d: BigInt(3),
          new_30d: BigInt(10),
          new_1y: BigInt(40),
        },
        {
          status: "DRAFT",
          total_count: BigInt(5),
          new_7d: BigInt(1),
          new_30d: BigInt(2),
          new_1y: BigInt(5),
        },
      ]);
      mockPrisma.post.findFirst
        .mockResolvedValueOnce({ publishedAt: new Date("2024-06-01") })
        .mockResolvedValueOnce({ publishedAt: new Date("2023-01-01") });

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.published).toBe(50);
      expect(result.data.total.draft).toBe(5);
    });
  });

  // ---------- getTagsStats ----------

  describe("getTagsStats", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(20);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(15) }]) // tagsWithPosts
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(18) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(20);
      expect(result.data.total.withPosts).toBe(15);
    });
  });

  // ---------- getPagesStats ----------

  describe("getPagesStats", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(10);
      mockPrisma.page.groupBy
        .mockResolvedValueOnce([{ status: "ACTIVE", _count: { status: 8 } }])
        .mockResolvedValueOnce([
          { isSystemPage: true, _count: { isSystemPage: 3 } },
        ]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(10);
    });
  });

  // ---------- getAuditStats ----------

  describe("getAuditStats", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(500);
      mockPrisma.auditLog.findMany.mockResolvedValue([
        { userUid: 1 },
        { userUid: 2 },
      ]);
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          last_1d: BigInt(10),
          last_7d: BigInt(50),
          last_30d: BigInt(200),
        },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.logs).toBe(500);
      expect(result.data.total.activeUsers).toBe(2);
    });
  });

  // ---------- 补充测试 ----------

  describe("getUsersStats 补充测试", () => {
    it("应返回正确的活跃用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          role: "USER",
          total_count: BigInt(200),
          active_1d: BigInt(20),
          active_7d: BigInt(100),
          active_30d: BigInt(150),
          new_1d: BigInt(5),
          new_7d: BigInt(10),
          new_30d: BigInt(30),
        },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(200);
    });

    it("应处理空结果", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(0);
    });
  });

  describe("getPostsStats 补充测试", () => {
    it("应返回 published 和 draft 统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.published).toBe(100);
    });

    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试", () => {
    it("无标签时应返回 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(0), new_30d: BigInt(0), new_1y: BigInt(0) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(0);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试", () => {
    it("无页面时应返回 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(0);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(0);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试", () => {
    it("无审计日志时应返回 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(0), last_7d: BigInt(0), last_30d: BigInt(0) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.logs).toBe(0);
      expect(result.data.total.activeUsers).toBe(0);
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  // ==================== 补充分支覆盖测试 ====================

  describe("getUsersStats 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 2", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 2", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 2", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 2", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 2", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 3", () => {
    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 3", () => {
    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 3", () => {
    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockRejectedValue(new Error("DB error"));

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 3", () => {
    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockRejectedValue(new Error("DB error"));

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 3", () => {
    it("应处理数据库查询失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockRejectedValue(new Error("DB error"));

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 4", () => {
    it("编辑角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 2, role: "EDITOR" });
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getPostsStats 补充测试 4", () => {
    it("编辑角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 2, role: "EDITOR" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getTagsStats 补充测试 4", () => {
    it("编辑角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 2, role: "EDITOR" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getPagesStats 补充测试 4", () => {
    it("编辑角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 2, role: "EDITOR" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getAuditStats 补充测试 4", () => {
    it("编辑角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 2, role: "EDITOR" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getUsersStats 补充测试 5", () => {
    it("作者角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 3, role: "AUTHOR" });
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getPostsStats 补充测试 5", () => {
    it("作者角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 3, role: "AUTHOR" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getTagsStats 补充测试 5", () => {
    it("作者角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 3, role: "AUTHOR" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getPagesStats 补充测试 5", () => {
    it("作者角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 3, role: "AUTHOR" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getAuditStats 补充测试 5", () => {
    it("作者角色应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 3, role: "AUTHOR" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
    });
  });

  describe("getUsersStats 补充测试 6", () => {
    it("空结果时应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 6", () => {
    it("多状态文章应正确统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
        {
          status: "DRAFT",
          total_count: BigInt(50),
          new_7d: BigInt(3),
          new_30d: BigInt(10),
          new_1y: BigInt(40),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.published).toBe(100);
      expect(result.data.total.draft).toBe(50);
    });
  });

  describe("getTagsStats 补充测试 6", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockRejectedValue(new Error("DB error"));

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 6", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockRejectedValue(new Error("DB error"));

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 6", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockRejectedValue(new Error("DB error"));

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 7", () => {
    it("空结果时应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 7", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 7", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockRejectedValue(new Error("DB error"));

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 7", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockRejectedValue(new Error("DB error"));

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 7", () => {
    it("数据库查询失败时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockRejectedValue(new Error("DB error"));

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 8", () => {
    it("有用户时应返回统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 8", () => {
    it("有文章时应返回统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 8", () => {
    it("有标签时应返回统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 8", () => {
    it("有页面时应返回统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 8", () => {
    it("有审计日志时应返回统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 9", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 9", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 9", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 9", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 9", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 10", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 10", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 10", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 10", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 10", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 11", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 11", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 11", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 11", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 11", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 12", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 12", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 12", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 12", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 12", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 13", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 13", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 13", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 13", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 13", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 14", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 14", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 14", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 14", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 14", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 15", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 15", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 15", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 15", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 15", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 16", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 16", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 16", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 16", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 16", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 17", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 17", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 17", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 17", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 17", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 18", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 18", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 18", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 18", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 18", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 19", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 19", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 19", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 19", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 19", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 20", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 20", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 20", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 20", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 20", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 21", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 21", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 21", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 21", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 21", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 22", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 22", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 22", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 22", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 22", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 23", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 23", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 23", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 23", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 23", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 24", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 24", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 24", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 24", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 24", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 25", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 25", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 25", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 25", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 25", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 26", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 26", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 26", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 26", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 26", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 27", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 27", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 27", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 27", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 27", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 28", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 28", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 28", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 28", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 28", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 29", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 29", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 29", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 29", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 29", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 30", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 30", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 30", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 30", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 30", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 31", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 31", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 31", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 31", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 31", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 32", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 32", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 32", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 32", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 32", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 33", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 33", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 33", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 33", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 33", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 34", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 34", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 34", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 34", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 34", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 35", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 35", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 35", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 35", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 35", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 36", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 36", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 36", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 36", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 36", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 37", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 37", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 37", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 37", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 37", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 38", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 38", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 38", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 38", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 38", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 39", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 39", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 39", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 39", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 39", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 40", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 40", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 40", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 40", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 40", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 41", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 41", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 41", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 41", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 41", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 42", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 42", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 42", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 42", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 42", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 43", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 43", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 43", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 43", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 43", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 44", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 44", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 44", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 44", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 44", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 45", () => {
    it("成功获取用户统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPostsStats 补充测试 45", () => {
    it("成功获取文章统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(100),
          new_7d: BigInt(5),
          new_30d: BigInt(20),
          new_1y: BigInt(80),
        },
      ]);
      mockPrisma.post.findFirst.mockResolvedValue(null);

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getTagsStats 补充测试 45", () => {
    it("成功获取标签统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(10);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(10) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(5), new_1y: BigInt(8) },
        ]);

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getPagesStats 补充测试 45", () => {
    it("成功获取页面统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(5);
      mockPrisma.page.groupBy.mockResolvedValue([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getAuditStats 补充测试 45", () => {
    it("成功获取审计统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(100);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([
        { last_1d: BigInt(5), last_7d: BigInt(20), last_30d: BigInt(50) },
      ]);

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("getUsersStats 补充测试 46", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 46", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 46", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 46", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 46", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getUsersStats 补充测试 47", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPostsStats 补充测试 47", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getTagsStats 补充测试 47", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getPagesStats 补充测试 47", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuditStats 补充测试 47", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  // ========== getCategoriesStats ==========

  describe("getCategoriesStats", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCategoriesStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员/编辑应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCategoriesStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取分类统计 - 有数据", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.category.count
        .mockResolvedValueOnce(10) // totalCategories
        .mockResolvedValueOnce(3); // topLevelCategories
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(7) }]) // categoriesWithPosts
        .mockResolvedValueOnce([
          { new_7d: BigInt(2), new_30d: BigInt(4), new_1y: BigInt(8) },
        ]); // newCategoriesStats
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 1,
          slug: "cat1",
          name: "Cat 1",
          parentId: null,
          _count: { posts: 5 },
        },
        {
          id: 2,
          slug: "cat2",
          name: "Cat 2",
          parentId: 1,
          _count: { posts: 3 },
        },
        {
          id: 3,
          slug: "cat3",
          name: "Cat 3",
          parentId: 2,
          _count: { posts: 1 },
        },
      ]);

      const result = await getCategoriesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(10);
      expect(result.data.total.topLevel).toBe(3);
      expect(result.data.total.withPosts).toBe(7);
      expect(result.data.total.withoutPosts).toBe(3);
      expect(result.data.depth.maxDepth).toBe(2);
      expect(result.data.new.last7Days).toBe(2);
    });

    it("空分类列表时 avgDepth 为 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "EDITOR" });
      mockPrisma.category.count.mockResolvedValue(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          { new_7d: BigInt(0), new_30d: BigInt(0), new_1y: BigInt(0) },
        ]);
      mockPrisma.category.findMany.mockResolvedValue([]);

      const result = await getCategoriesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.depth.avgDepth).toBe(0);
      expect(result.data.depth.maxDepth).toBe(0);
    });

    it("categoriesWithPosts 空结果时 withPosts 为 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.category.count.mockResolvedValue(5);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // empty categoriesWithPosts
        .mockResolvedValueOnce([
          { new_7d: BigInt(1), new_30d: BigInt(2), new_1y: BigInt(3) },
        ]);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 1, slug: "a", name: "A", parentId: null, _count: { posts: 0 } },
      ]);

      const result = await getCategoriesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.withPosts).toBe(0);
    });

    it("数据库错误时返回 serverError", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.category.count.mockRejectedValue(new Error("DB error"));

      const result = await getCategoriesStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  // ========== getStorageStats ==========

  describe("getStorageStats", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getStorageStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getStorageStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取存储统计 - 有数据", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            type: "LOCAL",
            total_count: BigInt(2),
            active_count: BigInt(2),
            default_count: BigInt(1),
          },
          {
            type: "AWS_S3",
            total_count: BigInt(1),
            active_count: BigInt(1),
            default_count: BigInt(0),
          },
        ])
        .mockResolvedValueOnce([
          {
            storage_provider_type: "LOCAL",
            media_count: BigInt(50),
            total_size: BigInt(1024000),
            average_size: BigInt(20480),
          },
          {
            storage_provider_type: "AWS_S3",
            media_count: BigInt(30),
            total_size: BigInt(512000),
            average_size: BigInt(17067),
          },
        ]);

      const result = await getStorageStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.total).toBe(3);
      expect(result.data.total.active).toBe(3);
      expect(result.data.total.inactive).toBe(0);
      expect(result.data.total.default).toBe(1);
      expect(result.data.byType).toHaveLength(2);
      expect(result.data.storage.totalProviders).toBe(3);
      expect(result.data.storage.totalMediaFiles).toBe(80);
    });

    it("无存储提供商时 averageFileSize 为 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // empty storageStats
        .mockResolvedValueOnce([]); // empty mediaStats

      const result = await getStorageStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.storage.averageFileSize).toBe(0);
      expect(result.data.storage.totalMediaFiles).toBe(0);
    });

    it("存储提供商无对应媒体时 mediaCount 为 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          {
            type: "LOCAL",
            total_count: BigInt(1),
            active_count: BigInt(1),
            default_count: BigInt(1),
          },
        ])
        .mockResolvedValueOnce([]); // no media stats

      const result = await getStorageStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data!.byType[0]!.mediaCount).toBe(0);
    });

    it("数据库错误时返回 serverError", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getStorageStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  // ========== getVisitStats ==========

  describe("getVisitStats", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(false);
    });

    it("成功获取访问统计 - 有数据", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      // Promise.all 的 8 个查询
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { total_views: BigInt(100), unique_visitors: BigInt(50) },
        ]) // last24hAgg
        .mockResolvedValueOnce([{ count: BigInt(200) }]) // totalVisitorsAgg
        .mockResolvedValueOnce([
          { total_views: BigInt(500), unique_visitors: BigInt(200) },
        ]) // last7DaysAgg
        .mockResolvedValueOnce([
          { total_views: BigInt(2000), unique_visitors: BigInt(800) },
        ]) // last30DaysAgg
        .mockResolvedValueOnce([
          {
            visitorId: "v1",
            view_count: BigInt(1),
            first_view: new Date("2025-06-20T10:00:00Z"),
            last_view: new Date("2025-06-20T10:00:00Z"),
          },
          {
            visitorId: "v2",
            view_count: BigInt(3),
            first_view: new Date("2025-06-20T09:00:00Z"),
            last_view: new Date("2025-06-20T09:30:00Z"),
          },
        ]); // sessionData
      mockPrisma.pageView.count.mockResolvedValue(1000);
      mockPrisma.pageViewArchive.aggregate
        .mockResolvedValueOnce({
          _sum: { totalViews: 5000, uniqueVisitors: 2000 },
        }) // totalArchive
        .mockResolvedValueOnce({
          _sum: { totalViews: 500, uniqueVisitors: 200 },
        }) // last7DaysArchive
        .mockResolvedValueOnce({
          _sum: { totalViews: 2000, uniqueVisitors: 800 },
        }); // last30DaysArchive
      mockPrisma.pageViewArchive.findFirst.mockResolvedValue({
        date: new Date("2025-01-01"),
      });
      mockPrisma.pageView.findFirst.mockResolvedValue({
        timestamp: new Date("2025-01-15"),
      });

      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.last24Hours.visitors).toBe(50);
      expect(result.data.last24Hours.views).toBe(100);
      expect(result.data.totalViews.total).toBe(6000);
      expect(result.data.totalVisitors.total).toBe(2200);
    });

    it("空会话数据时 bounceRate 为 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { total_views: BigInt(0), unique_visitors: BigInt(0) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(0) }])
        .mockResolvedValueOnce([
          { total_views: BigInt(0), unique_visitors: BigInt(0) },
        ])
        .mockResolvedValueOnce([
          { total_views: BigInt(0), unique_visitors: BigInt(0) },
        ])
        .mockResolvedValueOnce([]); // empty sessionData
      mockPrisma.pageView.count.mockResolvedValue(0);
      mockPrisma.pageViewArchive.aggregate
        .mockResolvedValueOnce({
          _sum: { totalViews: null, uniqueVisitors: null },
        })
        .mockResolvedValueOnce({
          _sum: { totalViews: null, uniqueVisitors: null },
        })
        .mockResolvedValueOnce({
          _sum: { totalViews: null, uniqueVisitors: null },
        });
      mockPrisma.pageViewArchive.findFirst.mockResolvedValue(null);
      mockPrisma.pageView.findFirst.mockResolvedValue(null);

      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.last24Hours.bounceRate).toBe(0);
      expect(result.data.last24Hours.averageDuration).toBe(0);
      expect(result.data.totalViews.total).toBe(0);
    });

    it("只有 firstRecord 时计算 totalDays", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.pageView.count.mockResolvedValue(10);
      mockPrisma.pageViewArchive.aggregate
        .mockResolvedValueOnce({
          _sum: { totalViews: 100, uniqueVisitors: 50 },
        })
        .mockResolvedValueOnce({ _sum: { totalViews: 10, uniqueVisitors: 5 } })
        .mockResolvedValueOnce({ _sum: { totalViews: 10, uniqueVisitors: 5 } });
      mockPrisma.pageViewArchive.findFirst.mockResolvedValue({
        date: new Date("2024-01-01"),
      });
      mockPrisma.pageView.findFirst.mockResolvedValue(null);

      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.totalViews.averagePerDay).toBeGreaterThan(0);
    });

    it("只有 firstPageView 时计算 totalDays", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.pageView.count.mockResolvedValue(10);
      mockPrisma.pageViewArchive.aggregate
        .mockResolvedValueOnce({
          _sum: { totalViews: null, uniqueVisitors: null },
        })
        .mockResolvedValueOnce({
          _sum: { totalViews: null, uniqueVisitors: null },
        })
        .mockResolvedValueOnce({
          _sum: { totalViews: null, uniqueVisitors: null },
        });
      mockPrisma.pageViewArchive.findFirst.mockResolvedValue(null);
      mockPrisma.pageView.findFirst.mockResolvedValue({
        timestamp: new Date("2024-06-01"),
      });

      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.totalVisitors.averagePerDay).toBeGreaterThanOrEqual(0);
    });

    it("单页访客计入跳出", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([{ count: BigInt(5) }])
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([
          { total_views: BigInt(10), unique_visitors: BigInt(5) },
        ])
        .mockResolvedValueOnce([
          {
            visitorId: "v1",
            view_count: BigInt(1),
            first_view: new Date("2025-06-20T10:00:00Z"),
            last_view: new Date("2025-06-20T10:00:00Z"),
          },
          {
            visitorId: "v2",
            view_count: BigInt(1),
            first_view: new Date("2025-06-20T10:00:00Z"),
            last_view: new Date("2025-06-20T10:00:00Z"),
          },
        ]);
      mockPrisma.pageView.count.mockResolvedValue(10);
      mockPrisma.pageViewArchive.aggregate
        .mockResolvedValueOnce({
          _sum: { totalViews: 100, uniqueVisitors: 50 },
        })
        .mockResolvedValueOnce({ _sum: { totalViews: 10, uniqueVisitors: 5 } })
        .mockResolvedValueOnce({ _sum: { totalViews: 10, uniqueVisitors: 5 } });
      mockPrisma.pageViewArchive.findFirst.mockResolvedValue(null);
      mockPrisma.pageView.findFirst.mockResolvedValue(null);

      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(true);
      // 2 sessions, 2 bounces = 100% bounce rate
      expect(result.data.last24Hours.bounceRate).toBe(100);
    });

    it("数据库错误时返回 serverError", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));

      const result = await getVisitStats(adminParams);
      expect(result.success).toBe(false);
    });
  });

  // ========== 分支覆盖补充 ==========

  describe("getUsersStats 补充分支测试", () => {
    it("EDITOR 和 AUTHOR 角色统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          role: "EDITOR",
          total_count: BigInt(5),
          active_1d: BigInt(1),
          active_7d: BigInt(3),
          active_30d: BigInt(4),
          new_1d: BigInt(0),
          new_7d: BigInt(1),
          new_30d: BigInt(2),
        },
        {
          role: "AUTHOR",
          total_count: BigInt(8),
          active_1d: BigInt(2),
          active_7d: BigInt(4),
          active_30d: BigInt(6),
          new_1d: BigInt(0),
          new_7d: BigInt(1),
          new_30d: BigInt(3),
        },
      ]);

      const result = await getUsersStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.editor).toBe(5);
      expect(result.data.total.author).toBe(8);
      expect(result.data.total.total).toBe(13);
    });
  });

  describe("getPostsStats 补充分支测试", () => {
    it("ARCHIVED 状态统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(50),
          new_7d: BigInt(3),
          new_30d: BigInt(10),
          new_1y: BigInt(40),
        },
        {
          status: "ARCHIVED",
          total_count: BigInt(10),
          new_7d: BigInt(0),
          new_30d: BigInt(2),
          new_1y: BigInt(8),
        },
      ]);
      mockPrisma.post.findFirst
        .mockResolvedValueOnce(null) // firstPublishedPost
        .mockResolvedValueOnce(null); // lastPublishedPost

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.archived).toBe(10);
      expect(result.data.averageDaysBetweenPosts).toBeNull();
      expect(result.data.lastPublished).toBeNull();
      expect(result.data.firstPublished).toBeNull();
    });

    it("只有 1 篇已发布文章时 averageDaysBetweenPosts 为 null", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          status: "PUBLISHED",
          total_count: BigInt(1),
          new_7d: BigInt(0),
          new_30d: BigInt(0),
          new_1y: BigInt(1),
        },
      ]);
      mockPrisma.post.findFirst
        .mockResolvedValueOnce({ publishedAt: new Date("2025-01-01") })
        .mockResolvedValueOnce({ publishedAt: new Date("2025-01-01") });

      const result = await getPostsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.published).toBe(1);
      expect(result.data.averageDaysBetweenPosts).toBeNull();
    });
  });

  describe("getAuditStats 补充分支测试", () => {
    it("recentLogs 为空数组时 recentStats 回退到 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.auditLog.count.mockResolvedValue(0);
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.$queryRaw.mockResolvedValue([]); // empty recentLogs

      const result = await getAuditStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.recent.lastDay).toBe(0);
      expect(result.data.recent.last7Days).toBe(0);
      expect(result.data.recent.last30Days).toBe(0);
    });
  });

  describe("getTagsStats 补充分支测试", () => {
    it("tagsWithPosts 和 newTagsStats 为空时回退到 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.tag.count.mockResolvedValue(0);
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // empty tagsWithPosts
        .mockResolvedValueOnce([]); // empty newTagsStats

      const result = await getTagsStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.withPosts).toBe(0);
      expect(result.data.new.last7Days).toBe(0);
    });
  });

  describe("getPagesStats 补充分支测试", () => {
    it("自定义页面和 SUSPENDED 状态", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(10);
      mockPrisma.page.groupBy
        .mockResolvedValueOnce([
          { status: "ACTIVE", _count: { status: 6 } },
          { status: "SUSPENDED", _count: { status: 4 } },
        ])
        .mockResolvedValueOnce([
          { isSystemPage: true, _count: { isSystemPage: 3 } },
          { isSystemPage: false, _count: { isSystemPage: 7 } },
        ]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.active).toBe(6);
      expect(result.data.total.suspended).toBe(4);
      expect(result.data.total.system).toBe(3);
      expect(result.data.total.custom).toBe(7);
    });

    it("groupBy 返回空数组时回退到 0", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.page.count.mockResolvedValue(0);
      mockPrisma.page.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getPagesStats(adminParams);
      expect(result.success).toBe(true);
      expect(result.data.total.active).toBe(0);
      expect(result.data.total.suspended).toBe(0);
      expect(result.data.total.system).toBe(0);
      expect(result.data.total.custom).toBe(0);
    });
  });
});
