import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock 外部依赖
vi.mock("server-only", () => ({}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock rate-limit
const mockLimitControl = vi.fn();
vi.mock("@/lib/server/rate-limit", () => ({
  default: (...args: unknown[]) => mockLimitControl(...args),
}));

// Mock captcha
const mockCreateChallenge = vi.fn();
const mockRedeemChallenge = vi.fn();
vi.mock("@/lib/server/captcha", () => ({
  cap: {
    createChallenge: (...args: unknown[]) => mockCreateChallenge(...args),
    redeemChallenge: (...args: unknown[]) => mockRedeemChallenge(...args),
  },
}));

// Mock next/server (ResponseBuilder 内部使用)
vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn(
      (body: unknown, init?: { status?: number; headers?: HeadersInit }) => ({
        body,
        status: init?.status ?? 200,
        headers: new Headers(init?.headers),
      }),
    ),
  },
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));

describe("captcha actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimitControl.mockResolvedValue(true);
  });

  // =========================================================================
  // createChallenge
  // =========================================================================
  describe("createChallenge", () => {
    it("成功创建验证码挑战", async () => {
      const mockData = {
        challenges: [{ c: 1, s: 2, d: 3 }],
        token: "test-token",
        expires: Date.now() + 600000,
      };
      mockCreateChallenge.mockResolvedValue(mockData);

      const { createChallenge } = await import("@/actions/captcha");
      const result = await createChallenge();

      expect((result as any).success).toBe(true);
      expect((result as any).data).toEqual(mockData);
      expect(mockCreateChallenge).toHaveBeenCalledWith({
        challengeCount: 50,
        challengeSize: 32,
        challengeDifficulty: 5,
        expiresMs: 600000,
      });
    });

    it("自定义环境参数为 serverless", async () => {
      const mockData = { challenges: [], token: "tok", expires: 1 };
      mockCreateChallenge.mockResolvedValue(mockData);

      const { createChallenge } = await import("@/actions/captcha");
      const result = await createChallenge({ environment: "serverless" });

      // serverless 模式返回 NextResponse 对象，带 status 属性
      expect((result as any).status).toBe(200);
      expect((result as any).body.success).toBe(true);
      expect((result as any).body.data).toEqual(mockData);
    });

    it("速率限制触发时返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);

      const { createChallenge } = await import("@/actions/captcha");
      const result = await createChallenge();

      expect((result as any).success).toBe(false);
      expect((result as any).error.code).toBe("TOO_MANY_REQUESTS");
    });

    it("cap.createChallenge 抛出异常时返回 500", async () => {
      mockCreateChallenge.mockRejectedValue(new Error("Redis 连接失败"));

      const { createChallenge } = await import("@/actions/captcha");
      const result = await createChallenge();

      expect((result as any).success).toBe(false);
      expect((result as any).message).toBe("创建验证码失败，请稍后重试");
    });
  });

  // =========================================================================
  // verifyChallenge
  // =========================================================================
  describe("verifyChallenge", () => {
    const validParams = {
      token: "test-token",
      solutions: [1, 2, 3],
    };

    it("成功验证验证码", async () => {
      const mockResult = { success: true, message: "验证通过" };
      mockRedeemChallenge.mockResolvedValue(mockResult);

      const { verifyChallenge } = await import("@/actions/captcha");
      const result = await verifyChallenge(validParams);

      expect((result as any).success).toBe(true);
      expect((result as any).data).toEqual(mockResult);
      expect(mockRedeemChallenge).toHaveBeenCalledWith({
        token: "test-token",
        solutions: [1, 2, 3],
      });
    });

    it("自定义环境参数为 serverless", async () => {
      const mockResult = { success: true, message: "OK" };
      mockRedeemChallenge.mockResolvedValue(mockResult);

      const { verifyChallenge } = await import("@/actions/captcha");
      const result = await verifyChallenge(validParams, {
        environment: "serverless",
      });

      expect((result as any).status).toBe(200);
      expect((result as any).body.success).toBe(true);
    });

    it("速率限制触发时返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);

      const { verifyChallenge } = await import("@/actions/captcha");
      const result = await verifyChallenge(validParams);

      expect((result as any).success).toBe(false);
      expect((result as any).error.code).toBe("TOO_MANY_REQUESTS");
    });

    it("token 为空时验证失败返回 400", async () => {
      const { verifyChallenge } = await import("@/actions/captcha");
      const result = await verifyChallenge({ token: "", solutions: [1] });

      expect((result as any).success).toBe(false);
    });

    it("solutions 为空数组时验证失败返回 400", async () => {
      const { verifyChallenge } = await import("@/actions/captcha");
      const result = await verifyChallenge({
        token: "tok",
        solutions: [],
      });

      expect((result as any).success).toBe(false);
    });

    it("cap.redeemChallenge 抛出异常时返回 500", async () => {
      mockRedeemChallenge.mockRejectedValue(new Error("验证服务异常"));

      const { verifyChallenge } = await import("@/actions/captcha");
      const result = await verifyChallenge(validParams);

      expect((result as any).success).toBe(false);
      expect((result as any).message).toBe("验证验证码失败，请稍后重试");
    });
  });
});
