import { describe, expect, it } from "vitest";

import {
  prepareRichTextSource,
  stripLeadingMarkdownH1,
} from "@/lib/shared/rich-text-source";

describe("rich-text-source", () => {
  describe("stripLeadingMarkdownH1", () => {
    it("移除 ATX 格式的 h1 标题", () => {
      const source = "# Title\n\nContent here";
      const result = stripLeadingMarkdownH1(source);
      expect(result).not.toContain("# Title");
      expect(result).toContain("Content here");
    });

    it("不移除非 h1 的 ATX 标题", () => {
      const source = "## Subtitle\n\nContent";
      const result = stripLeadingMarkdownH1(source);
      expect(result).toBe(source);
    });

    it("移除 Setext 格式的 h1 标题", () => {
      const source = "Title\n=====\n\nContent here";
      const result = stripLeadingMarkdownH1(source);
      expect(result).not.toContain("Title");
      expect(result).not.toContain("=====");
      expect(result).toContain("Content here");
    });

    it("不移除 Setext h2 标题", () => {
      const source = "Subtitle\n-----\n\nContent";
      const result = stripLeadingMarkdownH1(source);
      expect(result).toBe(source);
    });

    it("跳过代码块中的 h1", () => {
      const source = "```\n# Not a heading\n```\n\n# Real Heading\n\nContent";
      const result = stripLeadingMarkdownH1(source);
      // 代码块中的 # 不是标题，Real Heading 是 h1 应被移除
      expect(result).toContain("# Not a heading");
      expect(result).not.toContain("# Real Heading");
    });

    it("无 h1 时返回原文本", () => {
      const source = "## Subtitle\n\nParagraph";
      expect(stripLeadingMarkdownH1(source)).toBe(source);
    });

    it("空字符串返回空字符串", () => {
      expect(stripLeadingMarkdownH1("")).toBe("");
    });

    it("仅包含 h1 时移除后返回空", () => {
      const result = stripLeadingMarkdownH1("# Only Title");
      expect(result.trim()).toBe("");
    });

    it("h1 前有空行时仍能正确移除", () => {
      const source = "\n\n# Title\n\nContent";
      const result = stripLeadingMarkdownH1(source);
      expect(result).not.toContain("# Title");
      expect(result).toContain("Content");
    });
  });

  describe("prepareRichTextSource", () => {
    it("skipFirstH1 为 true 且 mode 为 markdown 时移除 h1", () => {
      const source = "# Title\n\nContent";
      const result = prepareRichTextSource(source, "markdown", {
        skipFirstH1: true,
      });
      expect(result).not.toContain("# Title");
      expect(result).toContain("Content");
    });

    it("skipFirstH1 为 true 且 mode 为 mdx 时移除 h1", () => {
      const source = "# Title\n\nContent";
      const result = prepareRichTextSource(source, "mdx", {
        skipFirstH1: true,
      });
      expect(result).not.toContain("# Title");
    });

    it("skipFirstH1 为 true 但 mode 为 html 时不处理", () => {
      const source = "<h1>Title</h1><p>Content</p>";
      const result = prepareRichTextSource(source, "html", {
        skipFirstH1: true,
      });
      expect(result).toBe(source);
    });

    it("skipFirstH1 为 false 时不处理", () => {
      const source = "# Title\n\nContent";
      const result = prepareRichTextSource(source, "markdown", {
        skipFirstH1: false,
      });
      expect(result).toBe(source);
    });

    it("无 options 时不处理", () => {
      const source = "# Title\n\nContent";
      const result = prepareRichTextSource(source, "markdown");
      expect(result).toBe(source);
    });
  });
});
