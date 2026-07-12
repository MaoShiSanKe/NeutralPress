import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
}));

// Mock prisma
const mockPhotoFindMany = vi.fn();
vi.mock("@/lib/server/prisma", () => ({
  default: {
    photo: {
      findMany: mockPhotoFindMany,
    },
  },
}));

// Mock image-crypto
vi.mock("@/lib/server/image-crypto", () => ({
  generateSignedImageId: vi
    .fn()
    .mockImplementation((hash: string) => `signed-${hash}`),
}));

describe("media", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfig.mockImplementation(async (key: string) => {
      const configs: Record<string, unknown> = {
        "media.gallery.sortByShotTime": false,
        "media.gallery.sortOrder": "desc",
      };
      return configs[key];
    });

    mockPhotoFindMany.mockResolvedValue([
      {
        id: 1,
        slug: "photo-1",
        size: 1024,
        name: "Test Photo 1",
        sortTime: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
        media: {
          shortHash: "abc123",
          blur: "data:image/jpeg;base64,blur",
          width: 1920,
          height: 1080,
          altText: "Test alt text",
        },
      },
      {
        id: 2,
        slug: "photo-2",
        size: 2048,
        name: "Test Photo 2",
        sortTime: new Date("2024-01-02"),
        createdAt: new Date("2024-01-02"),
        media: {
          shortHash: "def456",
          blur: "data:image/jpeg;base64,blur2",
          width: 800,
          height: 600,
          altText: null,
        },
      },
    ]);
  });

  describe("getGalleryPhotosData", () => {
    it("应返回照片列表和 nextCursor", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      const result = await getGalleryPhotosData({});

      expect(result.photos).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined(); // 少于 50 张，没有 nextCursor
    });

    it("应正确映射照片数据", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      const result = await getGalleryPhotosData({});

      const photo = result.photos[0]!;
      expect(photo.id).toBe(1);
      expect(photo.slug).toBe("photo-1");
      expect(photo.size).toBe(1024);
      expect(photo.name).toBe("Test Photo 1");
      expect(photo.width).toBe(1920);
      expect(photo.height).toBe(1080);
      expect(photo.alt).toBe("Test alt text");
      expect(photo.blur).toBe("data:image/jpeg;base64,blur");
    });

    it("应生成签名图片 URL", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      const result = await getGalleryPhotosData({});

      expect(result.photos[0]!.imageUrl).toBe("/p/signed-abc123");
      expect(result.photos[1]!.imageUrl).toBe("/p/signed-def456");
    });

    it("当照片 alt 为 null 时应返回 null", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      const result = await getGalleryPhotosData({});

      expect(result.photos[1]!.alt).toBeNull();
    });

    it("应按创建时间排序（默认）", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      await getGalleryPhotosData({});

      expect(mockPhotoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { createdAt: "desc" },
            { id: "desc" },
          ]),
        }),
      );
    });

    it("当配置按拍摄时间排序时应使用 sortTime", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "media.gallery.sortByShotTime") return true;
        if (key === "media.gallery.sortOrder") return "asc";
        return undefined;
      });

      const { getGalleryPhotosData } = await import("@/lib/server/media");
      await getGalleryPhotosData({});

      expect(mockPhotoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { sortTime: "asc" },
            { id: "desc" },
          ]),
        }),
      );
    });

    it("当提供 cursorId 时应使用游标分页", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      await getGalleryPhotosData({ cursorId: 10 });

      expect(mockPhotoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1,
          cursor: { id: 10 },
        }),
      );
    });

    it("当没有 cursorId 时应 skip 0", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      await getGalleryPhotosData({});

      expect(mockPhotoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          cursor: undefined,
        }),
      );
    });

    it("当返回 50 张照片时应设置 nextCursor", async () => {
      const photos = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        slug: `photo-${i + 1}`,
        size: 1024,
        name: `Photo ${i + 1}`,
        sortTime: new Date(),
        createdAt: new Date(),
        media: {
          shortHash: `hash${i}`,
          blur: null,
          width: 100,
          height: 100,
          altText: null,
        },
      }));
      mockPhotoFindMany.mockResolvedValueOnce(photos);

      const { getGalleryPhotosData } = await import("@/lib/server/media");
      const result = await getGalleryPhotosData({});

      expect(result.photos).toHaveLength(50);
      expect(result.nextCursor).toBe(50);
    });

    it("应限制每页数量为 50", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      await getGalleryPhotosData({});

      expect(mockPhotoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it("应包含 media 关联数据", async () => {
      const { getGalleryPhotosData } = await import("@/lib/server/media");
      await getGalleryPhotosData({});

      expect(mockPhotoFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            media: true,
          },
        }),
      );
    });
  });
});
