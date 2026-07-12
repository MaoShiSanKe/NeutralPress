import { beforeEach, describe, expect, it, vi } from "vitest";

// ============ Mocks ============

const mockHeaders = vi.fn().mockReturnValue(new Headers());
vi.mock("next/headers", () => ({
  headers: (...args: unknown[]) => mockHeaders(...args),
}));

const mockLimitControl = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/server/rate-limit", () => ({
  default: (...args: unknown[]) => mockLimitControl(...args),
}));

const mockAuthVerify = vi.fn();
vi.mock("@/lib/server/auth-verify", () => ({
  authVerify: (...args: unknown[]) => mockAuthVerify(...args),
}));

const mockGetAblyApiKey = vi.fn();
vi.mock("@/lib/server/ably-config", () => ({
  getAblyApiKey: (...args: unknown[]) => mockGetAblyApiKey(...args),
}));

// Mock Ably Rest client
const mockCreateTokenRequest = vi.fn();
vi.mock("ably", () => {
  return {
    Rest: class MockRest {
      auth: { createTokenRequest: ReturnType<typeof vi.fn> };
      constructor(_config: unknown) {
        this.auth = {
          createTokenRequest: mockCreateTokenRequest,
        };
      }
    },
  };
});

// ============ Tests ============

describe("ably actions", () => {
  let getAblyTokenRequest: typeof import("@/actions/ably").getAblyTokenRequest;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/ably");
    getAblyTokenRequest = mod.getAblyTokenRequest;
  });

  describe("getAblyTokenRequest", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getAblyTokenRequest();
      expect(result.success).toBe(false);
    });

    it("Ably 未配置时应返回 503", async () => {
      mockGetAblyApiKey.mockResolvedValue(null);
      const result = await getAblyTokenRequest();
      expect(result.success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockGetAblyApiKey.mockResolvedValue("test-api-key");
      mockAuthVerify.mockResolvedValue(null);
      const result = await getAblyTokenRequest();
      expect(result.success).toBe(false);
      expect(result.message).toContain("未登录");
    });

    it("成功获取 Token Request", async () => {
      mockGetAblyApiKey.mockResolvedValue("test-api-key");
      mockAuthVerify.mockResolvedValue({ uid: 42, role: "USER" });
      const mockToken = { ttl: 3600000, clientId: "user:42" };
      mockCreateTokenRequest.mockResolvedValue(mockToken);

      const result = await getAblyTokenRequest();
      expect(result.success).toBe(true);
      expect(result.data.tokenRequest).toEqual(mockToken);
      expect(result.data.userUid).toBe(42);
    });

    it("Token 生成失败时应返回 500", async () => {
      mockGetAblyApiKey.mockResolvedValue("test-api-key");
      mockAuthVerify.mockResolvedValue({ uid: 42, role: "USER" });
      mockCreateTokenRequest.mockRejectedValue(new Error("Ably error"));

      const result = await getAblyTokenRequest();
      expect(result.success).toBe(false);
    });
  });
});
