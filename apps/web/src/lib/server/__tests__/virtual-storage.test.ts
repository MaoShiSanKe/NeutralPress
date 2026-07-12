import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
vi.mock("@/lib/server/prisma", () => {
  return {
    default: {
      storageProvider: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

import prisma from "@/lib/server/prisma";
import {
  getOrCreateVirtualStorage,
  getVirtualStorageName,
  isVirtualStorage,
} from "@/lib/server/virtual-storage";

describe("virtual-storage", () => {
  describe("isVirtualStorage", () => {
    it("returns true for the virtual storage name string", () => {
      expect(isVirtualStorage("external-url")).toBe(true);
    });

    it("returns false for other storage name strings", () => {
      expect(isVirtualStorage("local")).toBe(false);
      expect(isVirtualStorage("aws-s3")).toBe(false);
      expect(isVirtualStorage("")).toBe(false);
    });

    it("returns true for object with matching name", () => {
      expect(isVirtualStorage({ name: "external-url" })).toBe(true);
    });

    it("returns false for object with non-matching name", () => {
      expect(isVirtualStorage({ name: "local" })).toBe(false);
      expect(isVirtualStorage({ name: "some-other" })).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isVirtualStorage("External-URL")).toBe(false);
      expect(isVirtualStorage("EXTERNAL-URL")).toBe(false);
    });
  });

  describe("getVirtualStorageName", () => {
    it("returns 'external-url'", () => {
      expect(getVirtualStorageName()).toBe("external-url");
    });

    it("returns consistent value on multiple calls", () => {
      const name1 = getVirtualStorageName();
      const name2 = getVirtualStorageName();
      expect(name1).toBe(name2);
    });
  });

  describe("getOrCreateVirtualStorage", () => {
    const mockPrisma = vi.mocked(prisma);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns existing virtual storage when found", async () => {
      const existingStorage = {
        id: 1,
        name: "external-url",
        type: "EXTERNAL_URL",
        displayName: "外部链接",
        baseUrl: "",
        isActive: true,
        isDefault: false,
        maxFileSize: 0,
        pathTemplate: "",
        config: {},
      };

      (mockPrisma.storageProvider.findUnique as any).mockResolvedValue(
        existingStorage,
      );

      const result = await getOrCreateVirtualStorage();

      expect(result).toEqual(existingStorage);
      expect(mockPrisma.storageProvider.findUnique).toHaveBeenCalledWith({
        where: { name: "external-url" },
      });
      expect(mockPrisma.storageProvider.create).not.toHaveBeenCalled();
    });

    it("creates new virtual storage when not found", async () => {
      const newStorage = {
        id: 2,
        name: "external-url",
        type: "EXTERNAL_URL",
        displayName: "外部链接",
        baseUrl: "",
        isActive: true,
        isDefault: false,
        maxFileSize: 0,
        pathTemplate: "",
        config: {},
      };

      (mockPrisma.storageProvider.findUnique as any).mockResolvedValue(null);
      (mockPrisma.storageProvider.create as any).mockResolvedValue(newStorage);

      const result = await getOrCreateVirtualStorage();

      expect(result).toEqual(newStorage);
      expect(mockPrisma.storageProvider.findUnique).toHaveBeenCalledWith({
        where: { name: "external-url" },
      });
      expect(mockPrisma.storageProvider.create).toHaveBeenCalledWith({
        data: {
          name: "external-url",
          type: "EXTERNAL_URL",
          displayName: "外部链接",
          baseUrl: "",
          isActive: true,
          isDefault: false,
          maxFileSize: 0,
          pathTemplate: "",
          config: {},
        },
      });
    });
  });
});
