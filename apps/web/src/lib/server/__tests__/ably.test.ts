import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock ably-config
const mockGetAblyApiKey = vi.fn();
vi.mock("@/lib/server/ably-config", () => ({
  getAblyApiKey: mockGetAblyApiKey,
}));

// Mock ably with a proper class
const mockPublish = vi.fn();
const mockPresenceGet = vi.fn();
const mockChannel = {
  publish: mockPublish,
  presence: {
    get: mockPresenceGet,
  },
};

class MockAblyRest {
  channels = {
    get: vi.fn().mockReturnValue(mockChannel),
  };
  constructor(_opts?: unknown) {}
}

vi.mock("ably", () => ({
  Rest: MockAblyRest,
}));

describe("ably", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAblyApiKey.mockResolvedValue("test-app.keyId:keySecret");
    mockPublish.mockResolvedValue(undefined);
    mockPresenceGet.mockResolvedValue({ items: [] });
  });

  describe("getAblyServerClient", () => {
    it("当 API Key 已配置时应返回 Ably 客户端", async () => {
      const { getAblyServerClient } = await import("@/lib/server/ably");
      const client = await getAblyServerClient();

      expect(client).not.toBeNull();
    });

    it("当 API Key 未配置时应返回 null", async () => {
      mockGetAblyApiKey.mockResolvedValueOnce(undefined);

      const { getAblyServerClient } = await import("@/lib/server/ably");
      const client = await getAblyServerClient();

      expect(client).toBeNull();
    });

    it("应使用单例模式复用客户端", async () => {
      const { getAblyServerClient } = await import("@/lib/server/ably");
      const client1 = await getAblyServerClient();
      const client2 = await getAblyServerClient();

      expect(client1).toBe(client2);
    });
  });

  describe("publishNoticeToUser", () => {
    it("应向指定用户频道推送通知", async () => {
      const { publishNoticeToUser } = await import("@/lib/server/ably");
      const result = await publishNoticeToUser(123, {
        type: "new_notice",
        payload: {
          id: "1",
          title: "Test",
          content: "Content",
          link: null,
          createdAt: "2024-01-01",
          count: 1,
        },
      });

      expect(result).toBe(true);
      expect(mockPublish).toHaveBeenCalledWith(
        "notification",
        expect.objectContaining({
          type: "new_notice",
        }),
      );
    });

    it("当 Ably 客户端不可用时应返回 false", async () => {
      mockGetAblyApiKey.mockResolvedValueOnce(undefined);

      const { publishNoticeToUser } = await import("@/lib/server/ably");
      const result = await publishNoticeToUser(123, {
        type: "new_notice",
        payload: {
          id: "1",
          title: "Test",
          content: "Content",
          link: null,
          createdAt: "2024-01-01",
          count: 1,
        },
      });

      expect(result).toBe(false);
    });

    it("当推送失败时应返回 false", async () => {
      mockPublish.mockRejectedValueOnce(new Error("Push failed"));

      const { publishNoticeToUser } = await import("@/lib/server/ably");
      const result = await publishNoticeToUser(123, {
        type: "new_notice",
        payload: {
          id: "1",
          title: "Test",
          content: "Content",
          link: null,
          createdAt: "2024-01-01",
          count: 1,
        },
      });

      expect(result).toBe(false);
    });
  });

  describe("publishNoticeToUsers", () => {
    it("应向多个用户推送通知并返回成功数量", async () => {
      const { publishNoticeToUsers } = await import("@/lib/server/ably");
      const result = await publishNoticeToUsers([1, 2, 3], {
        type: "unread_count_update",
        payload: { count: 5 },
      });

      expect(result).toBe(3);
    });

    it("当用户列表为空时应返回 0", async () => {
      const { publishNoticeToUsers } = await import("@/lib/server/ably");
      const result = await publishNoticeToUsers([], {
        type: "unread_count_update",
        payload: { count: 0 },
      });

      expect(result).toBe(0);
    });
  });

  describe("checkUserOnlineStatus", () => {
    it("当用户有活跃的 presence 成员时应返回 true", async () => {
      mockPresenceGet.mockResolvedValueOnce({
        items: [{ clientId: "user-123" }],
      });

      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const result = await checkUserOnlineStatus(123);

      expect(result).toBe(true);
    });

    it("当用户没有活跃的 presence 成员时应返回 false", async () => {
      mockPresenceGet.mockResolvedValueOnce({ items: [] });

      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const result = await checkUserOnlineStatus(123);

      expect(result).toBe(false);
    });

    it("当 Ably 客户端不可用时应返回 false", async () => {
      mockGetAblyApiKey.mockResolvedValueOnce(undefined);

      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const result = await checkUserOnlineStatus(123);

      expect(result).toBe(false);
    });

    it("当 presence 检查抛出异常时应返回 false", async () => {
      mockPresenceGet.mockRejectedValueOnce(new Error("Presence error"));

      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const result = await checkUserOnlineStatus(123);

      expect(result).toBe(false);
    });

    it("应使用自定义 timeout 参数", async () => {
      mockPresenceGet.mockResolvedValueOnce({
        items: [{ clientId: "user-123" }],
      });

      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const result = await checkUserOnlineStatus(456, 5000);

      expect(result).toBe(true);
    });

    it("当 presence 返回 undefined items 时应返回 false", async () => {
      mockPresenceGet.mockResolvedValueOnce({ items: undefined });

      const { checkUserOnlineStatus } = await import("@/lib/server/ably");
      const result = await checkUserOnlineStatus(123);

      expect(result).toBe(false);
    });
  });

  describe("通知类型和载荷", () => {
    it("应支持 unread_count_update 类型通知", async () => {
      const { publishNoticeToUser } = await import("@/lib/server/ably");
      const result = await publishNoticeToUser(123, {
        type: "unread_count_update",
        payload: { count: 3, noticeId: "notice-1", title: "New" },
      });

      expect(result).toBe(true);
      expect(mockPublish).toHaveBeenCalledWith(
        "notification",
        expect.objectContaining({
          type: "unread_count_update",
          payload: expect.objectContaining({ count: 3 }),
        }),
      );
    });

    it("应支持 new_private_message 类型通知", async () => {
      const { publishNoticeToUser } = await import("@/lib/server/ably");
      const result = await publishNoticeToUser(123, {
        type: "new_private_message",
        payload: {
          conversationId: "conv-1",
          message: {
            id: "msg-1",
            content: "Hello",
            type: "TEXT",
            senderUid: 456,
            createdAt: "2024-01-01T00:00:00Z",
          },
          sender: {
            uid: 456,
            username: "sender",
            nickname: null,
          },
          messageCount: 1,
        },
      });

      expect(result).toBe(true);
    });

    it("应支持 system_notice 类型通知", async () => {
      const { publishNoticeToUser } = await import("@/lib/server/ably");
      const result = await publishNoticeToUser(123, {
        type: "system_notice",
        payload: {},
      });

      expect(result).toBe(true);
    });
  });

  describe("publishNoticeToUsers 批量推送", () => {
    it("当部分推送失败时应返回成功的数量", async () => {
      let callCount = 0;
      mockPublish.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Push failed for user 2");
        }
      });

      const { publishNoticeToUsers } = await import("@/lib/server/ably");
      const result = await publishNoticeToUsers([1, 2, 3], {
        type: "unread_count_update",
        payload: { count: 1 },
      });

      expect(result).toBe(2);
    });

    it("当所有推送失败时应返回 0", async () => {
      mockPublish.mockRejectedValue(new Error("All failed"));

      const { publishNoticeToUsers } = await import("@/lib/server/ably");
      const result = await publishNoticeToUsers([1, 2], {
        type: "unread_count_update",
        payload: { count: 0 },
      });

      expect(result).toBe(0);
    });
  });
});
