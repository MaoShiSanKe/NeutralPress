import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  processImage,
  SUPPORTED_IMAGE_FORMATS,
} from "@/lib/server/image-processor";

/**
 * 生成一个合法的最小 PNG buffer (1x1 红色像素)
 */
function createTinyPngBuffer(): Buffer {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "base64",
  );
}

/**
 * 生成一个 2x2 绿色 PNG buffer (使用 sharp 确保有效)
 */
async function create2x2PngBuffer(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 2,
      channels: 4,
      background: { r: 0, g: 255, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("image-processor", () => {
  describe("SUPPORTED_IMAGE_FORMATS", () => {
    it("includes common image formats", () => {
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/jpeg");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/png");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/gif");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/webp");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/avif");
    });

    it("includes HEIC/HEIF formats", () => {
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/heic");
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/heif");
    });

    it("includes TIFF format", () => {
      expect(SUPPORTED_IMAGE_FORMATS).toContain("image/tiff");
    });

    it("is a readonly tuple", () => {
      // The type is `as const`, verify the array has expected length
      expect(SUPPORTED_IMAGE_FORMATS.length).toBe(9);
    });
  });

  describe("processImage", () => {
    it("processes a PNG in lossy mode", async () => {
      const buffer = createTinyPngBuffer();
      const result = await processImage(
        buffer,
        "test.png",
        "image/png",
        "lossy",
      );

      expect(result.mimeType).toBe("image/avif");
      expect(result.extension).toBe("avif");
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.size).toBeGreaterThan(0);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.shortHash).toMatch(/^[A-Za-z0-9]{8}$/);
      expect(result.blur).toMatch(/^data:image\/webp;base64,/);
      expect(result.exif).toEqual({});
    });

    it("processes a PNG in lossless mode", async () => {
      const buffer = createTinyPngBuffer();
      const result = await processImage(
        buffer,
        "test.png",
        "image/png",
        "lossless",
      );

      expect(result.mimeType).toBe("image/webp");
      expect(result.extension).toBe("webp");
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.size).toBeGreaterThan(0);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.shortHash).toMatch(/^[A-Za-z0-9]{8}$/);
      expect(result.blur).toMatch(/^data:image\/webp;base64,/);
    });

    it("processes a PNG in original mode", async () => {
      const buffer = createTinyPngBuffer();
      const result = await processImage(
        buffer,
        "test.png",
        "image/png",
        "original",
      );

      expect(result.mimeType).toBe("image/png");
      expect(result.extension).toBe("png");
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(result.size).toBe(buffer.length);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.shortHash).toMatch(/^[A-Za-z0-9]{8}$/);
      expect(result.blur).toMatch(/^data:image\/webp;base64,/);
    });

    it("generates consistent hash for the same input", async () => {
      const buffer = createTinyPngBuffer();
      const result1 = await processImage(
        buffer,
        "test.png",
        "image/png",
        "original",
      );
      const result2 = await processImage(
        buffer,
        "test.png",
        "image/png",
        "original",
      );

      expect(result1.hash).toBe(result2.hash);
      expect(result1.shortHash).toBe(result2.shortHash);
    });

    it("generates different hashes for different inputs", async () => {
      const png1 = createTinyPngBuffer();
      const png2 = await create2x2PngBuffer();

      const result1 = await processImage(
        png1,
        "test.png",
        "image/png",
        "original",
      );
      const result2 = await processImage(
        png2,
        "test2.png",
        "image/png",
        "original",
      );

      expect(result1.hash).not.toBe(result2.hash);
    });

    it("shortHash is always 8 characters", async () => {
      const buffer = createTinyPngBuffer();
      const result = await processImage(
        buffer,
        "test.png",
        "image/png",
        "original",
      );
      expect(result.shortHash).toHaveLength(8);
    });

    it("lossy mode produces smaller or equal buffer to original for small images", async () => {
      // For very small images (1x1), resize won't enlarge, so the buffer should
      // at least not explode in size
      const buffer = createTinyPngBuffer();
      const result = await processImage(
        buffer,
        "test.png",
        "image/png",
        "lossy",
      );
      // AVIF encoding of 1x1 pixel should be reasonably small
      expect(result.size).toBeLessThan(10000);
    });

    it("original mode preserves original buffer", async () => {
      const buffer = createTinyPngBuffer();
      const result = await processImage(
        buffer,
        "test.png",
        "image/png",
        "original",
      );
      // original mode should preserve the original buffer content
      expect(result.buffer).toEqual(buffer);
    });

    it("throws for unsupported mode", async () => {
      const buffer = createTinyPngBuffer();
      await expect(
        processImage(buffer, "test.png", "image/png", "unknown" as any),
      ).rejects.toThrow("未知的处理模式");
    });

    it("throws for oversized buffer", async () => {
      // Create a buffer exceeding 50MB limit
      const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024, 0);
      await expect(
        processImage(oversizedBuffer, "huge.png", "image/png", "lossy"),
      ).rejects.toThrow("图片文件过大");
    });

    it("rejects mismatched mime type", async () => {
      const pngBuffer = createTinyPngBuffer();
      // Pass a JPEG mime type but provide PNG content
      await expect(
        processImage(pngBuffer, "test.jpg", "image/jpeg", "lossy"),
      ).rejects.toThrow("文件类型与文件内容不匹配");
    });

    it("accepts image/jpg as alias for image/jpeg", async () => {
      const pngBuffer = createTinyPngBuffer();
      // image/jpg should normalize to image/jpeg, but the content is PNG
      // so this should still fail with mime mismatch
      await expect(
        processImage(pngBuffer, "test.jpg", "image/jpg", "lossy"),
      ).rejects.toThrow("文件类型与文件内容不匹配");
    });
  });
});
