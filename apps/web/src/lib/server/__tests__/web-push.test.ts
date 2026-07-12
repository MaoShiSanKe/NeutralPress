import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
}));

// Mock prisma
const mockPushSubFindMany = vi.fn();
const mockPushSubUpdate = vi.fn();
vi.mock("@/lib/server/prisma", () => ({
  default: {
    pushSubscription: {
      findMany: mockPushSubFindMany,
      update: mockPushSubUpdate,
    },
  },
}));

// Mock web-push
const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

describe("web-push", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfig.mockImplementation(async (key: string) => {
      const configs: Record<string, unknown> = {
        "notice.webPush.vapidKeys": {
          publicKey: "test-public-key",
          privateKey: "test-private-key",
        },
        "site.url": "https://example.com",
      };
      return configs[key];
    });

    mockSendNotification.mockResolvedValue(undefined);
    mockPushSubUpdate.mockResolvedValue({});
  });

  describe("initWebPush", () => {
    it("当 VAPID 密钥已配置时应初始化成功并返回 true", async () => {
      const { initWebPush } = await import("@/lib/server/web-push");
      const result = await initWebPush();

      expect(result).toBe(true);
      expect(mockSetVapidDetails).toHaveBeenCalledWith(
        "https://example.com",
        "test-public-key",
        "test-private-key",
      );
    });

    it("当 VAPID 密钥未配置时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "notice.webPush.vapidKeys") return null;
        return undefined;
      });

      const { initWebPush } = await import("@/lib/server/web-push");
      const result = await initWebPush();

      expect(result).toBe(false);
    });

    it("当 site.url 以 http:// 开头时应使用 mailto 作为 subject", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "notice.webPush.vapidKeys") {
          return { publicKey: "pk", privateKey: "pvk" };
        }
        if (key === "site.url") return "http://localhost:3000";
        return undefined;
      });

      const { initWebPush } = await import("@/lib/server/web-push");
      await initWebPush();

      expect(mockSetVapidDetails).toHaveBeenCalledWith(
        "mailto:noreply@example.com",
        "pk",
        "pvk",
      );
    });

    it("当配置获取失败时应返回 false", async () => {
      mockGetConfig.mockRejectedValueOnce(new Error("Config error"));

      const { initWebPush } = await import("@/lib/server/web-push");
      const result = await initWebPush();

      expect(result).toBe(false);
    });
  });

  describe("sendWebPushNotification", () => {
    it("应发送推送通知并返回 true", async () => {
      const { sendWebPushNotification } = await import("@/lib/server/web-push");
      const result = await sendWebPushNotification(
        {
          endpoint: "https://fcm.googleapis.com/test",
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        {
          title: "Test Title",
          body: "Test Body",
        },
      );

      expect(result).toBe(true);
      expect(mockSendNotification).toHaveBeenCalled();
    });

    it("应更新订阅的最后使用时间", async () => {
      const { sendWebPushNotification } = await import("@/lib/server/web-push");
      await sendWebPushNotification(
        {
          endpoint: "https://fcm.googleapis.com/test",
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        { title: "Test", body: "Body" },
      );

      expect(mockPushSubUpdate).toHaveBeenCalledWith({
        where: { endpoint: "https://fcm.googleapis.com/test" },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it("当订阅过期（410）时应标记为非活跃", async () => {
      mockSendNotification.mockRejectedValueOnce({
        statusCode: 410,
        message: "Gone",
      });

      const { sendWebPushNotification } = await import("@/lib/server/web-push");
      const result = await sendWebPushNotification(
        {
          endpoint: "https://fcm.googleapis.com/expired",
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        { title: "Test", body: "Body" },
      );

      expect(result).toBe(false);
      expect(mockPushSubUpdate).toHaveBeenCalledWith({
        where: { endpoint: "https://fcm.googleapis.com/expired" },
        data: { isActive: false },
      });
    });

    it("当订阅不存在（404）时应标记为非活跃", async () => {
      mockSendNotification.mockRejectedValueOnce({
        statusCode: 404,
        message: "Not Found",
      });

      const { sendWebPushNotification } = await import("@/lib/server/web-push");
      const result = await sendWebPushNotification(
        {
          endpoint: "https://fcm.googleapis.com/notfound",
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        { title: "Test", body: "Body" },
      );

      expect(result).toBe(false);
    });

    it("当发送失败（非 410/404）时应返回 false 但不标记为非活跃", async () => {
      mockSendNotification.mockRejectedValueOnce({
        statusCode: 500,
        message: "Server Error",
      });

      const { sendWebPushNotification } = await import("@/lib/server/web-push");
      const result = await sendWebPushNotification(
        {
          endpoint: "https://fcm.googleapis.com/error",
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        { title: "Test", body: "Body" },
      );

      expect(result).toBe(false);
    });

    it("当初始化失败时应返回 false", async () => {
      mockGetConfig.mockImplementation(async (key: string) => {
        if (key === "notice.webPush.vapidKeys") return null;
        return undefined;
      });

      const { sendWebPushNotification } = await import("@/lib/server/web-push");
      const result = await sendWebPushNotification(
        {
          endpoint: "https://fcm.googleapis.com/test",
          p256dh: "test-p256dh",
          auth: "test-auth",
        },
        { title: "Test", body: "Body" },
      );

      expect(result).toBe(false);
    });
  });

  describe("sendWebPushToUser", () => {
    it("应向用户的所有活跃订阅发送推送", async () => {
      mockPushSubFindMany.mockResolvedValueOnce([
        { endpoint: "ep1", p256dh: "key1", auth: "auth1" },
        { endpoint: "ep2", p256dh: "key2", auth: "auth2" },
      ]);

      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      const result = await sendWebPushToUser(1, {
        title: "Test",
        body: "Body",
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it("当用户没有活跃订阅时应返回 { success: 0, failed: 0 }", async () => {
      mockPushSubFindMany.mockResolvedValueOnce([]);

      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      const result = await sendWebPushToUser(1, {
        title: "Test",
        body: "Body",
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("应正确统计成功和失败的推送数", async () => {
      mockPushSubFindMany.mockResolvedValueOnce([
        { endpoint: "ep1", p256dh: "key1", auth: "auth1" },
        { endpoint: "ep2", p256dh: "key2", auth: "auth2" },
        { endpoint: "ep3", p256dh: "key3", auth: "auth3" },
      ]);

      // 第二个推送失败
      mockSendNotification
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce({ statusCode: 500 })
        .mockResolvedValueOnce(undefined);

      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      const result = await sendWebPushToUser(1, {
        title: "Test",
        body: "Body",
      });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
    });

    it("当查询订阅失败时应返回 { success: 0, failed: 0 }", async () => {
      mockPushSubFindMany.mockRejectedValueOnce(new Error("DB Error"));

      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      const result = await sendWebPushToUser(1, {
        title: "Test",
        body: "Body",
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("应支持 icon、badge 和 data 参数", async () => {
      mockPushSubFindMany.mockResolvedValueOnce([
        { endpoint: "ep1", p256dh: "key1", auth: "auth1" },
      ]);

      const { sendWebPushToUser } = await import("@/lib/server/web-push");
      await sendWebPushToUser(1, {
        title: "Test",
        body: "Body",
        icon: "/icon.png",
        badge: "/badge.png",
        data: { url: "/test" },
      });

      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("/icon.png"),
        expect.anything(),
      );
    });
  });
});
