import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRecentVisits,
  readRecentVisits,
  RECENT_VISITS_EVENT,
  RECENT_VISITS_STORAGE_KEY,
  recordRecentVisit,
} from "@/lib/client/recent-visits";

describe("recent-visits", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("readRecentVisits", () => {
    it("无数据时应返回空数组", () => {
      expect(readRecentVisits()).toEqual([]);
    });

    it("应读取并解析存储的访问记录", () => {
      const items = [
        {
          path: "/post/hello",
          title: "Hello",
          visitedAt: "2024-01-15T10:00:00Z",
        },
      ];
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(items));
      const result = readRecentVisits();
      expect(result).toHaveLength(1);
      expect(result[0]!.path).toBe("/post/hello");
      expect(result[0]!.title).toBe("Hello");
    });

    it("应按访问时间降序排序", () => {
      const items = [
        { path: "/a", title: "A", visitedAt: "2024-01-01T00:00:00Z" },
        { path: "/b", title: "B", visitedAt: "2024-06-01T00:00:00Z" },
      ];
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(items));
      const result = readRecentVisits();
      expect(result[0]!.path).toBe("/b");
      expect(result[1]!.path).toBe("/a");
    });

    it("应过滤无效数据", () => {
      const items = [
        { path: "/valid", title: "Valid", visitedAt: "2024-01-01T00:00:00Z" },
        { invalid: true },
        null,
        { path: 123, title: 456 },
      ];
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(items));
      const result = readRecentVisits();
      expect(result).toHaveLength(1);
      expect(result[0]!.path).toBe("/valid");
    });

    it("损坏的 JSON 应返回空数组", () => {
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, "not-json{{{");
      expect(readRecentVisits()).toEqual([]);
    });

    it("应为缺少前导斜杠的路径添加斜杠", () => {
      const items = [
        {
          path: "post/hello",
          title: "Hello",
          visitedAt: "2024-01-01T00:00:00Z",
        },
      ];
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(items));
      const result = readRecentVisits();
      expect(result[0]!.path).toBe("/post/hello");
    });

    it("过长的标题应被截断", () => {
      const longTitle = "A".repeat(100);
      const items = [
        { path: "/test", title: longTitle, visitedAt: "2024-01-01T00:00:00Z" },
      ];
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(items));
      const result = readRecentVisits();
      expect(result[0]!.title.length).toBeLessThanOrEqual(83); // 80 + "..."
      expect(result[0]!.title).toContain("...");
    });

    it("空标题应使用路径作为标题", () => {
      const items = [
        { path: "/some/path", title: "", visitedAt: "2024-01-01T00:00:00Z" },
      ];
      localStorage.setItem(RECENT_VISITS_STORAGE_KEY, JSON.stringify(items));
      const result = readRecentVisits();
      expect(result[0]!.title).toBe("/some/path");
    });
  });

  describe("recordRecentVisit", () => {
    it("应记录一次访问", () => {
      recordRecentVisit({ path: "/post/hello", title: "Hello" });
      const result = readRecentVisits();
      expect(result).toHaveLength(1);
      expect(result[0]!.path).toBe("/post/hello");
      expect(result[0]!.title).toBe("Hello");
    });

    it("应将最新记录放在最前面", () => {
      recordRecentVisit({
        path: "/first",
        title: "First",
        visitedAt: "2024-01-01T00:00:00Z",
      });
      recordRecentVisit({
        path: "/second",
        title: "Second",
        visitedAt: "2024-06-01T00:00:00Z",
      });
      const result = readRecentVisits();
      expect(result[0]!.path).toBe("/second");
      expect(result[1]!.path).toBe("/first");
    });

    it("不应记录被排除的路径（/login）", () => {
      recordRecentVisit({ path: "/login" });
      expect(readRecentVisits()).toHaveLength(0);
    });

    it("不应记录被排除的路径前缀（/admin/*）", () => {
      recordRecentVisit({ path: "/admin/dashboard" });
      expect(readRecentVisits()).toHaveLength(0);
    });

    it("应排除 /register、/logout、/reset-password 等路径", () => {
      recordRecentVisit({ path: "/register" });
      recordRecentVisit({ path: "/logout" });
      recordRecentVisit({ path: "/reset-password" });
      recordRecentVisit({ path: "/email-verify" });
      recordRecentVisit({ path: "/reauth" });
      expect(readRecentVisits()).toHaveLength(0);
    });

    it("应限制最大记录数为 50", () => {
      for (let i = 0; i < 60; i++) {
        recordRecentVisit({
          path: `/post/${i}`,
          title: `Post ${i}`,
          visitedAt: new Date(2024, 0, 1, 0, 0, i).toISOString(),
        });
      }
      const result = readRecentVisits();
      expect(result).toHaveLength(50);
    });

    it("应去除查询参数后判断路径", () => {
      recordRecentVisit({ path: "/login?redirect=/home" });
      expect(readRecentVisits()).toHaveLength(0);
    });

    it("应保留带查询参数的完整路径", () => {
      recordRecentVisit({ path: "/post/hello?page=1" });
      const result = readRecentVisits();
      expect(result).toHaveLength(1);
      expect(result[0]!.path).toBe("/post/hello?page=1");
    });
  });

  describe("clearRecentVisits", () => {
    it("应清除所有访问记录", () => {
      recordRecentVisit({ path: "/post/a" });
      recordRecentVisit({ path: "/post/b" });
      expect(readRecentVisits()).toHaveLength(2);

      clearRecentVisits();
      expect(readRecentVisits()).toHaveLength(0);
    });

    it("应派发更新事件", () => {
      const handler = vi.fn();
      window.addEventListener(RECENT_VISITS_EVENT, handler);

      clearRecentVisits();

      expect(handler).toHaveBeenCalled();
      window.removeEventListener(RECENT_VISITS_EVENT, handler);
    });
  });

  describe("recordRecentVisit 事件派发", () => {
    it("记录访问时应派发自定义事件", () => {
      const handler = vi.fn();
      window.addEventListener(RECENT_VISITS_EVENT, handler);

      recordRecentVisit({ path: "/post/test" });

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]![0] as CustomEvent;
      expect((event as any).detail.count).toBe(1);
      expect(event.detail.items).toHaveLength(1);

      window.removeEventListener(RECENT_VISITS_EVENT, handler);
    });
  });
});
