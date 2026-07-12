import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock post-access
vi.mock("@/lib/server/post-access", () => ({
  LISTABLE_POST_PUBLISHED_WHERE: { deletedAt: null, status: "PUBLISHED" },
}));

// Mock unstable_cache to just call the inner function
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

// Mock Prisma
const mockPrisma = {
  category: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
  },
  post: {
    count: vi.fn(),
  },
};

vi.mock("@/lib/server/prisma", () => ({
  default: mockPrisma,
}));

describe("category-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildCategoryTree", () => {
    it("builds a tree from flat categories", async () => {
      const { buildCategoryTree } = await import("@/lib/server/category-utils");

      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 1,
          slug: "tech",
          name: "Tech",
          description: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 5 },
        },
        {
          id: 2,
          slug: "web",
          name: "Web",
          description: null,
          parentId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 3 },
        },
        {
          id: 3,
          slug: "frontend",
          name: "Frontend",
          description: null,
          parentId: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 1 },
        },
      ]);

      const tree = await buildCategoryTree(null);
      expect(tree).toHaveLength(1);
      expect(tree[0]!.id).toBe(1);
      expect(tree[0]!.children).toHaveLength(1);
      expect(tree[0]!.children[0]!.id).toBe(2);
      expect(tree[0]!.children[0]!.children).toHaveLength(1);
      expect(tree[0]!.children[0]!.children[0]!.id).toBe(3);
    });

    it("returns empty array when no categories exist", async () => {
      const { buildCategoryTree } = await import("@/lib/server/category-utils");
      mockPrisma.category.findMany.mockResolvedValue([]);

      const tree = await buildCategoryTree(null);
      expect(tree).toEqual([]);
    });

    it("handles multiple root categories", async () => {
      const { buildCategoryTree } = await import("@/lib/server/category-utils");

      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 1,
          slug: "tech",
          name: "Tech",
          description: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 5 },
        },
        {
          id: 2,
          slug: "life",
          name: "Life",
          description: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 2 },
        },
      ]);

      const tree = await buildCategoryTree(null);
      expect(tree).toHaveLength(2);
      expect(tree[0]!.slug).toBe("tech");
      expect(tree[1]!.slug).toBe("life");
    });

    it("applies maxDepth filter", async () => {
      const { buildCategoryTree } = await import("@/lib/server/category-utils");

      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 1,
          slug: "tech",
          name: "Tech",
          description: null,
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 5 },
        },
        {
          id: 2,
          slug: "web",
          name: "Web",
          description: null,
          parentId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 3 },
        },
        {
          id: 3,
          slug: "frontend",
          name: "Frontend",
          description: null,
          parentId: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 1 },
        },
      ]);

      // maxDepth=1 means only the root level (depth 0) should be returned
      const tree = await buildCategoryTree(null, 1);
      expect(tree).toHaveLength(1);
      expect(tree[0]!.children).toEqual([]);
    });

    it("builds subtree from a specific parent", async () => {
      const { buildCategoryTree } = await import("@/lib/server/category-utils");

      // Mock finding parent path
      mockPrisma.category.findUnique.mockResolvedValue({ path: "1" });

      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: 2,
          slug: "web",
          name: "Web",
          description: null,
          parentId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 3 },
        },
        {
          id: 3,
          slug: "frontend",
          name: "Frontend",
          description: null,
          parentId: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { posts: 1 },
        },
      ]);

      const tree = await buildCategoryTree(1);
      expect(tree).toHaveLength(1);
      expect(tree[0]!.id).toBe(2);
      expect(tree[0]!.children).toHaveLength(1);
    });
  });

  describe("validateCategoryMove", () => {
    it("returns false when moving to top level", async () => {
      const { validateCategoryMove } = await import(
        "@/lib/server/category-utils"
      );
      const result = await validateCategoryMove(1, null);
      expect(result).toBe(false);
    });

    it("returns true when moving to self (circular)", async () => {
      const { validateCategoryMove } = await import(
        "@/lib/server/category-utils"
      );
      const result = await validateCategoryMove(5, 5);
      expect(result).toBe(true);
    });

    it("returns false when new parent does not exist", async () => {
      const { validateCategoryMove } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const result = await validateCategoryMove(1, 999);
      expect(result).toBe(false);
    });

    it("returns true when moving under a descendant (circular)", async () => {
      const { validateCategoryMove } = await import(
        "@/lib/server/category-utils"
      );
      // Category 1 has path "1/2/3", so 3 is a descendant of 1
      mockPrisma.category.findUnique.mockResolvedValue({ path: "1/2/3" });

      const result = await validateCategoryMove(1, 3);
      expect(result).toBe(true);
    });

    it("returns false when moving under a non-descendant", async () => {
      const { validateCategoryMove } = await import(
        "@/lib/server/category-utils"
      );
      // Category 5 has path "4/5", which doesn't contain 1
      mockPrisma.category.findUnique.mockResolvedValue({ path: "4/5" });

      const result = await validateCategoryMove(1, 5);
      expect(result).toBe(false);
    });
  });

  describe("getCategoryPath", () => {
    it("returns path slugs for a category with ancestors", async () => {
      const { getCategoryPath } = await import("@/lib/server/category-utils");

      mockPrisma.category.findUnique.mockResolvedValue({
        slug: "frontend",
        path: "1/2/3",
      });

      mockPrisma.category.findMany.mockResolvedValue([
        { id: 1, slug: "tech" },
        { id: 2, slug: "web" },
      ]);

      const path = await getCategoryPath(3);
      expect(path).toEqual(["tech", "web", "frontend"]);
    });

    it("returns single slug for root category", async () => {
      const { getCategoryPath } = await import("@/lib/server/category-utils");

      mockPrisma.category.findUnique.mockResolvedValue({
        slug: "tech",
        path: "1",
      });

      const path = await getCategoryPath(1);
      expect(path).toEqual(["tech"]);
    });

    it("returns empty array for non-existent category", async () => {
      const { getCategoryPath } = await import("@/lib/server/category-utils");
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const path = await getCategoryPath(999);
      expect(path).toEqual([]);
    });
  });

  describe("getCategoryNamePath", () => {
    it("returns name path for a category with ancestors", async () => {
      const { getCategoryNamePath } = await import(
        "@/lib/server/category-utils"
      );

      mockPrisma.category.findUnique.mockResolvedValue({
        name: "Frontend",
        path: "1/2/3",
      });

      mockPrisma.category.findMany.mockResolvedValue([
        { id: 1, name: "Technology" },
        { id: 2, name: "Web Development" },
      ]);

      const path = await getCategoryNamePath(3);
      expect(path).toEqual(["Technology", "Web Development", "Frontend"]);
    });

    it("returns single name for root category", async () => {
      const { getCategoryNamePath } = await import(
        "@/lib/server/category-utils"
      );

      mockPrisma.category.findUnique.mockResolvedValue({
        name: "Technology",
        path: "1",
      });

      const path = await getCategoryNamePath(1);
      expect(path).toEqual(["Technology"]);
    });

    it("returns empty array for non-existent category", async () => {
      const { getCategoryNamePath } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const path = await getCategoryNamePath(999);
      expect(path).toEqual([]);
    });
  });

  describe("getAllDescendantIds", () => {
    it("returns descendant IDs using path prefix", async () => {
      const { getAllDescendantIds } = await import(
        "@/lib/server/category-utils"
      );

      mockPrisma.category.findUnique.mockResolvedValue({ path: "1" });
      mockPrisma.category.findMany.mockResolvedValue([
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);

      const ids = await getAllDescendantIds(1);
      expect(ids).toEqual([2, 3, 4]);
    });

    it("returns empty array when category has no descendants", async () => {
      const { getAllDescendantIds } = await import(
        "@/lib/server/category-utils"
      );

      mockPrisma.category.findUnique.mockResolvedValue({ path: "1/2/3" });
      mockPrisma.category.findMany.mockResolvedValue([]);

      const ids = await getAllDescendantIds(3);
      expect(ids).toEqual([]);
    });

    it("returns empty array for non-existent category", async () => {
      const { getAllDescendantIds } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const ids = await getAllDescendantIds(999);
      expect(ids).toEqual([]);
    });
  });

  describe("calculateCategoryDepth", () => {
    it("returns the depth from database", async () => {
      const { calculateCategoryDepth } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findUnique.mockResolvedValue({ depth: 3 });

      const depth = await calculateCategoryDepth(1);
      expect(depth).toBe(3);
    });

    it("returns 0 for non-existent category", async () => {
      const { calculateCategoryDepth } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const depth = await calculateCategoryDepth(999);
      expect(depth).toBe(0);
    });
  });

  describe("findCategoryByPath", () => {
    it("returns null for empty path", async () => {
      const { findCategoryByPath } = await import(
        "@/lib/server/category-utils"
      );
      const result = await findCategoryByPath([]);
      expect(result).toBeNull();
    });

    it("finds category by fullSlug", async () => {
      const { findCategoryByPath } = await import(
        "@/lib/server/category-utils"
      );
      const mockCategory = {
        id: 3,
        slug: "frontend",
        name: "Frontend",
        description: null,
        parentId: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await findCategoryByPath(["tech", "web", "frontend"]);
      expect(result).toEqual(mockCategory);
      expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({
        where: { fullSlug: "tech/web/frontend" },
        select: expect.any(Object),
      });
    });

    it("returns null for non-existent path", async () => {
      const { findCategoryByPath } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const result = await findCategoryByPath(["nonexistent"]);
      expect(result).toBeNull();
    });
  });

  describe("checkCategoryUniqueness", () => {
    it("returns both false when no conflicts", async () => {
      const { checkCategoryUniqueness } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findFirst.mockResolvedValue(null);

      const result = await checkCategoryUniqueness(
        "New Name",
        "new-slug",
        null,
      );
      expect(result).toEqual({ slugExists: false, nameExists: false });
    });

    it("returns slugExists when slug conflicts", async () => {
      const { checkCategoryUniqueness } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findFirst
        .mockResolvedValueOnce({ id: 1 }) // slug found
        .mockResolvedValueOnce(null); // name not found

      const result = await checkCategoryUniqueness(
        "New Name",
        "existing-slug",
        null,
      );
      expect(result.slugExists).toBe(true);
      expect(result.nameExists).toBe(false);
    });

    it("returns nameExists when name conflicts", async () => {
      const { checkCategoryUniqueness } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findFirst
        .mockResolvedValueOnce(null) // slug not found
        .mockResolvedValueOnce({ id: 2 }); // name found

      const result = await checkCategoryUniqueness(
        "Existing Name",
        "new-slug",
        null,
      );
      expect(result.slugExists).toBe(false);
      expect(result.nameExists).toBe(true);
    });

    it("excludes specified ID from check", async () => {
      const { checkCategoryUniqueness } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await checkCategoryUniqueness("Name", "slug", null, 5);
      expect(mockPrisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 5 },
          }),
        }),
      );
    });
  });

  describe("countCategoryPosts", () => {
    it("counts posts including descendants", async () => {
      const { countCategoryPosts } = await import(
        "@/lib/server/category-utils"
      );

      // Mock getAllDescendantIds
      mockPrisma.category.findUnique.mockResolvedValue({ path: "1" });
      mockPrisma.category.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }]);
      mockPrisma.post.count.mockResolvedValue(10);

      const count = await countCategoryPosts(1);
      expect(count).toBe(10);
      expect(mockPrisma.post.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          categories: { some: { id: { in: [1, 2, 3] } } },
          deletedAt: null,
        }),
      });
    });
  });

  describe("countDirectChildren", () => {
    it("counts direct children", async () => {
      const { countDirectChildren } = await import(
        "@/lib/server/category-utils"
      );
      mockPrisma.category.count.mockResolvedValue(3);

      const count = await countDirectChildren(1);
      expect(count).toBe(3);
      expect(mockPrisma.category.count).toHaveBeenCalledWith({
        where: { parentId: 1 },
      });
    });
  });

  describe("batchGetCategoryPaths", () => {
    it("returns empty map for empty input", async () => {
      const { batchGetCategoryPaths } = await import(
        "@/lib/server/category-utils"
      );
      const result = await batchGetCategoryPaths([]);
      expect(result.size).toBe(0);
    });

    it("builds path map for multiple categories", async () => {
      const { batchGetCategoryPaths } = await import(
        "@/lib/server/category-utils"
      );

      mockPrisma.category.findMany
        .mockResolvedValueOnce([
          {
            id: 3,
            path: "1/2/3",
            name: "Frontend",
            slug: "frontend",
            parentId: 2,
          },
        ])
        .mockResolvedValueOnce([
          { id: 1, name: "Tech", slug: "tech" },
          { id: 2, name: "Web", slug: "web" },
        ]);

      const result = await batchGetCategoryPaths([3]);
      expect(result.has(3)).toBe(true);

      const path = result.get(3)!;
      expect(path).toHaveLength(3);
      expect(path[0]!.name).toBe("Tech");
      expect(path[1]!.name).toBe("Web");
      expect(path[2]!.name).toBe("Frontend");
    });
  });
});
