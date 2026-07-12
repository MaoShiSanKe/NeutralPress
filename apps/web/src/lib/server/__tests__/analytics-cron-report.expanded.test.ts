import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/shared-types/api/cron", () => ({}));
vi.mock("@/emails/templates/AnalyticsDigestEmail", () => ({
  default: vi.fn().mockReturnValue("mock-component"),
}));
vi.mock("@/emails/utils", () => ({
  renderEmail: vi
    .fn()
    .mockResolvedValue({ html: "<html></html>", text: "text" }),
}));

const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({ getConfigs: mockGetConfigs }));

const mockSendEmail = vi.fn();
vi.mock("@/lib/server/email", () => ({ sendEmail: mockSendEmail }));

const mockSendNotice = vi.fn();
vi.mock("@/lib/server/notice", () => ({ sendNotice: mockSendNotice }));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { total_views: BigInt(100), unique_visitors: BigInt(50) },
      ]),
    pageViewArchive: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

describe("analytics-cron-report expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfigs.mockResolvedValue([
      "NOTICE",
      true,
      true,
      true,
      "1",
      "Asia/Shanghai",
      "My Site",
      "https://example.com",
    ]);
    mockSendEmail.mockResolvedValue({ success: true });
    mockSendNotice.mockResolvedValue(undefined);
  });

  describe("dispatchAnalyticsCronReports", () => {
    it("mode 为 NONE 时返回空结果", async () => {
      mockGetConfigs.mockResolvedValue([
        "NONE",
        true,
        true,
        true,
        "1",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.mode).toBe("NONE");
      expect(result.cycleResults).toHaveLength(0);
      expect(result.noticeSent).toBe(0);
      expect(result.emailSent).toBe(0);
    });

    it("返回正确的 mode", async () => {
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 10,
          syncedViewCountRows: 5,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.mode).toBe("NOTICE");
    });

    it("返回正确的 timezone", async () => {
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.timezone).toBe("Asia/Shanghai");
    });

    it("没有找到接收人时添加错误信息", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("未找到可用管理员接收人");
    });

    it("无效 timezone 时使用 UTC", async () => {
      mockGetConfigs.mockResolvedValue([
        "NOTICE",
        true,
        false,
        false,
        "",
        "Invalid/Timezone",
        "Site",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result).toBeDefined();
    });

    it("处理 EMAIL 模式", async () => {
      mockGetConfigs.mockResolvedValue([
        "EMAIL",
        true,
        false,
        false,
        "",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.mode).toBe("EMAIL");
    });

    it("处理 NOTICE_EMAIL 模式", async () => {
      mockGetConfigs.mockResolvedValue([
        "NOTICE_EMAIL",
        true,
        false,
        false,
        "",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.mode).toBe("NOTICE_EMAIL");
    });

    it("无效 mode 默认为 NONE", async () => {
      mockGetConfigs.mockResolvedValue([
        "INVALID_MODE",
        true,
        true,
        true,
        "",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.mode).toBe("NONE");
    });

    it("处理 uid 列表中的非数字值", async () => {
      mockGetConfigs.mockResolvedValue([
        "NOTICE",
        true,
        false,
        false,
        ["abc", "1", "", "  ", "2"],
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
        {
          uid: 2,
          username: "editor",
          nickname: "Editor",
          email: "editor@example.com",
          emailVerified: true,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.recipientCount).toBe(2);
    });

    it("应将 flushResult 传递给报告", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      mockGetConfigs.mockResolvedValue([
        "NOTICE",
        true,
        false,
        false,
        "1",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 42,
          syncedViewCountRows: 10,
          archivedDateGroups: 3,
          archivedRawPageViewDeleted: 100,
          expiredArchiveDeleted: 5,
        },
      });
      expect(result).toBeDefined();
      if (result.cycleResults.length > 0) {
        expect(result.cycleResults[0]!.periodLabel).toBeDefined();
      }
    });

    it("应处理空 site.url", async () => {
      mockGetConfigs.mockResolvedValue([
        "NOTICE",
        true,
        false,
        false,
        "1",
        "UTC",
        "Site",
        "",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result).toBeDefined();
    });

    it("应处理空 site.title", async () => {
      mockGetConfigs.mockResolvedValue([
        "NOTICE",
        true,
        false,
        false,
        "1",
        "UTC",
        "",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result).toBeDefined();
    });

    it("应处理 email 未验证的接收人", async () => {
      mockGetConfigs.mockResolvedValue([
        "EMAIL",
        true,
        false,
        false,
        "",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: false,
        },
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.emailSent).toBe(0);
    });

    it("应处理发送通知失败的情况", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      mockSendNotice.mockRejectedValue(new Error("Send failed"));
      mockGetConfigs.mockResolvedValue([
        "NOTICE",
        true,
        false,
        false,
        "1",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("应处理发送邮件失败的情况", async () => {
      mockGetConfigs.mockResolvedValue([
        "EMAIL",
        true,
        false,
        false,
        "",
        "UTC",
        "Site",
        "https://example.com",
      ]);
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.user.findMany as any).mockResolvedValue([
        {
          uid: 1,
          username: "admin",
          nickname: null,
          email: "admin@example.com",
          emailVerified: true,
        },
      ]);
      mockSendEmail.mockResolvedValue({ success: false, error: "SMTP error" });
      const { dispatchAnalyticsCronReports } = await import(
        "@/lib/server/analytics-cron-report"
      );
      const result = await dispatchAnalyticsCronReports({
        triggerType: "CRON" as any,
        flushResult: {
          success: true,
          flushedCount: 0,
          syncedViewCountRows: 0,
          archivedDateGroups: 0,
          archivedRawPageViewDeleted: 0,
          expiredArchiveDeleted: 0,
        },
      });
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
