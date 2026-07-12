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
      return { success: false, status: 401, message: "未授权访问" };
    }
    tooManyRequests() {
      return { success: false, status: 429, message: "请求过于频繁" };
    }
    serverError(opts?: unknown) {
      return {
        success: false,
        status: 500,
        ...(opts as Record<string, unknown>),
      };
    }
  }
  return { default: MockResponseBuilder };
});

vi.mock("@/lib/server/validator", () => ({
  validateData: vi.fn(),
}));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return {
    ...actual,
    cpus: vi.fn(() => [
      {
        model: "Mock CPU",
        speed: 2400,
        times: { user: 100, nice: 0, sys: 50, idle: 850 },
      },
    ]),
    loadavg: vi.fn(() => [0.5, 0.3, 0.2]),
    totalmem: vi.fn(() => 8 * 1024 * 1024 * 1024),
    freemem: vi.fn(() => 4 * 1024 * 1024 * 1024),
    platform: vi.fn(() => "linux"),
    type: vi.fn(() => "Linux"),
    release: vi.fn(() => "5.15.0"),
    arch: vi.fn(() => "x64"),
    hostname: vi.fn(() => "test-host"),
    uptime: vi.fn(() => 86400),
    networkInterfaces: vi.fn(() => ({})),
  };
});

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  return {
    ...actual,
    exec: vi.fn(
      (
        _cmd: string,
        _opts: unknown,
        cb: (err: null, result: { stdout: string; stderr: string }) => void,
      ) => {
        if (typeof _opts === "function") {
          cb = _opts as unknown as typeof cb;
        }
        cb(null, { stdout: "1024 512 512\n", stderr: "" });
      },
    ),
  };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { authVerify } from "@/lib/server/auth-verify";
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe("system actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSystemInfo", () => {
    it("返回系统信息 - 成功路径", async () => {
      setupSuccessMocks();

      const { getSystemInfo } = await import("@/actions/system");
      const result = await getSystemInfo({ access_token: "valid-token" });

      expect(result).toEqual(expect.objectContaining({ success: true }));
      const data = (result as Record<string, unknown>).data as Record<
        string,
        unknown
      >;
      expect(data).toBeDefined();
      expect(data.os).toBeDefined();
      expect(data.memory).toBeDefined();
      expect(data.cpu).toBeDefined();
      expect(data.process).toBeDefined();
      expect(data.time).toBeDefined();
    });

    it("系统信息包含正确的 OS 数据结构", async () => {
      setupSuccessMocks();

      const { getSystemInfo } = await import("@/actions/system");
      const result = await getSystemInfo({ access_token: "valid-token" });

      const data = (result as Record<string, unknown>).data as Record<
        string,
        unknown
      >;
      const osData = data.os as Record<string, unknown>;
      expect(osData.platform).toBeDefined();
      expect(osData.arch).toBeDefined();
      expect(osData.hostname).toBeDefined();
      expect(osData.type).toBeDefined();
      expect(osData.release).toBeDefined();
      expect(typeof osData.uptime).toBe("number");
    });

    it("系统信息包含正确的内存数据结构", async () => {
      setupSuccessMocks();

      const { getSystemInfo } = await import("@/actions/system");
      const result = await getSystemInfo({ access_token: "valid-token" });

      const data = (result as Record<string, unknown>).data as Record<
        string,
        unknown
      >;
      const memory = data.memory as Record<string, unknown>;
      expect(typeof memory.total).toBe("number");
      expect(typeof memory.free).toBe("number");
      expect(typeof memory.used).toBe("number");
      expect(typeof memory.usagePercent).toBe("number");
      expect(memory.total).toBeGreaterThan(0);
      expect(memory.free).toBeGreaterThanOrEqual(0);
      expect(memory.used).toBeGreaterThanOrEqual(0);
    });

    it("速率限制触发返回 429", async () => {
      mockLimitControl.mockResolvedValue(false as never);

      const { getSystemInfo } = await import("@/actions/system");
      const result = await getSystemInfo({ access_token: "valid-token" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("未授权用户返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getSystemInfo } = await import("@/actions/system");
      const result = await getSystemInfo({ access_token: "invalid" });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });
  });
});
