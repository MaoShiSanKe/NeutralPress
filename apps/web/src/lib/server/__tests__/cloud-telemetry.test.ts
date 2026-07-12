import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock fs
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn().mockRejectedValue(new Error("File not found")),
  },
}));

// Mock path
vi.mock("node:path", () => ({
  default: {
    join: vi.fn().mockReturnValue("/mock/package.json"),
  },
}));

// Mock config-cache
const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfigs: mockGetConfigs,
}));

// Mock prisma
const _mockFindFirst = vi.fn();
vi.mock("@/lib/server/prisma", () => ({
  default: {
    cronHistory: { findFirst: vi.fn().mockResolvedValue(null) },
    healthCheck: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

describe("cloud-telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfigs.mockResolvedValue([true, true, true, true]);
  });

  describe("collectCloudTelemetry", () => {
    it("应返回包含 schemaVer 的遥测数据", async () => {
      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 150,
        tokenAgeMs: 5000,
      });

      expect(result.schemaVer).toBe("np-cloud-telemetry-v1");
    });

    it("应包含 collectedAt 时间戳", async () => {
      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 100,
        tokenAgeMs: null,
      });

      expect(result.collectedAt).toBeDefined();
      expect(typeof result.collectedAt).toBe("string");
      // 应该是有效的 ISO 日期字符串
      expect(new Date(result.collectedAt).toISOString()).toBe(
        result.collectedAt,
      );
    });

    it("应传递 accepted 和 dedupHit 值", async () => {
      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: false,
        dedupHit: true,
        verifySource: "NONE",
        dnssecAd: null,
        verifyMs: 0,
        tokenAgeMs: null,
      });

      expect(result.accepted).toBe(false);
      expect(result.dedupHit).toBe(true);
    });

    it("应包含 protocolVerification 信息", async () => {
      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "JWKS",
        dnssecAd: false,
        verifyMs: 200,
        tokenAgeMs: 10000,
      });

      expect(result.protocolVerification).toEqual({
        accepted: true,
        dedupHit: false,
        verifySource: "JWKS",
        dnssecAd: false,
        verifyMs: 200,
        tokenAgeMs: 10000,
      });
    });

    it("应包含 configSnapshot 信息", async () => {
      mockGetConfigs.mockResolvedValue([true, false, true, false]);

      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 50,
        tokenAgeMs: null,
      });

      expect(result.configSnapshot).toEqual({
        cronEnabled: true,
        doctorEnabled: false,
        projectsEnabled: true,
        friendsEnabled: false,
      });
    });

    it("当没有 cron 历史时应返回 null 的 cron summary", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.cronHistory.findFirst as any).mockResolvedValue(null);

      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 50,
        tokenAgeMs: null,
      });

      expect(result.latestCronSummary.latestRunId).toBeNull();
      expect(result.latestCronSummary.latestCreatedAt).toBeNull();
      expect(result.latestCronSummary.latestStatus).toBeNull();
    });

    it("当有 cron 历史时应包含 cron summary", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.cronHistory.findFirst as any).mockResolvedValue({
        id: 42,
        createdAt: new Date("2024-01-15T10:00:00Z"),
        status: "OK",
        durationMs: 5000,
        enabledCount: 3,
        successCount: 3,
        failedCount: 0,
        skippedCount: 0,
        snapshot: { tasks: {} },
      });

      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 50,
        tokenAgeMs: null,
      });

      expect(result.latestCronSummary.latestRunId).toBe(42);
      expect(result.latestCronSummary.latestStatus).toBe("OK");
      expect(result.latestCronSummary.enabledCount).toBe(3);
    });

    it("当没有 health check 记录时应返回 null 的 runtimeHealth", async () => {
      const prisma = (await import("@/lib/server/prisma")).default;
      (prisma.healthCheck.findFirst as any).mockResolvedValue(null);

      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 50,
        tokenAgeMs: null,
      });

      expect(result.runtimeHealth.healthRecordId).toBeNull();
      expect(result.runtimeHealth.healthStatus).toBeNull();
    });

    it("应包含 versionInfo", async () => {
      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );
      const result = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 50,
        tokenAgeMs: null,
      });

      expect(result.versionInfo).toBeDefined();
      expect(result.versionInfo.runtimeNodeVersion).toBeDefined();
      expect(typeof result.versionInfo.runtimeNodeVersion).toBe("string");
    });

    it("应处理不同的 verifySource 值", async () => {
      const { collectCloudTelemetry } = await import(
        "@/lib/server/cloud-telemetry"
      );

      const dohResult = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "DOH",
        dnssecAd: true,
        verifyMs: 50,
        tokenAgeMs: null,
      });
      expect(dohResult.protocolVerification.verifySource).toBe("DOH");

      const jwksResult = await collectCloudTelemetry({
        accepted: true,
        dedupHit: false,
        verifySource: "JWKS",
        dnssecAd: false,
        verifyMs: 100,
        tokenAgeMs: 5000,
      });
      expect(jwksResult.protocolVerification.verifySource).toBe("JWKS");

      const noneResult = await collectCloudTelemetry({
        accepted: false,
        dedupHit: false,
        verifySource: "NONE",
        dnssecAd: null,
        verifyMs: 0,
        tokenAgeMs: null,
      });
      expect(noneResult.protocolVerification.verifySource).toBe("NONE");
    });
  });
});
