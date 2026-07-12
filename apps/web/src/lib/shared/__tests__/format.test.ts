import { describe, expect, it } from "vitest";

import { calculateCompressionRatio, formatBytes } from "@/lib/shared/format";

describe("format", () => {
  describe("formatBytes", () => {
    it("0 字节返回 '0 B'", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("格式化字节", () => {
      expect(formatBytes(500)).toBe("500.00 B");
    });

    it("格式化 KB", () => {
      expect(formatBytes(1024)).toBe("1.00 KB");
    });

    it("格式化 MB", () => {
      expect(formatBytes(1048576)).toBe("1.00 MB");
    });

    it("格式化 GB", () => {
      expect(formatBytes(1073741824)).toBe("1.00 GB");
    });

    it("格式化带小数的值", () => {
      const result = formatBytes(1536); // 1.5 KB
      expect(result).toBe("1.50 KB");
    });

    it("格式化大数值", () => {
      const result = formatBytes(5368709120); // 5 GB
      expect(result).toBe("5.00 GB");
    });
  });

  describe("calculateCompressionRatio", () => {
    it("压缩 30% 显示为 '-30.0%'", () => {
      expect(calculateCompressionRatio(1000, 700)).toBe("-30.0%");
    });

    it("体积增大 10% 显示为 '+10.0%'", () => {
      expect(calculateCompressionRatio(1000, 1100)).toBe("+10.0%");
    });

    it("大小不变显示为 '+0.0%'", () => {
      expect(calculateCompressionRatio(1000, 1000)).toBe("+0.0%");
    });

    it("完全压缩显示为 '-100.0%'", () => {
      expect(calculateCompressionRatio(1000, 0)).toBe("-100.0%");
    });

    it("处理小数值", () => {
      const result = calculateCompressionRatio(1000, 850);
      expect(result).toBe("-15.0%");
    });
  });
});
