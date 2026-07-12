import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  generateImageId,
  generateSignature,
  generateSignedImageId,
  parseImageId,
  SHORT_HASH_LENGTH,
  SIGNATURE_LENGTH,
  verifySignature,
} from "@/lib/server/image-crypto";

// 设置测试所需的环境变量
const TEST_MASTER_SECRET =
  "test-master-secret-key-that-is-at-least-32-chars-long-for-testing";

describe("image-crypto", () => {
  beforeEach(() => {
    process.env.MASTER_SECRET = TEST_MASTER_SECRET;
  });

  afterEach(() => {
    // 清理：确保不影响其他测试
  });

  // ==========================================================================
  // 常量
  // ==========================================================================

  describe("常量", () => {
    it("SHORT_HASH_LENGTH 应为 8", () => {
      expect(SHORT_HASH_LENGTH).toBe(8);
    });

    it("SIGNATURE_LENGTH 应为 4", () => {
      expect(SIGNATURE_LENGTH).toBe(4);
    });
  });

  // ==========================================================================
  // generateSignature
  // ==========================================================================

  describe("generateSignature", () => {
    it("应返回 4 位 base62 签名", () => {
      const signature = generateSignature("abcd1234");
      expect(signature).toHaveLength(SIGNATURE_LENGTH);
    });

    it("相同输入应产生相同的签名", () => {
      const sig1 = generateSignature("abcd1234");
      const sig2 = generateSignature("abcd1234");
      expect(sig1).toBe(sig2);
    });

    it("不同输入应产生不同的签名", () => {
      const sig1 = generateSignature("abcd1234");
      const sig2 = generateSignature("efgh5678");
      expect(sig1).not.toBe(sig2);
    });

    it("签名应只包含 base62 字符", () => {
      const signature = generateSignature("test1234");
      expect(signature).toMatch(/^[0-9A-Za-z]+$/);
    });

    it("签名长度不足 4 时应前补零", () => {
      // 这个测试验证 padStart 逻辑
      // 由于 HMAC 输出的 base62 结果可能很短，padStart 确保长度为 4
      const signature = generateSignature("00000000");
      expect(signature).toHaveLength(SIGNATURE_LENGTH);
    });

    it("MASTER_SECRET 未设置时应抛出错误", () => {
      delete process.env.MASTER_SECRET;
      expect(() => generateSignature("abcd1234")).toThrow(
        "MASTER_SECRET 环境变量未设置",
      );
    });
  });

  // ==========================================================================
  // verifySignature
  // ==========================================================================

  describe("verifySignature", () => {
    it("应验证有效的签名", () => {
      const shortHash = "abcd1234";
      const signature = generateSignature(shortHash);
      expect(verifySignature(shortHash, signature)).toBe(true);
    });

    it("应拒绝无效的签名", () => {
      const shortHash = "abcd1234";
      // 使用一个几乎不可能匹配的签名
      expect(verifySignature(shortHash, "XXXX")).toBe(false);
    });

    it("应拒绝篡改的签名", () => {
      const shortHash = "abcd1234";
      const signature = generateSignature(shortHash);
      // 修改签名的第一个字符
      const tamperedSignature =
        signature[0] === "A"
          ? "B" + signature.slice(1)
          : "A" + signature.slice(1);
      expect(verifySignature(shortHash, tamperedSignature)).toBe(false);
    });

    it("不同 shortHash 的签名不应互相验证", () => {
      const sig1 = generateSignature("abcd1234");
      expect(verifySignature("efgh5678", sig1)).toBe(false);
    });
  });

  // ==========================================================================
  // generateImageId
  // ==========================================================================

  describe("generateImageId", () => {
    it("应返回 12 位的图片 ID（8 位 shortHash + 4 位签名）", () => {
      const imageId = generateImageId("abcd1234");
      expect(imageId).toHaveLength(SHORT_HASH_LENGTH + SIGNATURE_LENGTH);
    });

    it("图片 ID 的前 8 位应为 shortHash", () => {
      const shortHash = "abcd1234";
      const imageId = generateImageId(shortHash);
      expect(imageId.slice(0, SHORT_HASH_LENGTH)).toBe(shortHash);
    });

    it("图片 ID 的后 4 位应为签名", () => {
      const shortHash = "abcd1234";
      const imageId = generateImageId(shortHash);
      const signature = generateSignature(shortHash);
      expect(imageId.slice(SHORT_HASH_LENGTH)).toBe(signature);
    });

    it("不足 8 位的 shortHash 应前补零", () => {
      const imageId = generateImageId("abc");
      // "abc" -> "00000abc" (padStart 8, "0")
      expect(imageId.slice(0, SHORT_HASH_LENGTH)).toBe("00000abc");
    });

    it("超过 8 位的 shortHash 应截断", () => {
      const imageId = generateImageId("abcdefghijk");
      // "abcdefghijk" -> "abcdefgh" (slice 0, 8)
      expect(imageId.slice(0, SHORT_HASH_LENGTH)).toBe("abcdefgh");
    });

    it("相同输入应产生相同的图片 ID", () => {
      const id1 = generateImageId("abcd1234");
      const id2 = generateImageId("abcd1234");
      expect(id1).toBe(id2);
    });

    it("不同输入应产生不同的图片 ID", () => {
      const id1 = generateImageId("abcd1234");
      const id2 = generateImageId("efgh5678");
      expect(id1).not.toBe(id2);
    });
  });

  // ==========================================================================
  // generateSignedImageId
  // ==========================================================================

  describe("generateSignedImageId", () => {
    it("在客户端环境（存在 window 对象）应抛出错误", () => {
      // happy-dom 测试环境提供了 window 对象，因此 generateSignedImageId 应抛出错误
      expect(() => generateSignedImageId("abcd1234")).toThrow(
        "generateSignedImageId can only be used on the server side",
      );
    });

    it("在服务端环境（无 window 对象）应返回与 generateImageId 相同的结果", () => {
      // 临时移除 window 以模拟服务端环境
      const originalWindow = globalThis.window;
      // @ts-expect-error 模拟服务端环境
      delete globalThis.window;

      try {
        const shortHash = "abcd1234";
        const signedId = generateSignedImageId(shortHash);
        const regularId = generateImageId(shortHash);
        expect(signedId).toBe(regularId);
      } finally {
        // 恢复 window 对象
        globalThis.window = originalWindow;
      }
    });

    it("在服务端环境应返回 12 位的图片 ID", () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error 模拟服务端环境
      delete globalThis.window;

      try {
        const signedId = generateSignedImageId("abcd1234");
        expect(signedId).toHaveLength(SHORT_HASH_LENGTH + SIGNATURE_LENGTH);
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  // ==========================================================================
  // parseImageId
  // ==========================================================================

  describe("parseImageId", () => {
    it("应正确解析有效的图片 ID", () => {
      const shortHash = "abcd1234";
      const imageId = generateImageId(shortHash);
      const parsed = parseImageId(imageId);

      expect(parsed).not.toBeNull();
      expect(parsed!.shortHash).toBe(shortHash);
      expect(parsed!.signature).toHaveLength(SIGNATURE_LENGTH);
    });

    it("解析后的签名应与生成的签名一致", () => {
      const shortHash = "abcd1234";
      const imageId = generateImageId(shortHash);
      const parsed = parseImageId(imageId);
      const expectedSignature = generateSignature(shortHash);

      expect(parsed!.signature).toBe(expectedSignature);
    });

    it("长度不足 12 的图片 ID 应返回 null", () => {
      expect(parseImageId("")).toBeNull();
      expect(parseImageId("abc")).toBeNull();
      expect(parseImageId("abcdefghij")).toBeNull(); // 10 位
      expect(parseImageId("abcdefghijk")).toBeNull(); // 11 位
    });

    it("长度超过 12 的图片 ID 应返回 null", () => {
      expect(parseImageId("abcdefghijklm")).toBeNull(); // 13 位
    });

    it("恰好 12 位但包含非 base62 字符的图片 ID 应返回 null", () => {
      expect(parseImageId("abcd1234!@#$")).toBeNull(); // 包含特殊字符
      expect(parseImageId("abcd1234 ef0")).toBeNull(); // 包含空格
    });

    it("恰好 12 位且全部为 base62 字符的图片 ID 应成功解析", () => {
      const result = parseImageId("abcd1234efgh");
      expect(result).not.toBeNull();
      expect(result!.shortHash).toBe("abcd1234");
      expect(result!.signature).toBe("efgh");
    });

    it("应正确分离 shortHash 和 signature", () => {
      const imageId = "ABCD1234wxyz";
      const parsed = parseImageId(imageId);
      expect(parsed).not.toBeNull();
      expect(parsed!.shortHash).toBe("ABCD1234");
      expect(parsed!.signature).toBe("wxyz");
    });
  });

  // ==========================================================================
  // 端到端集成测试
  // ==========================================================================

  describe("端到端集成", () => {
    it("生成的图片 ID 应能正确解析和验证", () => {
      const shortHash = "a1b2c3d4";
      const imageId = generateImageId(shortHash);
      const parsed = parseImageId(imageId);

      expect(parsed).not.toBeNull();
      expect(parsed!.shortHash).toBe(shortHash);
      expect(verifySignature(shortHash, parsed!.signature)).toBe(true);
    });

    it("篡改的图片 ID 应验证失败", () => {
      const shortHash = "a1b2c3d4";
      const imageId = generateImageId(shortHash);
      const parsed = parseImageId(imageId);

      // 篡改 shortHash 部分
      const tamperedShortHash = "x1b2c3d4";
      expect(verifySignature(tamperedShortHash, parsed!.signature)).toBe(false);
    });

    it("使用不同密钥生成的签名应验证失败", () => {
      const shortHash = "a1b2c3d4";
      const imageId = generateImageId(shortHash);
      const parsed = parseImageId(imageId);

      // 更换密钥
      process.env.MASTER_SECRET =
        "different-test-master-secret-key-that-is-at-least-32-characters";
      expect(verifySignature(shortHash, parsed!.signature)).toBe(false);
    });

    it("应处理各种 shortHash 格式", () => {
      const testCases = [
        "00000000", // 全零
        "zzzzzzzz", // 全 z
        "0aA9zZ1b", // 混合字符
        "FFFFFFFF", // 全大写
      ];

      for (const shortHash of testCases) {
        const imageId = generateImageId(shortHash);
        expect(imageId).toHaveLength(12);
        const parsed = parseImageId(imageId);
        expect(parsed).not.toBeNull();
        expect(parsed!.shortHash).toBe(shortHash);
        expect(verifySignature(shortHash, parsed!.signature)).toBe(true);
      }
    });
  });
});
