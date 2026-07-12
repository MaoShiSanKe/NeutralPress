import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

// Mock block catalog
const mockGetBlockDefinition = vi.fn();
vi.mock("@/blocks/core/catalog", () => ({
  getBlockDefinition: mockGetBlockDefinition,
}));

// Mock block definition types (just need to exist)
vi.mock("@/blocks/core/definition", () => ({}));

// Mock shared lib
const mockExtractParsedPlaceholdersFromValue = vi.fn();
vi.mock("@/blocks/core/lib/shared", () => ({
  extractParsedPlaceholdersFromValue: mockExtractParsedPlaceholdersFromValue,
}));

// Mock pipeline
const mockResolveSingleBlock = vi.fn();
vi.mock("@/blocks/core/runtime/pipeline", () => ({
  resolveSingleBlock: mockResolveSingleBlock,
}));

describe("block-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlockDefinition.mockReturnValue(null);
    mockExtractParsedPlaceholdersFromValue.mockReturnValue([]);
    mockResolveSingleBlock.mockResolvedValue({
      id: 1,
      block: "hero",
      resolvedData: {},
    });
  });

  describe("getBlockCacheTags", () => {
    it("应返回包含 pageId 的标签", async () => {
      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "hero", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("pages/page-1");
      expect(tags).toContain("block/page-1/1");
    });

    it("当没有 pageId 时不应包含页面标签", async () => {
      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "hero", content: {} },
      });

      expect(tags).not.toContain(expect.stringContaining("pages/"));
      expect(tags).not.toContain(expect.stringContaining("block/"));
    });

    it("应包含来自 block definition 的依赖标签", async () => {
      mockGetBlockDefinition.mockReturnValue({
        cache: {
          tags: ["custom-tag-1", "custom-tag-2"],
        },
        capabilities: {},
      });

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "hero", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("custom-tag-1");
      expect(tags).toContain("custom-tag-2");
    });

    it("应处理 block definition 的 tags 为函数的情况", async () => {
      mockGetBlockDefinition.mockReturnValue({
        cache: {
          tags: vi.fn().mockReturnValue(["dynamic-tag"]),
        },
        capabilities: {},
      });

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "hero", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("dynamic-tag");
    });

    it("当 block definition 的 tags 函数抛出异常时应返回空标签", async () => {
      mockGetBlockDefinition.mockReturnValue({
        cache: {
          tags: vi.fn().mockImplementation(() => {
            throw new Error("Tag resolution failed");
          }),
        },
        capabilities: {},
      });

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "hero", content: {} },
        pageId: "page-1",
      });

      // 应仍然包含 pageId 相关标签
      expect(tags).toContain("pages/page-1");
    });

    it("当 block 有 media 能力时应包含 photos 标签", async () => {
      mockGetBlockDefinition.mockReturnValue({
        capabilities: {
          media: ["image/jpeg"],
        },
      });

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "gallery", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("photos");
    });

    it("应包含 placeholder 映射的静态标签", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "posts", params: {} },
        { name: "categories", params: {} },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("posts/list");
      expect(tags).toContain("categories/list");
    });

    it("应包含 placeholder 动态标签（category 类型带 slug）", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "category", params: { slug: "tech" } },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("categories/tech");
    });

    it("应包含 placeholder 动态标签（tag 类型带 slug）", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "tagName", params: { slug: "react" } },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("tags/react");
    });

    it("应处理 pageInfo placeholder 的 category-detail 页面类型", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "pageInfo", params: { page: "category-detail", slug: "tech" } },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("categories/tech");
    });

    it("应处理 pageInfo placeholder 的 tag-index 页面类型", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "pageInfo", params: { page: "tag-index" } },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("tags/list");
    });

    it("应处理 pageInfo placeholder 的 posts-index 页面类型", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "pageInfo", params: { page: "posts-index" } },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      expect(tags).toContain("posts/list");
    });

    it("应从 pageContext 中获取 slug", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "category", params: {} },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
        pageContext: { slug: "frontend" },
      });

      expect(tags).toContain("categories/frontend");
    });

    it("应返回去重后的标签数组", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([
        { name: "posts", params: {} },
        { name: "postsList", params: {} },
      ]);

      const { getBlockCacheTags } = await import("@/lib/server/block-cache");

      const tags = getBlockCacheTags({
        block: { id: 1, block: "text", content: {} },
        pageId: "page-1",
      });

      const postsListTags = tags.filter((t) => t === "posts/list");
      expect(postsListTags).toHaveLength(1);
    });
  });

  describe("buildPageCacheTagsForBlocks", () => {
    it("应包含 pageId 标签", async () => {
      const { buildPageCacheTagsForBlocks } = await import(
        "@/lib/server/block-cache"
      );

      const tags = buildPageCacheTagsForBlocks({
        pageId: "home",
        blocks: [],
      });

      expect(tags).toContain("pages/home");
    });

    it("应收集所有 blocks 的依赖标签", async () => {
      mockExtractParsedPlaceholdersFromValue.mockReturnValue([]);

      const { buildPageCacheTagsForBlocks } = await import(
        "@/lib/server/block-cache"
      );

      const tags = buildPageCacheTagsForBlocks({
        pageId: "home",
        blocks: [
          { id: 1, block: "hero", content: {} },
          { id: 2, block: "text", content: {} },
        ],
      });

      expect(tags).toContain("pages/home");
    });

    it("应处理空 blocks 数组", async () => {
      const { buildPageCacheTagsForBlocks } = await import(
        "@/lib/server/block-cache"
      );

      const tags = buildPageCacheTagsForBlocks({
        pageId: "home",
        blocks: [],
      });

      expect(tags).toContain("pages/home");
      expect(tags).toHaveLength(1);
    });
  });

  describe("resolveSingleBlockWithCache", () => {
    it("当 disableCache 为 true 时应直接调用 resolveSingleBlock", async () => {
      const { resolveSingleBlockWithCache } = await import(
        "@/lib/server/block-cache"
      );

      const block = { id: 1, block: "hero", content: {} };
      const resolved = { id: 1, block: "hero", resolvedData: {} };
      mockResolveSingleBlock.mockResolvedValueOnce(resolved);

      const result = await resolveSingleBlockWithCache({
        block,
        pageId: "page-1",
        disableCache: true,
      });

      expect(result).toEqual(resolved);
      expect(mockResolveSingleBlock).toHaveBeenCalledWith(block, undefined);
    });

    it("当没有 pageId 时应直接调用 resolveSingleBlock", async () => {
      const { resolveSingleBlockWithCache } = await import(
        "@/lib/server/block-cache"
      );

      const block = { id: 1, block: "hero", content: {} };
      const resolved = { id: 1, block: "hero", resolvedData: {} };
      mockResolveSingleBlock.mockResolvedValueOnce(resolved);

      const result = await resolveSingleBlockWithCache({
        block,
        pageContext: { slug: "test" },
      });

      expect(result).toEqual(resolved);
    });

    it("应传递 pageContext 给 resolver", async () => {
      const { resolveSingleBlockWithCache } = await import(
        "@/lib/server/block-cache"
      );

      const block = { id: 1, block: "hero", content: {} };
      const context = { slug: "test", pageId: "home" };
      mockResolveSingleBlock.mockResolvedValueOnce(block);

      await resolveSingleBlockWithCache({
        block,
        pageId: "page-1",
        pageContext: context,
        disableCache: true,
      });

      expect(mockResolveSingleBlock).toHaveBeenCalledWith(block, context);
    });
  });
});
