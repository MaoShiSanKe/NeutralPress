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

const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
}));

const mockAssertPublicHttpUrl = vi.fn();
vi.mock("@/lib/server/url-security", () => ({
  assertPublicHttpUrl: (...args: unknown[]) => mockAssertPublicHttpUrl(...args),
}));

const mockSendNotice = vi.fn();
vi.mock("@/lib/server/notice", () => ({
  sendNotice: (...args: unknown[]) => mockSendNotice(...args),
}));

const mockPrisma = {
  pushSubscription: {
    count: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

// ============ Tests ============

describe("web-push actions", () => {
  let subscribeToWebPush: typeof import("@/actions/web-push").subscribeToWebPush;
  let getVapidPublicKey: typeof import("@/actions/web-push").getVapidPublicKey;
  let getUserPushSubscriptions: typeof import("@/actions/web-push").getUserPushSubscriptions;
  let deleteWebPushSubscription: typeof import("@/actions/web-push").deleteWebPushSubscription;
  let sendTestWebPush: typeof import("@/actions/web-push").sendTestWebPush;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    const mod = await import("@/actions/web-push");
    subscribeToWebPush = mod.subscribeToWebPush;
    getVapidPublicKey = mod.getVapidPublicKey;
    getUserPushSubscriptions = mod.getUserPushSubscriptions;
    deleteWebPushSubscription = mod.deleteWebPushSubscription;
    sendTestWebPush = mod.sendTestWebPush;
  });

  const validSubscriptionData = {
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    p256dh: "test-p256dh",
    auth: "test-auth",
    deviceName: "Test Device",
  };

  // ---------- subscribeToWebPush ----------

  describe("subscribeToWebPush", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await subscribeToWebPush(validSubscriptionData);
      expect(result.success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await subscribeToWebPush(validSubscriptionData);
      expect(result.success).toBe(false);
    });

    it("无效端点时应返回 400", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockAssertPublicHttpUrl.mockRejectedValue(new Error("Invalid URL"));

      const result = await subscribeToWebPush(validSubscriptionData);
      expect(result.success).toBe(false);
    });

    it("超过订阅限制时应返回 400", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockAssertPublicHttpUrl.mockResolvedValue({
        url: new URL("https://example.com"),
      });
      mockPrisma.pushSubscription.count.mockResolvedValue(5);
      mockGetConfig.mockResolvedValue(3);

      const result = await subscribeToWebPush(validSubscriptionData);
      expect(result.success).toBe(false);
    });

    it("成功创建新订阅", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockAssertPublicHttpUrl.mockResolvedValue({
        url: new URL("https://example.com"),
      });
      mockPrisma.pushSubscription.count.mockResolvedValue(0);
      mockGetConfig.mockResolvedValue(5);
      mockPrisma.pushSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.pushSubscription.create.mockResolvedValue({ id: "sub1" });

      const result = await subscribeToWebPush(validSubscriptionData);
      expect(result.success).toBe(true);
    });

    it("已存在的订阅应更新", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockAssertPublicHttpUrl.mockResolvedValue({
        url: new URL("https://example.com"),
      });
      mockPrisma.pushSubscription.count.mockResolvedValue(1);
      mockGetConfig.mockResolvedValue(5);
      mockPrisma.pushSubscription.findUnique.mockResolvedValue({
        id: "sub1",
        userUid: 1,
      });
      mockPrisma.pushSubscription.update.mockResolvedValue({});

      const result = await subscribeToWebPush(validSubscriptionData);
      expect(result.success).toBe(true);
    });
  });

  // ---------- getVapidPublicKey ----------

  describe("getVapidPublicKey", () => {
    it("VAPID 未配置时应返回 503", async () => {
      mockGetConfig.mockResolvedValue(null);
      const result = await getVapidPublicKey();
      expect(result.success).toBe(false);
    });

    it("成功获取 VAPID 公钥", async () => {
      mockGetConfig.mockResolvedValue({ publicKey: "test-key" });
      const result = await getVapidPublicKey();
      expect(result.success).toBe(true);
      expect(result.data!.publicKey).toBe("test-key");
    });
  });

  // ---------- getUserPushSubscriptions ----------

  describe("getUserPushSubscriptions", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getUserPushSubscriptions();
      expect(result.success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getUserPushSubscriptions();
      expect(result.success).toBe(false);
    });

    it("成功获取订阅列表", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.pushSubscription.findMany.mockResolvedValue([
        { id: "sub1", deviceName: "Phone", isActive: true },
      ]);

      const result = await getUserPushSubscriptions();
      expect(result.success).toBe(true);
      expect(result.data!.subscriptions).toHaveLength(1);
    });
  });

  // ---------- deleteWebPushSubscription ----------

  describe("deleteWebPushSubscription", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteWebPushSubscription("https://example.com");
      expect(result.success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteWebPushSubscription("https://example.com");
      expect(result.success).toBe(false);
    });

    it("成功删除订阅", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteWebPushSubscription("https://example.com");
      expect(result.success).toBe(true);
    });
  });

  // ---------- sendTestWebPush ----------

  describe("sendTestWebPush", () => {
    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await sendTestWebPush();
      expect(result.success).toBe(false);
    });

    it("无有效订阅时应返回 400", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.pushSubscription.count.mockResolvedValue(0);

      const result = await sendTestWebPush();
      expect(result.success).toBe(false);
    });

    it("成功发送测试通知", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.pushSubscription.count.mockResolvedValue(2);
      mockSendNotice.mockResolvedValue(undefined);

      const result = await sendTestWebPush();
      expect(result.success).toBe(true);
      expect(result.data!.message).toContain("2");
    });
  });
});
