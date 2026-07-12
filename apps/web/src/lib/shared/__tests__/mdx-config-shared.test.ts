import { describe, expect, it } from "vitest";

import {
  cleanMDXSource,
  createShikiConfig,
  defaultShikiTheme,
  normalizeCodeLanguage,
  renderPlainCodeBlockHtml,
  shouldSilenceShikiError,
} from "@/lib/shared/mdx-config-shared";

describe("mdx-config-shared", () => {
  describe("defaultShikiTheme", () => {
    it("包含 light 和 dark 主题", () => {
      expect(defaultShikiTheme.light).toBe("light-plus");
      expect(defaultShikiTheme.dark).toBe("dark-plus");
    });
  });

  describe("createShikiConfig", () => {
    it("使用默认主题", () => {
      const config = createShikiConfig();
      expect(config.themes.light).toBe("light-plus");
      expect(config.themes.dark).toBe("dark-plus");
    });

    it("使用自定义主题", () => {
      const config = createShikiConfig({
        light: "github-light",
        dark: "github-dark",
      });
      expect(config.themes.light).toBe("github-light");
      expect(config.themes.dark).toBe("github-dark");
    });
  });

  describe("normalizeCodeLanguage", () => {
    it("空字符串返回 text 模式", () => {
      const result = normalizeCodeLanguage("");
      expect(result.textMode).toBe(true);
      expect(result.normalized).toBe("text");
    });

    it("undefined 返回 text 模式", () => {
      const result = normalizeCodeLanguage(undefined);
      expect(result.textMode).toBe(true);
    });

    it("text 返回 text 模式", () => {
      const result = normalizeCodeLanguage("text");
      expect(result.textMode).toBe(true);
      expect(result.normalized).toBe("text");
    });

    it("txt 返回 text 模式", () => {
      expect(normalizeCodeLanguage("txt").textMode).toBe(true);
    });

    it("plain 返回 text 模式", () => {
      expect(normalizeCodeLanguage("plain").textMode).toBe(true);
    });

    it("plaintext 返回 text 模式", () => {
      expect(normalizeCodeLanguage("plaintext").textMode).toBe(true);
    });

    it("javascript 返回非 text 模式", () => {
      const result = normalizeCodeLanguage("javascript");
      expect(result.textMode).toBe(false);
      expect(result.normalized).toBe("javascript");
    });

    it("env 别名映射到 dotenv", () => {
      const result = normalizeCodeLanguage("env");
      expect(result.normalized).toBe("dotenv");
      expect(result.textMode).toBe(false);
    });

    it("ejs 别名映射到 html", () => {
      const result = normalizeCodeLanguage("ejs");
      expect(result.normalized).toBe("html");
      expect(result.textMode).toBe(false);
    });

    it("大写语言名被转换为小写", () => {
      const result = normalizeCodeLanguage("TypeScript");
      expect(result.normalized).toBe("typescript");
    });

    it("保留 input 原始值", () => {
      const result = normalizeCodeLanguage("  JavaScript  ");
      expect(result.input).toBe("javascript");
    });
  });

  describe("shouldSilenceShikiError", () => {
    it("包含 'is not included in this bundle' 的错误返回 true", () => {
      const error = new Error("Language 'xyz' is not included in this bundle");
      expect(shouldSilenceShikiError(error)).toBe(true);
    });

    it("其他 Error 返回 false", () => {
      const error = new Error("Some other error");
      expect(shouldSilenceShikiError(error)).toBe(false);
    });

    it("非 Error 实例返回 false", () => {
      expect(shouldSilenceShikiError("string error")).toBe(false);
      expect(shouldSilenceShikiError(null)).toBe(false);
      expect(shouldSilenceShikiError(123)).toBe(false);
    });
  });

  describe("renderPlainCodeBlockHtml", () => {
    it("生成包含代码的 HTML", () => {
      const html = renderPlainCodeBlockHtml("console.log('hello')");
      expect(html).toContain("<pre");
      expect(html).toContain("<code");
      expect(html).toContain("console.log('hello')");
    });

    it("转义 HTML 特殊字符", () => {
      const html = renderPlainCodeBlockHtml('<div>&"test"</div>');
      expect(html).toContain("&lt;div&gt;");
      expect(html).toContain("&amp;");
    });

    it("空字符串不报错", () => {
      const html = renderPlainCodeBlockHtml("");
      expect(html).toContain("<pre");
      expect(html).toContain("<code");
    });
  });

  describe("cleanMDXSource", () => {
    it("移除 import 语句", () => {
      const source = `import Foo from 'bar';\n\n# Hello`;
      const result = cleanMDXSource(source);
      expect(result).not.toContain("import Foo");
      expect(result).toContain("# Hello");
    });

    it("移除多条 import 语句", () => {
      const source = `import A from 'a';\nimport B from 'b';\n\nContent`;
      const result = cleanMDXSource(source);
      expect(result).not.toContain("import A");
      expect(result).not.toContain("import B");
      expect(result).toContain("Content");
    });

    it("无 import 语句时返回原内容", () => {
      const source = "# Hello\n\nSome content";
      expect(cleanMDXSource(source)).toBe(source);
    });

    it("空字符串返回空字符串", () => {
      expect(cleanMDXSource("")).toBe("");
    });
  });
});
