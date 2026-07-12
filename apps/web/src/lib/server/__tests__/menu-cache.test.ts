import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock 外部依赖
vi.mock("@/lib/server/prisma", () => ({
  default: {
    menu: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => Promise<unknown>) => fn),
}));

import {
  getActiveMenus,
  getActiveMenusByCategory,
  getActiveMenusForClient,
  getMenus,
  getMenusByCategory,
} from "@/lib/server/menu-cache";
import prisma from "@/lib/server/prisma";

const mockPrisma = vi.mocked(prisma);

// 辅助函数：创建测试菜单数据
function createMockDbMenu(overrides: Record<string, unknown> = {}) {
  return {
    id: "menu-1",
    name: "Home",
    icon: "home",
    link: "/",
    slug: null,
    status: "ACTIVE",
    order: 1,
    category: "MAIN",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    page: null,
    ...overrides,
  };
}

describe("menu-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // getMenus
  // =========================================================================
  describe("getMenus", () => {
    it("returns menus from database in non-production environment", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "menu-1",
          name: "Home",
          order: 1,
          category: "MAIN",
        }),
        createMockDbMenu({
          id: "menu-2",
          name: "About",
          link: "/about",
          order: 2,
          category: "MAIN",
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenus();

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("Home");
      expect(result[1]!.name).toBe("About");
      expect(mockPrisma.menu.findMany).toHaveBeenCalledWith({
        orderBy: [{ category: "asc" }, { order: "asc" }, { createdAt: "asc" }],
        include: { page: true },
      });
    });

    it("returns empty array when database query fails", async () => {
      (mockPrisma.menu.findMany as any).mockRejectedValue(
        new Error("DB connection failed"),
      );

      const result = await getMenus();

      expect(result).toEqual([]);
    });

    it("includes page data when menu has associated page", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "menu-with-page",
          name: "Blog",
          slug: "blog",
          page: {
            id: "page-1",
            title: "Blog Page",
            slug: "/blog",
            content: "Blog content",
            config: null,
            status: "ACTIVE",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            isSystemPage: false,
            metaDescription: "Blog page",
            metaKeywords: "blog, posts",
            robotsIndex: true,
            userUid: 1,
          },
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenus();

      expect(result[0]!.page).not.toBeNull();
      expect(result[0]!.page?.title).toBe("Blog Page");
      expect(result[0]!.page?.slug).toBe("/blog");
      expect(result[0]!.page?.content).toBe("Blog content");
    });

    it("sets page to null when menu has no associated page", async () => {
      const dbMenus = [createMockDbMenu({ page: null })];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenus();

      expect(result[0]!.page).toBeNull();
    });

    it("returns correct date objects", async () => {
      const createdAt = new Date("2024-03-15T10:00:00Z");
      const updatedAt = new Date("2024-06-20T15:30:00Z");
      const dbMenus = [createMockDbMenu({ createdAt, updatedAt })];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenus();

      expect(result[0]!.createdAt).toEqual(createdAt);
      expect(result[0]!.updatedAt).toEqual(updatedAt);
    });
  });

  // =========================================================================
  // getMenusByCategory
  // =========================================================================
  describe("getMenusByCategory", () => {
    it("returns only MAIN category menus", async () => {
      const dbMenus = [
        createMockDbMenu({ id: "1", name: "Home", category: "MAIN" }),
        createMockDbMenu({ id: "2", name: "Settings", category: "COMMON" }),
        createMockDbMenu({ id: "3", name: "About", category: "MAIN" }),
        createMockDbMenu({ id: "4", name: "External", category: "OUTSITE" }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenusByCategory("MAIN");

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.category === "MAIN")).toBe(true);
    });

    it("returns only COMMON category menus", async () => {
      const dbMenus = [
        createMockDbMenu({ id: "1", name: "Home", category: "MAIN" }),
        createMockDbMenu({ id: "2", name: "Settings", category: "COMMON" }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenusByCategory("COMMON");

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Settings");
    });

    it("returns empty array when no menus match category", async () => {
      const dbMenus = [
        createMockDbMenu({ id: "1", name: "Home", category: "MAIN" }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getMenusByCategory("OUTSITE");

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getActiveMenus
  // =========================================================================
  describe("getActiveMenus", () => {
    it("returns only ACTIVE menus", async () => {
      const dbMenus = [
        createMockDbMenu({ id: "1", name: "Visible", status: "ACTIVE" }),
        createMockDbMenu({ id: "2", name: "Hidden", status: "SUSPENDED" }),
        createMockDbMenu({ id: "3", name: "Also Visible", status: "ACTIVE" }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenus();

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.status === "ACTIVE")).toBe(true);
    });

    it("returns empty array when all menus are suspended", async () => {
      const dbMenus = [
        createMockDbMenu({ id: "1", name: "Hidden", status: "SUSPENDED" }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenus();

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getActiveMenusByCategory
  // =========================================================================
  describe("getActiveMenusByCategory", () => {
    it("filters by both category and ACTIVE status", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "1",
          name: "Active Main",
          category: "MAIN",
          status: "ACTIVE",
        }),
        createMockDbMenu({
          id: "2",
          name: "Suspended Main",
          category: "MAIN",
          status: "SUSPENDED",
        }),
        createMockDbMenu({
          id: "3",
          name: "Active Common",
          category: "COMMON",
          status: "ACTIVE",
        }),
        createMockDbMenu({
          id: "4",
          name: "Another Active Main",
          category: "MAIN",
          status: "ACTIVE",
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenusByCategory("MAIN");

      expect(result).toHaveLength(2);
      expect(
        result.every((m) => m.category === "MAIN" && m.status === "ACTIVE"),
      ).toBe(true);
    });

    it("returns empty when no menus match both criteria", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "1",
          name: "Suspended Main",
          category: "MAIN",
          status: "SUSPENDED",
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenusByCategory("MAIN");

      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getActiveMenusForClient
  // =========================================================================
  describe("getActiveMenusForClient", () => {
    it("returns client-safe menu items without page content", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "menu-1",
          name: "Blog",
          icon: "blog",
          link: null,
          slug: "blog",
          order: 1,
          category: "MAIN",
          status: "ACTIVE",
          page: {
            id: "page-1",
            title: "Blog Page with long content",
            slug: "/blog",
            content: "Very long content that should not be included",
            config: { complex: "object" },
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
            isSystemPage: false,
            metaDescription: null,
            metaKeywords: null,
            robotsIndex: true,
            userUid: 1,
          },
        }),
        createMockDbMenu({
          id: "menu-2",
          name: "Home",
          icon: "home",
          link: "/",
          slug: null,
          order: 2,
          category: "MAIN",
          status: "ACTIVE",
          page: null,
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenusForClient();

      expect(result).toHaveLength(2);

      // 带页面的菜单项应只包含 slug
      expect(result[0]!.page).toEqual({ slug: "/blog" });
      // 不应包含 title, content 等
      expect(result[0]!.page).not.toHaveProperty("title");
      expect(result[0]!.page).not.toHaveProperty("content");

      // 不带页面的菜单项应返回 null
      expect(result[1]!.page).toBeNull();

      // 应该包含基本字段
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("name");
      expect(result[0]).toHaveProperty("icon");
      expect(result[0]).toHaveProperty("link");
      expect(result[0]).toHaveProperty("slug");
      expect(result[0]).toHaveProperty("order");
      expect(result[0]).toHaveProperty("category");
    });

    it("only includes ACTIVE menus", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "1",
          name: "Active",
          status: "ACTIVE",
        }),
        createMockDbMenu({
          id: "2",
          name: "Suspended",
          status: "SUSPENDED",
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenusForClient();

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Active");
    });

    it("returns empty array when no active menus exist", async () => {
      const dbMenus = [createMockDbMenu({ id: "1", status: "SUSPENDED" })];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenusForClient();

      expect(result).toEqual([]);
    });

    it("handles menus with page containing null optional fields", async () => {
      const dbMenus = [
        createMockDbMenu({
          id: "menu-minimal",
          name: "Minimal",
          status: "ACTIVE",
          page: {
            id: "page-minimal",
            title: "Minimal Page",
            slug: "/minimal",
            content: "",
            config: null,
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
            isSystemPage: false,
            metaDescription: null,
            metaKeywords: null,
            robotsIndex: false,
            userUid: null,
          },
        }),
      ];
      (mockPrisma.menu.findMany as any).mockResolvedValue(dbMenus);

      const result = await getActiveMenusForClient();

      expect(result[0]!.page).toEqual({ slug: "/minimal" });
    });
  });

  // ==================== 补充分支覆盖测试 ====================

  describe("getMenusByCategory 补充测试", () => {
    it("返回 FOOTER 分类菜单", async () => {
      (mockPrisma.menu.findMany as any).mockResolvedValue([
        createMockDbMenu({ id: "1", name: "Footer Menu", category: "FOOTER" }),
      ]);

      const result = await getMenusByCategory("FOOTER" as any);

      expect(result).toHaveLength(1);
      expect(result[0]!.category).toBe("FOOTER");
    });
  });

  describe("getActiveMenus 补充测试", () => {
    it("混合状态时只返回 ACTIVE", async () => {
      (mockPrisma.menu.findMany as any).mockResolvedValue([
        createMockDbMenu({ id: "1", name: "Active", status: "ACTIVE" }),
        createMockDbMenu({ id: "2", name: "Suspended", status: "SUSPENDED" }),
        createMockDbMenu({ id: "3", name: "Active2", status: "ACTIVE" }),
      ]);

      const result = await getActiveMenus();

      expect(result).toHaveLength(2);
      expect(result.every((m) => m.status === "ACTIVE")).toBe(true);
    });
  });
});
