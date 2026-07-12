import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock the pipeline resolver
const mockResolveSingleBlock = vi.fn();
vi.mock("@/blocks/core/runtime/pipeline", () => ({
  resolveSingleBlock: mockResolveSingleBlock,
}));

// Mock the block-cache resolver
const mockResolveSingleBlockWithCache = vi.fn();
vi.mock("@/lib/server/block-cache", () => ({
  resolveSingleBlockWithCache: mockResolveSingleBlockWithCache,
}));

describe("block-data-resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resolveSingleBlockData", () => {
    it("delegates to resolveSingleBlock from pipeline", async () => {
      const { resolveSingleBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const mockBlock = {
        id: 1,
        block: "hero" as const,
        title: "Test",
      };
      const mockResolved = {
        id: 1,
        block: "hero" as const,
        title: "Test",
        resolvedData: { posts: [] },
      };

      mockResolveSingleBlock.mockResolvedValue(mockResolved);

      const result = await resolveSingleBlockData(mockBlock as any);
      expect(result).toEqual(mockResolved);
      expect(mockResolveSingleBlock).toHaveBeenCalledWith(mockBlock, undefined);
    });

    it("passes pageContext to resolver", async () => {
      const { resolveSingleBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const block = { id: 1, block: "hero" as const };
      const context = { pageId: "test-page" };

      mockResolveSingleBlock.mockResolvedValue(block);

      await resolveSingleBlockData(block as any, context);
      expect(mockResolveSingleBlock).toHaveBeenCalledWith(block, context);
    });
  });

  describe("resolveBlockData", () => {
    it("returns null for null input", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );
      const result = await resolveBlockData(null);
      expect(result).toBeNull();
    });

    it("returns config as-is when blocks array is empty", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );
      const config = { blocks: [], title: "test" };
      const result = await resolveBlockData(config);
      expect(result).toEqual(config);
    });

    it("returns config as-is when blocks is undefined", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );
      const config = { title: "test" };
      const result = await resolveBlockData(config);
      expect(result).toEqual(config);
    });

    it("resolves all blocks with cache", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const blocks = [
        { id: 1, block: "hero" as const },
        { id: 2, block: "text" as const },
      ];
      const config = { blocks };

      mockResolveSingleBlockWithCache
        .mockResolvedValueOnce({ id: 1, block: "hero", resolved: true })
        .mockResolvedValueOnce({ id: 2, block: "text", resolved: true });

      const result = await resolveBlockData(config as any);
      expect(result!.blocks).toHaveLength(2);
      expect(result!.blocks![0]).toEqual({
        id: 1,
        block: "hero",
        resolved: true,
      });
      expect(result!.blocks![1]).toEqual({
        id: 2,
        block: "text",
        resolved: true,
      });
    });

    it("passes pageContext and options to cache resolver", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const blocks = [{ id: 1, block: "hero" as const }];
      const config = { blocks };
      const context = { pageId: "home" };
      const options = { pageId: "page-1", disableCache: true };

      mockResolveSingleBlockWithCache.mockResolvedValue({
        id: 1,
        block: "hero",
      });

      await resolveBlockData(config as any, context, options);
      expect(mockResolveSingleBlockWithCache).toHaveBeenCalledWith({
        block: blocks[0],
        pageId: "page-1",
        pageContext: context,
        disableCache: true,
      });
    });

    it("uses config.data as fallback pageContext", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const blocks = [{ id: 1, block: "hero" as const }];
      const config = { blocks, data: { key: "value" } };

      mockResolveSingleBlockWithCache.mockResolvedValue({
        id: 1,
        block: "hero",
      });

      await resolveBlockData(config as any);
      expect(mockResolveSingleBlockWithCache).toHaveBeenCalledWith({
        block: blocks[0],
        pageId: undefined,
        pageContext: { key: "value" },
        disableCache: undefined,
      });
    });

    it("preserves non-blocks fields in config", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const config = {
        blocks: [{ id: 1, block: "hero" as const }],
        title: "My Page",
        metadata: { author: "test" },
      };

      mockResolveSingleBlockWithCache.mockResolvedValue({
        id: 1,
        block: "hero",
      });

      const result = await resolveBlockData(config as any);
      expect(result!.title).toBe("My Page");
      expect(result!.metadata).toEqual({ author: "test" });
    });

    it("当 blocks 为 undefined 时应返回原始 config", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const config = { title: "No blocks config" };
      const result = await resolveBlockData(config as any);

      expect(result).toEqual(config);
      expect(mockResolveSingleBlockWithCache).not.toHaveBeenCalled();
    });

    it("当传入 disableCache 为 false 时应正确传递", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const blocks = [{ id: 1, block: "hero" as const }];
      const config = { blocks };

      mockResolveSingleBlockWithCache.mockResolvedValue({
        id: 1,
        block: "hero",
      });

      await resolveBlockData(config as any, undefined, {
        pageId: "test",
        disableCache: false,
      });

      expect(mockResolveSingleBlockWithCache).toHaveBeenCalledWith({
        block: blocks[0],
        pageId: "test",
        pageContext: {},
        disableCache: false,
      });
    });

    it("应能处理多个 blocks 的并行解析", async () => {
      const { resolveBlockData } = await import(
        "@/lib/server/block-data-resolver"
      );

      const blocks = [
        { id: 1, block: "hero" as const },
        { id: 2, block: "text" as const },
        { id: 3, block: "image" as const },
      ];
      const config = { blocks };

      mockResolveSingleBlockWithCache
        .mockResolvedValueOnce({ id: 1, block: "hero", resolved: true })
        .mockResolvedValueOnce({ id: 2, block: "text", resolved: true })
        .mockResolvedValueOnce({ id: 3, block: "image", resolved: true });

      const result = await resolveBlockData(config as any);

      expect(result!.blocks).toHaveLength(3);
      expect(mockResolveSingleBlockWithCache).toHaveBeenCalledTimes(3);
    });
  });
});
