import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock crypto - using importOriginal to keep the actual implementation
const mockVerify = vi.fn().mockReturnValue(true);
const mockCreatePublicKey = vi.fn().mockReturnValue("mock-key-object");

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    createPublicKey: mockCreatePublicKey,
    verify: mockVerify,
  };
});

// Mock cloud-signature - need to properly handle base64url decoding
vi.mock("@/lib/shared/cloud-signature", () => ({
  decodeBase64Url: vi.fn().mockImplementation((input: string) => {
    // Convert base64url to base64 and decode
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(base64, "base64");
  }),
  extractDnsTxtPublicKey: vi.fn().mockReturnValue("mock-key-material"),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("cloud-trigger-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          Status: 0,
          AD: true,
          Answer: [
            {
              data: '"mock-key-base64"',
              type: 16,
            },
          ],
        }),
    });
  });

  describe("verifyCloudTriggerToken", () => {
    it("当 token 格式错误时应返回失败", async () => {
      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );
      const result = await verifyCloudTriggerToken({
        token: "invalid-token",
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toBe("token 格式错误");
      expect(result.source).toBe("NONE");
      expect(result.claims).toBeNull();
    });

    it("当 token 只有两段时应返回格式错误", async () => {
      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );
      const result = await verifyCloudTriggerToken({
        token: "header.payload",
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toBe("token 格式错误");
    });

    it("当 token 算法不是 EdDSA 时应返回算法不支持", async () => {
      // 构造一个有效的 JWT 格式但算法不是 EdDSA
      const header = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(JSON.stringify({ iss: "test" })).toString(
        "base64url",
      );
      const signature = Buffer.from("sig").toString("base64url");
      const token = `${header}.${payload}.${signature}`;

      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );
      const result = await verifyCloudTriggerToken({
        token,
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      expect(result.ok).toBe(false);
      expect(result.message).toBe("token 算法不支持");
      expect(result.claims).toBeDefined();
    });

    it("应返回 verifyMs 耗时", async () => {
      const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
        "base64url",
      );
      const payload = Buffer.from(JSON.stringify({ iss: "test" })).toString(
        "base64url",
      );
      const signature = Buffer.from("sig").toString("base64url");
      const token = `${header}.${payload}.${signature}`;

      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );
      const result = await verifyCloudTriggerToken({
        token,
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      expect(typeof result.verifyMs).toBe("number");
      expect(result.verifyMs).toBeGreaterThanOrEqual(0);
    });

    it("当 DoH 和 JWKS 都无法验证签名时应返回失败", async () => {
      // Mock DoH 返回非 AD（DNSSEC 验证失败）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Status: 0,
            AD: false,
            Answer: [],
          }),
      });

      // Mock JWKS 返回空
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keys: [] }),
      });

      const header = Buffer.from(
        JSON.stringify({ alg: "EdDSA", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          iss: "test-issuer",
          aud: "test-audience",
          siteId: "site-1",
          deliveryId: "delivery-1",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString("base64url");
      const signature = Buffer.from("sig").toString("base64url");
      const token = `${header}.${payload}.${signature}`;

      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );
      const result = await verifyCloudTriggerToken({
        token,
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      expect(result.ok).toBe(false);
      expect(result.source).toBe("NONE");
    });

    it("应包含 token claims 信息（当 token 格式正确时）", async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "EdDSA", typ: "JWT" }),
      ).toString("base64url");
      const claims = {
        iss: "test-issuer",
        aud: "test-audience",
        siteId: "site-1",
        deliveryId: "delivery-1",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const signature = Buffer.from("sig").toString("base64url");
      const token = `${header}.${payload}.${signature}`;

      // Mock fetch to return no keys
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );
      const result = await verifyCloudTriggerToken({
        token,
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      expect(result.claims).toBeDefined();
      expect(result.claims?.iss).toBe("test-issuer");
      expect(result.claims?.siteId).toBe("site-1");
    });

    it("当 token 过期时应返回 token 已过期", async () => {
      const { verifyCloudTriggerToken } = await import(
        "@/lib/server/cloud-trigger-verify"
      );

      const header = Buffer.from(
        JSON.stringify({ alg: "EdDSA", kid: "key-1", typ: "JWT" }),
      ).toString("base64url");
      const claims = {
        iss: "test-issuer",
        aud: "test-audience",
        siteId: "site-1",
        deliveryId: "delivery-1",
        exp: Math.floor(Date.now() / 1000) - 3600, // 过期 1 小时
        iat: Math.floor(Date.now() / 1000) - 7200,
      };
      const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
      const signature = Buffer.from("sig").toString("base64url");
      const token = `${header}.${payload}.${signature}`;

      // Mock DoH 返回有效 key
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Status: 0,
            AD: true,
            Answer: [{ data: '"mock-key"', type: 16 }],
          }),
      });

      // Mock crypto verify to return true
      const crypto = await import("node:crypto");
      (crypto.verify as any).mockReturnValue(true);

      const result = await verifyCloudTriggerToken({
        token,
        expectedSiteId: "site-1",
        expectedDeliveryId: "delivery-1",
        issuer: "test-issuer",
        audience: "test-audience",
        dohDomain: "_verify.example.com",
        jwksUrl: "https://example.com/.well-known/jwks.json",
      });

      // 验证签名通过但 claims 校验失败（过期）
      expect(result.ok).toBe(false);
      expect(result.claims).toBeDefined();
    });
  });
});
