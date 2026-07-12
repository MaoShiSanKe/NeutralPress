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

describe("post-access expanded", () => {
  describe("normalizeAccessPasswords", () => {
    it("null 返回空数组", () => {
      expect(normalizeAccessPasswords(null)).toEqual([]);
    });

    it("undefined 返回空数组", () => {
      expect(normalizeAccessPasswords(undefined)).toEqual([]);
    });

    it("非数组输入返回空数组", () => {
      expect(normalizeAccessPasswords("string" as unknown as string[])).toEqual(
        [],
      );
    });

    it("过滤空和纯空格字符串", () => {
      expect(normalizeAccessPasswords(["", "  ", "valid"])).toEqual(["valid"]);
    });

    it("修剪空格", () => {
      expect(normalizeAccessPasswords([" pass1 ", "pass2 "])).toEqual([
        "pass1",
        "pass2",
      ]);
    });

    it("去重", () => {
      expect(normalizeAccessPasswords(["pass1", "pass1", "pass2"])).toEqual([
        "pass1",
        "pass2",
      ]);
    });

    it("过滤非字符串值", () => {
      expect(
        normalizeAccessPasswords(["pass1", 123 as unknown as string, "pass2"]),
      ).toEqual(["pass1", "pass2"]);
    });

    it("处理包含非字符串元素的数组", () => {
      const result = normalizeAccessPasswords([
        "pass1",
        123,
        null,
        "pass2",
      ] as any);
      expect(result).toEqual(["pass1", "pass2"]);
    });
  });

  describe("normalizePostAccessInput", () => {
    it("PUBLIC 模式", () => {
      const result = normalizePostAccessInput({ accessMode: "PUBLIC" });
      expect(result).toEqual({
        accessMode: "PUBLIC",
        minRole: null,
        accessPasswords: [],
      });
    });

    it("ROLE 模式带 minRole", () => {
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

    it("PASSWORD 模式带密码", () => {
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

    it("无效 accessMode 默认为 PUBLIC", () => {
      const result = normalizePostAccessInput({ accessMode: "INVALID" as any });
      expect(result.accessMode).toBe("PUBLIC");
    });

    it("undefined accessMode 默认为 PUBLIC", () => {
      const result = normalizePostAccessInput({ accessMode: undefined });
      expect(result.accessMode).toBe("PUBLIC");
    });

    it("null accessMode 默认为 PUBLIC", () => {
      const result = normalizePostAccessInput({ accessMode: null });
      expect(result.accessMode).toBe("PUBLIC");
    });

    it("PASSWORD 模式清空 minRole", () => {
      const result = normalizePostAccessInput({
        accessMode: "PASSWORD",
        minRole: "ADMIN",
        accessPasswords: ["pass"],
      });
      expect(result.minRole).toBeNull();
    });

    it("ROLE 模式清空 accessPasswords", () => {
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
  });

  describe("normalizePostAccessState", () => {
    it("默认 accessVersion 为 1", () => {
      const result = normalizePostAccessState({ accessMode: "PUBLIC" });
      expect(result.accessVersion).toBe(1);
    });

    it("保留有效 accessVersion", () => {
      const result = normalizePostAccessState({
        accessMode: "PUBLIC",
        accessVersion: 5,
      });
      expect(result.accessVersion).toBe(5);
    });

    it("无效 accessVersion 默认为 1", () => {
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: 0 })
          .accessVersion,
      ).toBe(1);
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: -1 })
          .accessVersion,
      ).toBe(1);
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: 1.5 })
          .accessVersion,
      ).toBe(1);
    });

    it("处理非整数 accessVersion", () => {
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: 3.7 })
          .accessVersion,
      ).toBe(1);
    });

    it("处理负数 accessVersion", () => {
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: -5 })
          .accessVersion,
      ).toBe(1);
    });

    it("处理字符串类型的 accessVersion", () => {
      expect(
        normalizePostAccessState({
          accessMode: "PUBLIC",
          accessVersion: "5" as unknown as number,
        }).accessVersion,
      ).toBe(1);
    });

    it("保留有效的正整数 accessVersion", () => {
      expect(
        normalizePostAccessState({ accessMode: "PUBLIC", accessVersion: 42 })
          .accessVersion,
      ).toBe(42);
    });
  });

  describe("validatePostAccessInput", () => {
    it("有效 PUBLIC 模式返回 null", () => {
      expect(validatePostAccessInput({ accessMode: "PUBLIC" })).toBeNull();
    });

    it("ROLE 模式无 minRole 返回错误", () => {
      expect(validatePostAccessInput({ accessMode: "ROLE" })).toBe(
        "角色权限文章必须设置最低角色",
      );
    });

    it("ROLE 模式有 minRole 返回 null", () => {
      expect(
        validatePostAccessInput({ accessMode: "ROLE", minRole: "ADMIN" }),
      ).toBeNull();
    });

    it("PASSWORD 模式无密码返回错误", () => {
      expect(validatePostAccessInput({ accessMode: "PASSWORD" })).toBe(
        "口令保护文章至少需要一个口令",
      );
    });

    it("PASSWORD 模式有密码返回 null", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: ["pass"],
        }),
      ).toBeNull();
    });

    it("ROLE 模式有 minRole 返回 null", () => {
      expect(
        validatePostAccessInput({ accessMode: "ROLE", minRole: "USER" }),
      ).toBeNull();
    });

    it("PASSWORD 模式有多个密码返回 null", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: ["pass1", "pass2", "pass3"],
        }),
      ).toBeNull();
    });

    it("PASSWORD 模式空密码数组返回错误", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: [],
        }),
      ).toBe("口令保护文章至少需要一个口令");
    });

    it("PASSWORD 模式密码全部为空白返回错误", () => {
      expect(
        validatePostAccessInput({
          accessMode: "PASSWORD",
          accessPasswords: ["  ", "  "],
        }),
      ).toBe("口令保护文章至少需要一个口令");
    });
  });

  describe("hasPostAccessChanged", () => {
    it("无变化返回 false", () => {
      const current = { accessMode: "PUBLIC" as const };
      const next = { accessMode: "PUBLIC" as const };
      expect(hasPostAccessChanged(current, next)).toBe(false);
    });

    it("accessMode 变化返回 true", () => {
      const current = { accessMode: "PUBLIC" as const };
      const next = { accessMode: "ROLE" as const, minRole: "ADMIN" as const };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("minRole 变化返回 true", () => {
      const current = { accessMode: "ROLE" as const, minRole: "USER" as const };
      const next = { accessMode: "ROLE" as const, minRole: "ADMIN" as const };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("密码变化返回 true", () => {
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

    it("忽略密码顺序", () => {
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

    it("密码数量变化返回 true", () => {
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

    it("从 PUBLIC 切换到 PASSWORD 返回 true", () => {
      const current = { accessMode: "PUBLIC" as const };
      const next = {
        accessMode: "PASSWORD" as const,
        accessPasswords: ["pass"],
      };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });

    it("从 ROLE 切换到 PUBLIC 返回 true", () => {
      const current = {
        accessMode: "ROLE" as const,
        minRole: "ADMIN" as const,
      };
      const next = { accessMode: "PUBLIC" as const };
      expect(hasPostAccessChanged(current, next)).toBe(true);
    });
  });

  describe("hasRoleAtLeast", () => {
    it("用户角色满足最低要求", () => {
      expect(hasRoleAtLeast("ADMIN", "ADMIN")).toBe(true);
      expect(hasRoleAtLeast("ADMIN", "USER")).toBe(true);
      expect(hasRoleAtLeast("EDITOR", "USER")).toBe(true);
      expect(hasRoleAtLeast("AUTHOR", "USER")).toBe(true);
      expect(hasRoleAtLeast("USER", "USER")).toBe(true);
    });

    it("用户角色低于最低要求", () => {
      expect(hasRoleAtLeast("USER", "ADMIN")).toBe(false);
      expect(hasRoleAtLeast("USER", "EDITOR")).toBe(false);
      expect(hasRoleAtLeast("USER", "AUTHOR")).toBe(false);
      expect(hasRoleAtLeast("AUTHOR", "EDITOR")).toBe(false);
    });

    it("无效角色返回 false", () => {
      expect(hasRoleAtLeast(null, "ADMIN")).toBe(false);
      expect(hasRoleAtLeast("ADMIN", null)).toBe(false);
      expect(hasRoleAtLeast("INVALID", "ADMIN")).toBe(false);
    });

    it("EDITOR 角色满足 AUTHOR 最低要求", () => {
      expect(hasRoleAtLeast("EDITOR", "AUTHOR")).toBe(true);
    });

    it("ADMIN 角色满足 EDITOR 最低要求", () => {
      expect(hasRoleAtLeast("ADMIN", "EDITOR")).toBe(true);
    });

    it("两个参数都为 null 返回 false", () => {
      expect(hasRoleAtLeast(null, null)).toBe(false);
    });

    it("用户角色为 undefined 返回 false", () => {
      expect(hasRoleAtLeast(undefined, "ADMIN")).toBe(false);
    });

    it("最低角色为 undefined 返回 false", () => {
      expect(hasRoleAtLeast("ADMIN", undefined)).toBe(false);
    });
  });

  describe("getPostAccessCookieName", () => {
    it("返回正确的 cookie 名称格式", () => {
      expect(getPostAccessCookieName(123)).toBe("POST_ACCESS_123");
      expect(getPostAccessCookieName(0)).toBe("POST_ACCESS_0");
      expect(getPostAccessCookieName(999999)).toBe("POST_ACCESS_999999");
    });
  });

  describe("normalizeBackupPostRow", () => {
    it("规范化 accessMode", () => {
      const row = { accessMode: "ROLE" };
      expect(normalizeBackupPostRow(row).accessMode).toBe("ROLE");
    });

    it("无效 accessMode 默认为 PUBLIC", () => {
      const row = { accessMode: "INVALID" };
      expect(normalizeBackupPostRow(row).accessMode).toBe("PUBLIC");
    });

    it("规范化 minRole", () => {
      const row = { minRole: "ADMIN" };
      expect(normalizeBackupPostRow(row).minRole).toBe("ADMIN");
    });

    it("无效 minRole 默认为 null", () => {
      const row = { minRole: "INVALID" };
      expect(normalizeBackupPostRow(row).minRole).toBeNull();
    });

    it("规范化 accessVersion", () => {
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

    it("规范化 accessPasswords", () => {
      const row = { accessPasswords: ["pass1", "pass2"] };
      expect(normalizeBackupPostRow(row).accessPasswords).toEqual([
        "pass1",
        "pass2",
      ]);
    });

    it("非数组 accessPasswords 返回空数组", () => {
      const row = { accessPasswords: "not-array" };
      expect(normalizeBackupPostRow(row).accessPasswords).toEqual([]);
    });

    it("处理完全空的行对象", () => {
      const result = normalizeBackupPostRow({});
      expect(result.accessMode).toBe("PUBLIC");
      expect(result.minRole).toBeNull();
      expect(result.accessPasswords).toEqual([]);
      expect(result.accessVersion).toBe(1);
    });

    it("accessVersion 为字符串数字", () => {
      expect(
        normalizeBackupPostRow({ accessVersion: "10" }).accessVersion,
      ).toBe(10);
    });

    it("accessVersion 为非数字字符串", () => {
      expect(
        normalizeBackupPostRow({ accessVersion: "abc" }).accessVersion,
      ).toBe(1);
    });

    it("accessPasswords 包含非字符串元素", () => {
      const row = { accessPasswords: ["pass1", 123, null, "pass2"] };
      const result = normalizeBackupPostRow(row);
      expect(result.accessPasswords).toEqual(["pass1", "pass2"]);
    });
  });
});
