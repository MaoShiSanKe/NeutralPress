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
    healthCheck: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
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

vi.mock("@/lib/server/audit", () => ({
  logAuditEvent: vi.fn(),
}));

vi.mock("@/lib/server/cron-task-runner", () => ({
  runDoctorHealthCheck: vi.fn(async () => ({
    id: 1,
    data: {
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      durationMs: 1000,
      triggerType: "MANUAL",
      status: "OK",
      okCount: 5,
      warningCount: 0,
      errorCount: 0,
      issues: [],
    },
  })),
}));

vi.mock("@/data/check-config", () => ({
  buildDoctorBriefFromIssues: vi.fn(() => "全部正常"),
  formatDoctorCheckDetails: vi.fn(() => "正常"),
  getDoctorCheckMessage: vi.fn((code: string) => `Check: ${code}`),
  getDoctorCheckOrder: vi.fn(() => 0),
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

function mockHealthCheckRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    startedAt: new Date("2025-06-01T12:00:00Z"),
    createdAt: new Date("2025-06-01T12:00:05Z"),
    durationMs: 5000,
    triggerType: "MANUAL",
    overallStatus: "OK",
    okCount: 5,
    warningCount: 0,
    errorCount: 0,
    snapshot: {
      checks: {
        db: { v: "connected", d: 100, s: "O" },
        redis: { v: "connected", d: 50, s: "O" },
      },
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("doctor actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // doctor
  // ==========================================================================
  describe("doctor", () => {
    it("使用缓存结果返回 - 非强制模式", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.findFirst).mockResolvedValue(
        mockHealthCheckRecord() as never,
      );

      const { doctor } = await import("@/actions/doctor");
      const result = await doctor({
        access_token: "valid-token",
        force: false,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("强制执行健康检查 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.findFirst).mockResolvedValue(null as never);

      const { doctor } = await import("@/actions/doctor");
      const result = await doctor({
        access_token: "valid-token",
        force: true,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("无缓存时执行新检查", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.findFirst).mockResolvedValue(null as never);

      const { doctor } = await import("@/actions/doctor");
      const result = await doctor({
        access_token: "valid-token",
        force: false,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { doctor } = await import("@/actions/doctor");
      const result = await doctor({ access_token: "invalid", force: false });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("速率限制触发返回 429", async () => {
      mockLimitControl.mockResolvedValue(false as never);

      const { doctor } = await import("@/actions/doctor");
      const result = await doctor({
        access_token: "valid-token",
        force: false,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });
  });

  // ==========================================================================
  // getDoctorHistory
  // ==========================================================================
  describe("getDoctorHistory", () => {
    it("返回健康检查历史 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.count).mockResolvedValue(1);
      vi.mocked(prisma.healthCheck.findMany).mockResolvedValue([
        mockHealthCheckRecord(),
      ] as never);

      const { getDoctorHistory } = await import("@/actions/doctor");
      const result = await getDoctorHistory({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("支持状态过滤", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.count).mockResolvedValue(0);
      vi.mocked(prisma.healthCheck.findMany).mockResolvedValue([]);

      const { getDoctorHistory } = await import("@/actions/doctor");
      const result = await getDoctorHistory({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        status: "OK",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getDoctorHistory } = await import("@/actions/doctor");
      const result = await getDoctorHistory({
        access_token: "invalid",
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误返回 500", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.count).mockRejectedValue(
        new Error("DB error"),
      );

      const { getDoctorHistory } = await import("@/actions/doctor");
      const result = await getDoctorHistory({
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
  // getDoctorTrends
  // ==========================================================================
  describe("getDoctorTrends", () => {
    it("返回健康检查趋势 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.healthCheck.findMany).mockResolvedValue([]);

      const { getDoctorTrends } = await import("@/actions/doctor");
      const result = await getDoctorTrends({
        access_token: "valid-token",
        days: 30,
        count: 30,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getDoctorTrends } = await import("@/actions/doctor");
      const result = await getDoctorTrends({
        access_token: "invalid",
        days: 30,
        count: 30,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });
});
