import { describe, expect, it, vi } from "vitest";

import {
  TableCellWithMarkdown,
  TableHeaderWithMarkdown,
  TableRowWithMarkdown,
  TableWithMarkdown,
} from "@/lib/tiptap/table-with-markdown";

function getRenderMarkdown(ext: { config?: Record<string, unknown> }) {
  return ext.config?.renderMarkdown as (
    node: { content?: unknown[] },
    helpers: { renderChildren: (nodes: unknown) => string },
  ) => string;
}

describe("table-with-markdown", () => {
  describe("TableWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(TableWithMarkdown).toBeDefined();
    });

    describe("renderMarkdown", () => {
      it("空表格应返回空字符串", () => {
        const renderMarkdown = getRenderMarkdown(TableWithMarkdown as any);
        expect(renderMarkdown).toBeDefined();

        const mockHelpers = { renderChildren: vi.fn(() => "") };
        expect(renderMarkdown({ content: [] }, mockHelpers)).toBe("");
      });

      it("无 content 应返回空字符串", () => {
        const renderMarkdown = getRenderMarkdown(TableWithMarkdown as any);
        const mockHelpers = { renderChildren: vi.fn(() => "") };
        expect(renderMarkdown({}, mockHelpers)).toBe("");
      });

      it("应正确渲染基本表格", () => {
        const renderMarkdown = getRenderMarkdown(TableWithMarkdown as any);
        const cellTexts = ["A", "B", "C", "D"];
        let callIndex = 0;
        const mockHelpers = {
          renderChildren: vi.fn(() => cellTexts[callIndex++] || ""),
        };

        const node = {
          content: [
            {
              // 第一行（表头）
              content: [
                { attrs: {}, content: [] },
                { attrs: {}, content: [] },
              ],
            },
            {
              // 第二行
              content: [
                { attrs: {}, content: [] },
                { attrs: {}, content: [] },
              ],
            },
          ],
        };

        const result = renderMarkdown(node, mockHelpers);
        const lines = result.split("\n");

        // 应有 3 行：表头 + 分隔行 + 数据行
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe("| A | B |");
        expect(lines[2]).toBe("| C | D |");
      });

      it("应为居中对齐列生成 :------: 分隔符", () => {
        const renderMarkdown = getRenderMarkdown(TableWithMarkdown as any);
        let callIndex = 0;
        const mockHelpers = {
          renderChildren: vi.fn(
            () => ["H1", "H2", "D1", "D2"][callIndex++] || "",
          ),
        };

        const node = {
          content: [
            {
              content: [
                { attrs: { textAlign: "center" }, content: [] },
                { attrs: {}, content: [] },
              ],
            },
            {
              content: [
                { attrs: {}, content: [] },
                { attrs: {}, content: [] },
              ],
            },
          ],
        };

        const result = renderMarkdown(node, mockHelpers);
        const lines = result.split("\n");
        expect(lines[1]).toBe("| :------: | -------- |");
      });

      it("应为右对齐列生成 -------: 分隔符", () => {
        const renderMarkdown = getRenderMarkdown(TableWithMarkdown as any);
        let callIndex = 0;
        const mockHelpers = {
          renderChildren: vi.fn(
            () => ["H1", "H2", "D1", "D2"][callIndex++] || "",
          ),
        };

        const node = {
          content: [
            {
              content: [
                { attrs: { textAlign: "right" }, content: [] },
                { attrs: {}, content: [] },
              ],
            },
            {
              content: [
                { attrs: {}, content: [] },
                { attrs: {}, content: [] },
              ],
            },
          ],
        };

        const result = renderMarkdown(node, mockHelpers);
        const lines = result.split("\n");
        expect(lines[1]).toBe("| -------: | -------- |");
      });

      it("空单元格应渲染为空格", () => {
        const renderMarkdown = getRenderMarkdown(TableWithMarkdown as any);
        const mockHelpers = {
          renderChildren: vi.fn(() => ""),
        };

        const node = {
          content: [
            {
              content: [{ attrs: {}, content: [] }],
            },
          ],
        };

        const result = renderMarkdown(node, mockHelpers);
        expect(result).toContain("|   |");
      });
    });
  });

  describe("TableCellWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(TableCellWithMarkdown).toBeDefined();
    });
  });

  describe("TableHeaderWithMarkdown", () => {
    it("应正确创建扩展", () => {
      expect(TableHeaderWithMarkdown).toBeDefined();
    });
  });

  describe("TableRowWithMarkdown", () => {
    it("应正确导出", () => {
      expect(TableRowWithMarkdown).toBeDefined();
    });
  });
});
