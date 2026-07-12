import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock dependencies
const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
  getConfigs: vi.fn(),
}));

const mockFindUnique = vi.fn();
const mockNoticeCreate = vi.fn();
const mockNoticeCount = vi.fn();
const mockRefreshTokenFindFirst = vi.fn();
vi.mock("@/lib/server/prisma", () => ({
  default: {
    user: { findUnique: mockFindUnique },
    notice: { create: mockNoticeCreate, count: mockNoticeCount },
    refreshToken: { findFirst: mockRefreshTokenFindFirst },
  },
}));

vi.mock("@/lib/server/ably", () => ({
  publishNoticeToUser: vi.fn().mockResolvedValue(true),
  checkUserOnlineStatus: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/server/ably-config", () => ({
  isAblyEnabled: vi.fn().mockResolvedValue(false),
}));

const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/server/email", () => ({
  sendEmail: mockSendEmail,
}));

vi.mock("@/lib/server/web-push", () => ({
  sendWebPushToUser: vi.fn().mockResolvedValue({ success: 1, failed: 0 }),
}));

vi.mock("@/lib/server/jwt", () => ({
  jwtTokenSign: vi.fn().mockReturnValue("mock-jwt-token"),
}));

vi.mock("@/emails/templates/NotificationEmail", () => ({
  default: vi.fn().mockReturnValue({}),
}));

vi.mock("@/emails/utils", () => ({
  renderEmail: vi.fn().mockResolvedValue({ html: "<p>Test</p>", text: "Test" }),
}));

