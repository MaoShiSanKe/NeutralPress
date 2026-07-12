import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearEditorContent,
  flushEditorContentSave,
  loadAllEditorContent,
  loadEditorContent,
  saveEditorContent,
  scheduleEditorContentSave,
} from "@/lib/client/editor-persistence";

describe("editor-persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("saveEditorContent / loadEditorContent", () => {
    it("应保存并加载编辑器内容", () => {
      saveEditorContent("# Hello World", {});
      const result = loadEditorContent();
      expect(result).not.toBeNull();
      expect(result!.content).toBe("# Hello World");
    });

    it("应支持自定义 key", () => {
      saveEditorContent("content A", {}, true, "post-1");
      saveEditorContent("content B", {}, true, "post-2");

      expect(loadEditorContent("post-1")!.content).toBe("content A");
      expect(loadEditorContent("post-2")!.content).toBe("content B");
    });

    it("应保存 lastUpdatedAt 时间戳", () => {
      saveEditorContent("test", {});
      const result = loadEditorContent();
      expect(result!.lastUpdatedAt).toBeTruthy();
      expect(new Date(result!.lastUpdatedAt).getTime()).not.toBeNaN();
    });

    it("应保存编辑器配置", () => {
      const config = { mode: "markdown", theme: "dark" };
      saveEditorContent("test", config);
      const result = loadEditorContent();
      expect(result!.config).toEqual(config);
    });

    it("加载不存在的 key 应返回 null", () => {
      saveEditorContent("test", {}, true, "existing");
      expect(loadEditorContent("nonexistent")).toBeNull();
    });

    it("无数据时加载应返回 null", () => {
      expect(loadEditorContent()).toBeNull();
    });
  });

  describe("loadAllEditorContent", () => {
    it("应加载所有保存的内容", () => {
      saveEditorContent("a", {}, true, "key-a");
      saveEditorContent("b", {}, true, "key-b");

      const all = loadAllEditorContent();
      expect(all).not.toBeNull();
      expect(all!["key-a"]!.content).toBe("a");
      expect(all!["key-b"]!.content).toBe("b");
    });

    it("无数据时应返回 null", () => {
      expect(loadAllEditorContent()).toBeNull();
    });
  });

  describe("clearEditorContent", () => {
    it("清除指定 key 应只删除该 key 的内容", () => {
      saveEditorContent("a", {}, true, "key-a");
      saveEditorContent("b", {}, true, "key-b");

      clearEditorContent("key-a");

      expect(loadEditorContent("key-a")).toBeNull();
      expect(loadEditorContent("key-b")).not.toBeNull();
    });

    it("不传 key 应清除所有内容", () => {
      saveEditorContent("a", {}, true, "key-a");
      saveEditorContent("b", {}, true, "key-b");

      clearEditorContent();

      expect(loadAllEditorContent()).toBeNull();
    });
  });

  describe("scheduleEditorContentSave", () => {
    it("应在延迟后保存内容", () => {
      scheduleEditorContentSave("deferred content", {}, "test", 5000);

      // 延迟前不应有数据
      expect(loadEditorContent("test")).toBeNull();

      // 快进时间
      vi.advanceTimersByTime(5000);

      // 延迟后应有数据
      const result = loadEditorContent("test");
      expect(result).not.toBeNull();
      expect(result!.content).toBe("deferred content");
    });

    it("多次调度应重置延迟（防抖）", () => {
      scheduleEditorContentSave("first", {}, "debounce", 5000);

      vi.advanceTimersByTime(3000);

      scheduleEditorContentSave("second", {}, "debounce", 5000);

      vi.advanceTimersByTime(3000);

      // 此时总共过了 6 秒，但第二次调度只过了 3 秒，不应有数据
      expect(loadEditorContent("debounce")).toBeNull();

      vi.advanceTimersByTime(2000);

      // 现在第二次调度的 5 秒到了
      const result = loadEditorContent("debounce");
      expect(result).not.toBeNull();
      expect(result!.content).toBe("second");
    });
  });

  describe("flushEditorContentSave", () => {
    it("应立即刷新指定 key 的待保存内容", () => {
      scheduleEditorContentSave("pending content", {}, "flush-test", 10000);

      // 内容尚未保存
      expect(loadEditorContent("flush-test")).toBeNull();

      // 立即刷新
      flushEditorContentSave("flush-test");

      const result = loadEditorContent("flush-test");
      expect(result).not.toBeNull();
      expect(result!.content).toBe("pending content");
    });

    it("不传 key 应刷新所有待保存内容", () => {
      scheduleEditorContentSave("a", {}, "key-a", 10000);
      scheduleEditorContentSave("b", {}, "key-b", 10000);

      flushEditorContentSave();

      expect(loadEditorContent("key-a")!.content).toBe("a");
      expect(loadEditorContent("key-b")!.content).toBe("b");
    });

    it("刷新不存在的 pending key 不应报错", () => {
      expect(() => flushEditorContentSave("nonexistent")).not.toThrow();
    });
  });
});
