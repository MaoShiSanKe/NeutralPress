import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock prisma - 设置大量 mock 来覆盖导出/导入函数
const _mockPrismaModels: Record<string, any> = {};
function createMockModel() {
  return {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  };
}

vi.mock("@/lib/server/prisma", () => {
  const models = [
    "user",
    "account",
    "refreshToken",
    "passwordReset",
    "passkey",
    "config",
    "page",
    "menu",
    "customDictionary",
    "notice",
    "conversation",
    "conversationParticipant",
    "message",
    "mailSubscription",
    "pushSubscription",
    "storageProvider",
    "virtualFolder",
    "media",
    "photo",
    "mediaReference",
    "tag",
    "category",
    "post",
    "comment",
    "commentLike",
    "project",
    "friendLink",
    "viewCountCache",
    "pageView",
    "pageViewArchive",
    "searchLog",
    "auditLog",
    "healthCheck",
    "cronHistory",
    "cloudTriggerHistory",
  ];

  const prisma: Record<string, any> = {
    $transaction: vi
      .fn()
      .mockImplementation(async (fn: (...args: any[]) => any) => fn(prisma)),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  };

  for (const model of models) {
    prisma[model] = createMockModel();
  }

  return { default: prisma, PrismaTransaction: {} };
});

// Mock oss
vi.mock("@/lib/server/oss", () => ({
  buildObjectKey: vi.fn().mockReturnValue("temp/backups/test.json"),
  uploadObject: vi.fn().mockResolvedValue({
    url: "https://example.com/test.json",
    key: "test.json",
  }),
}));

// Mock post-access
vi.mock("@/lib/server/post-access", () => ({
  normalizeBackupPostRow: vi.fn().mockImplementation((row: any) => row),
}));

// Mock url-security
vi.mock("@/lib/server/url-security", () => ({
  fetchPublicHttpUrlBuffer: vi.fn().mockResolvedValue({
    status: 200,
    body: Buffer.from("{}"),
  }),
}));

// Mock Vercel Blob
vi.mock("@vercel/blob/client", () => ({
  generateClientTokenFromReadWriteToken: vi
    .fn()
    .mockResolvedValue("blob-token"),
}));

// Mock AWS S3
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/upload"),
}));

// Mock shared-types
vi.mock("@repo/shared-types/api/backup", () => ({
  BackupArchiveSchema: {
    safeParse: vi.fn().mockImplementation((data: any) => ({
      success: true,
      data,
    })),
  },
}));

describe("backup expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBackupScopes 扩展测试", () => {
    it("每个分组应有唯一 scope 标识", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();
      const scopeIds = scopes.map((s) => s.scope);
      expect(new Set(scopeIds).size).toBe(scopeIds.length);
    });

    it("应返回 5 个分组", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();
      expect(scopes).toHaveLength(5);
    });
  });

  describe("getScopeTableNames 扩展测试", () => {
    it("所有 scope 应返回非空数组", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const allScopes = [
        "CORE_BASE",
        "CONTENT",
        "ASSETS",
        "ANALYTICS",
        "OPS_LOGS",
      ] as const;
      for (const scope of allScopes) {
        const tables = getScopeTableNames(scope);
        expect(tables.length).toBeGreaterThan(0);
      }
    });
  });

  describe("createBackupArchiveForScope", () => {
    it("应为 CORE_BASE 生成备份归档", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("CORE_BASE");

      expect(result).toBeDefined();
      expect(result.archive).toBeDefined();
      expect(result.archive.meta.scope).toBe("CORE_BASE");
      expect(result.archive.meta.schemaVersion).toBe(1);
      expect(result.content).toBeDefined();
      expect(result.fileName).toBeDefined();
      expect(result.checksum).toBeDefined();
      expect(result.sizeBytes).toBeGreaterThan(0);
    });

    it("应为 ASSETS 生成备份归档", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("ASSETS");
      expect(result.archive.meta.scope).toBe("ASSETS");
    });

    it("应为 CONTENT 生成备份归档", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("CONTENT");
      expect(result.archive.meta.scope).toBe("CONTENT");
    });

    it("应为 ANALYTICS 生成备份归档", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("ANALYTICS");
      expect(result.archive.meta.scope).toBe("ANALYTICS");
    });

    it("应为 OPS_LOGS 生成备份归档", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("OPS_LOGS");
      expect(result.archive.meta.scope).toBe("OPS_LOGS");
    });

    it("生成的 content 应为有效 JSON", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("CORE_BASE");
      const parsed = JSON.parse(result.content);
      expect(parsed.meta).toBeDefined();
      expect(parsed.data).toBeDefined();
    });

    it("生成的 checksum 应为 SHA256 哈希", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("CORE_BASE");
      // SHA256 hex 应为 64 字符
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it("fileName 应包含 scope 名称", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("CORE_BASE");
      expect(result.fileName).toContain("core_base");
      expect(result.fileName).toContain("backup");
      expect(result.fileName).toContain(".json");
    });

    it("sizeBytes 应等于 content 的字节长度", async () => {
      const { createBackupArchiveForScope } = await import(
        "@/lib/server/backup"
      );
      const result = await createBackupArchiveForScope("CORE_BASE");
      const expectedSize = Buffer.byteLength(result.content, "utf8");
      expect(result.sizeBytes).toBe(expectedSize);
    });
  });

  describe("createBackupExport", () => {
    it("DIRECT 模式下应返回直接内容", async () => {
      const { createBackupExport } = await import("@/lib/server/backup");
      const result = await createBackupExport("CORE_BASE", "DIRECT");

      expect(result).toBeDefined();
      expect(result.scope).toBe("CORE_BASE");
    });

    it("OSS 模式在有存储提供商时应调用 uploadObject", async () => {
      // Mock storageProvider to return a valid provider
      const prisma = await import("@/lib/server/prisma");
      vi.mocked(prisma.default.storageProvider.findFirst).mockResolvedValue({
        id: "provider-1",
        name: "Test Provider",
        type: "LOCAL",
        baseUrl: "https://storage.example.com",
        isActive: true,
        isDefault: true,
        maxFileSize: 10 * 1024 * 1024,
        config: {},
        pathTemplate: "/{year}/{month}/{filename}",
      } as any);

      const oss = await import("@/lib/server/oss");
      const { createBackupExport } = await import("@/lib/server/backup");
      const result = await createBackupExport("CORE_BASE", "OSS");

      expect(result.mode).toBe("OSS");
      expect(oss.uploadObject).toHaveBeenCalled();
    });
  });

  describe("常量扩展测试", () => {
    it("BACKUP_DIRECT_LIMIT_BYTES 为正整数", async () => {
      const { BACKUP_DIRECT_LIMIT_BYTES } = await import("@/lib/server/backup");
      expect(BACKUP_DIRECT_LIMIT_BYTES).toBeGreaterThan(0);
      expect(Number.isInteger(BACKUP_DIRECT_LIMIT_BYTES)).toBe(true);
    });

    it("BACKUP_OSS_IMPORT_LIMIT_BYTES 大于 BACKUP_DIRECT_LIMIT_BYTES", async () => {
      const { BACKUP_DIRECT_LIMIT_BYTES, BACKUP_OSS_IMPORT_LIMIT_BYTES } =
        await import("@/lib/server/backup");
      expect(BACKUP_OSS_IMPORT_LIMIT_BYTES).toBeGreaterThan(
        BACKUP_DIRECT_LIMIT_BYTES,
      );
    });
  });
});
