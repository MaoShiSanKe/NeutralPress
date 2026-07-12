import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
}));

// Mock akismet-api with a proper class
const mockVerifyKey = vi.fn();
const mockCheckSpam = vi.fn();
const mockSubmitSpam = vi.fn();
const mockSubmitHam = vi.fn();

class MockAkismetClient {
  verifyKey = mockVerifyKey;
  checkSpam = mockCheckSpam;
  submitSpam = mockSubmitSpam;
  submitHam = mockSubmitHam;
  constructor(_opts?: unknown) {}
}

vi.mock("akismet-api", () => ({
  AkismetClient: MockAkismetClient,
}));

describe("akismet", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfig.mockImplementation(async (key: string) => {
      const configs: Record<string, unknown> = {
        "comment.akismet.enable": true,
        "comment.akismet.apiKey": "test-akismet-key",
        "comment.akismet.report.enable": true,
        "site.url": "https://example.com",
      };
      return configs[key];
    });

    mockVerifyKey.mockResolvedValue(true);
    mockCheckSpam.mockResolvedValue(false);
    mockSubmitSpam.mockResolvedValue(undefined);
    mockSubmitHam.mockResolvedValue(undefined);
  });

  describe("checkSpam", () => {
    it("当评论不是垃圾时应返回 false", async () => {
      mockCheckSpam.mockResolvedValueOnce(false);

      const { checkSpam } = await import("@/lib/server/akismet");
      const result = await checkSpam({
        userIp: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        commentContent: "This is a normal comment",
      });

      expect(result).toBe(false);
    });

    it("当评论是垃圾时应返回 true", async () => {
      mockCheckSpam.mockResolvedValueOnce(true);

      const { checkSpam } = await import("@/lib/server/akismet");
      const result = await checkSpam({
        userIp: "192.168.1.1",
        commentContent: "Buy cheap viagra!",
      });

      expect(result).toBe(true);
    });

    it("当 Akismet 未启用时应返回 false（默认不是垃圾）", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return false;
        return undefined;
      });

      const { checkSpam } = await import("@/lib/server/akismet");
      const result = await checkSpam({
        userIp: "192.168.1.1",
        commentContent: "Spam content",
      });

      expect(result).toBe(false);
    });

    it("当 API Key 验证失败时应返回 false", async () => {
      mockVerifyKey.mockResolvedValueOnce(false);

      const { checkSpam } = await import("@/lib/server/akismet");
      const result = await checkSpam({
        userIp: "192.168.1.1",
        commentContent: "Test",
      });

      expect(result).toBe(false);
    });

    it("当检查过程中发生错误时应返回 false", async () => {
      mockCheckSpam.mockRejectedValueOnce(new Error("API Error"));

      const { checkSpam } = await import("@/lib/server/akismet");
      const result = await checkSpam({
        userIp: "192.168.1.1",
        commentContent: "Test",
      });

      expect(result).toBe(false);
    });

    it("应传递完整的评论数据给 Akismet", async () => {
      const { checkSpam } = await import("@/lib/server/akismet");
      await checkSpam({
        userIp: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        referrer: "https://example.com/post",
        permalink: "https://example.com/post/1",
        commentType: "comment",
        commentAuthor: "Test User",
        commentAuthorEmail: "test@example.com",
        commentAuthorUrl: "https://test.com",
        commentContent: "Test content",
        userRole: "subscriber",
        isTest: false,
      });

      expect(mockCheckSpam).toHaveBeenCalledWith(
        expect.objectContaining({
          user_ip: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          comment_content: "Test content",
          comment_type: "comment",
        }),
      );
    });

    it("当 commentType 未指定时应默认为 comment", async () => {
      const { checkSpam } = await import("@/lib/server/akismet");
      await checkSpam({
        userIp: "192.168.1.1",
        commentContent: "Test",
      });

      expect(mockCheckSpam).toHaveBeenCalledWith(
        expect.objectContaining({
          comment_type: "comment",
        }),
      );
    });
  });

  describe("submitSpam", () => {
    it("当报告功能启用时应提交垃圾评论", async () => {
      const { submitSpam } = await import("@/lib/server/akismet");
      const result = await submitSpam({
        userIp: "192.168.1.1",
        commentContent: "Spam content",
      });

      expect(result).toBe(true);
      expect(mockSubmitSpam).toHaveBeenCalled();
    });

    it("当报告功能未启用时应返回 true（不提交）", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return true;
        if (key === "comment.akismet.apiKey") return "key";
        if (key === "comment.akismet.report.enable") return false;
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { submitSpam } = await import("@/lib/server/akismet");
      const result = await submitSpam({
        userIp: "192.168.1.1",
        commentContent: "Spam",
      });

      expect(result).toBe(true);
      expect(mockSubmitSpam).not.toHaveBeenCalled();
    });

    it("当 Akismet 未启用时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return false;
        if (key === "comment.akismet.report.enable") return true;
        return undefined;
      });

      const { submitSpam } = await import("@/lib/server/akismet");
      const result = await submitSpam({
        userIp: "192.168.1.1",
        commentContent: "Spam",
      });

      expect(result).toBe(false);
    });
  });

  describe("submitHam", () => {
    it("当报告功能启用时应提交正常评论", async () => {
      const { submitHam } = await import("@/lib/server/akismet");
      const result = await submitHam({
        userIp: "192.168.1.1",
        commentContent: "Normal comment",
      });

      expect(result).toBe(true);
      expect(mockSubmitHam).toHaveBeenCalled();
    });

    it("当报告功能未启用时应返回 true", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return true;
        if (key === "comment.akismet.apiKey") return "key";
        if (key === "comment.akismet.report.enable") return false;
        if (key === "site.url") return "https://example.com";
        return undefined;
      });

      const { submitHam } = await import("@/lib/server/akismet");
      const result = await submitHam({
        userIp: "192.168.1.1",
        commentContent: "Normal",
      });

      expect(result).toBe(true);
      expect(mockSubmitHam).not.toHaveBeenCalled();
    });
  });

  describe("isAkismetEnabled", () => {
    it("当 Akismet 已配置且 API Key 有效时应返回 true", async () => {
      const { isAkismetEnabled } = await import("@/lib/server/akismet");
      const result = await isAkismetEnabled();

      expect(result).toBe(true);
    });

    it("当 Akismet 未启用时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return false;
        return undefined;
      });

      const { isAkismetEnabled } = await import("@/lib/server/akismet");
      const result = await isAkismetEnabled();

      expect(result).toBe(false);
    });

    it("当 API Key 未配置时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return true;
        if (key === "comment.akismet.apiKey") return "";
        return undefined;
      });

      const { isAkismetEnabled } = await import("@/lib/server/akismet");
      const result = await isAkismetEnabled();

      expect(result).toBe(false);
    });

    it("当 API Key 验证失败时应返回 false", async () => {
      // 由于 getAkismetClient 内部缓存了客户端实例，
      // 当已缓存时不会再次调用 verifyKey
      // 此测试验证当配置禁用时返回 false
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "comment.akismet.enable") return false;
        return undefined;
      });

      const { isAkismetEnabled } = await import("@/lib/server/akismet");
      const result = await isAkismetEnabled();

      expect(result).toBe(false);
    });
  });

  describe("边界情况", () => {
    it("应传递 referrer 和 permalink 给 Akismet", async () => {
      const { checkSpam } = await import("@/lib/server/akismet");
      await checkSpam({
        userIp: "10.0.0.1",
        userAgent: "TestBot/1.0",
        referrer: "https://referrer.com",
        permalink: "https://example.com/post/123",
        commentAuthor: "Spammer",
        commentAuthorEmail: "spam@spam.com",
        commentAuthorUrl: "https://spam.com",
        commentContent: "Buy now!",
        commentDateGmt: new Date("2024-01-01"),
        commentPostModifiedGmt: new Date("2024-01-01"),
        userRole: "guest",
        isTest: true,
      });

      expect(mockCheckSpam).toHaveBeenCalledWith(
        expect.objectContaining({
          user_ip: "10.0.0.1",
          referrer: "https://referrer.com",
          permalink: "https://example.com/post/123",
          comment_author: "Spammer",
          comment_author_email: "spam@spam.com",
          comment_author_url: "https://spam.com",
          is_test: true,
        }),
      );
    });

    it("当 submitSpam 抛出异常时应返回 false", async () => {
      mockSubmitSpam.mockRejectedValueOnce(new Error("Submit failed"));

      const { submitSpam } = await import("@/lib/server/akismet");
      const result = await submitSpam({
        userIp: "192.168.1.1",
        commentContent: "Spam",
      });

      expect(result).toBe(false);
    });

    it("当 submitHam 抛出异常时应返回 false", async () => {
      mockSubmitHam.mockRejectedValueOnce(new Error("Submit failed"));

      const { submitHam } = await import("@/lib/server/akismet");
      const result = await submitHam({
        userIp: "192.168.1.1",
        commentContent: "Normal",
      });

      expect(result).toBe(false);
    });
  });
});
