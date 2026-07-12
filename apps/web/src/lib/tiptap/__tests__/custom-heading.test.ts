import { describe, expect, it, vi } from "vitest";

import { CustomHeading } from "@/lib/tiptap/custom-heading";

function getRenderMarkdown() {
  const config = (CustomHeading as any).config;
  return config?.renderMarkdown;
}

describe("CustomHeading", () => {
  it("应正确创建扩展", () => {
    expect(CustomHeading).toBeDefined();
  });

  describe("renderMarkdown", () => {
    it("左对齐应输出标准 Markdown 标题", () => {
      const renderMarkdown = getRenderMarkdown();
      expect(renderMarkdown).toBeDefined();

      const mockHelpers = {
        renderChildren: vi.fn(() => "标题内容"),
      };
      const node = { attrs: { level: 1, textAlign: "left" }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe("# 标题内容");
    });

    it("无 textAlign 属性应输出标准 Markdown 标题", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "标题"),
      };
      const node = { attrs: { level: 2 }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe("## 标题");
    });

    it("居中对齐应输出 HTML 标签", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "居中标题"),
      };
      const node = { attrs: { level: 2, textAlign: "center" }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe(
        '<h2 style="text-align: center;">居中标题</h2>',
      );
    });

    it("右对齐应输出 HTML 标题标签", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "右对齐"),
      };
      const node = { attrs: { level: 3, textAlign: "right" }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe(
        '<h3 style="text-align: right;">右对齐</h3>',
      );
    });

    it("不同级别应生成对应数量的 #", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "text"),
      };

      for (let level = 1; level <= 6; level++) {
        const node = { attrs: { level, textAlign: "left" }, content: [] };
        const expected = "#".repeat(level) + " text";
        expect(renderMarkdown(node, mockHelpers)).toBe(expected);
      }
    });

    it("默认 level 应为 1", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "text"),
      };
      const node = { attrs: {}, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe("# text");
    });
  });
});
