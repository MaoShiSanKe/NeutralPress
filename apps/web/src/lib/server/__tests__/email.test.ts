import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: vi.fn().mockResolvedValue("Test Site"),
  getConfigs: vi.fn().mockResolvedValue([
    true, // notice.enable
    "test@example.com", // notice.email
    "Test Sender", // notice.email.from.name
    "reply@example.com", // notice.email.replyTo
    "re_test_key", // notice.email.resend.apiKey
    null, // notice.email.smtp
    "Test Site", // site.title
  ]),
}));

// Mock Resend
const mockSend = vi.fn();
class MockResend {
  emails = { send: mockSend };
  constructor(_apiKey?: string) {}
}
vi.mock("resend", () => ({
  Resend: MockResend,
}));

// Mock nodemailer
const mockSendMail = vi.fn();
const mockTransporter = { sendMail: mockSendMail };
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn().mockReturnValue(mockTransporter),
  },
}));

describe("email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ data: { id: "msg-123" }, error: null });
    mockSendMail.mockResolvedValue({ messageId: "smtp-msg-123" });
  });

  // =========================================================================
  // generate (验证码生成)
  // =========================================================================
  describe("generate (验证码生成)", () => {
    it("应导出 emailUtils 对象", async () => {
      const emailUtils = (await import("@/lib/server/email")).default;
      expect(emailUtils).toBeDefined();
      expect(typeof emailUtils.generate).toBe("function");
      expect(typeof emailUtils.verify).toBe("function");
      expect(typeof emailUtils.sendEmail).toBe("function");
    });

    it("generate 应返回包含时间戳的验证码", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const code = emailUtils.generate();

      // 格式应为 "6位数字-时间戳"
      expect(code).toMatch(/^\d{6}-\d+$/);
    });

    it("generate 每次应生成不同的验证码", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const code1 = emailUtils.generate();
      const code2 = emailUtils.generate();

      // 由于随机性，两次生成的验证码应该不同
      expect(code1).not.toBe(code2);
    });

    it("generate 生成的验证码数字部分应为 6 位", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const code = emailUtils.generate();
      const [numberPart] = code.split("-");

      expect(numberPart).toHaveLength(6);
      expect(parseInt(numberPart!, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(numberPart!, 10)).toBeLessThan(1000000);
    });

    it("generate 生成的验证码时间戳部分应为有效时间", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const before = Date.now();
      const code = emailUtils.generate();
      const after = Date.now();

      const timestampStr = code.split("-")[1];
      const timestamp = parseInt(timestampStr!, 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  // =========================================================================
  // verify (验证码验证)
  // =========================================================================
  describe("verify (验证码验证)", () => {
    it("应验证有效的验证码", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const code = emailUtils.generate();
      const [numberPart] = code.split("-");

      const result = emailUtils.verify(numberPart!, code);
      expect(result).toBe(true);
    });

    it("应拒绝错误的验证码", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const code = emailUtils.generate();

      const result = emailUtils.verify("000000", code);
      expect(result).toBe(false);
    });

    it("应拒绝过期的验证码（超过 15 分钟）", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      // 创建一个 16 分钟前的时间戳（超过 15 分钟有效期）
      const expiredTimestamp = Date.now() - 16 * 60 * 1000;
      const expiredCode = `123456-${expiredTimestamp}`;

      const result = emailUtils.verify("123456", expiredCode);
      expect(result).toBe(false);
    });

    it("应接受未过期的验证码（14 分钟内）", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const recentTimestamp = Date.now() - 14 * 60 * 1000;
      const recentCode = `123456-${recentTimestamp}`;

      const result = emailUtils.verify("123456", recentCode);
      expect(result).toBe(true);
    });

    it("应拒绝格式错误的验证码（空 storedCode）", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      expect(emailUtils.verify("123456", "")).toBe(false);
    });

    it("应拒绝格式错误的验证码（无分隔符）", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      expect(emailUtils.verify("123456", "invalid")).toBe(false);
    });

    it("应拒绝空输入验证码", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      expect(emailUtils.verify("", "123456-123456789")).toBe(false);
    });

    it("应拒绝长度不匹配的验证码（过短）", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const timestamp = Date.now();
      const code = `123456-${timestamp}`;

      expect(emailUtils.verify("12345", code)).toBe(false);
    });

    it("应拒绝长度不匹配的验证码（过长）", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      const timestamp = Date.now();
      const code = `123456-${timestamp}`;

      expect(emailUtils.verify("1234567", code)).toBe(false);
    });

    it("应拒绝无效时间戳", async () => {
      const { default: emailUtils } = await import("@/lib/server/email");
      expect(emailUtils.verify("123456", "123456-abc")).toBe(false);
    });
  });

  // =========================================================================
  // sendEmail (邮件发送)
  // =========================================================================
  describe("sendEmail (邮件发送)", () => {
    it("当邮件功能未启用时应返回失败", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        false, // notice.enable = false
        "test@example.com",
        "Test Sender",
        "reply@example.com",
        null,
        null,
        "Test Site",
      ] as any);

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("未启用");
    });

    it("当邮件地址为空时应返回失败", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        true,
        "", // 空邮件地址
        "Test Sender",
        "reply@example.com",
        null,
        null,
        "Test Site",
      ] as any);

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
    });

    it("当缺少收件人时应返回失败", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "",
        subject: "Test",
        html: "<p>Test</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("缺少必要参数");
    });

    it("当缺少邮件内容时应返回失败", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("缺少必要参数");
    });

    it("应通过 Resend 发送邮件", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-123");
      expect(mockSend).toHaveBeenCalled();
    });

    it("应支持发送给多个收件人", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@example.com", "user2@example.com"],
        }),
      );
    });

    it("当 Resend 返回错误时应返回失败", async () => {
      mockSend.mockResolvedValueOnce({
        data: null,
        error: { message: "API Error" },
      });

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
    });

    it("当 Resend 抛出异常时应返回失败", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("当 Resend 抛出非 Error 异常时应返回默认错误信息", async () => {
      mockSend.mockRejectedValueOnce("string error");

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("未知错误");
    });
  });

  // =========================================================================
  // SMTP 邮件发送
  // =========================================================================
  describe("SMTP 邮件发送", () => {
    it("当配置了 SMTP 时应使用 SMTP 发送", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        true,
        "test@example.com",
        "Test Sender",
        "reply@example.com",
        null, // 无 Resend API key
        {
          user: "smtp-user",
          host: "smtp.example.com",
          port: "587",
          tls: false,
          password: "smtp-pass",
        },
        "Test Site",
      ] as any);

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("smtp-msg-123");
      expect(mockSendMail).toHaveBeenCalled();
    });

    it("SMTP 发送应支持多个收件人（逗号分隔）", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        true,
        "test@example.com",
        "Test Sender",
        "reply@example.com",
        null,
        {
          user: "smtp-user",
          host: "smtp.example.com",
          port: "587",
          tls: false,
          password: "smtp-pass",
        },
        "Test Site",
      ] as any);

      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: ["user1@example.com", "user2@example.com"],
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user1@example.com, user2@example.com",
        }),
      );
    });

    it("SMTP 发送失败时应返回错误", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        true,
        "test@example.com",
        "Test Sender",
        "reply@example.com",
        null,
        {
          user: "smtp-user",
          host: "smtp.example.com",
          port: "587",
          tls: false,
          password: "smtp-pass",
        },
        "Test Site",
      ] as any);

      mockSendMail.mockRejectedValueOnce(new Error("SMTP Error"));

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP Error");
    });

    it("SMTP 发送抛出非 Error 异常时返回默认错误", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        true,
        "test@example.com",
        "Test Sender",
        "reply@example.com",
        null,
        {
          user: "smtp-user",
          host: "smtp.example.com",
          port: "587",
          tls: false,
          password: "smtp-pass",
        },
        "Test Site",
      ] as any);

      mockSendMail.mockRejectedValueOnce("string error");

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("未知错误");
    });
  });

  // =========================================================================
  // 无邮件服务配置
  // =========================================================================
  describe("无邮件服务配置", () => {
    it("当既无 Resend 也无 SMTP 时返回失败", async () => {
      const { getConfigs } = await import("@/lib/server/config-cache");
      vi.mocked(getConfigs).mockResolvedValueOnce([
        true,
        "test@example.com",
        "Test Sender",
        "reply@example.com",
        null, // 无 Resend
        null, // 无 SMTP
        "Test Site",
      ] as any);

      const { sendEmail } = await import("@/lib/server/email");
      const result = await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("未配置");
    });
  });

  // =========================================================================
  // SendEmailOptions 接口
  // =========================================================================
  describe("SendEmailOptions 接口", () => {
    it("应支持 replyTo 选项", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
        replyTo: "custom-reply@example.com",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "custom-reply@example.com",
        }),
      );
    });

    it("应支持 text 内容", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        text: "Plain text content",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Plain text content",
        }),
      );
    });

    it("同时提供 html 和 text 时两者都应传递", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>HTML</p>",
        text: "Plain text",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          html: "<p>HTML</p>",
          text: "Plain text",
        }),
      );
    });
  });

  // =========================================================================
  // 邮件主题前缀
  // =========================================================================
  describe("邮件主题前缀", () => {
    it("Resend 发送时应添加站点标题前缀", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test Subject",
        html: "<p>Hello</p>",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Test Subject"),
        }),
      );
    });

    it("应使用正确的发件人格式", async () => {
      const { sendEmail } = await import("@/lib/server/email");
      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining("test@example.com"),
        }),
      );
    });
  });
});
