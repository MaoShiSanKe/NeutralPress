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
    storageProvider: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    media: {
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    $transaction: vi.fn(),
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
    forbidden(opts?: unknown) {
      return {
        success: false,
        status: 403,
        ...(opts as Record<string, unknown>),
      };
    }
    notFound() {
      return { success: false, status: 404 };
    }
    conflict(opts?: unknown) {
      return {
        success: false,
        status: 409,
        ...(opts as Record<string, unknown>),
      };
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

vi.mock("@/lib/server/oss", () => ({
  uploadObject: vi.fn(async () => ({ key: "test/healthcheck.txt" })),
  deleteObject: vi.fn(async () => {}),
}));

vi.mock("@/lib/server/virtual-storage", () => ({
  isVirtualStorage: vi.fn(() => false),
}));

vi.mock("next/server", () => ({
  after: vi.fn((fn: () => void) => fn()),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { authVerify } from "@/lib/server/auth-verify";
import prisma from "@/lib/server/prisma";
import limitControl from "@/lib/server/rate-limit";
import { validateData } from "@/lib/server/validator";
import { isVirtualStorage } from "@/lib/server/virtual-storage";

const mockLimitControl = vi.mocked(limitControl);
const mockValidateData = vi.mocked(validateData);
const mockAuthVerify = vi.mocked(authVerify);
const mockIsVirtualStorage = vi.mocked(isVirtualStorage);

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupSuccessMocks() {
  mockLimitControl.mockResolvedValue(true as never);
  mockValidateData.mockReturnValue(null as never);
  mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" } as never);
}

function mockStorageProvider(overrides: Record<string, unknown> = {}) {
  return {
    id: "storage-1",
    name: "local",
    type: "LOCAL",
    displayName: "Local Storage",
    baseUrl: "/uploads",
    isActive: true,
    isDefault: false,
    maxFileSize: 10485760,
    pathTemplate: "/{year}/{month}/{filename}",
    config: {},
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    _count: { media: 0 },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("storage actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsVirtualStorage.mockReturnValue(false);
  });

  describe("getStorageList", () => {
    it("返回存储列表 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.count).mockResolvedValue(1);
      vi.mocked(prisma.storageProvider.findMany).mockResolvedValue([
        mockStorageProvider(),
      ] as never);
      vi.mocked(prisma.media.groupBy).mockResolvedValue([]);

      const { getStorageList } = await import("@/actions/storage");
      const result = await getStorageList({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("未授权返回 401", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);

      const { getStorageList } = await import("@/actions/storage");
      const result = await getStorageList({
        access_token: "invalid",
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误返回 500", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.count).mockRejectedValue(
        new Error("DB error"),
      );

      const { getStorageList } = await import("@/actions/storage");
      const result = await getStorageList({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 500 }),
      );
    });
  });

  describe("getStorageDetail", () => {
    it("返回存储详情 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        mockStorageProvider() as never,
      );
      vi.mocked(prisma.media.aggregate).mockResolvedValue({
        _sum: { size: 1024 },
      } as never);

      const { getStorageDetail } = await import("@/actions/storage");
      const result = await getStorageDetail({
        access_token: "valid-token",
        id: "storage-1",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("存储不存在返回 404", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        null as never,
      );

      const { getStorageDetail } = await import("@/actions/storage");
      const result = await getStorageDetail({
        access_token: "valid-token",
        id: "non-existent",
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 404 }),
      );
    });
  });

  describe("createStorage", () => {
    it("创建存储提供商 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.updateMany).mockResolvedValue({
        count: 0,
      } as never);
      vi.mocked(prisma.storageProvider.create).mockResolvedValue(
        mockStorageProvider() as never,
      );

      const { createStorage } = await import("@/actions/storage");
      const result = await createStorage({
        access_token: "valid-token",
        name: "new-storage",
        type: "LOCAL",
        displayName: "New Storage",
        baseUrl: "/uploads",
        isActive: true,
        isDefault: false,
        maxFileSize: 10485760,
        pathTemplate: "/{year}/{month}/{filename}",
        config: { rootDir: "/tmp/uploads" },
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("存储名称重复返回 409", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.create).mockRejectedValue({
        code: "P2002",
      });

      const { createStorage } = await import("@/actions/storage");
      const result = await createStorage({
        access_token: "valid-token",
        name: "duplicate",
        type: "LOCAL",
        displayName: "Dup",
        baseUrl: "/uploads",
        isActive: true,
        isDefault: false,
        maxFileSize: 10485760,
        pathTemplate: "/{year}/{month}/{filename}",
        config: {},
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 409 }),
      );
    });
  });

  describe("deleteStorage", () => {
    it("删除存储提供商 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findMany).mockResolvedValue([
        { id: "storage-1", name: "test" },
      ] as never);
      vi.mocked(prisma.media.count).mockResolvedValue(0);
      vi.mocked(prisma.storageProvider.deleteMany).mockResolvedValue({
        count: 1,
      } as never);

      const { deleteStorage } = await import("@/actions/storage");
      const result = await deleteStorage({
        access_token: "valid-token",
        ids: ["storage-1"],
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("有关联媒体时返回 400", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findMany).mockResolvedValue([
        { id: "storage-1", name: "test" },
      ] as never);
      vi.mocked(prisma.media.count).mockResolvedValue(5);

      const { deleteStorage } = await import("@/actions/storage");
      const result = await deleteStorage({
        access_token: "valid-token",
        ids: ["storage-1"],
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 400 }),
      );
    });

    it("虚拟存储提供商返回 403", async () => {
      setupSuccessMocks();
      mockIsVirtualStorage.mockReturnValue(true);
      vi.mocked(prisma.storageProvider.findMany).mockResolvedValue([
        { id: "storage-1", name: "test" },
      ] as never);

      const { deleteStorage } = await import("@/actions/storage");
      const result = await deleteStorage({
        access_token: "valid-token",
        ids: ["storage-1"],
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 403 }),
      );
    });
  });

  describe("toggleStorageStatus", () => {
    it("切换存储状态 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        mockStorageProvider({ isActive: true }) as never,
      );
      vi.mocked(prisma.storageProvider.update).mockResolvedValue(
        mockStorageProvider({ isActive: false }) as never,
      );

      const { toggleStorageStatus } = await import("@/actions/storage");
      const result = await toggleStorageStatus({
        access_token: "valid-token",
        id: "storage-1",
        isActive: false,
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("存储不存在返回 404", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        null as never,
      );

      const { toggleStorageStatus } = await import("@/actions/storage");
      const result = await toggleStorageStatus({
        access_token: "valid-token",
        id: "non-existent",
        isActive: false,
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 404 }),
      );
    });
  });

  describe("setDefaultStorage", () => {
    it("设置默认存储 - 成功路径", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        mockStorageProvider({ isDefault: false }) as never,
      );
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          storageProvider: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return (fn as (tx: unknown) => Promise<unknown>)(tx);
      });

      const { setDefaultStorage } = await import("@/actions/storage");
      const result = await setDefaultStorage({
        access_token: "valid-token",
        id: "storage-1",
      });

      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it("虚拟存储返回 403", async () => {
      setupSuccessMocks();
      mockIsVirtualStorage.mockReturnValue(true);
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        mockStorageProvider() as never,
      );

      const { setDefaultStorage } = await import("@/actions/storage");
      const result = await setDefaultStorage({
        access_token: "valid-token",
        id: "storage-1",
      });

      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 403 }),
      );
    });
  });

  // ==================== updateStorage 补充测试 ====================

  describe("updateStorage", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const { updateStorage } = await import("@/actions/storage");
      const result = await updateStorage({
        access_token: "valid-token",
        id: "storage-1",
        name: "updated",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });

    it("未授权时应返回失败", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const { updateStorage } = await import("@/actions/storage");
      const result = await updateStorage({
        access_token: "invalid-token",
        id: "storage-1",
        name: "updated",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });

    it("存储不存在时应返回 404", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(null);
      const { updateStorage } = await import("@/actions/storage");
      const result = await updateStorage({
        access_token: "valid-token",
        id: "nonexistent",
        name: "updated",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 404 }),
      );
    });

    it("虚拟存储不允许修改", async () => {
      setupSuccessMocks();
      mockIsVirtualStorage.mockReturnValue(true);
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        mockStorageProvider() as never,
      );
      const { updateStorage } = await import("@/actions/storage");
      const result = await updateStorage({
        access_token: "valid-token",
        id: "storage-1",
        name: "updated",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 403 }),
      );
    });

    it("成功更新存储", async () => {
      setupSuccessMocks();
      mockIsVirtualStorage.mockReturnValue(false);
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(
        mockStorageProvider() as never,
      );
      vi.mocked(prisma.storageProvider.update).mockResolvedValue(
        mockStorageProvider({ name: "updated" }) as never,
      );
      const { updateStorage } = await import("@/actions/storage");
      const result = await updateStorage({
        access_token: "valid-token",
        id: "storage-1",
        name: "updated",
      });
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  // ===== 分支覆盖补充测试 =====

  describe("getStorageList 分支", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false as never);
      const { getStorageList } = await import("@/actions/storage");
      const result = await getStorageList({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findMany).mockRejectedValue(
        new Error("DB error"),
      );
      const { getStorageList } = await import("@/actions/storage");
      const result = await getStorageList({
        access_token: "valid-token",
        page: 1,
        pageSize: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });

  describe("getStorageDetail 分支", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false as never);
      const { getStorageDetail } = await import("@/actions/storage");
      const result = await getStorageDetail({
        access_token: "valid-token",
        id: "s1",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("非管理员应返回未授权", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);
      const { getStorageDetail } = await import("@/actions/storage");
      const result = await getStorageDetail({
        access_token: "invalid",
        id: "s1",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockRejectedValue(
        new Error("DB error"),
      );
      const { getStorageDetail } = await import("@/actions/storage");
      const result = await getStorageDetail({
        access_token: "valid-token",
        id: "s1",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });

  describe("createStorage 分支", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false as never);
      const { createStorage } = await import("@/actions/storage");
      const result = await createStorage({
        access_token: "valid-token",
        name: "New",
        type: "LOCAL",
        displayName: "New",
        baseUrl: "/uploads",
        isActive: true,
        isDefault: false,
        maxFileSize: 10485760,
        pathTemplate: "/{year}/{month}/{filename}",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("非管理员应返回未授权", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);
      const { createStorage } = await import("@/actions/storage");
      const result = await createStorage({
        access_token: "invalid",
        name: "New",
        type: "LOCAL",
        displayName: "New",
        baseUrl: "/uploads",
        isActive: true,
        isDefault: false,
        maxFileSize: 10485760,
        pathTemplate: "/{year}/{month}/{filename}",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.create).mockRejectedValue(
        new Error("DB error"),
      );
      const { createStorage } = await import("@/actions/storage");
      const result = await createStorage({
        access_token: "valid-token",
        name: "New",
        type: "LOCAL",
        displayName: "New",
        baseUrl: "/uploads",
        isActive: true,
        isDefault: false,
        maxFileSize: 10485760,
        pathTemplate: "/{year}/{month}/{filename}",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });

  describe("deleteStorage 分支", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false as never);
      const { deleteStorage } = await import("@/actions/storage");
      const result = await deleteStorage({
        access_token: "valid-token",
        ids: ["s1"],
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("非管理员应返回未授权", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);
      const { deleteStorage } = await import("@/actions/storage");
      const result = await deleteStorage({
        access_token: "invalid",
        ids: ["s1"],
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockRejectedValue(
        new Error("DB error"),
      );
      const { deleteStorage } = await import("@/actions/storage");
      const result = await deleteStorage({
        access_token: "valid-token",
        ids: ["s1"],
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });

  describe("toggleStorageStatus 分支", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false as never);
      const { toggleStorageStatus } = await import("@/actions/storage");
      const result = await toggleStorageStatus({
        access_token: "valid-token",
        id: "s1",
        isActive: true,
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("非管理员应返回未授权", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);
      const { toggleStorageStatus } = await import("@/actions/storage");
      const result = await toggleStorageStatus({
        access_token: "invalid",
        id: "s1",
        isActive: true,
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockRejectedValue(
        new Error("DB error"),
      );
      const { toggleStorageStatus } = await import("@/actions/storage");
      const result = await toggleStorageStatus({
        access_token: "valid-token",
        id: "s1",
        isActive: true,
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });

  describe("setDefaultStorage 分支", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false as never);
      const { setDefaultStorage } = await import("@/actions/storage");
      const result = await setDefaultStorage({
        access_token: "valid-token",
        id: "s1",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 429 }),
      );
    });

    it("非管理员应返回未授权", async () => {
      mockLimitControl.mockResolvedValue(true as never);
      mockValidateData.mockReturnValue(null as never);
      mockAuthVerify.mockResolvedValue(null as never);
      const { setDefaultStorage } = await import("@/actions/storage");
      const result = await setDefaultStorage({
        access_token: "invalid",
        id: "s1",
      });
      expect(result).toEqual(
        expect.objectContaining({ success: false, status: 401 }),
      );
    });

    it("未找到存储提供者返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockResolvedValue(null);
      const { setDefaultStorage } = await import("@/actions/storage");
      const result = await setDefaultStorage({
        access_token: "valid-token",
        id: "s1",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });

    it("数据库错误时返回失败", async () => {
      setupSuccessMocks();
      vi.mocked(prisma.storageProvider.findUnique).mockRejectedValue(
        new Error("DB error"),
      );
      const { setDefaultStorage } = await import("@/actions/storage");
      const result = await setDefaultStorage({
        access_token: "valid-token",
        id: "s1",
      });
      expect(result).toEqual(expect.objectContaining({ success: false }));
    });
  });
});
