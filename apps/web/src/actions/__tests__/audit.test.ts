import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/server/auth-verify", () => ({
  authVerify: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    auditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/server/response", () => {
  class MockResponseBuilder {
    ok(opts?: unknown) {
      return { success: true, ...(opts as Record<string, unknown>) };
    }
    badRequest(opts?: unknown) {
      return {
        success: false,
        status: 400,
        ...(opts as Record<string, unknown>),
      };
    }
    unauthorized() {
      return { success: false, status: 401 };
    }
    tooManyRequests() {
      return { success: false, status: 429 };
    }
    serverError() {
      return { success: false, status: 500 };
    }
  }
  return { default: MockResponseBuilder };
});

vi.mock("@/lib/server/validator", () => ({
  validateData: vi.fn(),
}));

vi.mock("@/lib/server/ip-utils", () => ({
  resolveIpLocation: vi.fn(() => null),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { authVerify } from "@/lib/server/auth-verify";
import prisma from "@/lib/server/prisma";
import limitControl from "@/lib/server/rate-limit";
import { validateData } from "@/lib/server/validator";

const mockLimitControl = vi.mocked(limitControl);
const mockValidateData = vi.mocked(validateData);
const mockAuthVerify = vi.mocked(authVerify);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSuccessMocks() {
  mockLimitControl.mockResolvedValue(true as never);
  mockValidateData.mockReturnValue(null as never);
  mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" } as never);
}

function mockAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    timestamp: new Date("2025-06-01T12:00:00Z"),
    action: "CREATE",
    resource: "POST",
    resourceId: "post-1",
    userUid: 1,
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
    oldData: null,
    newData: { title: "Test" },
    description: "Created a post",
    metadata: null,
    user: { uid: 1, username: "admin", nickname: "Admin" },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("audit actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // getAuditLogs
  // ==========================================================================
  describe("getAuditLogs", () => {
    it("返回审计日志列表 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        mockAuditRecord(),
      ] as never);

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("返回正确的数据格式", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.count).mockResolvedValue(1);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        mockAuditRecord(),
      ] as never);

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
      });

      const data = (result as Record<string, unknown>).data as unknown[];
      expect(data).toHaveLength(1);
      expect(data[0]).toEqual(
        expect.objectContaining({
          id: 1,
          action: "CREATE",
          resource: "POST",
          resourceId: "post-1",
          userUid: 1,
        }),
      );
    });

    it("支持搜索过滤", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        search: "test keyword",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
      expect(prisma.auditLog.findMany).toHaveBeenCalled();
    });

    it("支持日期范围过滤", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        timestampStart: "2025-01-01",
        timestampEnd: "2025-12-31",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "invalid",
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("速率限制触发返回 429", async () => {
      mockLimitControl.mockResolvedValue(false as never);

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("数据库错误返回 500", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.count).mockRejectedValue(new Error("DB error"));

      const { getAuditLogs } = await import("@/actions/audit");
      const result = await getAuditLogs({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 500 }),
      );
    });
  });

  // ==========================================================================
  // getAuditTrends
  // ==========================================================================
  describe("getAuditTrends", () => {
    it("返回审计趋势 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        {
          id: 1,
          timestamp: new Date("2025-06-01T12:00:00Z"),
          action: "CREATE",
          resource: "POST",
        },
        {
          id: 2,
          timestamp: new Date("2025-06-01T14:00:00Z"),
          action: "UPDATE",
          resource: "POST",
        },
      ] as never);

      const { getAuditTrends } = await import("@/actions/audit");
      const result = await getAuditTrends({
        access_token: "valid-token",
        days: 30,
        count: 30,
        groupBy: "action",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("支持按资源分组", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([]);

      const { getAuditTrends } = await import("@/actions/audit");
      const result = await getAuditTrends({
        access_token: "valid-token",
        days: 7,
        count: 10,
        groupBy: "resource",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getAuditTrends } = await import("@/actions/audit");
      const result = await getAuditTrends({
        access_token: "invalid",
        days: 30,
        count: 30,
        groupBy: "action",
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });
});
