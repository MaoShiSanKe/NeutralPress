import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock prisma - 使用 vi.hoisted 确保在 vi.mock 之前定义
const { mockMediaFindUnique, mockMediaFindMany } = vi.hoisted(() => ({
  mockMediaFindUnique: vi.fn(),
  mockMediaFindMany: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    media: {
      findUnique: mockMediaFindUnique,
      findMany: mockMediaFindMany,
    },
  },
}));

import {
  getMediaByShortHash,
  getMediaByShortHashes,
} from "@/lib/server/image-resolver";

describe("image-resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMediaByShortHash", () => {
    it("返回媒体信息当找到匹配记录", async () => {
      const mockMedia = {
        id: 1,
        shortHash: "abc12345",
        storageUrl: "https://cdn.example.com/image.jpg",
        mimeType: "image/jpeg",
        fileName: "image.jpg",
        isOptimized: true,
      };
      mockMediaFindUnique.mockResolvedValue(mockMedia);

      const result = await getMediaByShortHash("abc12345");

      expect(result).toEqual({
        id: 1,
        shortHash: "abc12345",
        storageUrl: "https://cdn.example.com/image.jpg",
        mimeType: "image/jpeg",
        fileName: "image.jpg",
        isOptimized: true,
      });
      expect(mockMediaFindUnique).toHaveBeenCalledWith({
        where: { shortHash: "abc12345" },
        select: {
          id: true,
          shortHash: true,
          storageUrl: true,
          mimeType: true,
          fileName: true,
          isOptimized: true,
        },
      });
    });

    it("返回 null 当未找到匹配记录", async () => {
      mockMediaFindUnique.mockResolvedValue(null);

      const result = await getMediaByShortHash("nonexistent");

      expect(result).toBeNull();
    });

    it("正确映射所有字段", async () => {
      mockMediaFindUnique.mockResolvedValue({
        id: 42,
        shortHash: "xyz789ab",
        storageUrl: "/uploads/test.webp",
        mimeType: "image/webp",
        fileName: "test.webp",
        isOptimized: false,
      });

      const result = await getMediaByShortHash("xyz789ab");

      expect(result?.id).toBe(42);
      expect(result?.shortHash).toBe("xyz789ab");
      expect(result?.storageUrl).toBe("/uploads/test.webp");
      expect(result?.mimeType).toBe("image/webp");
      expect(result?.fileName).toBe("test.webp");
      expect(result?.isOptimized).toBe(false);
    });
  });

  describe("getMediaByShortHashes", () => {
    it("返回映射表当找到多个匹配记录", async () => {
      mockMediaFindMany.mockResolvedValue([
        {
          id: 1,
          shortHash: "abc12345",
          storageUrl: "https://cdn.example.com/img1.jpg",
          mimeType: "image/jpeg",
          fileName: "img1.jpg",
          isOptimized: true,
        },
        {
          id: 2,
          shortHash: "def67890",
          storageUrl: "https://cdn.example.com/img2.png",
          mimeType: "image/png",
          fileName: "img2.png",
          isOptimized: false,
        },
      ]);

      const result = await getMediaByShortHashes(["abc12345", "def67890"]);

      expect(result.size).toBe(2);
      expect(result.get("abc12345")?.id).toBe(1);
      expect(result.get("abc12345")?.mimeType).toBe("image/jpeg");
      expect(result.get("def67890")?.id).toBe(2);
      expect(result.get("def67890")?.mimeType).toBe("image/png");
    });

    it("返回空 Map 当没有匹配记录", async () => {
      mockMediaFindMany.mockResolvedValue([]);

      const result = await getMediaByShortHashes(["nonexistent"]);

      expect(result.size).toBe(0);
    });

    it("处理空数组输入", async () => {
      mockMediaFindMany.mockResolvedValue([]);

      const result = await getMediaByShortHashes([]);

      expect(result.size).toBe(0);
    });

    it("处理单个哈希输入", async () => {
      mockMediaFindMany.mockResolvedValue([
        {
          id: 1,
          shortHash: "abc12345",
          storageUrl: "/test.jpg",
          mimeType: "image/jpeg",
          fileName: "test.jpg",
          isOptimized: true,
        },
      ]);

      const result = await getMediaByShortHashes(["abc12345"]);

      expect(result.size).toBe(1);
      expect(result.has("abc12345")).toBe(true);
    });
  });
});
