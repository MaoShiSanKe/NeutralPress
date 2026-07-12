import { describe, expect, it } from "vitest";

import {
  buildCloudSignMessage,
  canonicalStringify,
  decodeBase64Url,
  encodeBase64Url,
  extractDnsTxtPublicKey,
  generateNonce,
  sha256Base64Url,
} from "@/lib/shared/cloud-signature";

describe("cloud-signature", () => {
  describe("canonicalStringify", () => {
    it("对对象键进行排序", () => {
      const result = canonicalStringify({ b: 2, a: 1 });
      expect(result).toBe('{"a":1,"b":2}');
    });

    it("递归排序嵌套对象", () => {
      const result = canonicalStringify({ b: { d: 4, c: 3 }, a: 1 });
      expect(result).toBe('{"a":1,"b":{"c":3,"d":4}}');
    });

    it("处理数组", () => {
      const result = canonicalStringify({ items: [3, 1, 2] });
      expect(result).toBe('{"items":[3,1,2]}');
    });

    it("处理数组中的对象", () => {
      const result = canonicalStringify([{ b: 2, a: 1 }]);
      expect(result).toBe('[{"a":1,"b":2}]');
    });

    it("处理 null 值", () => {
      expect(canonicalStringify(null)).toBe("null");
    });

    it("处理原始值", () => {
      expect(canonicalStringify(42)).toBe("42");
      expect(canonicalStringify("hello")).toBe('"hello"');
    });
  });

  describe("encodeBase64Url / decodeBase64Url", () => {
    it("编码和解码往返一致", () => {
      const input = Buffer.from("Hello, World!");
      const encoded = encodeBase64Url(input);
      const decoded = decodeBase64Url(encoded);
      expect(decoded).toEqual(input);
    });

    it("编码结果不含 +, /, = 字符", () => {
      // 使用包含会产生 + / = 的输入
      const input = Buffer.from([0xff, 0xff, 0xff, 0xfe]);
      const encoded = encodeBase64Url(input);
      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
    });

    it("处理空输入", () => {
      const input = Buffer.from([]);
      const encoded = encodeBase64Url(input);
      const decoded = decodeBase64Url(encoded);
      expect(decoded).toEqual(input);
    });
  });

  describe("sha256Base64Url", () => {
    it("生成确定性哈希", () => {
      const hash1 = sha256Base64Url("test");
      const hash2 = sha256Base64Url("test");
      expect(hash1).toBe(hash2);
    });

    it("不同输入产生不同哈希", () => {
      const hash1 = sha256Base64Url("test1");
      const hash2 = sha256Base64Url("test2");
      expect(hash1).not.toBe(hash2);
    });

    it("结果是有效的 base64url 字符串", () => {
      const hash = sha256Base64Url("hello");
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("空字符串也能生成哈希", () => {
      const hash = sha256Base64Url("");
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("generateNonce", () => {
    it("生成默认长度的 nonce", () => {
      const nonce = generateNonce();
      expect(nonce).toBeTruthy();
      expect(typeof nonce).toBe("string");
    });

    it("每次生成不同的 nonce", () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });

    it("自定义长度", () => {
      const nonce = generateNonce(32);
      expect(nonce).toBeTruthy();
    });

    it("结果是有效的 base64url 字符串", () => {
      const nonce = generateNonce();
      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("buildCloudSignMessage", () => {
    it("构建签名消息", () => {
      const message = buildCloudSignMessage({
        method: "POST",
        path: "/api/test",
        payload: { key: "value" },
        ts: "1234567890",
        nonce: "abc123",
      });

      expect(message).toContain("NP-CLOUD-SIGN-V1");
      expect(message).toContain("POST");
      expect(message).toContain("/api/test");
      expect(message).toContain("1234567890");
      expect(message).toContain("abc123");
    });

    it("method 转换为大写", () => {
      const message = buildCloudSignMessage({
        method: "get",
        path: "/api/test",
        payload: {},
        ts: "0",
        nonce: "n",
      });

      expect(message).toContain("GET");
    });

    it("payload 被规范化后哈希", () => {
      const message1 = buildCloudSignMessage({
        method: "POST",
        path: "/test",
        payload: { b: 2, a: 1 },
        ts: "0",
        nonce: "n",
      });
      const message2 = buildCloudSignMessage({
        method: "POST",
        path: "/test",
        payload: { a: 1, b: 2 },
        ts: "0",
        nonce: "n",
      });

      // 键顺序不同但规范化后应相同
      expect(message1).toBe(message2);
    });
  });

  describe("extractDnsTxtPublicKey", () => {
    it("提取 p= 字段的值", () => {
      const input = "v=spf1; p=MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE";
      const result = extractDnsTxtPublicKey(input);
      expect(result).toBe("MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE");
    });

    it("无分号和等号时返回原始字符串", () => {
      const input = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE";
      const result = extractDnsTxtPublicKey(input);
      expect(result).toBe(input);
    });

    it("p= 字段不存在时返回原始字符串", () => {
      const input = "v=spf1; k=rsa";
      const result = extractDnsTxtPublicKey(input);
      expect(result).toBe("v=spf1; k=rsa");
    });

    it("p= 字段为空时返回原始字符串", () => {
      const input = "v=spf1; p=; k=rsa";
      const result = extractDnsTxtPublicKey(input);
      expect(result).toBe("v=spf1; p=; k=rsa");
    });

    it("处理包含多个 = 号的 p 值", () => {
      const input = "v=spf1; p=key==";
      const result = extractDnsTxtPublicKey(input);
      expect(result).toBe("key==");
    });

    it("修剪空白", () => {
      const input = "  key123  ";
      const result = extractDnsTxtPublicKey(input);
      expect(result).toBe("key123");
    });
  });
});
