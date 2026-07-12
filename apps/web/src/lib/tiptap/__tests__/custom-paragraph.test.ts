import { describe, expect, it, vi } from "vitest";

import { CustomParagraph } from "@/lib/tiptap/custom-paragraph";

function getRenderMarkdown() {
  const config = (CustomParagraph as any).config;
  return config?.renderMarkdown;
}

describe("CustomParagraph", () => {
  it("应正确创建扩展", () => {
    expect(CustomParagraph).toBeDefined();
  });

  describe("renderMarkdown", () => {
    it("左对齐应输出纯文本内容", () => {
      const renderMarkdown = getRenderMarkdown();
      expect(renderMarkdown).toBeDefined();

      const mockHelpers = {
        renderChildren: vi.fn(() => "段落内容"),
      };
      const node = { attrs: { textAlign: "left" }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe("段落内容");
    });

    it("无 textAlign 属性应输出纯文本内容", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "段落"),
      };
      const node = { attrs: {}, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe("段落");
    });

    it("居中对齐应输出 <p> 标签", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "居中段落"),
      };
      const node = { attrs: { textAlign: "center" }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe(
        '<p style="text-align: center;">居中段落</p>',
      );
    });

    it("右对齐应输出 <p> 标签", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "右对齐段落"),
      };
      const node = { attrs: { textAlign: "right" }, content: [] };
      expect(renderMarkdown(node, mockHelpers)).toBe(
        '<p style="text-align: right;">右对齐段落</p>',
      );
    });

    it("应调用 renderChildren 处理子节点", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "content"),
      };
      const node = {
        attrs: { textAlign: "left" },
        content: [{ type: "text", text: "a" }],
      };
      renderMarkdown(node, mockHelpers);
      expect(mockHelpers.renderChildren).toHaveBeenCalledWith(node.content);
    });
  });
});
