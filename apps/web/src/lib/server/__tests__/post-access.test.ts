import { describe, expect, it } from "vitest";

import {
  getPostAccessCookieName,
  hasPostAccessChanged,
  hasRoleAtLeast,
  normalizeAccessPasswords,
  normalizeBackupPostRow,
  normalizePostAccessInput,
  normalizePostAccessState,
  validatePostAccessInput,
} from "@/lib/server/post-access";

describe("post-access utilities", () => {
  describe("normalizeAccessPasswords", () => {
    it("returns empty array for null/undefined", () => {
      expect(normalizeAccessPasswords(null)).toEqual([]);
      expect(normalizeAccessPasswords(undefined)).toEqual([]);
    });

    it("returns empty array for non-array input", () => {
      expect(normalizeAccessPasswords("string" as unknown as string[])).toEqual(
        [],
      );
    });

    it("filters empty and whitespace-only strings", () => {
      expect(normalizeAccessPasswords(["", "  ", "valid"])).toEqual(["valid"]);
    });

    it("trims whitespace from passwords", () => {
      expect(normalizeAccessPasswords([" pass1 ", "pass2 "])).toEqual([
        "pass1",
        "pass2",
      ]);
    });

    it("removes duplicates", () => {
      expect(normalizeAccessPasswords(["pass1", "pass1", "pass2"])).toEqual([
        "pass1",
        "pass2",
      ]);
    });

    it("filters non-string values", () => {
      expect(
        normalizeAccessPasswords(["pass1", 123 as unknown as string, "pass2"]),
      ).toEqual(["pass1", "pass2"]);
    });
  });

  describe("normalizePostAccessInput", () => {
    it("normalizes PUBLIC mode", () => {
      const result = normalizePostAccessInput({ accessMode: "PUBLIC" });
      expect(result).toEqual({
        accessMode: "PUBLIC",
        minRole: null,
        accessPasswords: [],
      });
    });

    it("normalizes ROLE mode with minRole", () => {
      const result = normalizePostAccessInput({
        accessMode: "ROLE",
        minRole: "ADMIN",
      });
      expect(result).toEqual({
        accessMode: "ROLE",
        minRole: "ADMIN",
        accessPasswords: [],
      });
    });

    it("normalizes PASSWORD mode with passwords", () => {
      const result = normalizePostAccessInput({
        accessMode: "PASSWORD",
        accessPasswords: ["pass1", "pass2"],
      });
      expect(result).toEqual({
        accessMode: "PASSWORD",
        minRole: null,
        accessPasswords: ["pass1", "pass2"],
      });
    });

    it("defaults to PUBLIC for invalid accessMode", () => {
      const result = normalizePostAccessInput({
        accessMode: "INVALID" as any,
      });
      expect(result.accessMode).toBe("PUBLIC");
    });
  });

  describe("normalizePostAccessState", () => {
    it("defaults accessVersion to 1", () => {
      const result = normalizePostAccessState({ accessMode: "PUBLIC" });
      expect(result.accessVersion).toBe(1);
    });

    it("preserves valid accessVersion", () => {
      const result = normalizePostAccessState({
        accessMode: "PUBLIC",
        accessVersion: 5,
      });
      expect(result.accessVersion).toBe(5);
    });

    it("defaults invalid accessVersion to 1", () => {
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: 0 })
          .accessVersion,
      ).toBe(1);
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: -1 })
          .accessVersion,
      ).toBe(1);
      expect(
        normalizePostAccessState({
          accessMode: "PUBLIC",
          accessVersion: 1.5,
        }).accessVersion,
      ).toBe(1);
    });
  });

  describe("validatePostAccessInput", () => {
    it("returns null for valid PUBLIC mode", () => {
      expect(validatePostAccessInput({ accessMode: "PUBLIC" })).toBeNull();
    });

    it("returns error for ROLE mode without minRole", () => {
      expect(validatePostAccessInput({ accessMode: "ROLE" })).toBe(
        "角色权限文章必须设置最低角色",
      );
    });

    it("returns null for ROLE mode with minRole", () => {
      expect(
        validatePostAccessInput({ accessMode: "ROLE", minRole: "ADMIN" }),
      ).toBeNull();
    });

    it("returns error for PASSWORD mode without passwords", () => {
      expect(validatePostAccessInput({ accessMode: "PASSWORD" })).toBe(
        "口令保护文章至少需要一个口令",
      );
    });

    it("returns null for PASSWORD mode with passwords", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: ["pass"],
        }),
      ).toBeNull();
    });
  });

  describe("hasPostAccessChanged", () => {
    it("returns false when no changes", () => {
      const current = { accessMode: "PUBLIC" as const };
      const next = { accessMode: "PUBLIC" as const };
      expect(hasPostAccessChanged(current, next)).toBe(false);
    });

    it("returns true when accessMode changes", () => {
      const current = { accessMode: "PUBLIC" as const };
      const next = { accessMode: "ROLE" as const, minRole: "ADMIN" as const };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("returns true when minRole changes", () => {
      const current = {
        accessMode: "ROLE" as const,
        minRole: "USER" as const,
      };
      const next = {
        accessMode: "ROLE" as const,
        minRole: "ADMIN" as const,
      };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("returns true when passwords change", () => {
      const current = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass1"],
      };
      const next = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass2"],
      };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("ignores password order", () => {
      const current = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass1", "pass2"],
      };
      const next = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass2", "pass1"],
      };
      expect(hasPostAccessChanged(current, next)).toBe(false);
    });
  });

  describe("hasRoleAtLeast", () => {
    it("returns true when user role meets minimum", () => {
      expect(hasRoleAtLeast("ADMIN", "ADMIN")).toBe(true);
      expect(hasRoleAtLeast("ADMIN", "USER")).toBe(true);
      expect(hasRoleAtLeast("EDITOR", "USER")).toBe(true);
      expect(hasRoleAtLeast("AUTHOR", "USER")).toBe(true);
      expect(hasRoleAtLeast("USER", "USER")).toBe(true);
    });

    it("returns false when user role is below minimum", () => {
      expect(hasRoleAtLeast("USER", "ADMIN")).toBe(false);
      expect(hasRoleAtLeast("USER", "EDITOR")).toBe(false);
      expect(hasRoleAtLeast("USER", "AUTHOR")).toBe(false);
      expect(hasRoleAtLeast("AUTHOR", "EDITOR")).toBe(false);
    });

    it("returns false for invalid roles", () => {
      expect(hasRoleAtLeast(null, "ADMIN")).toBe(false);
      expect(hasRoleAtLeast("ADMIN", null)).toBe(false);
      expect(hasRoleAtLeast("INVALID", "ADMIN")).toBe(false);
    });
  });

  describe("normalizeBackupPostRow", () => {
    it("normalizes accessMode", () => {
      const row = { accessMode: "ROLE" };
      expect(normalizeBackupPostRow(row).accessMode).toBe("ROLE");
    });

    it("defaults invalid accessMode to PUBLIC", () => {
      const row = { accessMode: "INVALID" };
      expect(normalizeBackupPostRow(row).accessMode).toBe("PUBLIC");
    });

    it("normalizes minRole", () => {
      const row = { minRole: "ADMIN" };
      expect(normalizeBackupPostRow(row).minRole).toBe("ADMIN");
    });

    it("defaults invalid minRole to null", () => {
      const row = { minRole: "INVALID" };
      expect(normalizeBackupPostRow(row).minRole).toBeNull();
    });

    it("normalizes accessVersion", () => {
      expect(normalizeBackupPostRow({ accessVersion: 5 }).accessVersion).toBe(
        5,
      );
      expect(normalizeBackupPostRow({ accessVersion: "3" }).accessVersion).toBe(
        3,
      );
      expect(normalizeBackupPostRow({ accessVersion: 0 }).accessVersion).toBe(
        1,
      );
      expect(normalizeBackupPostRow({ accessVersion: -1 }).accessVersion).toBe(
        1,
      );
    });

    it("normalizes accessPasswords", () => {
      const row = { accessPasswords: ["pass1", "pass2"] };
      expect(normalizeBackupPostRow(row).accessPasswords).toEqual([
        "pass1",
        "pass2",
      ]);
    });

    it("handles non-array accessPasswords", () => {
      const row = { accessPasswords: "not-array" };
      expect(normalizeBackupPostRow(row).accessPasswords).toEqual([]);
    });
  });

  describe("getPostAccessCookieName", () => {
    it("应返回正确的 cookie 名称格式", () => {
      expect(getPostAccessCookieName(123)).toBe("POST_ACCESS_123");
      expect(getPostAccessCookieName(0)).toBe("POST_ACCESS_0");
      expect(getPostAccessCookieName(999999)).toBe("POST_ACCESS_999999");
    });
  });

  describe("normalizePostAccessInput - 补充测试", () => {
    it("清空 PASSWORD 模式的 minRole", () => {
      const result = normalizePostAccessInput({
        accessMode: "PASSWORD",
        minRole: "ADMIN",
        accessPasswords: ["pass"],
      });
      expect(result.minRole).toBeNull();
    });

    it("清空 ROLE 模式的 accessPasswords", () => {
      const result = normalizePostAccessInput({
        accessMode: "ROLE",
        minRole: "USER",
        accessPasswords: ["pass1", "pass2"],
      });
      expect(result.accessPasswords).toEqual([]);
    });

    it("PUBLIC 模式清空所有额外字段", () => {
      const result = normalizePostAccessInput({
        accessMode: "PUBLIC",
        minRole: "ADMIN",
        accessPasswords: ["pass"],
      });
      expect(result.accessMode).toBe("PUBLIC");
      expect(result.minRole).toBeNull();
      expect(result.accessPasswords).toEqual([]);
    });

    it("处理 undefined accessMode", () => {
      const result = normalizePostAccessInput({
        accessMode: undefined,
      });
      expect(result.accessMode).toBe("PUBLIC");
    });

    it("处理 null accessMode", () => {
      const result = normalizePostAccessInput({
        accessMode: null,
      });
      expect(result.accessMode).toBe("PUBLIC");
    });
  });

  describe("hasRoleAtLeast - 补充测试", () => {
    it("EDITOR 角色满足 AUTHOR 最低要求", () => {
      expect(hasRoleAtLeast("EDITOR", "AUTHOR")).toBe(true);
    });

    it("ADMIN 角色满足 EDITOR 最低要求", () => {
      expect(hasRoleAtLeast("ADMIN", "EDITOR")).toBe(true);
    });

    it("返回 false 当两个参数都为 null", () => {
      expect(hasRoleAtLeast(null, null)).toBe(false);
    });

    it("返回 false 当用户角色为 undefined", () => {
      expect(hasRoleAtLeast(undefined, "ADMIN")).toBe(false);
    });

    it("返回 false 当最低角色为 undefined", () => {
      expect(hasRoleAtLeast("ADMIN", undefined)).toBe(false);
    });
  });

  describe("normalizePostAccessState - 补充测试", () => {
    it("处理非整数 accessVersion", () => {
      const result = normalizePostAccessState({
        accessMode: "PUBLIC",
        accessVersion: 3.7,
      });
      expect(result.accessVersion).toBe(1);
    });

    it("处理负数 accessVersion", () => {
      const result = normalizePostAccessState({
        accessMode: "PUBLIC",
        accessVersion: -5,
      });
      expect(result.accessVersion).toBe(1);
    });

    it("处理字符串类型的 accessVersion", () => {
      const result = normalizePostAccessState({
        accessMode: "PUBLIC",
        accessVersion: "5" as unknown as number,
      });
      expect(result.accessVersion).toBe(1);
    });

    it("保留有效的正整数 accessVersion", () => {
      const result = normalizePostAccessState({
        accessMode: "PUBLIC",
        accessVersion: 42,
      });
      expect(result.accessVersion).toBe(42);
    });
  });

  describe("hasPostAccessChanged - 补充测试", () => {
    it("返回 false 当从 PASSWORD 模式切换到相同密码的不同顺序", () => {
      const current = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["z", "a", "m"],
      };
      const next = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["a", "m", "z"],
      };
      expect(hasPostAccessChanged(current, next)).toBe(false);
    });

    it("返回 true 当密码数量变化", () => {
      const current = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass1"],
      };
      const next = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass1", "pass2"],
      };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("返回 true 当从 PUBLIC 切换到 PASSWORD", () => {
      const current = { accessMode: "PUBLIC" as const };
      const next = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass"],
      };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("返回 true 当从 ROLE 切换到 PUBLIC", () => {
      const current = {
        accessMode: "ROLE" as const,
        minRole: "ADMIN" as const,
      };
      const next = { accessMode: "PUBLIC" as const };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });
  });

  describe("validatePostAccessInput - 补充测试", () => {
    it("返回 null 当 ROLE 模式有 minRole", () => {
      expect(
        validatePostAccessInput({ accessMode: "ROLE", minRole: "USER" }),
      ).toBeNull();
    });

    it("返回 null 当 PASSWORD 模式有多个密码", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: ["pass1", "pass2", "pass3"],
        }),
      ).toBeNull();
    });

    it("返回错误当 PASSWORD 模式密码数组为空", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: [],
        }),
      ).toBe("口令保护文章至少需要一个口令");
    });

    it("返回错误当 PASSWORD 模式密码全部为空白", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: ["  ", "  "],
        }),
      ).toBe("口令保护文章至少需要一个口令");
    });
  });

  describe("normalizeBackupPostRow - 补充测试", () => {
    it("处理完全空的行对象", () => {
      const result = normalizeBackupPostRow({});
      expect(result.accessMode).toBe("PUBLIC");
      expect(result.minRole).toBeNull();
      expect(result.accessPasswords).toEqual([]);
      expect(result.accessVersion).toBe(1);
    });

    it("处理 accessVersion 为字符串数字", () => {
      expect(
        normalizeBackupPostRow({ accessVersion: "10" }).accessVersion,
      ).toBe(10);
    });

    it("处理 accessVersion 为非数字字符串", () => {
      expect(
        normalizeBackupPostRow({ accessVersion: "abc" }).accessVersion,
      ).toBe(1);
    });

    it("处理 accessPasswords 包含非字符串元素", () => {
      const row = { accessPasswords: ["pass1", 123, null, "pass2"] };
      const result = normalizeBackupPostRow(row);
      expect(result.accessPasswords).toEqual(["pass1", "pass2"]);
    });
  });
});
