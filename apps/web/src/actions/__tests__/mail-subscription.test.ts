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

const mockVerifyCaptchaToken = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/server/captcha", () => ({
  verifyToken: (...args: unknown[]) => mockVerifyCaptchaToken(...args),
}));

const mockGetConfig = vi.fn();
const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: (...args: unknown[]) => mockGetConfig(...args),
  getConfigs: (...args: unknown[]) => mockGetConfigs(...args),
}));

const mockPrisma = {
  mailSubscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    groupBy: vi.fn(),
  },
  post: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};
vi.mock("@/lib/server/prisma", () => ({ default: mockPrisma }));

const mockSendEmail = vi.fn().mockResolvedValue({ success: true });
vi.mock("@/lib/server/email", () => ({
  default: { generate: vi.fn().mockReturnValue("code-test") },
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

vi.mock("@/lib/server/jwt", () => ({
  jwtTokenSign: vi.fn().mockReturnValue("signed-token"),
  jwtTokenVerify: vi.fn(),
}));

vi.mock("@/lib/server/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/server/media-reference", () => ({
  getFeaturedImageUrl: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/server/post-access", () => ({
  PUBLIC_POST_PUBLISHED_WHERE: { status: "PUBLISHED", deletedAt: null },
}));

vi.mock("@/emails/templates/MailSubscriptionVerifyEmail", () => ({
  MailSubscriptionVerifyEmail: vi.fn(),
}));

vi.mock("@/emails/templates/PostSubscriptionEmail", () => ({
  PostSubscriptionEmail: vi.fn(),
}));

vi.mock("@/emails/utils", () => ({
  renderEmail: vi.fn().mockResolvedValue({ html: "<p>test</p>", text: "test" }),
}));

// ============ Tests ============

describe("mail-subscription actions", () => {
  let subscribeMail: typeof import("@/actions/mail-subscription").subscribeMail;
  let confirmMailSubscription: typeof import("@/actions/mail-subscription").confirmMailSubscription;
  let getMailSubscriptionList: typeof import("@/actions/mail-subscription").getMailSubscriptionList;
  let getMailSubscriptionStatusDistribution: typeof import("@/actions/mail-subscription").getMailSubscriptionStatusDistribution;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLimitControl.mockResolvedValue(true);
    mockVerifyCaptchaToken.mockResolvedValue({ success: true });
    const mod = await import("@/actions/mail-subscription");
    subscribeMail = mod.subscribeMail;
    confirmMailSubscription = mod.confirmMailSubscription;
    getMailSubscriptionList = mod.getMailSubscriptionList;
    getMailSubscriptionStatusDistribution =
      mod.getMailSubscriptionStatusDistribution;
  });

  // ---------- subscribeMail ----------

  describe("subscribeMail", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await subscribeMail({
        email: "test@test.com",
        captcha_token: "token",
      });
      expect(result.success).toBe(false);
    });

    it("缺少验证码时应返回 400", async () => {
      const result = await subscribeMail({
        email: "test@test.com",
        captcha_token: "",
      });
      expect(result.success).toBe(false);
    });

    it("验证码验证失败时应返回 400", async () => {
      mockVerifyCaptchaToken.mockResolvedValue({ success: false });
      const result = await subscribeMail({
        email: "test@test.com",
        captcha_token: "bad",
      });
      expect(result.success).toBe(false);
    });

    it("邮件订阅功能未开启时应返回 503", async () => {
      mockGetConfigs.mockResolvedValue([
        false,
        false,
        false,
        "Site",
        "https://site.com",
      ]);
      const result = await subscribeMail({
        email: "test@test.com",
        captcha_token: "token",
      });
      expect(result.success).toBe(false);
    });

    it("已登录用户直接订阅成功", async () => {
      // subscribeMail calls getConfigs twice:
      // 1st: ["notice.mailSubscription.enable", "notice.mailSubscription.anonymous.enable", "notice.mailSubscription.check.enable", "site.title", "site.url"]
      // 2nd (inside checkMailDeliveryAvailability): ["notice.enable", "notice.email", "notice.email.resend.apiKey", "notice.email.smtp"]
      mockGetConfigs
        .mockResolvedValueOnce([true, false, true, "Site", "https://site.com"])
        .mockResolvedValueOnce([true, "noreply@site.com", "resend-key", null]);

      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrisma.user.findUnique.mockResolvedValue({
        uid: 1,
        email: "user@test.com",
      });
      mockPrisma.mailSubscription.findUnique.mockResolvedValue(null);
      mockPrisma.mailSubscription.create.mockResolvedValue({
        id: 1,
        status: "ACTIVE",
      });

      const result = await subscribeMail({ captcha_token: "token" });
      expect(result.success).toBe(true);
    });
  });

  // ---------- confirmMailSubscription ----------

  describe("confirmMailSubscription", () => {
    it("缺少确认令牌时应返回 400", async () => {
      const result = await confirmMailSubscription({ token: "" });
      expect(result.success).toBe(false);
    });

    it("无效令牌格式时应返回 400", async () => {
      const result = await confirmMailSubscription({ token: "invalid" });
      expect(result.success).toBe(false);
    });
  });

  // ---------- getMailSubscriptionList ----------

  describe("getMailSubscriptionList", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMailSubscriptionList();
      expect(result.success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getMailSubscriptionList();
      expect(result.success).toBe(false);
    });

    it("成功获取列表", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.mailSubscription.count.mockResolvedValue(0);
      mockPrisma.mailSubscription.findMany.mockResolvedValue([]);

      const result = await getMailSubscriptionList();
      expect(result.success).toBe(true);
      expect(result.data!.items).toHaveLength(0);
    });
  });

  // ---------- getMailSubscriptionStatusDistribution ----------

  describe("getMailSubscriptionStatusDistribution", () => {
    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getMailSubscriptionStatusDistribution();
      expect(result.success).toBe(false);
    });

    it("成功获取分布", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.mailSubscription.groupBy.mockResolvedValue([
        { status: "ACTIVE", _count: { _all: 10 } },
        { status: "PENDING_VERIFY", _count: { _all: 2 } },
      ]);

      const result = await getMailSubscriptionStatusDistribution();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(3); // ACTIVE, PENDING_VERIFY, UNSUBSCRIBED
    });

    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMailSubscriptionStatusDistribution();
      expect(result.success).toBe(false);
    });
  });

  // ---------- 补充测试 ----------

  describe("subscribeMail 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await subscribeMail({
        email: "test@example.com",
        captcha_token: "valid-token",
      });
      expect(result.success).toBe(false);
    });

    it("验证码失败时应返回错误", async () => {
      mockVerifyCaptchaToken.mockResolvedValueOnce({ success: false });
      const result = await subscribeMail({
        email: "test@example.com",
        captcha_token: "invalid-token",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getMailSubscriptionList 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMailSubscriptionList();
      expect(result.success).toBe(false);
    });

    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getMailSubscriptionList();
      expect(result.success).toBe(false);
    });

    it("返回空列表时应正常工作", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.mailSubscription.count.mockResolvedValue(0);
      mockPrisma.mailSubscription.findMany.mockResolvedValue([]);

      const result = await getMailSubscriptionList();
      expect(result.success).toBe(true);
      expect(result.data!.items).toHaveLength(0);
    });
  });

  describe("getMailSubscriptionStatusDistribution 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getMailSubscriptionStatusDistribution();
      expect(result.success).toBe(false);
    });

    it("无订阅者时应返回分布", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrisma.mailSubscription.groupBy.mockResolvedValue([]);

      const result = await getMailSubscriptionStatusDistribution();
      expect(result.success).toBe(true);
    });
  });
});
