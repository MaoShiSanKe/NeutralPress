import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock prisma - 使用 vi.hoisted 确保在 vi.mock 之前定义
const { mockMediaFindMany } = vi.hoisted(() => ({
  mockMediaFindMany: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    media: {
      findMany: mockMediaFindMany,
    },
  },
}));

// Mock image-common
vi.mock("@/lib/shared/image-common", () => ({
  extractInternalHashes: vi.fn((input: string) => {
    // 简化的 mock：匹配 /p/ 后面的 8 位哈希
    const matches = input.match(/\/p\/([a-zA-Z0-9]{8})/g) || [];
    return matches.map((m: string) => ({
      shortHash: m.slice(3),
      fullHash: m.slice(3) + "extra",
    }));
  }),
}));

import { batchQueryMediaFiles } from "@/lib/server/image-query";

describe("image-query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("batchQueryMediaFiles", () => {
    it("返回空 Map 当没有内部链接时", async () => {
      const result = await batchQueryMediaFiles([
        "https://example.com/image.jpg",
        null,
      ]);
      expect(result.size).toBe(0);
      expect(mockMediaFindMany).not.toHaveBeenCalled();
    });

    it("返回空 Map 当输入为空数组时", async () => {
      const result = await batchQueryMediaFiles([]);
      expect(result.size).toBe(0);
      expect(mockMediaFindMany).not.toHaveBeenCalled();
    });

    it("查询内部链接对应的媒体文件", async () => {
      mockMediaFindMany.mockResolvedValue([
        {
          shortHash: "abc12345",
          width: 1920,
          height: 1080,
          blur: "data:image/webp;base64,blur",
        },
      ]);

      const result = await batchQueryMediaFiles(["/p/abc12345"]);

      expect(mockMediaFindMany).toHaveBeenCalledWith({
        where: {
          shortHash: { in: ["abc12345"] },
          mediaType: "IMAGE",
        },
        select: {
          shortHash: true,
          width: true,
          height: true,
          blur: true,
        },
      });
      expect(result.size).toBe(1);
      expect(result.get("abc12345")).toEqual({
        shortHash: "abc12345",
        width: 1920,
        height: 1080,
        blur: "data:image/webp;base64,blur",
      });
    });

    it("处理多个内部链接", async () => {
      mockMediaFindMany.mockResolvedValue([
        { shortHash: "abc12345", width: 800, height: 600, blur: null },
        { shortHash: "def67890", width: 400, height: 300, blur: null },
      ]);

      const result = await batchQueryMediaFiles(["/p/abc12345", "/p/def67890"]);

      expect(result.size).toBe(2);
      expect(result.has("abc12345")).toBe(true);
      expect(result.has("def67890")).toBe(true);
    });

    it("处理 null 值输入", async () => {
      mockMediaFindMany.mockResolvedValue([]);

      const result = await batchQueryMediaFiles([null, null]);
      expect(result.size).toBe(0);
    });

    it("null width/height/blur 转换为 undefined", async () => {
      mockMediaFindMany.mockResolvedValue([
        { shortHash: "abc12345", width: null, height: null, blur: null },
      ]);

      const result = await batchQueryMediaFiles(["/p/abc12345"]);

      const info = result.get("abc12345");
      expect(info?.width).toBeUndefined();
      expect(info?.height).toBeUndefined();
      expect(info?.blur).toBeUndefined();
    });

    it("混合内部链接和外部链接", async () => {
      mockMediaFindMany.mockResolvedValue([
        { shortHash: "abc12345", width: 100, height: 100, blur: null },
      ]);

      const result = await batchQueryMediaFiles([
        "https://example.com/external.jpg",
        "/p/abc12345",
        null,
      ]);

      expect(result.size).toBe(1);
      expect(result.has("abc12345")).toBe(true);
    });

    it("处理重复的内部链接", async () => {
      mockMediaFindMany.mockResolvedValue([
        { shortHash: "abc12345", width: 100, height: 100, blur: null },
      ]);

      const result = await batchQueryMediaFiles(["/p/abc12345", "/p/abc12345"]);

      // 应该能正确返回结果（即使有重复链接）
      expect(result.size).toBe(1);
      expect(result.has("abc12345")).toBe(true);
    });

    it("数据库返回空结果时返回空 Map", async () => {
      mockMediaFindMany.mockResolvedValue([]);

      const result = await batchQueryMediaFiles(["/p/abc12345"]);
      expect(result.size).toBe(0);
    });
  });
});
