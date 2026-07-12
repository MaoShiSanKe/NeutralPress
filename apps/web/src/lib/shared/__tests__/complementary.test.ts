import { describe, expect, it } from "vitest";

import { generateComplementary } from "@/lib/shared/complementary";

describe("complementary", () => {
  describe("generateComplementary", () => {
    it("红色的互补色是青色", () => {
      const result = generateComplementary("#ff0000");
      expect(result).toBe("#00ffff");
    });

    it("蓝色的互补色是黄色", () => {
      const result = generateComplementary("#0000ff");
      expect(result).toBe("#ffff00");
    });

    it("绿色的互补色是洋红", () => {
      const result = generateComplementary("#00ff00");
      expect(result).toBe("#ff00ff");
    });

    it("黑色的互补色是白色", () => {
      const result = generateComplementary("#000000");
      expect(result).toBe("#ffffff");
    });

    it("白色的互补色是黑色", () => {
      const result = generateComplementary("#ffffff");
      expect(result).toBe("#000000");
    });

    it("灰色的互补色仍是灰色", () => {
      const result = generateComplementary("#808080");
      expect(result).toBe("#7f7f7f");
    });

    it("处理 3 位 HEX 颜色", () => {
      const result = generateComplementary("#f00");
      expect(result).toBe("#00ffff");
    });

    it("结果是有效的 HEX 颜色格式", () => {
      const result = generateComplementary("#3b82f6");
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