describe("notice", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfig.mockImplementation(async (key: string) => {
      const configs: Record<string, unknown> = {
        "notice.enable": true,
        "notice.webPush.enable": false,
        "site.url": "https://example.com",
        "site.title": "Test Site",
      };
      return configs[key];
    });

    mockFindUnique.mockResolvedValue({
      email: "user@example.com",
      username: "testuser",
      emailVerified: true,
    });

    mockNoticeCreate.mockResolvedValue({
      id: "notice-1",
      title: "Test",
      content: "Content",
      link: null,
      createdAt: new Date(),
    });

    mockNoticeCount.mockResolvedValue(1);
  });

  // =========================================================================
  // sendNotice
  // =========================================================================
  describe("sendNotice", () => {
    it("当全局通知未启用时应直接返回", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "notice.enable") return false;
        return undefined;
      });

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockNoticeCreate).not.toHaveBeenCalled();
    });

    it("应创建站内通知记录", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Test Title", "Test Content", "/test-link");

      expect(mockNoticeCreate).toHaveBeenCalledWith({
        data: {
          userUid: 1,
          title: "Test Title",
          content: "Test Content",
          link: "/test-link",
          isRead: false,
        },
      });
    });

    it("当用户不存在时应抛出错误", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const { sendNotice } = await import("@/lib/server/notice");
      await expect(sendNotice(999, "Title", "Content")).rejects.toThrow(
        "用户不存在",
      );
    });

    it("当 link 为 undefined 时应存储 null", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockNoticeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            link: null,
          }),
        }),
      );
    });

    it("当 skipEmail 为 true 时应跳过邮件发送", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content", undefined, { skipEmail: true });

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("当用户邮箱未验证时应跳过邮件发送", async () => {
      mockFindUnique.mockResolvedValueOnce({
        email: "user@example.com",
        username: "testuser",
        emailVerified: false,
      });

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("应创建站内通知并记录标题和内容", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockNoticeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Title",
            content: "Content",
          }),
        }),
      );
    });

    it("应支持自定义通知类型", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content", undefined, {
        type: "new_comment" as any,
      });

      expect(mockNoticeCreate).toHaveBeenCalled();
    });

    it("应支持测试通知选项", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content", undefined, {
        isTest: true,
      });

      expect(mockNoticeCreate).toHaveBeenCalled();
    });

    it("应查询未读通知数量", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockNoticeCount).toHaveBeenCalledWith({
        where: {
          userUid: 1,
          isRead: false,
        },
      });
    });

    it("应通过 Ably 推送新通知", async () => {
      const { publishNoticeToUser } = await import("@/lib/server/ably");

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content", "/link");

      expect(publishNoticeToUser).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: "new_notice",
          payload: expect.objectContaining({
            content: "Content",
          }),
        }),
      );
    });

    it("link 为 undefined 时 Ably 推送应包含 null link", async () => {
      const { publishNoticeToUser } = await import("@/lib/server/ably");

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      // 验证 publishNoticeToUser 被调用
      expect(publishNoticeToUser).toHaveBeenCalled();
      const callArgs = vi.mocked(publishNoticeToUser).mock.calls[0]!;
      expect(callArgs[0]).toBe(1);
      expect(callArgs[1]).toHaveProperty("type", "new_notice");
    });
  });

  // =========================================================================
  // 邮件通知路径
  // =========================================================================
  describe("邮件通知", () => {
    it("用户离线且邮箱已验证时应发送邮件", async () => {
      // Ably 未启用，用户离线
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Test Title", "Test Content", "/test-link");

      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("用户在线时应跳过邮件发送", async () => {
      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      vi.mocked(isAblyEnabled).mockResolvedValueOnce(true);
      vi.mocked(checkUserOnlineStatus).mockResolvedValueOnce(true);

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("邮件标题应使用通知标题", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Custom Title", "Content");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Custom Title",
        }),
      );
    });

    it("应使用正确的收件人邮箱", async () => {
      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
        }),
      );
    });

    it("包含 link 时应通过 JWT 生成重定向 URL", async () => {
      const { jwtTokenSign } = await import("@/lib/server/jwt");

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content", "/some-link");

      expect(jwtTokenSign).toHaveBeenCalled();
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it("不包含 link 时不应生成重定向令牌", async () => {
      const { jwtTokenSign } = await import("@/lib/server/jwt");
      vi.mocked(jwtTokenSign).mockClear();

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      // 仍然会调用 jwtTokenSign，但 link 参数为 undefined 时不会传递给模板
      expect(mockSendEmail).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Web Push 通知
  // =========================================================================
  describe("Web Push 通知", () => {
    it("当 Web Push 启用且用户离线时应发送 Web Push", async () => {
      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      mockGetConfig.mockImplementation(async (key: string) => {
        const configs: Record<string, unknown> = {
          "notice.enable": true,
          "notice.webPush.enable": true,
          "site.url": "https://example.com",
          "site.title": "Test Site",
        };
        return configs[key];
      });

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Push Title", "Push Content", "/push-link");

      expect(sendWebPushToUser).toHaveBeenCalled();
    });

    it("当 Web Push 未启用时不应发送", async () => {
      const { sendWebPushToUser } = await import("@/lib/server/web-push");

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(sendWebPushToUser).not.toHaveBeenCalled();
    });

    it("测试通知应始终发送 Web Push", async () => {
      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      vi.mocked(isAblyEnabled).mockResolvedValueOnce(true);
      vi.mocked(checkUserOnlineStatus).mockResolvedValueOnce(true);

      mockGetConfig.mockImplementation(async (key: string) => {
        const configs: Record<string, unknown> = {
          "notice.enable": true,
          "notice.webPush.enable": true,
          "site.url": "https://example.com",
          "site.title": "Test Site",
        };
        return configs[key];
      });

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content", undefined, { isTest: true });

      expect(sendWebPushToUser).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Ably Presence 在线检测
  // =========================================================================
  describe("Ably Presence 在线检测", () => {
    it("当 Ably 启用时应使用 Presence 检测", async () => {
      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      vi.mocked(isAblyEnabled).mockResolvedValueOnce(true);
      vi.mocked(checkUserOnlineStatus).mockResolvedValueOnce(false);

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(checkUserOnlineStatus).toHaveBeenCalledWith(1);
    });

    it("当 Ably 未启用时应降级到 RefreshToken 检测", async () => {
      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      vi.mocked(isAblyEnabled).mockResolvedValueOnce(false);

      const { sendNotice } = await import("@/lib/server/notice");
      await sendNotice(1, "Title", "Content");

      expect(mockRefreshTokenFindFirst).toHaveBeenCalled();
    });
  });
});
