import { describe, expect, it } from "vitest";

import { calculateMD5 } from "@/lib/server/crypto";

describe("crypto utilities", () => {
  describe("calculateMD5", () => {
    it("应返回正确的 MD5 哈希值", () => {
      // 已知的 MD5 哈希值
      expect(calculateMD5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
      expect(calculateMD5("test")).toBe("098f6bcd4621d373cade4e832627b4f6");
    });

    it("应将输入转换为小写后再计算哈希", () => {
      const upperHash = calculateMD5("HELLO@EXAMPLE.COM");
      const lowerHash = calculateMD5("hello@example.com");
      const mixedHash = calculateMD5("Hello@Example.Com");

      expect(upperHash).toBe(lowerHash);
      expect(mixedHash).toBe(lowerHash);
    });

    it("应去除首尾空格后再计算哈希", () => {
      const trimmedHash = calculateMD5("hello");
      const spacedHash = calculateMD5("  hello  ");
      const leadingHash = calculateMD5("hello  ");
      const trailingHash = calculateMD5("  hello");

      expect(trimmedHash).toBe(spacedHash);
      expect(trimmedHash).toBe(leadingHash);
      expect(trimmedHash).toBe(trailingHash);
    });

    it("空字符串应返回有效的 MD5 哈希值", () => {
      // MD5("") = d41d8cd98f00b204e9800998ecf8427e
      expect(calculateMD5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });

    it("仅包含空格的字符串应等同于空字符串", () => {
      // trim 后为空字符串
      expect(calculateMD5("   ")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });

    it("应返回 32 位十六进制字符串", () => {
      const hash = calculateMD5("any input");
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });

    it("不同输入应产生不同的哈希值", () => {
      const hash1 = calculateMD5("input1");
      const hash2 = calculateMD5("input2");
      expect(hash1).not.toBe(hash2);
    });

    it("相同输入应产生相同的哈希值", () => {
      const hash1 = calculateMD5("consistent");
      const hash2 = calculateMD5("consistent");
      expect(hash1).toBe(hash2);
    });

    it("典型邮箱地址场景应正确处理大小写和空格", () => {
      // Gravatar 使用邮箱的 MD5 哈希
      const email = "User@Example.COM";
      const hash = calculateMD5(email);

      // 应等同于对 "user@example.com" 计算哈希
      expect(hash).toBe(calculateMD5("user@example.com"));
      expect(hash).toHaveLength(32);
    });

    it("应正确处理包含 Unicode 字符的输入", () => {
      const hash = calculateMD5("测试中文");
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });

    it("应正确处理包含特殊字符的输入", () => {
      const hash = calculateMD5("!@#$%^&*()");
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[0-9a-f]{32}$/);
    });
  });
});
