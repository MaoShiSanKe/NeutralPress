import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_COLOR_CONFIG,
  getSiteColorTokens,
  getSitePrimaryColor,
  normalizeSiteColorConfig,
  SITE_COLOR_TOKEN_TO_CSS_VARIABLE,
} from "@/lib/shared/site-color";

describe("site-color", () => {
  describe("SITE_COLOR_TOKEN_TO_CSS_VARIABLE", () => {
    it("包含所有 token 的 CSS 变量映射", () => {
      expect(SITE_COLOR_TOKEN_TO_CSS_VARIABLE.background).toBe(
        "--color-background",
      );
      expect(SITE_COLOR_TOKEN_TO_CSS_VARIABLE.primary).toBe("--color-primary");
      expect(SITE_COLOR_TOKEN_TO_CSS_VARIABLE.foreground).toBe(
        "--color-foreground",
      );
    });
  });

  describe("normalizeSiteColorConfig", () => {
    it("null 返回默认配置", () => {
      const result = normalizeSiteColorConfig(null);
      expect(result).toEqual(DEFAULT_SITE_COLOR_CONFIG);
    });

    it("undefined 返回默认配置", () => {
      const result = normalizeSiteColorConfig(undefined);
      expect(result).toEqual(DEFAULT_SITE_COLOR_CONFIG);
    });

    it("非对象返回默认配置", () => {
      expect(normalizeSiteColorConfig("invalid")).toEqual(
        DEFAULT_SITE_COLOR_CONFIG,
      );
      expect(normalizeSiteColorConfig(123)).toEqual(DEFAULT_SITE_COLOR_CONFIG);
    });

    it("新格式配置（light/dark 结构）正确解析", () => {
      const config = {
        light: { primary: "#ff0000" },
        dark: { primary: "#00ff00" },
      };
      const result = normalizeSiteColorConfig(config);
      expect(result.light.primary).toBe("#ff0000");
      expect(result.dark.primary).toBe("#00ff00");
      // 未指定的值使用默认值
      expect(result.light.background).toBe(
        DEFAULT_SITE_COLOR_CONFIG.light.background,
      );
    });

    it("旧格式配置（legacy 结构）正确解析", () => {
      const config = {
        primary: "#ff0000",
        background: { light: "#ffffff", dark: "#000000" },
        muted: { light: "#f0f0f0", dark: "#1a1a1a" },
      };
      const result = normalizeSiteColorConfig(config);
      expect(result.light.primary).toBe("#ff0000");
      expect(result.dark.primary).toBe("#ff0000");
      expect(result.light.background).toBe("#ffffff");
      expect(result.dark.background).toBe("#000000");
    });

    it("空对象返回默认配置", () => {
      const result = normalizeSiteColorConfig({});
      // 空对象走 legacy 分支，但所有字段都缺失，使用默认值
      expect(result.light.primary).toBe(
        DEFAULT_SITE_COLOR_CONFIG.light.primary,
      );
    });
  });

  describe("getSiteColorTokens", () => {
    it("获取 light 模式的 tokens", () => {
      const tokens = getSiteColorConfig(null, "light");
      expect(tokens).toEqual(DEFAULT_SITE_COLOR_CONFIG.light);
    });

    it("获取 dark 模式的 tokens", () => {
      const tokens = getSiteColorConfig(null, "dark");
      expect(tokens).toEqual(DEFAULT_SITE_COLOR_CONFIG.dark);
    });

    it("自定义配置正确覆盖", () => {
      const config = {
        light: { primary: "#custom" },
        dark: { primary: "#dark-custom" },
      };
      const lightTokens = getSiteColorTokens(config, "light");
      const darkTokens = getSiteColorTokens(config, "dark");
      expect(lightTokens.primary).toBe("#custom");
      expect(darkTokens.primary).toBe("#dark-custom");
    });
  });

  describe("getSitePrimaryColor", () => {
    it("默认 light 模式返回默认主色", () => {
      expect(getSitePrimaryColor(null)).toBe(
        DEFAULT_SITE_COLOR_CONFIG.light.primary,
      );
    });

    it("指定 dark 模式返回暗色主色", () => {
      expect(getSitePrimaryColor(null, "dark")).toBe(
        DEFAULT_SITE_COLOR_CONFIG.dark.primary,
      );
    });

    it("自定义配置返回自定义主色", () => {
      const config = { light: { primary: "#abc123" } };
      expect(getSitePrimaryColor(config)).toBe("#abc123");
    });
  });
});

// 辅助函数（修复上面的拼写错误）
function getSiteColorConfig(siteColor: unknown, mode: "light" | "dark") {
  return getSiteColorTokens(siteColor, mode);
}
