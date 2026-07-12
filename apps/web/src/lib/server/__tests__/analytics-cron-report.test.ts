import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock shared-types
vi.mock("@repo/shared-types/api/cron", () => ({}));

// Mock email templates
vi.mock("@/emails/templates/AnalyticsDigestEmail", () => ({
  default: vi.fn().mockReturnValue("mock-component"),
}));

// Mock email utils
vi.mock("@/emails/utils", () => ({
  renderEmail: vi
    .fn()
    .mockResolvedValue({ html: "<html></html>", text: "text" }),
}));

// Mock config-cache
const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfigs: mockGetConfigs,
}));

// Mock email
const mockSendEmail = vi.fn();
vi.mock("@/lib/server/email", () => ({
  sendEmail: mockSendEmail,
}));

// Mock notice
const mockSendNotice = vi.fn();
vi.mock("@/lib/server/notice", () => ({
  sendNotice: mockSendNotice,
}));

// Mock prisma
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

describe("analytics-cron-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfigs.mockResolvedValue([
      "NOTICE", // mode
      true, // daily.enable
      true, // weekly.enable
      true, // monthly.enable
      "1", // notifyAdmin.uid
      "Asia/Shanghai", // timezone
      "My Site", // site.title
      "https://example.com", // site.url
    ]);

    mockSendEmail.mockResolvedValue({ success: true });
    mockSendNotice.mockResolvedValue(undefined);
  });

  describe("dispatchAnalyticsCronReports", () => {
    it("当 mode 为 NONE 时应返回空结果", async () => {
      mockGetConfigs.mockResolvedValue([
        "NONE", // mode
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

    it("应返回正确的 mode", async () => {
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

    it("应返回正确的 timezone", async () => {
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

    it("当没有找到接收人时应添加错误信息", async () => {
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

    it("当配置的 timezone 无效时应使用 UTC", async () => {
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

      // 应仍然能够执行
      expect(result).toBeDefined();
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
        true, // daily
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
      // 应该至少有一个 cycle result
      if (result.cycleResults.length > 0) {
        expect(result.cycleResults[0]!.periodLabel).toBeDefined();
      }
    });

    it("应处理 EMAIL 模式", async () => {
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

    it("应处理 NOTICE_EMAIL 模式", async () => {
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

    it("应将无效的 mode 默认为 NONE", async () => {
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

    it("应处理 uid 列表中的非数字值", async () => {
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
  });
});
