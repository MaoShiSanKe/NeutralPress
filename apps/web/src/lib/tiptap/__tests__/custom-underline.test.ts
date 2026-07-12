import { describe, expect, it, vi } from "vitest";

import { CustomUnderline } from "@/lib/tiptap/custom-underline";

// 获取扩展配置中的 markdownTokenizer
// Tiptap 扩展在创建时会将配置存储在内部
function getTokenizer() {
  const config = (CustomUnderline as any).config;
  return config?.markdownTokenizer;
}

function getRenderMarkdown() {
  const config = (CustomUnderline as any).config;
  return config?.renderMarkdown;
}

describe("CustomUnderline", () => {
  it("应正确创建扩展", () => {
    expect(CustomUnderline).toBeDefined();
    expect(CustomUnderline.name).toBe("underline");
  });

  describe("markdownTokenizer", () => {
    it("应存在 tokenizer 配置", () => {
      const tokenizer = getTokenizer();
      expect(tokenizer).toBeDefined();
      expect(tokenizer.name).toBe("underline");
      expect(tokenizer.level).toBe("inline");
    });

    describe("start", () => {
      it("应返回 ++ 的位置", () => {
        const tokenizer = getTokenizer();
        expect(tokenizer.start("hello ++world++")).toBe(6);
      });

      it("应返回 <u> 的位置", () => {
        const tokenizer = getTokenizer();
        expect(tokenizer.start("hello <u>world</u>")).toBe(6);
      });

      it("应返回较早出现的位置", () => {
        const tokenizer = getTokenizer();
        // ++ 在位置 3，<u> 在位置 10
        expect(tokenizer.start("ab ++cd++ <u>ef</u>")).toBe(3);
        // <u> 在位置 2，++ 在位置 12
        expect(tokenizer.start("ab<u>cd</u> ++ef++")).toBe(2);
      });

      it("无匹配时应返回 -1", () => {
        const tokenizer = getTokenizer();
        expect(tokenizer.start("hello world")).toBe(-1);
      });
    });

    describe("tokenize", () => {
      const mockLexer = {
        inlineTokens: vi.fn((text: string) => [{ type: "text", raw: text }]),
      };

      it("应匹配 <u> 标签", () => {
        const tokenizer = getTokenizer();
        const result = tokenizer.tokenize(
          "<u>underlined text</u>",
          [],
          mockLexer,
        );
        expect(result).toBeDefined();
        expect(result.type).toBe("underline");
        expect(result.text).toBe("underlined text");
        expect(result.raw).toBe("<u>underlined text</u>");
      });

      it("应匹配 ++ 语法", () => {
        const tokenizer = getTokenizer();
        const result = tokenizer.tokenize("++underlined++", [], mockLexer);
        expect(result).toBeDefined();
        expect(result.type).toBe("underline");
        expect(result.text).toBe("underlined");
        expect(result.raw).toBe("++underlined++");
      });

      it("不匹配时应返回 undefined", () => {
        const tokenizer = getTokenizer();
        const result = tokenizer.tokenize("plain text", [], mockLexer);
        expect(result).toBeUndefined();
      });

      it("应调用 lexer.inlineTokens 处理内部内容", () => {
        const tokenizer = getTokenizer();
        mockLexer.inlineTokens.mockClear();
        tokenizer.tokenize("<u>test</u>", [], mockLexer);
        expect(mockLexer.inlineTokens).toHaveBeenCalledWith("test");
      });

      it("++ 语法应去除内部内容的首尾空白", () => {
        const tokenizer = getTokenizer();
        const result = tokenizer.tokenize("++  spaced  ++", [], mockLexer);
        expect(result).toBeDefined();
        expect(result.text).toBe("spaced");
      });
    });
  });

  describe("renderMarkdown", () => {
    it("应将内容序列化为 <u> 标签", () => {
      const renderMarkdown = getRenderMarkdown();
      expect(renderMarkdown).toBeDefined();

      const mockHelpers = {
        renderChildren: vi.fn(() => "underlined content"),
      };
      const result = renderMarkdown(
        { content: [{ type: "text", text: "test" }] },
        mockHelpers,
      );
      expect(result).toBe("<u>underlined content</u>");
    });

    it("应调用 renderChildren 处理子节点", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => "child"),
      };
      const node = { content: [{ type: "text", text: "a" }] };
      renderMarkdown(node, mockHelpers);
      expect(mockHelpers.renderChildren).toHaveBeenCalledWith(node.content);
    });

    it("空内容应渲染为空的 <u> 标签", () => {
      const renderMarkdown = getRenderMarkdown();
      const mockHelpers = {
        renderChildren: vi.fn(() => ""),
      };
      const result = renderMarkdown({ content: [] }, mockHelpers);
      expect(result).toBe("<u></u>");
    });
  });
});
