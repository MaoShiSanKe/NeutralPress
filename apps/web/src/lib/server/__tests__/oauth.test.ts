import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
}));

// Mock arctic with proper classes
const mockCreateAuthorizationURL = vi
  .fn()
  .mockReturnValue(new URL("https://accounts.google.com/o/oauth2/v2/auth"));
const mockValidateAuthorizationCode = vi.fn();

class MockGoogle {
  createAuthorizationURL = mockCreateAuthorizationURL;
  validateAuthorizationCode = mockValidateAuthorizationCode;
  constructor(
    _clientId?: string,
    _clientSecret?: string,
    _redirectUri?: string,
  ) {}
}

class MockGitHub {
  createAuthorizationURL = mockCreateAuthorizationURL;
  validateAuthorizationCode = mockValidateAuthorizationCode;
  constructor(
    _clientId?: string,
    _clientSecret?: string,
    _redirectUri?: string,
  ) {}
}

class MockMicrosoftEntraId {
  createAuthorizationURL = mockCreateAuthorizationURL;
  validateAuthorizationCode = mockValidateAuthorizationCode;
  constructor(
    _tenant?: string,
    _clientId?: string,
    _clientSecret?: string,
    _redirectUri?: string,
  ) {}
}

vi.mock("arctic", () => ({
  generateCodeVerifier: vi.fn().mockReturnValue("test-code-verifier"),
  Google: MockGoogle,
  GitHub: MockGitHub,
  MicrosoftEntraId: MockMicrosoftEntraId,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfig.mockImplementation(async (key: string) => {
      const configs: Record<string, unknown> = {
        "site.url": "https://example.com",
        "user.sso.google.enabled": true,
        "user.sso.google": {
          clientId: "google-id",
          clientSecret: "google-secret",
        },
        "user.sso.github.enabled": true,
        "user.sso.github": {
          clientId: "github-id",
          clientSecret: "github-secret",
        },
        "user.sso.microsoft.enabled": true,
        "user.sso.microsoft": {
          clientId: "ms-id",
          clientSecret: "ms-secret",
        },
      };
      return configs[key];
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "123",
        email: "test@example.com",
        name: "Test User",
      }),
    });

    mockValidateAuthorizationCode.mockResolvedValue({
      accessToken: () => "test-access-token",
    });
  });

  // =========================================================================
  // isOAuthEnabled
  // =========================================================================
  describe("isOAuthEnabled", () => {
    it("当 Google OAuth 已启用且配置完整时应返回 true", async () => {
      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("google");
      expect(result).toBe(true);
    });

    it("当 OAuth 未启用时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "user.sso.google.enabled") return false;
        if (key === "user.sso.google")
          return { clientId: "id", clientSecret: "secret" };
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("google");
      expect(result).toBe(false);
    });

    it("当缺少 clientId 时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "user.sso.google.enabled") return true;
        if (key === "user.sso.google")
          return { clientId: "", clientSecret: "secret" };
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("google");
      expect(result).toBe(false);
    });

    it("当缺少 clientSecret 时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "user.sso.google.enabled") return true;
        if (key === "user.sso.google")
          return { clientId: "id", clientSecret: "" };
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("google");
      expect(result).toBe(false);
    });

    it("当配置获取失败时应返回 false", async () => {
      mockGetConfig.mockRejectedValueOnce(new Error("Config error"));

      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("google");
      expect(result).toBe(false);
    });

    it("应支持 GitHub 提供商", async () => {
      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("github");
      expect(result).toBe(true);
    });

    it("应支持 Microsoft 提供商", async () => {
      const { isOAuthEnabled } = await import("@/lib/server/oauth");
      const result = await isOAuthEnabled("microsoft");
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // getAuthorizationUrl
  // =========================================================================
  describe("getAuthorizationUrl", () => {
    it("应返回 Google 授权 URL 和 codeVerifier", async () => {
      const { getAuthorizationUrl } = await import("@/lib/server/oauth");
      const result = await getAuthorizationUrl("google", "test-state");

      expect(result.url).toBeDefined();
      expect(result.codeVerifier).toBe("test-code-verifier");
    });

    it("应返回 GitHub 授权 URL（无 codeVerifier）", async () => {
      const { getAuthorizationUrl } = await import("@/lib/server/oauth");
      const result = await getAuthorizationUrl("github", "test-state");

      expect(result.url).toBeDefined();
      // GitHub 不需要 codeVerifier
      expect(result.codeVerifier).toBeUndefined();
    });

    it("应返回 Microsoft 授权 URL 和 codeVerifier", async () => {
      const { getAuthorizationUrl } = await import("@/lib/server/oauth");
      const result = await getAuthorizationUrl("microsoft", "test-state");

      expect(result.url).toBeDefined();
      expect(result.codeVerifier).toBe("test-code-verifier");
    });

    it("当 OAuth 未启用时应抛出错误", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "user.sso.google.enabled") return false;
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { getAuthorizationUrl } = await import("@/lib/server/oauth");
      await expect(getAuthorizationUrl("google", "state")).rejects.toThrow(
        "未启用",
      );
    });

    it("不支持的提供商应抛出错误", async () => {
      const { getAuthorizationUrl } = await import("@/lib/server/oauth");
      // getOAuthConfig 会先运行，由于 unknown 没有配置，会先抛出 "未启用"
      await expect(
        getAuthorizationUrl("unknown" as any, "state"),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // validateOAuthCallback
  // =========================================================================
  describe("validateOAuthCallback", () => {
    it("应验证 Google 回调并返回用户信息", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "google-123",
          email: "user@gmail.com",
          name: "Google User",
          picture: "https://example.com/avatar.jpg",
        }),
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback(
        "google",
        "auth-code",
        "code-verifier",
      );

      expect(result.provider).toBe("google");
      expect(result.providerAccountId).toBe("google-123");
      expect(result.email).toBe("user@gmail.com");
      expect(result.name).toBe("Google User");
      expect(result.avatar).toBe("https://example.com/avatar.jpg");
    });

    it("应验证 GitHub 回调并返回用户信息", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 456,
          email: "user@github.com",
          name: "GitHub User",
          login: "ghuser",
          avatar_url: "https://example.com/gh-avatar.jpg",
        }),
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback("github", "auth-code");

      expect(result.provider).toBe("github");
      expect(result.providerAccountId).toBe("456");
      expect(result.email).toBe("user@github.com");
      expect(result.name).toBe("GitHub User");
    });

    it("GitHub 无邮箱时应通过 /user/emails 获取", async () => {
      // 第一次请求：用户信息（无邮箱）
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 789,
          email: null,
          name: "User",
          login: "ghuser2",
          avatar_url: "https://example.com/avatar.jpg",
        }),
      });

      // 第二次请求：邮箱列表
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { email: "secondary@example.com", primary: false },
          { email: "primary@example.com", primary: true },
        ],
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback("github", "auth-code");

      expect(result.email).toBe("primary@example.com");
    });

    it("GitHub 无邮箱且 emails API 也无主要邮箱时使用第一个", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 790,
          email: null,
          name: "User",
          login: "ghuser3",
          avatar_url: "https://example.com/avatar.jpg",
        }),
      });

      // GitHub emails API 返回数组格式
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { email: "first@example.com", primary: false },
          { email: "second@example.com", primary: false },
        ],
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback("github", "auth-code");

      expect(result.email).toBe("first@example.com");
    });

    it("GitHub 完全无法获取邮箱时应抛出错误", async () => {
      // 重置 fetch mock 以确保干净状态
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 791,
          email: null,
          name: "User",
          login: "ghuser4",
          avatar_url: "https://example.com/avatar.jpg",
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(
        validateOAuthCallback("github", "auth-code"),
      ).rejects.toThrow();
    });

    it("应验证 Microsoft 回调并返回用户信息", async () => {
      // 重置 fetch mock 以确保干净状态
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ms-123",
          mail: "user@outlook.com",
          userPrincipalName: "user@outlook.com",
          displayName: "MS User",
        }),
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback(
        "microsoft",
        "auth-code",
        "code-verifier",
      );

      expect(result.provider).toBe("microsoft");
      expect(result.providerAccountId).toBe("ms-123");
      expect(result.email).toBe("user@outlook.com");
      expect(result.name).toBe("MS User");
    });

    it("Microsoft mail 为 null 时使用 userPrincipalName", async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ms-456",
          mail: null,
          userPrincipalName: "user@contoso.com",
          displayName: "MS User 2",
        }),
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback(
        "microsoft",
        "auth-code",
        "code-verifier",
      );

      expect(result.email).toBe("user@contoso.com");
    });

    it("Microsoft 无邮箱时应抛出错误", async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ms-789",
          mail: null,
          userPrincipalName: null,
          displayName: "No Email User",
        }),
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(
        validateOAuthCallback("microsoft", "auth-code", "code-verifier"),
      ).rejects.toThrow();
    });

    it("当 Google OAuth 需要 codeVerifier 但未提供时应抛出错误", async () => {
      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(validateOAuthCallback("google", "code")).rejects.toThrow(
        "code verifier",
      );
    });

    it("当 Microsoft OAuth 需要 codeVerifier 但未提供时应抛出错误", async () => {
      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(validateOAuthCallback("microsoft", "code")).rejects.toThrow(
        "code verifier",
      );
    });

    it("当 OAuth 未启用时应抛出错误", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "user.sso.google.enabled") return false;
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(
        validateOAuthCallback("google", "code", "verifier"),
      ).rejects.toThrow("未启用");
    });

    it("当获取 Google 用户信息失败时应抛出错误", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(
        validateOAuthCallback("google", "code", "verifier"),
      ).rejects.toThrow();
    });

    it("当获取 GitHub 用户信息失败时应抛出错误", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(validateOAuthCallback("github", "code")).rejects.toThrow();
    });

    it("当获取 Microsoft 用户信息失败时应抛出错误", async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Unauthorized",
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      await expect(
        validateOAuthCallback("microsoft", "code", "verifier"),
      ).rejects.toThrow();
    });

    it("不支持的提供商应抛出错误", async () => {
      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      // getOAuthConfig 会先运行，由于 unknown 没有配置，会抛出 "未启用"
      await expect(
        validateOAuthCallback("unknown" as any, "code", "verifier"),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // generateState
  // =========================================================================
  describe("generateState", () => {
    it("应生成 64 字符的十六进制字符串", async () => {
      const { generateState } = await import("@/lib/server/oauth");
      const state = generateState();

      expect(state).toHaveLength(64);
      expect(state).toMatch(/^[0-9a-f]{64}$/);
    });

    it("每次调用应生成不同的 state", async () => {
      const { generateState } = await import("@/lib/server/oauth");
      const state1 = generateState();
      const state2 = generateState();

      expect(state1).not.toBe(state2);
    });

    it("state 应为 hex 编码（仅包含 0-9 和 a-f）", async () => {
      const { generateState } = await import("@/lib/server/oauth");
      const state = generateState();

      expect(/^[0-9a-f]+$/.test(state)).toBe(true);
    });
  });

  // =========================================================================
  // OAuth 类型导出
  // =========================================================================
  describe("类型导出", () => {
    it("OAuthUserInfo 接口应包含必要字段", async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "123",
          email: "test@example.com",
          name: "Test User",
          picture: "https://example.com/avatar.jpg",
        }),
      });

      const { validateOAuthCallback } = await import("@/lib/server/oauth");
      const result = await validateOAuthCallback(
        "google",
        "auth-code",
        "test-code-verifier",
      );

      // 验证返回值包含 OAuthUserInfo 的所有字段
      expect(result).toHaveProperty("provider");
      expect(result).toHaveProperty("providerAccountId");
      expect(result).toHaveProperty("email");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("avatar");
    });
  });
});
