import { describe, expect, it } from "vitest";

import {
  batchProcessImageUrls,
  extractInternalHashes,
  processImageUrl,
} from "@/lib/shared/image-common";

describe("image-common", () => {
  describe("extractInternalHashes", () => {
    it("提取单个内部链接哈希", () => {
      const text = "/p/abcd1234ef56";
      const result = extractInternalHashes(text);
      expect(result).toEqual([
        { shortHash: "abcd1234", fullHash: "abcd1234ef56" },
      ]);
    });

    it("提取多个内部链接哈希", () => {
      const text = "/p/abcd1234ef56, /p/567890abcdef";
      const result = extractInternalHashes(text);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        shortHash: "abcd1234",
        fullHash: "abcd1234ef56",
      });
      expect(result[1]).toEqual({
        shortHash: "567890ab",
        fullHash: "567890abcdef",
      });
    });

    it("去重基于短哈希", () => {
      const text = "/p/abcd1234ef56, /p/abcd1234xy99";
      const result = extractInternalHashes(text);
      // 两个链接短哈希相同（abcd1234），只保留第一个
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        shortHash: "abcd1234",
        fullHash: "abcd1234ef56",
      });
    });

    it("空字符串返回空数组", () => {
      expect(extractInternalHashes("")).toEqual([]);
    });

    it("null 返回空数组", () => {
      expect(extractInternalHashes(null as unknown as string)).toEqual([]);
    });

    it("无内部链接时返回空数组", () => {
      expect(extractInternalHashes("https://example.com/img.jpg")).toEqual([]);
    });

    it("混合内部和外部链接", () => {
      const text = "https://example.com/img.jpg, /p/abcd1234ef56";
      const result = extractInternalHashes(text);
      expect(result).toHaveLength(1);
      expect(result[0]!.shortHash).toBe("abcd1234");
    });
  });

  describe("processImageUrl", () => {
    it("处理包含内部链接的 URL", () => {
      const mediaFileMap = new Map([
        ["abcd1234", { shortHash: "abcd1234", width: 800, height: 600 }],
      ]);
      const result = processImageUrl("/p/abcd1234ef56", mediaFileMap);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        url: "/p/abcd1234ef56",
        width: 800,
        height: 600,
        blur: undefined,
      });
    });

    it("处理内部链接但 mediaFileMap 中不存在对应文件", () => {
      const mediaFileMap = new Map();
      const result = processImageUrl("/p/abcd1234ef56", mediaFileMap);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ url: "/p/abcd1234ef56" });
    });

    it("处理外部链接", () => {
      const mediaFileMap = new Map();
      const result = processImageUrl(
        "https://example.com/img.jpg",
        mediaFileMap,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ url: "https://example.com/img.jpg" });
    });

    it("空字符串返回空数组", () => {
      const result = processImageUrl("", new Map());
      expect(result).toEqual([]);
    });

    it("处理包含 blur 的媒体文件", () => {
      const mediaFileMap = new Map([
        [
          "abcd1234",
          {
            shortHash: "abcd1234",
            width: 800,
            height: 600,
            blur: "data:image/...",
          },
        ],
      ]);
      const result = processImageUrl("/p/abcd1234ef56", mediaFileMap);
      expect(result[0]!.blur).toBe("data:image/...");
    });
  });

  describe("batchProcessImageUrls", () => {
    it("批量处理多个图片 URL", () => {
      const mediaFileMap = new Map();
      const urls = [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        null,
      ];
      const result = batchProcessImageUrls(urls, mediaFileMap);
      expect(result).toHaveLength(2);
    });

    it("跳过 null 值", () => {
      const result = batchProcessImageUrls([null, null], new Map());
      expect(result).toEqual([]);
    });

    it("空数组返回空数组", () => {
      expect(batchProcessImageUrls([], new Map())).toEqual([]);
    });
  });
});
