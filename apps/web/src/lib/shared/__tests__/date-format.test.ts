import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatDateTimeLocale,
  formatDateTimeWithSeconds,
  formatDateWithDots,
  isDateString,
} from "@/lib/shared/date-format";

describe("date-format", () => {
  const testDate = new Date("2024-11-25T14:30:55Z");

  describe("formatDate", () => {
    it("格式化日期为 zh-CN 格式", () => {
      const result = formatDate(testDate);
      expect(result).toContain("2024");
      expect(result).toContain("11");
      expect(result).toContain("25");
    });

    it("null 返回默认 fallback", () => {
      expect(formatDate(null)).toBe("-");
    });

    it("undefined 返回默认 fallback", () => {
      expect(formatDate(undefined)).toBe("-");
    });

    it("自定义 fallback", () => {
      expect(formatDate(null, "N/A")).toBe("N/A");
    });

    it("接受字符串日期", () => {
      const result = formatDate("2024-01-01");
      expect(result).toContain("2024");
    });
  });

  describe("formatDateWithDots", () => {
    it("使用点号分隔日期", () => {
      const result = formatDateWithDots(testDate);
      expect(result).toContain(".");
      expect(result).toContain("2024");
    });

    it("null 返回默认 fallback", () => {
      expect(formatDateWithDots(null)).toBe("-");
    });

    it("自定义 fallback", () => {
      expect(formatDateWithDots(undefined, "empty")).toBe("empty");
    });
  });

  describe("formatDateTime", () => {
    it("格式化日期时间（精确到分钟）", () => {
      const result = formatDateTime(testDate);
      expect(result).toContain("2024");
      expect(result).toContain("11");
      expect(result).toContain("25");
    });

    it("null 返回默认 fallback", () => {
      expect(formatDateTime(null)).toBe("-");
    });
  });

  describe("formatDateTimeWithSeconds", () => {
    it("格式化日期时间（精确到秒）", () => {
      const result = formatDateTimeWithSeconds(testDate);
      expect(result).toContain("2024");
    });

    it("null 返回默认 fallback", () => {
      expect(formatDateTimeWithSeconds(null)).toBe("-");
    });
  });

  describe("formatDateTimeLocale", () => {
    it("格式化为完整区域日期时间", () => {
      const result = formatDateTimeLocale(testDate);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("null 返回默认 fallback", () => {
      expect(formatDateTimeLocale(null)).toBe("-");
    });
  });

  describe("isDateString", () => {
    it("ISO 8601 日期字符串返回 true", () => {
      expect(isDateString("2024-01-15T12:00:00Z")).toBe(true);
    });

    it("带毫秒的 ISO 日期返回 true", () => {
      expect(isDateString("2024-01-15T12:00:00.000Z")).toBe(true);
    });

    it("非字符串返回 false", () => {
      expect(isDateString(123)).toBe(false);
      expect(isDateString(null)).toBe(false);
      expect(isDateString(undefined)).toBe(false);
    });

    it("非日期格式字符串返回 false", () => {
      expect(isDateString("hello")).toBe(false);
      expect(isDateString("2024/01/15")).toBe(false);
    });

    it("无效日期字符串返回 false", () => {
      expect(isDateString("2024-13-45T99:99:99Z")).toBe(false);
    });
  });
});
