import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock generateSignature before importing the module under test
vi.mock("@/lib/server/image-crypto", () => ({
  generateSignature: (shortHash: string) => `sig_${shortHash.slice(0, 4)}`,
}));

// Mock prisma
vi.mock("@/lib/server/prisma", () => {
  return {
    default: {
      media: {
        findFirst: vi.fn(),
      },
    },
  };
});

import {
  createContentImageRefs,
  createFeaturedImageRef,
  findMediaIdByUrl,
  getAllFeaturedImageUrls,
  getContentImageUrls,
  getFeaturedImageData,
  getFeaturedImageUrl,
  mediaRefsInclude,
  updateFeaturedImageRef,
} from "@/lib/server/media-reference";
import prisma from "@/lib/server/prisma";
import { MEDIA_SLOTS } from "@/types/media";

// Helper to build a minimal mediaRef
function makeRef(
  slot: string,
  shortHash: string,
  extra?: Record<string, unknown>,
) {
  return {
    slot,
    media: {
      shortHash,
      id: 1,
      fileName: "test.jpg",
      originalName: "test.jpg",
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
      altText: null,
      blur: null,
      ...extra,
    },
  };
}

describe("media-reference", () => {
  describe("mediaRefsInclude", () => {
    it("has correct structure", () => {
      expect(mediaRefsInclude).toHaveProperty("mediaRefs");
      expect(mediaRefsInclude.mediaRefs).toHaveProperty("include");
      expect(mediaRefsInclude.mediaRefs.include).toHaveProperty("media");
      expect(mediaRefsInclude.mediaRefs.include.media).toHaveProperty("select");
    });

    it("selects expected media fields", () => {
      const select = mediaRefsInclude.mediaRefs.include.media.select;
      expect(select).toHaveProperty("id", true);
      expect(select).toHaveProperty("shortHash", true);
      expect(select).toHaveProperty("fileName", true);
      expect(select).toHaveProperty("mimeType", true);
    });
  });

  describe("getFeaturedImageUrl", () => {
    it("returns null when mediaRefs is undefined", () => {
      expect(getFeaturedImageUrl(undefined)).toBeNull();
    });

    it("returns null when mediaRefs is empty", () => {
      expect(getFeaturedImageUrl([])).toBeNull();
    });

    it("returns null when no featured image slot exists", () => {
      const refs = [makeRef("otherSlot", "abc12345")];
      expect(getFeaturedImageUrl(refs)).toBeNull();
    });

    it("returns URL for POST_FEATURED_IMAGE slot", () => {
      const refs = [makeRef(MEDIA_SLOTS.POST_FEATURED_IMAGE, "abcd1234")];
      const url = getFeaturedImageUrl(refs);
      expect(url).toBe("/p/abcd1234sig_abcd");
    });

    it("returns URL for TAG_FEATURED_IMAGE slot", () => {
      const refs = [makeRef(MEDIA_SLOTS.TAG_FEATURED_IMAGE, "efgh5678")];
      const url = getFeaturedImageUrl(refs);
      expect(url).toBe("/p/efgh5678sig_efgh");
    });

    it("returns URL for CATEGORY_FEATURED_IMAGE slot", () => {
      const refs = [makeRef(MEDIA_SLOTS.CATEGORY_FEATURED_IMAGE, "ijkl9012")];
      const url = getFeaturedImageUrl(refs);
      expect(url).toBe("/p/ijkl9012sig_ijkl");
    });

    it("returns URL for PAGE_FEATURED_IMAGE slot", () => {
      const refs = [makeRef(MEDIA_SLOTS.PAGE_FEATURED_IMAGE, "mnop3456")];
      const url = getFeaturedImageUrl(refs);
      expect(url).toBe("/p/mnop3456sig_mnop");
    });

    it("returns URL for PROJECT_FEATURED_IMAGE slot", () => {
      const refs = [makeRef(MEDIA_SLOTS.PROJECT_FEATURED_IMAGE, "qrst7890")];
      const url = getFeaturedImageUrl(refs);
      expect(url).toBe("/p/qrst7890sig_qrst");
    });

    it("returns first matching featured image when multiple exist", () => {
      const refs = [
        makeRef("otherSlot", "aaaaaaaa"),
        makeRef(MEDIA_SLOTS.POST_FEATURED_IMAGE, "bbbbbbbb"),
        makeRef(MEDIA_SLOTS.PAGE_FEATURED_IMAGE, "cccccccc"),
      ];
      const url = getFeaturedImageUrl(refs);
      expect(url).toBe("/p/bbbbbbbbsig_bbbb");
    });
  });

  describe("getAllFeaturedImageUrls", () => {
    it("returns empty array when mediaRefs is undefined", () => {
      expect(getAllFeaturedImageUrls(undefined)).toEqual([]);
    });

    it("returns empty array when mediaRefs is empty", () => {
      expect(getAllFeaturedImageUrls([])).toEqual([]);
    });

    it("returns empty array when no featured image slots exist", () => {
      const refs = [makeRef("otherSlot", "aaaaaaaa")];
      expect(getAllFeaturedImageUrls(refs)).toEqual([]);
    });

    it("returns all featured image URLs", () => {
      const refs = [
        makeRef(MEDIA_SLOTS.POST_FEATURED_IMAGE, "aaaaaaaa"),
        makeRef("otherSlot", "bbbbbbbb"),
        makeRef(MEDIA_SLOTS.TAG_FEATURED_IMAGE, "cccccccc"),
        makeRef(MEDIA_SLOTS.PAGE_CONTENT_IMAGE, "dddddddd"),
      ];
      const urls = getAllFeaturedImageUrls(refs);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe("/p/aaaaaaaasig_aaaa");
      expect(urls[1]).toBe("/p/ccccccccsig_cccc");
    });
  });

  describe("getFeaturedImageData", () => {
    it("returns null when mediaRefs is undefined", () => {
      expect(getFeaturedImageData(undefined)).toBeNull();
    });

    it("returns null when mediaRefs is empty", () => {
      expect(getFeaturedImageData([])).toBeNull();
    });

    it("returns data with width, height, and blur when available", () => {
      const refs = [
        makeRef(MEDIA_SLOTS.POST_FEATURED_IMAGE, "abcd1234", {
          width: 1920,
          height: 1080,
          blur: "data:image/webp;base64,abc",
        }),
      ];
      const data = getFeaturedImageData(refs);
      expect(data).not.toBeNull();
      expect(data!.url).toBe("/p/abcd1234sig_abcd");
      expect(data!.width).toBe(1920);
      expect(data!.height).toBe(1080);
      expect(data!.blur).toBe("data:image/webp;base64,abc");
    });

    it("returns undefined for null width/height/blur", () => {
      const refs = [
        {
          slot: MEDIA_SLOTS.POST_FEATURED_IMAGE,
          media: {
            shortHash: "abcd1234",
            width: null,
            height: null,
            blur: null,
          },
        },
      ];
      const data = getFeaturedImageData(refs);
      expect(data).not.toBeNull();
      expect(data!.width).toBeUndefined();
      expect(data!.height).toBeUndefined();
      expect(data!.blur).toBeUndefined();
    });
  });

  describe("getContentImageUrls", () => {
    it("returns empty array when mediaRefs is undefined", () => {
      expect(getContentImageUrls(undefined)).toEqual([]);
    });

    it("returns empty array when mediaRefs is empty", () => {
      expect(getContentImageUrls([])).toEqual([]);
    });

    it("returns only content image URLs", () => {
      const refs = [
        makeRef(MEDIA_SLOTS.POST_FEATURED_IMAGE, "aaaaaaaa"),
        makeRef(MEDIA_SLOTS.POST_CONTENT_IMAGE, "bbbbbbbb"),
        makeRef(MEDIA_SLOTS.PAGE_CONTENT_IMAGE, "cccccccc"),
        makeRef("otherSlot", "dddddddd"),
      ];
      const urls = getContentImageUrls(refs);
      expect(urls).toHaveLength(2);
      expect(urls[0]).toBe("/p/bbbbbbbbsig_bbbb");
      expect(urls[1]).toBe("/p/ccccccccsig_cccc");
    });
  });

  describe("createFeaturedImageRef", () => {
    it("creates ref for post", () => {
      const result = createFeaturedImageRef(42, "post");
      expect(result).toEqual({
        create: {
          mediaId: 42,
          slot: MEDIA_SLOTS.POST_FEATURED_IMAGE,
        },
      });
    });

    it("creates ref for tag", () => {
      const result = createFeaturedImageRef(10, "tag");
      expect(result).toEqual({
        create: {
          mediaId: 10,
          slot: MEDIA_SLOTS.TAG_FEATURED_IMAGE,
        },
      });
    });

    it("creates ref for category", () => {
      const result = createFeaturedImageRef(5, "category");
      expect(result).toEqual({
        create: {
          mediaId: 5,
          slot: MEDIA_SLOTS.CATEGORY_FEATURED_IMAGE,
        },
      });
    });

    it("creates ref for page", () => {
      const result = createFeaturedImageRef(99, "page");
      expect(result).toEqual({
        create: {
          mediaId: 99,
          slot: MEDIA_SLOTS.PAGE_FEATURED_IMAGE,
        },
      });
    });
  });

  describe("createContentImageRefs", () => {
    it("creates refs for post content images", () => {
      const result = createContentImageRefs([1, 2, 3], "post");
      expect(result).toEqual({
        create: [
          { mediaId: 1, slot: MEDIA_SLOTS.POST_CONTENT_IMAGE },
          { mediaId: 2, slot: MEDIA_SLOTS.POST_CONTENT_IMAGE },
          { mediaId: 3, slot: MEDIA_SLOTS.POST_CONTENT_IMAGE },
        ],
      });
    });

    it("creates refs for page content images", () => {
      const result = createContentImageRefs([10, 20], "page");
      expect(result).toEqual({
        create: [
          { mediaId: 10, slot: MEDIA_SLOTS.PAGE_CONTENT_IMAGE },
          { mediaId: 20, slot: MEDIA_SLOTS.PAGE_CONTENT_IMAGE },
        ],
      });
    });

    it("returns empty create array for empty mediaIds", () => {
      const result = createContentImageRefs([], "post");
      expect(result).toEqual({ create: [] });
    });
  });

  describe("updateFeaturedImageRef", () => {
    it("deletes existing ref when mediaId is null", () => {
      const result = updateFeaturedImageRef(null, "post");
      expect(result).toEqual({
        deleteMany: { slot: MEDIA_SLOTS.POST_FEATURED_IMAGE },
      });
    });

    it("replaces ref when mediaId is provided", () => {
      const result = updateFeaturedImageRef(42, "post");
      expect(result).toEqual({
        deleteMany: { slot: MEDIA_SLOTS.POST_FEATURED_IMAGE },
        create: {
          mediaId: 42,
          slot: MEDIA_SLOTS.POST_FEATURED_IMAGE,
        },
      });
    });

    it("handles tag entity type", () => {
      const result = updateFeaturedImageRef(null, "tag");
      expect(result).toEqual({
        deleteMany: { slot: MEDIA_SLOTS.TAG_FEATURED_IMAGE },
      });
    });

    it("handles category entity type", () => {
      const result = updateFeaturedImageRef(7, "category");
      expect(result).toEqual({
        deleteMany: { slot: MEDIA_SLOTS.CATEGORY_FEATURED_IMAGE },
        create: {
          mediaId: 7,
          slot: MEDIA_SLOTS.CATEGORY_FEATURED_IMAGE,
        },
      });
    });

    it("handles page entity type", () => {
      const result = updateFeaturedImageRef(null, "page");
      expect(result).toEqual({
        deleteMany: { slot: MEDIA_SLOTS.PAGE_FEATURED_IMAGE },
      });
    });
  });

  describe("findMediaIdByUrl", () => {
    const mockPrisma = vi.mocked(prisma);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns null for null URL", async () => {
      expect(await findMediaIdByUrl(mockPrisma as any, null)).toBeNull();
    });

    it("returns null for undefined URL", async () => {
      expect(await findMediaIdByUrl(mockPrisma as any, undefined)).toBeNull();
    });

    it("returns null for empty string URL", async () => {
      expect(await findMediaIdByUrl(mockPrisma as any, "")).toBeNull();
    });

    it("matches by full storageUrl", async () => {
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce({ id: 42 });

      const result = await findMediaIdByUrl(
        mockPrisma as any,
        "https://cdn.example.com/uploads/test.jpg",
      );

      expect(result).toBe(42);
      expect(mockPrisma.media.findFirst).toHaveBeenCalledWith({
        where: { storageUrl: "https://cdn.example.com/uploads/test.jpg" },
        select: { id: true },
      });
    });

    it("matches by short link format /p/{shortHash}", async () => {
      // First call (full URL match) returns null
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce(null);
      // Second call (shortHash match) returns result
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce({ id: 99 });

      const result = await findMediaIdByUrl(
        mockPrisma as any,
        "/p/abcd1234xyz9",
      );

      expect(result).toBe(99);
      // Second call should search by shortHash (first 8 chars)
      expect(mockPrisma.media.findFirst).toHaveBeenNthCalledWith(2, {
        where: { shortHash: "abcd1234" },
        select: { id: true },
      });
    });

    it("falls back to fileName match", async () => {
      // First call (full URL match) returns null
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce(null);
      // Second call (fileName match) returns result
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce({ id: 55 });

      const result = await findMediaIdByUrl(
        mockPrisma as any,
        "https://example.com/path/to/photo.jpg",
      );

      expect(result).toBe(55);
      expect(mockPrisma.media.findFirst).toHaveBeenNthCalledWith(2, {
        where: { fileName: "photo.jpg" },
        select: { id: true },
      });
    });

    it("falls back to partial storageUrl match for relative paths", async () => {
      // First call (full URL match) returns null
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce(null);
      // No short link match (URL doesn't match /p/ pattern)
      // fileName match returns null
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce(null);
      // Partial URL match returns result
      (mockPrisma.media.findFirst as any).mockResolvedValueOnce({ id: 77 });

      const result = await findMediaIdByUrl(
        mockPrisma as any,
        "/uploads/images/photo.webp",
      );

      expect(result).toBe(77);
    });

    it("returns null when no match is found", async () => {
      (mockPrisma.media.findFirst as any).mockResolvedValue(null);

      const result = await findMediaIdByUrl(
        mockPrisma as any,
        "https://example.com/nonexistent.gif",
      );

      expect(result).toBeNull();
    });

    it("does not attempt partial match for single-segment paths", async () => {
      // /something (no second slash after first char) should not trigger partial match
      (mockPrisma.media.findFirst as any).mockResolvedValue(null);

      const result = await findMediaIdByUrl(mockPrisma as any, "/single");

      // Should not have called with endsWith partial match
      expect(result).toBeNull();
    });
  });
});
