import { describe, expect, it, vi } from "vitest";

import {
  HighlightWithMarkdown,
  SubscriptWithMarkdown,
  SuperscriptWithMarkdown,
  TextAlignWithMarkdown,
  UnderlineWithMarkdown,
} from "@/lib/tiptap/markdown-extensions";

function getRenderMarkdown(ext: { config?: Record<string, unknown> }) {
  return ext.config?.renderMarkdown as (
    node: { content?: unknown[] },
    helpers: { renderChildren: (nodes: unknown) => string },
  ) => string;
}

describe("markdown-extensions", () => {
  describe("UnderlineWithMarkdown", () => {
    it("应导出自定义下划线扩展", () => {
      expect(UnderlineWithMarkdown).toBeDefined();
      expect(UnderlineWithMarkdown.name).toBe("underline");
    });
  });

  describe("HighlightWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(HighlightWithMarkdown).toBeDefined();
    });

    it("renderMarkdown 应序列化为 <mark> 标签", () => {
      const renderMarkdown = getRenderMarkdown(HighlightWithMarkdown as any);
      expect(renderMarkdown).toBeDefined();

      const mockHelpers = { renderChildren: vi.fn(() => "高亮文本") };
      const result = renderMarkdown({ content: [] }, mockHelpers);
      expect(result).toBe("<mark>高亮文本</mark>");
    });
  });

  describe("SuperscriptWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(SuperscriptWithMarkdown).toBeDefined();
    });

    it("renderMarkdown 应序列化为 <sup> 标签", () => {
      const renderMarkdown = getRenderMarkdown(SuperscriptWithMarkdown as any);
      expect(renderMarkdown).toBeDefined();

      const mockHelpers = { renderChildren: vi.fn(() => "上标") };
      const result = renderMarkdown({ content: [] }, mockHelpers);
      expect(result).toBe("<sup>上标</sup>");
    });
  });

  describe("SubscriptWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(SubscriptWithMarkdown).toBeDefined();
    });

    it("renderMarkdown 应序列化为 <sub> 标签", () => {
      const renderMarkdown = getRenderMarkdown(SubscriptWithMarkdown as any);
      expect(renderMarkdown).toBeDefined();

      const mockHelpers = { renderChildren: vi.fn(() => "下标") };
      const result = renderMarkdown({ content: [] }, mockHelpers);
      expect(result).toBe("<sub>下标</sub>");
    });
  });

  describe("TextAlignWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(TextAlignWithMarkdown).toBeDefined();
    });
  });
});
