import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock get-client-info
vi.mock("@/lib/server/get-client-info", () => ({
  getClientIP: vi.fn().mockResolvedValue("192.168.1.1"),
  getClientUserAgent: vi.fn().mockResolvedValue("test-agent"),
}));

// Mock Prisma
const mockAuditLogCreate = vi.fn();
vi.mock("@/lib/server/prisma", () => ({
  default: {
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

describe("audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({ id: 1 });
  });

  describe("logAuditEvent", () => {
    it("creates audit log with basic info", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "UPDATE",
          resourceType: "POST",
          value: { old: "old-value", new: "new-value" },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UPDATE",
          resource: "POST",
          userUid: 1,
          ipAddress: "192.168.1.1",
          userAgent: "test-agent",
        }),
      });
    });

    it("uses provided IP and user-agent over auto-detected", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: {
          uid: "1",
          ipAddress: "10.0.0.1",
          userAgent: "custom-agent",
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: "10.0.0.1",
          userAgent: "custom-agent",
        }),
      });
    });

    it("auto-detects IP and user-agent when not provided", async () => {
      const { getClientIP, getClientUserAgent } = await import(
        "@/lib/server/get-client-info"
      );
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({ user: { uid: "1" } });

      expect(getClientIP).toHaveBeenCalled();
      expect(getClientUserAgent).toHaveBeenCalled();
    });

    it("defaults action and resourceType to UNKNOWN", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({ user: { uid: "1" } });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UNKNOWN",
          resource: "UNKNOWN",
          resourceId: "",
          description: "",
        }),
      });
    });

    it("performs object diff for old and new values", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "UPDATE",
          resourceType: "CONFIG",
          value: {
            old: { name: "old", unchanged: "same" },
            new: { name: "new", unchanged: "same" },
          },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldData: JSON.stringify({ name: "old" }),
          newData: JSON.stringify({ name: "new" }),
        }),
      });
    });

    it("does not diff non-object values", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "UPDATE",
          resourceType: "STATUS",
          value: {
            old: "draft",
            new: "published",
          },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldData: JSON.stringify("draft"),
          newData: JSON.stringify("published"),
        }),
      });
    });

    it("handles null values in details", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "DELETE",
          resourceType: "POST",
          value: { old: { title: "post" }, new: null },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "DELETE",
          oldData: JSON.stringify({ title: "post" }),
          newData: {},
        }),
      });
    });

    it("handles missing details", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({ user: { uid: "1" } });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "UNKNOWN",
          resource: "UNKNOWN",
          oldData: {},
          newData: {},
        }),
      });
    });

    it("includes resourceId and metadata when provided", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "UPDATE",
          resourceType: "POST",
          resourceId: "42",
          value: { old: null, new: null },
          description: "Updated post",
          metadata: { version: 2, published: true },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceId: "42",
          description: "Updated post",
          metadata: { version: 2, published: true },
        }),
      });
    });

    it("diffs objects with added keys", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "UPDATE",
          resourceType: "CONFIG",
          value: {
            old: { a: 1 },
            new: { a: 1, b: 2 },
          },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldData: JSON.stringify({}),
          newData: JSON.stringify({ b: 2 }),
        }),
      });
    });

    it("diffs objects with removed keys", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "1" },
        details: {
          action: "UPDATE",
          resourceType: "CONFIG",
          value: {
            old: { a: 1, b: 2 },
            new: { a: 1 },
          },
        },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldData: JSON.stringify({ b: 2 }),
          newData: JSON.stringify({}),
        }),
      });
    });

    it("converts uid string to number", async () => {
      const { logAuditEvent } = await import("@/lib/server/audit");

      await logAuditEvent({
        user: { uid: "42" },
      });

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userUid: 42,
        }),
      });
    });
  });
});
