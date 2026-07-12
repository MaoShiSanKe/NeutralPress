import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateUniqueSlug,
  isValidSlug,
  sanitizeUserSlug,
  slugify,
} from "@/lib/server/slugify";

// Mock getConfig to control segment mode
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: vi.fn(),
}));

import { getConfig } from "@/lib/server/config-cache";

const mockGetConfig = vi.mocked(getConfig);

describe("slugify utilities", () => {
  describe("isValidSlug", () => {
    it("accepts valid slugs", () => {
      expect(isValidSlug("hello-world")).toBe(true);
      expect(isValidSlug("test-123")).toBe(true);
      expect(isValidSlug("a")).toBe(true);
      expect(isValidSlug("hello-world-foo")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(isValidSlug("")).toBe(false);
      expect(isValidSlug("-hello")).toBe(false);
      expect(isValidSlug("hello-")).toBe(false);
      expect(isValidSlug("Hello")).toBe(false);
      expect(isValidSlug("hello world")).toBe(false);
      expect(isValidSlug("hello--world")).toBe(false);
      expect(isValidSlug("hello_world")).toBe(false);
    });

    it("handles non-string input", () => {
      expect(isValidSlug(null as unknown as string)).toBe(false);
      expect(isValidSlug(undefined as unknown as string)).toBe(false);
      expect(isValidSlug(123 as unknown as string)).toBe(false);
    });
  });

  describe("generateUniqueSlug", () => {
    it("returns base slug when no conflict", () => {
      expect(generateUniqueSlug("hello-world", new Set())).toBe("hello-world");
      expect(generateUniqueSlug("test", [])).toBe("test");
    });

    it("appends counter when conflict exists", () => {
      expect(generateUniqueSlug("hello-world", new Set(["hello-world"]))).toBe(
        "hello-world-1",
      );
    });

    it("increments counter until unique", () => {
      expect(
        generateUniqueSlug("hello", new Set(["hello", "hello-1", "hello-2"])),
      ).toBe("hello-3");
    });

    it("works with array input", () => {
      expect(generateUniqueSlug("test", ["test", "test-1"])).toBe("test-2");
    });
  });

  describe("sanitizeUserSlug", () => {
    it("converts to lowercase", () => {
      expect(sanitizeUserSlug("HelloWorld")).toBe("helloworld");
    });

    it("replaces spaces with hyphens", () => {
      expect(sanitizeUserSlug("hello world")).toBe("hello-world");
    });

    it("replaces underscores with hyphens", () => {
      expect(sanitizeUserSlug("hello_world")).toBe("hello-world");
    });

    it("removes special characters", () => {
      expect(sanitizeUserSlug("hello@world!")).toBe("helloworld");
    });

    it("collapses multiple hyphens", () => {
      expect(sanitizeUserSlug("hello---world")).toBe("hello-world");
    });

    it("trims leading and trailing hyphens", () => {
      expect(sanitizeUserSlug("-hello-")).toBe("hello");
    });

    it("handles empty input", () => {
      expect(sanitizeUserSlug("")).toBe("");
      expect(sanitizeUserSlug(null as unknown as string)).toBe("");
      expect(sanitizeUserSlug(undefined as unknown as string)).toBe("");
    });

    it("handles complex cases", () => {
      expect(sanitizeUserSlug("  Hello World! @#$  ")).toBe("hello-world");
    });
  });

  describe("slugify", () => {
    it("returns empty string for empty input", async () => {
      expect(await slugify("")).toBe("");
    });

    it("returns empty string for non-string input", async () => {
      expect(await slugify(null as unknown as string)).toBe("");
      expect(await slugify(undefined as unknown as string)).toBe("");
    });

    it("returns empty string for whitespace-only input", async () => {
      expect(await slugify("   ")).toBe("");
    });

    describe("without segment mode", () => {
      beforeEach(() => {
        mockGetConfig.mockResolvedValue(false);
      });

      it("converts Chinese text to pinyin slug", async () => {
        const result = await slugify("你好世界");
        expect(result).toBeTruthy();
        expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });

      it("converts English text to lowercase slug", async () => {
        expect(await slugify("Hello World")).toBe("hello-world");
      });

      it("handles mixed Chinese and English text", async () => {
        const result = await slugify("Hello你好World");
        expect(result).toBeTruthy();
        expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(result).toContain("hello");
        expect(result).toContain("world");
      });

      it("removes special characters", async () => {
        expect(await slugify("Hello! World?")).toBe("hello-world");
      });

      it("trims whitespace", async () => {
        expect(await slugify("  hello world  ")).toBe("hello-world");
      });

      it("collapses multiple hyphens", async () => {
        const result = await slugify("hello---world");
        expect(result).not.toContain("--");
      });

      it("strips leading and trailing hyphens", async () => {
        const result = await slugify("!hello!");
        expect(result).toBe("hello");
      });

      it("handles numbers", async () => {
        expect(await slugify("test 123")).toBe("test-123");
      });

      it("handles Chinese article title", async () => {
        const result = await slugify("这是一篇文章");
        expect(result).toBeTruthy();
        expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        // Should contain pinyin
        expect(result).toContain("zhe");
      });

      it("handles Chinese punctuation", async () => {
        const result = await slugify("你好，世界！");
        expect(result).toBeTruthy();
        expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });
    });

    describe("with segment mode", () => {
      beforeEach(() => {
        mockGetConfig.mockResolvedValue(true);
      });

      it("converts Chinese text to segmented pinyin slug", async () => {
        const result = await slugify("这是一篇文章");
        expect(result).toBeTruthy();
        expect(result).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      });

      it("converts English text to lowercase slug", async () => {
        expect(await slugify("Hello World")).toBe("hello-world");
      });

      it("handles numbers in segment mode", async () => {
        expect(await slugify("test 123")).toBe("test-123");
      });
    });
  });
});
