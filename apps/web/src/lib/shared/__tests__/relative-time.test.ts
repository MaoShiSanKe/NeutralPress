import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatRelativeDays,
  formatRelativeTime,
} from "@/lib/shared/relative-time";

describe("relative-time", () => {
  beforeEach(() => {
    // 固定当前时间为 2024-01-15 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatRelativeTime", () => {
    it("null 返回空字符串", () => {
      expect(formatRelativeTime(null)).toBe("");
    });

    it("undefined 返回空字符串", () => {
      expect(formatRelativeTime(undefined)).toBe("");
    });

    it("刚刚（小于 1 分钟）", () => {
      const date = new Date("2024-01-15T11:59:30Z");
      expect(formatRelativeTime(date)).toBe("刚刚");
    });

    it("未来时间返回 '刚刚'", () => {
      const futureDate = new Date("2024-01-15T13:00:00Z");
      expect(formatRelativeTime(futureDate)).toBe("刚刚");
    });

    it("5 分钟前", () => {
      const date = new Date("2024-01-15T11:55:00Z");
      expect(formatRelativeTime(date)).toBe("5 分钟前");
    });

    it("59 分钟前", () => {
      const date = new Date("2024-01-15T11:01:00Z");
      expect(formatRelativeTime(date)).toBe("59 分钟前");
    });

    it("1 小时前", () => {
      const date = new Date("2024-01-15T11:00:00Z");
      expect(formatRelativeTime(date)).toBe("1 小时前");
    });

    it("23 小时前", () => {
      const date = new Date("2024-01-14T13:00:00Z");
      expect(formatRelativeTime(date)).toBe("23 小时前");
    });

    it("1 天前", () => {
      const date = new Date("2024-01-14T12:00:00Z");
      expect(formatRelativeTime(date)).toBe("1 天前");
    });

    it("29 天前", () => {
      const date = new Date("2023-12-17T12:00:00Z");
      expect(formatRelativeTime(date)).toBe("29 天前");
    });

    it("1 个月前", () => {
      const date = new Date("2023-12-16T12:00:00Z");
      expect(formatRelativeTime(date)).toBe("1 个月前");
    });

    it("X 个月零 X 天前", () => {
      const date = new Date("2023-11-01T12:00:00Z");
      const result = formatRelativeTime(date);
      expect(result).toMatch(/\d+ 个月零 \d+ 天前/);
    });

    it("1 年前", () => {
      const date = new Date("2023-01-15T12:00:00Z");
      expect(formatRelativeTime(date)).toBe("1 年前");
    });

    it("X 年零 X 个月前", () => {
      const date = new Date("2022-06-15T12:00:00Z");
      const result = formatRelativeTime(date);
      expect(result).toMatch(/\d+ 年零 \d+ 个月前/);
    });

    it("接受字符串格式的日期", () => {
      const result = formatRelativeTime("2024-01-15T11:55:00Z");
      expect(result).toBe("5 分钟前");
    });
  });

  describe("formatRelativeDays", () => {
    it("null 返回空字符串", () => {
      expect(formatRelativeDays(null)).toBe("");
    });

    it("undefined 返回空字符串", () => {
      expect(formatRelativeDays(undefined)).toBe("");
    });

    it("今天", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      expect(formatRelativeDays(date)).toBe("今天");
    });

    it("未来日期返回 '今天'", () => {
      const futureDate = new Date("2024-01-16T12:00:00Z");
      expect(formatRelativeDays(futureDate)).toBe("今天");
    });

    it("1 天前", () => {
      const date = new Date("2024-01-14T12:00:00Z");
      expect(formatRelativeDays(date)).toBe("1 天前");
    });

    it("30 天前", () => {
      const date = new Date("2023-12-16T12:00:00Z");
      expect(formatRelativeDays(date)).toBe("30 天前");
    });

    it("接受字符串格式的日期", () => {
      expect(formatRelativeDays("2024-01-14T12:00:00Z")).toBe("1 天前");
    });
  });
});
