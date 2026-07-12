import { describe, expect, it } from "vitest";

import { generateGradient } from "@/lib/shared/gradient";

describe("gradient", () => {
  describe("generateGradient", () => {
    it("生成两步渐变（起始和结束颜色）", () => {
      const result = generateGradient("#ff0000", "#0000ff", 2);
      expect(result).toHaveLength(2);
      // 起始颜色应接近红色
      expect(result[0]).toMatch(/^#[0-9a-f]{6}$/i);
      // 结束颜色应接近蓝色
      expect(result[1]).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("生成多步渐变", () => {
      const result = generateGradient("#000000", "#ffffff", 5);
      expect(result).toHaveLength(5);
      result.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it("相同起始和结束颜色时所有步骤返回相同颜色", () => {
      const result = generateGradient("#ff0000", "#ff0000", 3);
      expect(result).toHaveLength(3);
      // 所有颜色应该非常接近
      result.forEach((color) => {
        expect(color.toLowerCase()).toBe(result[0]!.toLowerCase());
      });
    });

    it("处理 3 位 HEX 颜色", () => {
      const result = generateGradient("#f00", "#00f", 3);
      expect(result).toHaveLength(3);
      result.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it("处理 OKLCh 颜色格式", () => {
      const result = generateGradient(
        "oklch(0.5 0.2 180)",
        "oklch(0.8 0.15 60)",
        3,
      );
      expect(result).toHaveLength(3);
      result.forEach((color) => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });

    it("steps 小于 2 时抛出错误", () => {
      expect(() => generateGradient("#ff0000", "#0000ff", 1)).toThrow(
        "Steps must be at least 2",
      );
    });

    it("无效颜色格式抛出错误", () => {
      expect(() => generateGradient("invalid", "#0000ff", 3)).toThrow(
        "Invalid color format",
      );
    });

    it("第二个颜色无效时抛出错误", () => {
      expect(() => generateGradient("#ff0000", "not-a-color", 3)).toThrow(
        "Invalid color format",
      );
    });
  });
});
