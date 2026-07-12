import { describe, expect, it } from "vitest";

import {
  deriveCacheBootstrapToken,
  deriveInternalToken,
  deriveWatchtowerApiToken,
  INTERNAL_TOKEN_PURPOSES,
  isSecureTokenEqual,
  parseBearerToken,
} from "@/lib/shared/cache-bootstrap-auth";

describe("cache-bootstrap-auth", () => {
  describe("INTERNAL_TOKEN_PURPOSES", () => {
    it("包含 CACHE_BOOTSTRAP", () => {
      expect(INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP).toBe(
        "cache-bootstrap-v1",
      );
    });

    it("包含 WATCHTOWER_API", () => {
      expect(INTERNAL_TOKEN_PURPOSES.WATCHTOWER_API).toBe("watchtower-api-v1");
    });
  });

  describe("parseBearerToken", () => {
    it("解析有效的 Bearer token", () => {
      expect(parseBearerToken("Bearer mytoken123")).toBe("mytoken123");
    });

    it("Bearer 后有空格时修剪", () => {
      expect(parseBearerToken("Bearer   mytoken  ")).toBe("mytoken");
    });

    it("null 返回 null", () => {
      expect(parseBearerToken(null)).toBeNull();
    });

    it("空字符串返回 null", () => {
      expect(parseBearerToken("")).toBeNull();
    });

    it("不以 Bearer 开头返回 null", () => {
      expect(parseBearerToken("Basic abc123")).toBeNull();
    });

    it("仅 Bearer 前缀无 token 返回 null", () => {
      expect(parseBearerToken("Bearer ")).toBeNull();
    });

    it("Bearer 后仅空格返回 null", () => {
      expect(parseBearerToken("Bearer   ")).toBeNull();
    });
  });

  describe("deriveInternalToken", () => {
    const validSecret = "a".repeat(32);

    it("从主密钥派生 token", () => {
      const token = deriveInternalToken(
        validSecret,
        INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP,
      );
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
    });

    it("相同输入产生相同输出", () => {
      const token1 = deriveInternalToken(
        validSecret,
        INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP,
      );
      const token2 = deriveInternalToken(
        validSecret,
        INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP,
      );
      expect(token1).toBe(token2);
    });

    it("不同 purpose 产生不同 token", () => {
      const token1 = deriveInternalToken(
        validSecret,
        INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP,
      );
      const token2 = deriveInternalToken(
        validSecret,
        INTERNAL_TOKEN_PURPOSES.WATCHTOWER_API,
      );
      expect(token1).not.toBe(token2);
    });

    it("主密钥长度不足时抛出错误", () => {
      expect(() => deriveInternalToken("short", "cache-bootstrap-v1")).toThrow(
        "MASTER_SECRET 长度不足",
      );
    });

    it("结果是有效的 base64url 格式", () => {
      const token = deriveInternalToken(
        validSecret,
        INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP,
      );
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("deriveCacheBootstrapToken", () => {
    it("正确派生缓存引导 token", () => {
      const secret = "a".repeat(32);
      const token = deriveCacheBootstrapToken(secret);
      const expected = deriveInternalToken(
        secret,
        INTERNAL_TOKEN_PURPOSES.CACHE_BOOTSTRAP,
      );
      expect(token).toBe(expected);
    });
  });

  describe("deriveWatchtowerApiToken", () => {
    it("正确派生 watchtower API token", () => {
      const secret = "a".repeat(32);
      const token = deriveWatchtowerApiToken(secret);
      const expected = deriveInternalToken(
        secret,
        INTERNAL_TOKEN_PURPOSES.WATCHTOWER_API,
      );
      expect(token).toBe(expected);
    });
  });

  describe("isSecureTokenEqual", () => {
    it("相同 token 返回 true", () => {
      expect(isSecureTokenEqual("abc123", "abc123")).toBe(true);
    });

    it("不同 token 返回 false", () => {
      expect(isSecureTokenEqual("abc123", "xyz789")).toBe(false);
    });

    it("长度不同的 token 返回 false", () => {
      expect(isSecureTokenEqual("abc", "abcdef")).toBe(false);
    });

    it("空字符串相等返回 true", () => {
      expect(isSecureTokenEqual("", "")).toBe(true);
    });
  });
});
