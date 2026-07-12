import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock prisma
vi.mock("@/lib/server/prisma", () => ({
  default: {
    storageProvider: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

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

describe("backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBackupScopes", () => {
    it("应返回所有备份分组定义", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      expect(scopes).toBeDefined();
      expect(Array.isArray(scopes)).toBe(true);
      expect(scopes.length).toBeGreaterThan(0);
    });

    it("应包含 CORE_BASE 分组", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const coreBase = scopes.find((s) => s.scope === "CORE_BASE");
      expect(coreBase).toBeDefined();
      expect(coreBase?.label).toBe("核心基础");
    });

    it("应包含 CONTENT 分组", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const content = scopes.find((s) => s.scope === "CONTENT");
      expect(content).toBeDefined();
      expect(content?.label).toBe("内容数据");
    });

    it("应包含 ASSETS 分组", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const assets = scopes.find((s) => s.scope === "ASSETS");
      expect(assets).toBeDefined();
      expect(assets?.label).toBe("媒体资产");
    });

    it("应包含 ANALYTICS 分组", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const analytics = scopes.find((s) => s.scope === "ANALYTICS");
      expect(analytics).toBeDefined();
      expect(analytics?.label).toBe("访问分析");
    });

    it("应包含 OPS_LOGS 分组", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const opsLogs = scopes.find((s) => s.scope === "OPS_LOGS");
      expect(opsLogs).toBeDefined();
      expect(opsLogs?.label).toBe("运维日志");
    });

    it("每个分组应包含 scope、label、description 和 dependsOn", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      for (const scope of scopes) {
        expect(scope).toHaveProperty("scope");
        expect(scope).toHaveProperty("label");
        expect(scope).toHaveProperty("description");
        expect(scope).toHaveProperty("dependsOn");
        expect(Array.isArray(scope.dependsOn)).toBe(true);
      }
    });

    it("CONTENT 应依赖 CORE_BASE", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const content = scopes.find((s) => s.scope === "CONTENT");
      expect(content?.dependsOn).toContain("CORE_BASE");
    });

    it("ASSETS 应依赖 CORE_BASE 和 CONTENT", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const assets = scopes.find((s) => s.scope === "ASSETS");
      expect(assets?.dependsOn).toContain("CORE_BASE");
      expect(assets?.dependsOn).toContain("CONTENT");
    });
  });

  describe("getScopeTableNames", () => {
    it("应返回 CORE_BASE 的表名列表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("CORE_BASE");

      expect(tables).toContain("User");
      expect(tables).toContain("Config");
      expect(tables).toContain("Page");
      expect(tables).toContain("Menu");
    });

    it("应返回 CONTENT 的表名列表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("CONTENT");

      expect(tables).toContain("Tag");
      expect(tables).toContain("Category");
      expect(tables).toContain("Post");
      expect(tables).toContain("Comment");
    });

    it("应返回 ASSETS 的表名列表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("ASSETS");

      expect(tables).toContain("StorageProvider");
      expect(tables).toContain("Media");
      expect(tables).toContain("Photo");
    });

    it("应返回 ANALYTICS 的表名列表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("ANALYTICS");

      expect(tables).toContain("ViewCountCache");
      expect(tables).toContain("PageView");
      expect(tables).toContain("SearchLog");
    });

    it("应返回 OPS_LOGS 的表名列表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("OPS_LOGS");

      expect(tables).toContain("AuditLog");
      expect(tables).toContain("HealthCheck");
      expect(tables).toContain("CronHistory");
    });

    it("当传入无效的 scope 时应抛出错误", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      expect(() => getScopeTableNames("INVALID" as any)).toThrow();
    });
  });

  describe("常量", () => {
    it("BACKUP_DIRECT_LIMIT_BYTES 应为 4MB", async () => {
      const { BACKUP_DIRECT_LIMIT_BYTES } = await import("@/lib/server/backup");
      expect(BACKUP_DIRECT_LIMIT_BYTES).toBe(4 * 1024 * 1024);
    });

    it("BACKUP_OSS_IMPORT_LIMIT_BYTES 应为 64MB", async () => {
      const { BACKUP_OSS_IMPORT_LIMIT_BYTES } = await import(
        "@/lib/server/backup"
      );
      expect(BACKUP_OSS_IMPORT_LIMIT_BYTES).toBe(64 * 1024 * 1024);
    });

    it("BACKUP_IMPORT_CONFIRM_TEXT 应为 '确认还原'", async () => {
      const { BACKUP_IMPORT_CONFIRM_TEXT } = await import(
        "@/lib/server/backup"
      );
      expect(BACKUP_IMPORT_CONFIRM_TEXT).toBe("确认还原");
    });
  });

  describe("getBackupScopes 分组依赖关系", () => {
    it("ANALYTICS 应依赖 CONTENT", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const analytics = scopes.find((s) => s.scope === "ANALYTICS");
      expect(analytics?.dependsOn).toContain("CONTENT");
    });

    it("OPS_LOGS 应无依赖", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const opsLogs = scopes.find((s) => s.scope === "OPS_LOGS");
      expect(opsLogs?.dependsOn).toEqual([]);
    });

    it("CORE_BASE 应无依赖", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      const coreBase = scopes.find((s) => s.scope === "CORE_BASE");
      expect(coreBase?.dependsOn).toEqual([]);
    });

    it("每个分组应有非空的 description", async () => {
      const { getBackupScopes } = await import("@/lib/server/backup");
      const scopes = getBackupScopes();

      for (const scope of scopes) {
        expect(scope.description).toBeDefined();
        expect(scope.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getScopeTableNames 完整验证", () => {
    it("CORE_BASE 应包含所有预期的表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("CORE_BASE");

      const expected = [
        "User",
        "Account",
        "RefreshToken",
        "PasswordReset",
        "Passkey",
        "Config",
        "Page",
        "Menu",
        "CustomDictionary",
        "Notice",
        "Conversation",
        "ConversationParticipant",
        "Message",
        "MailSubscription",
        "PushSubscription",
      ];
      for (const table of expected) {
        expect(tables).toContain(table);
      }
    });

    it("CONTENT 应包含所有预期的表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("CONTENT");

      const expected = [
        "Tag",
        "Category",
        "Post",
        "PostTagLink",
        "PostCategoryLink",
        "Comment",
        "CommentLike",
        "Project",
        "ProjectTagLink",
        "ProjectCategoryLink",
        "FriendLink",
      ];
      for (const table of expected) {
        expect(tables).toContain(table);
      }
    });

    it("ASSETS 应包含所有预期的表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("ASSETS");

      const expected = [
        "StorageProvider",
        "VirtualFolder",
        "Media",
        "Photo",
        "MediaReference",
      ];
      for (const table of expected) {
        expect(tables).toContain(table);
      }
    });

    it("ANALYTICS 应包含所有预期的表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("ANALYTICS");

      const expected = [
        "ViewCountCache",
        "PageView",
        "PageViewArchive",
        "SearchLog",
      ];
      for (const table of expected) {
        expect(tables).toContain(table);
      }
    });

    it("OPS_LOGS 应包含所有预期的表", async () => {
      const { getScopeTableNames } = await import("@/lib/server/backup");
      const tables = getScopeTableNames("OPS_LOGS");

      const expected = [
        "AuditLog",
        "HealthCheck",
        "CronHistory",
        "CloudTriggerHistory",
      ];
      for (const table of expected) {
        expect(tables).toContain(table);
      }
    });
  });
});
