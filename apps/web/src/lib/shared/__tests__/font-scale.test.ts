import { describe, expect, it } from "vitest";

import {
  DEFAULT_SITE_FONT_SCALE_PERCENT,
  MAX_SITE_FONT_SCALE_PERCENT,
  MIN_SITE_FONT_SCALE_PERCENT,
  normalizeSiteFontScalePercent,
  siteFontScalePercentToMultiplier,
} from "@/lib/shared/font-scale";

describe("font-scale", () => {
  describe("常量", () => {
    it("默认字体缩放为 100%", () => {
      expect(DEFAULT_SITE_FONT_SCALE_PERCENT).toBe(100);
    });

    it("最小字体缩放为 50%", () => {
      expect(MIN_SITE_FONT_SCALE_PERCENT).toBe(50);
    });

    it("最大字体缩放为 200%", () => {
      expect(MAX_SITE_FONT_SCALE_PERCENT).toBe(200);
    });
  });

  describe("normalizeSiteFontScalePercent", () => {
    it("正常值保持不变", () => {
      expect(normalizeSiteFontScalePercent(120)).toBe(120);
    });

    it("默认值（100）", () => {
      expect(normalizeSiteFontScalePercent(100)).toBe(100);
    });

    it("低于最小值时钳制到最小值", () => {
      expect(normalizeSiteFontScalePercent(30)).toBe(50);
    });

    it("高于最大值时钳制到最大值", () => {
      expect(normalizeSiteFontScalePercent(300)).toBe(200);
    });

    it("四舍五入到整数", () => {
      expect(normalizeSiteFontScalePercent(120.6)).toBe(121);
      expect(normalizeSiteFontScalePercent(120.4)).toBe(120);
    });

    it("NaN 返回默认值", () => {
      expect(normalizeSiteFontScalePercent(NaN)).toBe(100);
    });

    it("Infinity 返回默认值", () => {
      expect(normalizeSiteFontScalePercent(Infinity)).toBe(100);
    });

    it("字符串数字正确解析", () => {
      expect(normalizeSiteFontScalePercent("150")).toBe(150);
    });

    it("无效字符串返回默认值", () => {
      expect(normalizeSiteFontScalePercent("abc")).toBe(100);
    });

    it("null 转换为 0 后钳制到最小值", () => {
      // Number(null) === 0，是有限数，会被钳制到最小值 50
      expect(normalizeSiteFontScalePercent(null)).toBe(50);
    });

    it("undefined 返回默认值", () => {
      expect(normalizeSiteFontScalePercent(undefined)).toBe(100);
    });
  });

  describe("siteFontScalePercentToMultiplier", () => {
    it("100% 转换为 1.0", () => {
      expect(siteFontScalePercentToMultiplier(100)).toBe(1);
    });

    it("150% 转换为 1.5", () => {
      expect(siteFontScalePercentToMultiplier(150)).toBe(1.5);
    });

    it("50% 转换为 0.5", () => {
      expect(siteFontScalePercentToMultiplier(50)).toBe(0.5);
    });

    it("超出范围的值先钳制再转换", () => {
      expect(siteFontScalePercentToMultiplier(300)).toBe(2);
      expect(siteFontScalePercentToMultiplier(10)).toBe(0.5);
    });

    it("无效值使用默认值转换", () => {
      expect(siteFontScalePercentToMultiplier("invalid")).toBe(1);
    });
  });
});
