import { describe, expect, it } from "vitest";

import { normalizeBlockIds } from "@/lib/server/block-normalize";

describe("block-normalize", () => {
  describe("normalizeBlockIds", () => {
    it("returns null for null input", () => {
      expect(normalizeBlockIds(null)).toBeNull();
    });

    it("returns non-object input as-is", () => {
      expect(
        normalizeBlockIds(undefined as unknown as Record<string, unknown>),
      ).toBeUndefined();
    });

    it("returns config without blocks field unchanged", () => {
      const config = { title: "test", description: "desc" };
      const result = normalizeBlockIds(config);
      expect(result).toEqual({ title: "test", description: "desc" });
    });

    it("returns config with non-array blocks unchanged", () => {
      const config = { blocks: "not-an-array" };
      const result = normalizeBlockIds(config);
      expect(result).toEqual({ blocks: "not-an-array" });
    });

    it("reassigns sequential IDs starting from 1", () => {
      const config = {
        blocks: [
          { id: 999, block: "hero" },
          { id: 42, block: "text" },
          { id: 0, block: "divider" },
        ],
      };
      const result = normalizeBlockIds(config) as { blocks: { id: number }[] };
      expect(result.blocks[0]!.id).toBe(1);
      expect(result.blocks[1]!.id).toBe(2);
      expect(result.blocks[2]!.id).toBe(3);
    });

    it("removes data field from blocks", () => {
      const config = {
        blocks: [
          { id: 1, block: "hero", data: { title: "Hello", items: [1, 2, 3] } },
          { id: 2, block: "text", content: "world" },
        ],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      expect(result.blocks[0]!).not.toHaveProperty("data");
      expect(result.blocks[1]!).not.toHaveProperty("data");
    });

    it("preserves other block properties", () => {
      const config = {
        blocks: [
          { id: 500, block: "hero", title: "Welcome", description: "desc" },
        ],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      expect(result.blocks[0]!.block).toBe("hero");
      expect(result.blocks[0]!.title).toBe("Welcome");
      expect(result.blocks[0]!.description).toBe("desc");
    });

    it("preserves non-blocks fields in config", () => {
      const config = {
        title: "Page Title",
        metadata: { key: "value" },
        blocks: [{ id: 10, block: "text" }],
      };
      const result = normalizeBlockIds(config) as Record<string, unknown>;
      expect(result.title).toBe("Page Title");
      expect(result.metadata).toEqual({ key: "value" });
    });

    it("does not mutate the original config", () => {
      const config = {
        blocks: [{ id: 100, block: "hero", data: { x: 1 } }],
      };
      const original = JSON.parse(JSON.stringify(config));
      normalizeBlockIds(config);
      expect(config).toEqual(original);
    });

    it("handles empty blocks array", () => {
      const config = { blocks: [] };
      const result = normalizeBlockIds(config) as { blocks: unknown[] };
      expect(result.blocks).toEqual([]);
    });

    it("handles single block", () => {
      const config = {
        blocks: [{ id: 50, block: "hero", data: { a: 1 } }],
      };
      const result = normalizeBlockIds(config) as { blocks: { id: number }[] };
      expect(result.blocks[0]!.id).toBe(1);
    });

    it("handles blocks with no data field gracefully", () => {
      const config = {
        blocks: [{ id: 1, block: "text", content: "hello" }],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      expect(result.blocks[0]!.id).toBe(1);
      expect(result.blocks[0]!.content).toBe("hello");
      expect(result.blocks[0]!).not.toHaveProperty("data");
    });

    it("handles deeply nested data objects in blocks", () => {
      const config = {
        blocks: [
          {
            id: 1,
            block: "hero",
            data: {
              nested: { deeply: { value: [1, 2, 3] } },
              arr: [{ a: 1 }, { b: 2 }],
            },
          },
        ],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      expect(result.blocks[0]!).not.toHaveProperty("data");
    });

    it("handles large number of blocks", () => {
      const blocks = Array.from({ length: 100 }, (_, i) => ({
        id: i * 10,
        block: "text",
        content: `Block ${i}`,
      }));
      const config = { blocks };
      const result = normalizeBlockIds(config) as { blocks: { id: number }[] };

      for (let i = 0; i < 100; i++) {
        expect(result.blocks[i]!.id).toBe(i + 1);
      }
    });

    it("handles blocks with null data field", () => {
      const config = {
        blocks: [{ id: 1, block: "text", data: null }],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      expect(result.blocks[0]!).not.toHaveProperty("data");
    });

    it("handles blocks with undefined data field", () => {
      const config = {
        blocks: [{ id: 1, block: "text", data: undefined }],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      expect(result.blocks[0]!).not.toHaveProperty("data");
    });

    it("handles config with extra nested properties", () => {
      const config = {
        title: "Page",
        slug: "page-slug",
        metadata: {
          seo: { title: "SEO Title", description: "SEO Desc" },
          custom: { key: "value" },
        },
        blocks: [{ id: 5, block: "hero", data: { x: 1 } }],
      };
      const result = normalizeBlockIds(config) as Record<string, unknown>;

      expect(result.title).toBe("Page");
      expect(result.slug).toBe("page-slug");
      expect((result.metadata as any).seo.title).toBe("SEO Title");
      expect(result.blocks).toHaveLength(1);
      expect((result.blocks as any[])[0].id).toBe(1);
    });

    it("应保留 blocks 中除 data 外的所有属性", () => {
      const config = {
        blocks: [
          {
            id: 100,
            block: "hero",
            data: { remove: "me" },
            title: "Keep",
            description: "Also keep",
            content: "Keep too",
            customField: 42,
          },
        ],
      };
      const result = normalizeBlockIds(config) as {
        blocks: Record<string, unknown>[];
      };
      const block = result.blocks[0]!;

      expect(block.id).toBe(1);
      expect(block.block).toBe("hero");
      expect(block.title).toBe("Keep");
      expect(block.description).toBe("Also keep");
      expect(block.content).toBe("Keep too");
      expect(block.customField).toBe(42);
      expect(block).not.toHaveProperty("data");
    });
  });
});
