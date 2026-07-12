import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock redis
const mockSetex = vi.fn();
const mockGet = vi.fn();
const mockDel = vi.fn();
vi.mock("@/lib/server/redis", () => ({
  default: {
    setex: mockSetex,
    get: mockGet,
    del: mockDel,
  },
  ensureRedisConnection: vi.fn().mockResolvedValue(undefined),
}));

// Mock cache key generator
vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: vi
    .fn()
    .mockImplementation((...args: string[]) => args.join(":")),
}));

// Mock @cap.js/server with a proper class
const mockValidateToken = vi.fn();

class MockCap {
  validateToken = mockValidateToken;
  storage: unknown;
  constructor(opts?: { storage?: unknown }) {
    this.storage = opts?.storage;
  }
}

vi.mock("@cap.js/server", () => ({
  default: MockCap,
}));

describe("captcha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyToken", () => {
    it("当 token 有效时应返回 true", async () => {
      mockValidateToken.mockResolvedValueOnce(true);

      const { verifyToken } = await import("@/lib/server/captcha");
      const result = await verifyToken("valid-token");

      expect(result).toBe(true);
    });

    it("当 token 无效时应返回 false", async () => {
      mockValidateToken.mockResolvedValueOnce(false);

      const { verifyToken } = await import("@/lib/server/captcha");
      const result = await verifyToken("invalid-token");

      expect(result).toBe(false);
    });

    it("当验证抛出异常时应返回 { success: false }", async () => {
      mockValidateToken.mockRejectedValueOnce(new Error("Validation error"));

      const { verifyToken } = await import("@/lib/server/captcha");
      const result = await verifyToken("error-token");

      expect(result).toEqual({ success: false });
    });

    it("应调用 cap.validateToken 并传入 keepToken: false", async () => {
      mockValidateToken.mockResolvedValueOnce(true);

      const { verifyToken } = await import("@/lib/server/captcha");
      await verifyToken("test-token");

      expect(mockValidateToken).toHaveBeenCalledWith("test-token", {
        keepToken: false,
      });
    });

    it("应处理空 token 字符串", async () => {
      mockValidateToken.mockResolvedValueOnce(false);

      const { verifyToken } = await import("@/lib/server/captcha");
      const result = await verifyToken("");

      expect(result).toBe(false);
    });

    it("应处理长 token 字符串", async () => {
      const longToken = "a".repeat(1000);
      mockValidateToken.mockResolvedValueOnce(true);

      const { verifyToken } = await import("@/lib/server/captcha");
      const result = await verifyToken(longToken);

      expect(result).toBe(true);
      expect(mockValidateToken).toHaveBeenCalledWith(longToken, {
        keepToken: false,
      });
    });
  });

  describe("cap 实例", () => {
    it("应导出 cap 实例", async () => {
      const { cap } = await import("@/lib/server/captcha");
      expect(cap).toBeDefined();
    });

    it("cap 实例应包含 storage 配置", async () => {
      const { cap } = await import("@/lib/server/captcha");
      expect((cap as any).storage).toBeDefined();
    });

    it("cap 的 storage 应包含 challenges 配置", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;
      expect(storage).toHaveProperty("challenges");
    });

    it("cap 的 storage 应包含 tokens 配置", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;
      expect(storage).toHaveProperty("tokens");
    });
  });

  describe("challenges storage", () => {
    it("store 应使用 redis.setex 存储 challenge", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const futureTime = Date.now() + 60000;
      const challengeData = { expires: futureTime, data: "test" };

      await storage.challenges.store("token-123", challengeData);

      expect(mockSetex).toHaveBeenCalledWith(
        "captcha:challenge:token-123",
        expect.any(Number),
        JSON.stringify(challengeData),
      );
    });

    it("store 应计算正确的 TTL", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const futureTime = Date.now() + 120000; // 2 minutes
      await storage.challenges.store("token", { expires: futureTime });

      const calledTtl = mockSetex.mock.calls[0]?.[1] as number;
      expect(calledTtl).toBeGreaterThan(0);
      expect(calledTtl).toBeLessThanOrEqual(120);
    });

    it("store 应在 TTL <= 0 时不存储", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const pastTime = Date.now() - 1000;
      await storage.challenges.store("token", { expires: pastTime });

      expect(mockSetex).not.toHaveBeenCalled();
    });

    it("store 应在 Redis 错误时抛出异常", async () => {
      mockSetex.mockRejectedValueOnce(new Error("Redis error"));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await expect(
        storage.challenges.store("token", { expires: Date.now() + 60000 }),
      ).rejects.toThrow("Redis store challenge failed");
    });

    it("read 应从 Redis 获取 challenge", async () => {
      const futureTime = Date.now() + 60000;
      const challengeData = { expires: futureTime, data: "test" };
      mockGet.mockResolvedValueOnce(JSON.stringify(challengeData));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.challenges.read("token-123");

      expect(mockGet).toHaveBeenCalledWith("captcha:challenge:token-123");
      expect(result).toEqual({ challenge: challengeData, expires: futureTime });
    });

    it("read 应在 challenge 不存在时返回 null", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.challenges.read("nonexistent");
      expect(result).toBeNull();
    });

    it("read 应在 challenge 过期时删除并返回 null", async () => {
      const pastTime = Date.now() - 1000;
      const expiredChallenge = { expires: pastTime };
      mockGet.mockResolvedValueOnce(JSON.stringify(expiredChallenge));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.challenges.read("expired-token");

      expect(result).toBeNull();
      expect(mockDel).toHaveBeenCalledWith("captcha:challenge:expired-token");
    });

    it("read 应在 Redis 错误时返回 null", async () => {
      mockGet.mockRejectedValueOnce(new Error("Redis error"));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.challenges.read("error-token");
      expect(result).toBeNull();
    });

    it("delete 应从 Redis 删除 challenge", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await storage.challenges.delete("token-123");

      expect(mockDel).toHaveBeenCalledWith("captcha:challenge:token-123");
    });

    it("delete 应在 Redis 错误时抛出异常", async () => {
      mockDel.mockRejectedValueOnce(new Error("Redis error"));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await expect(storage.challenges.delete("token")).rejects.toThrow(
        "Redis delete challenge failed",
      );
    });

    it("deleteExpired 应为空操作", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await expect(storage.challenges.deleteExpired()).resolves.toBeUndefined();
    });
  });

  describe("tokens storage", () => {
    it("store 应使用 redis.setex 存储 token", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const futureTime = Date.now() + 60000;
      await storage.tokens.store("token-key", futureTime);

      expect(mockSetex).toHaveBeenCalledWith(
        "captcha:token:token-key",
        expect.any(Number),
        futureTime.toString(),
      );
    });

    it("store 应在 TTL <= 0 时不存储", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const pastTime = Date.now() - 1000;
      await storage.tokens.store("key", pastTime);

      expect(mockSetex).not.toHaveBeenCalled();
    });

    it("store 应在 Redis 错误时抛出异常", async () => {
      mockSetex.mockRejectedValueOnce(new Error("Redis error"));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await expect(
        storage.tokens.store("key", Date.now() + 60000),
      ).rejects.toThrow("Redis store token failed");
    });

    it("get 应返回有效的 token 过期时间", async () => {
      const futureTime = Date.now() + 60000;
      mockGet.mockResolvedValueOnce(futureTime.toString());

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.tokens.get("token-key");
      expect(result).toBe(futureTime);
    });

    it("get 应在 token 不存在时返回 null", async () => {
      mockGet.mockResolvedValueOnce(null);

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.tokens.get("nonexistent");
      expect(result).toBeNull();
    });

    it("get 应在 token 过期时删除并返回 null", async () => {
      const pastTime = Date.now() - 1000;
      mockGet.mockResolvedValueOnce(pastTime.toString());

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.tokens.get("expired-key");
      expect(result).toBeNull();
      expect(mockDel).toHaveBeenCalledWith("captcha:token:expired-key");
    });

    it("get 应在 Redis 错误时返回 null", async () => {
      mockGet.mockRejectedValueOnce(new Error("Redis error"));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      const result = await storage.tokens.get("error-key");
      expect(result).toBeNull();
    });

    it("delete 应从 Redis 删除 token", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await storage.tokens.delete("token-key");

      expect(mockDel).toHaveBeenCalledWith("captcha:token:token-key");
    });

    it("delete 应在 Redis 错误时抛出异常", async () => {
      mockDel.mockRejectedValueOnce(new Error("Redis error"));

      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await expect(storage.tokens.delete("key")).rejects.toThrow(
        "Redis delete token failed",
      );
    });

    it("deleteExpired 应为空操作", async () => {
      const { cap } = await import("@/lib/server/captcha");
      const storage = (cap as any).storage;

      await expect(storage.tokens.deleteExpired()).resolves.toBeUndefined();
    });
  });
});
