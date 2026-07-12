import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TEST_MASTER_SECRET =
  "test-master-secret-key-that-is-at-least-32-chars-long-for-testing";

describe("internal-auth", () => {
  let validateInternalBearerToken: typeof import("@/lib/server/internal-auth").validateInternalBearerToken;
  let deriveCacheBootstrapToken: typeof import("@/lib/shared/cache-bootstrap-auth").deriveCacheBootstrapToken;

  beforeEach(async () => {
    vi.resetModules();
    process.env.MASTER_SECRET = TEST_MASTER_SECRET;

    const internalAuthModule = await import("@/lib/server/internal-auth");
    validateInternalBearerToken =
      internalAuthModule.validateInternalBearerToken;

    const sharedModule = await import("@/lib/shared/cache-bootstrap-auth");
    deriveCacheBootstrapToken = sharedModule.deriveCacheBootstrapToken;
  });

  afterEach(() => {
    delete process.env.MASTER_SECRET;
  });

  // ==========================================================================
  // 有效 token 验证
  // ==========================================================================

  describe("有效 token 验证", () => {
    it("有效的 Bearer token 应返回 ok: true", () => {
      const expectedToken = deriveCacheBootstrapToken(TEST_MASTER_SECRET);
      const header = `Bearer ${expectedToken}`;

      const result = validateInternalBearerToken(header);
      expect(result.ok).toBe(true);
    });

    it("应正确解析 Bearer 前缀", () => {
      const expectedToken = deriveCacheBootstrapToken(TEST_MASTER_SECRET);

      // 有 Bearer 前缀
      const result1 = validateInternalBearerToken(`Bearer ${expectedToken}`);
      expect(result1.ok).toBe(true);

      // 无 Bearer 前缀
      const result2 = validateInternalBearerToken(expectedToken);
      expect(result2.ok).toBe(false);
      expect((result2 as { ok: false; reason: string }).reason).toBe(
        "MISSING_TOKEN",
      );
    });
  });

  // ==========================================================================
  // 无效 token
  // ==========================================================================

  describe("无效 token", () => {
    it("错误的 token 应返回 INVALID_TOKEN", () => {
      const result = validateInternalBearerToken("Bearer wrong-token-value");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "INVALID_TOKEN",
      );
    });

    it("空的 Bearer token 应返回 MISSING_TOKEN", () => {
      const result = validateInternalBearerToken("Bearer ");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MISSING_TOKEN",
      );
    });

    it("被篡改的 token 应返回 INVALID_TOKEN", () => {
      const expectedToken = deriveCacheBootstrapToken(TEST_MASTER_SECRET);
      const tamperedToken = expectedToken.slice(0, -5) + "XXXXX";
      const result = validateInternalBearerToken(`Bearer ${tamperedToken}`);
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "INVALID_TOKEN",
      );
    });
  });

  // ==========================================================================
  // 缺失 token
  // ==========================================================================

  describe("缺失 token", () => {
    it("null 应返回 MISSING_TOKEN", () => {
      const result = validateInternalBearerToken(null);
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MISSING_TOKEN",
      );
    });

    it("空字符串应返回 MISSING_TOKEN", () => {
      const result = validateInternalBearerToken("");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MISSING_TOKEN",
      );
    });

    it("只有 Bearer 前缀无 token 应返回 MISSING_TOKEN", () => {
      const result = validateInternalBearerToken("Bearer");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MISSING_TOKEN",
      );
    });

    it("非 Bearer 前缀应返回 MISSING_TOKEN", () => {
      const result = validateInternalBearerToken("Basic dXNlcjpwYXNz");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MISSING_TOKEN",
      );
    });
  });

  // ==========================================================================
  // MASTER_SECRET 不可用
  // ==========================================================================

  describe("MASTER_SECRET 不可用", () => {
    it("MASTER_SECRET 未设置时应返回 MASTER_SECRET_UNAVAILABLE", () => {
      delete process.env.MASTER_SECRET;

      const result = validateInternalBearerToken("Bearer some-token");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MASTER_SECRET_UNAVAILABLE",
      );
    });

    it("MASTER_SECRET 为空字符串时应返回 MASTER_SECRET_UNAVAILABLE", () => {
      process.env.MASTER_SECRET = "";

      const result = validateInternalBearerToken("Bearer some-token");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MASTER_SECRET_UNAVAILABLE",
      );
    });

    it("MASTER_SECRET 只有空格时应返回 MASTER_SECRET_UNAVAILABLE", () => {
      process.env.MASTER_SECRET = "   ";

      const result = validateInternalBearerToken("Bearer some-token");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MASTER_SECRET_UNAVAILABLE",
      );
    });

    it("MASTER_SECRET 长度不足 32 字符时应返回 MASTER_SECRET_UNAVAILABLE", () => {
      process.env.MASTER_SECRET = "too-short";

      const result = validateInternalBearerToken("Bearer some-token");
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "MASTER_SECRET_UNAVAILABLE",
      );
    });
  });

  // ==========================================================================
  // 不同密钥生成的 token 不匹配
  // ==========================================================================

  describe("密钥不匹配", () => {
    it("用不同 MASTER_SECRET 生成的 token 应验证失败", () => {
      const otherSecret =
        "another-test-master-secret-key-that-is-at-least-32-characters-long!!";
      const tokenFromOtherSecret = deriveCacheBootstrapToken(otherSecret);

      const result = validateInternalBearerToken(
        `Bearer ${tokenFromOtherSecret}`,
      );
      expect(result.ok).toBe(false);
      expect((result as { ok: false; reason: string }).reason).toBe(
        "INVALID_TOKEN",
      );
    });
  });

  // ==========================================================================
  // 端到端测试
  // ==========================================================================

  describe("端到端", () => {
    it("签发后应能成功验证", () => {
      const token = deriveCacheBootstrapToken(TEST_MASTER_SECRET);
      const result = validateInternalBearerToken(`Bearer ${token}`);
      expect(result.ok).toBe(true);
    });

    it("多次调用应返回一致结果", () => {
      const token = deriveCacheBootstrapToken(TEST_MASTER_SECRET);
      const header = `Bearer ${token}`;

      for (let i = 0; i < 5; i++) {
        const result = validateInternalBearerToken(header);
        expect(result.ok).toBe(true);
      }
    });
  });
});
