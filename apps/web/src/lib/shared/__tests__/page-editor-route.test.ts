import { describe, expect, it } from "vitest";

import {
  getPageEditorEntryPath,
  getPageEditorPathByContentType,
} from "@/lib/shared/page-editor-route";

describe("page-editor-route", () => {
  describe("getPageEditorEntryPath", () => {
    it("生成页面编辑器入口路径", () => {
      expect(getPageEditorEntryPath("123")).toBe("/admin/pages?id=123");
    });

    it("编码特殊字符", () => {
      expect(getPageEditorEntryPath("hello world")).toBe(
        "/admin/pages?id=hello%20world",
      );
    });

    it("编码中文字符", () => {
      expect(getPageEditorEntryPath("测试")).toBe(
        "/admin/pages?id=%E6%B5%8B%E8%AF%95",
      );
    });
  });

  describe("getPageEditorPathByContentType", () => {
    it("BUILDIN 类型返回入口路径", () => {
      expect(getPageEditorPathByContentType("BUILDIN", "123")).toBe(
        "/admin/pages?id=123",
      );
    });

    it("BLOCK 类型返回 block 路径", () => {
      expect(getPageEditorPathByContentType("BLOCK", "123")).toBe(
        "/admin/pages/block/123",
      );
    });

    it("MARKDOWN 类型返回 markdown 路径", () => {
      expect(getPageEditorPathByContentType("MARKDOWN", "123")).toBe(
        "/admin/pages/markdown/123",
      );
    });

    it("MDX 类型返回 mdx 路径", () => {
      expect(getPageEditorPathByContentType("MDX", "123")).toBe(
        "/admin/pages/mdx/123",
      );
    });

    it("HTML 类型返回 html 路径", () => {
      expect(getPageEditorPathByContentType("HTML", "123")).toBe(
        "/admin/pages/html/123",
      );
    });

    it("未知类型返回 html 路径（默认分支）", () => {
      expect(getPageEditorPathByContentType("UNKNOWN" as never, "123")).toBe(
        "/admin/pages/html/123",
      );
    });
  });
});
