import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hashPassword,
  needsRehash,
  PasswordError,
  PasswordErrorType,
  resetConfigCache,
  verifyPassword,
  verifyPasswordSimple,
} from "@/lib/server/password";

// 设置测试所需的环境变量
const TEST_MASTER_SECRET =
  "test-master-secret-key-that-is-at-least-32-chars-long-for-testing";

describe("password", () => {
  beforeEach(() => {
    process.env.MASTER_SECRET = TEST_MASTER_SECRET;
    resetConfigCache();
  });

  afterEach(() => {
    resetConfigCache();
  });

  // ==========================================================================
  // PasswordError 类
  // ==========================================================================

  describe("PasswordError", () => {
    it("应正确创建错误实例", () => {
      const error = new PasswordError(
        PasswordErrorType.INVALID_INPUT,
        "测试错误",
      );
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PasswordError);
      expect(error.name).toBe("PasswordError");
      expect(error.type).toBe(PasswordErrorType.INVALID_INPUT);
      expect(error.message).toBe("测试错误");
      expect(error.originalError).toBeUndefined();
    });

    it("应支持保存原始错误", () => {
      const original = new Error("原始错误");
      const error = new PasswordError(
        PasswordErrorType.HASHING_FAILED,
        "哈希失败",
        original,
      );
      expect(error.originalError).toBe(original);
    });
  });

  // ==========================================================================
  // PasswordErrorType 枚举
  // ==========================================================================

  describe("PasswordErrorType", () => {
    it("应包含所有预期的错误类型", () => {
      expect(PasswordErrorType.INVALID_INPUT).toBe("INVALID_INPUT");
      expect(PasswordErrorType.HASHING_FAILED).toBe("HASHING_FAILED");
      expect(PasswordErrorType.VERIFICATION_FAILED).toBe("VERIFICATION_FAILED");
      expect(PasswordErrorType.CONFIG_ERROR).toBe("CONFIG_ERROR");
      expect(PasswordErrorType.SYSTEM_ERROR).toBe("SYSTEM_ERROR");
    });
  });

  // ==========================================================================
  // hashPassword
  // ==========================================================================

  describe("hashPassword", () => {
    it("应成功哈希有效密码", async () => {
      const hash = await hashPassword("mySecurePassword123");
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
      // Argon2 哈希值以 $argon2id$ 开头
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it("应为不同密码生成不同的哈希值", async () => {
      const hash1 = await hashPassword("password1");
      const hash2 = await hashPassword("password2");
      expect(hash1).not.toBe(hash2);
    });

    it("应为同一密码生成不同的哈希值（随机盐）", async () => {
      const hash1 = await hashPassword("samePassword");
      const hash2 = await hashPassword("samePassword");
      expect(hash1).not.toBe(hash2);
    });

    it("空密码应抛出 INVALID_INPUT 错误", async () => {
      await expect(hashPassword("")).rejects.toThrow(PasswordError);
      await expect(hashPassword("")).rejects.toMatchObject({
        type: PasswordErrorType.INVALID_INPUT,
      });
    });

    it("非字符串密码应抛出 INVALID_INPUT 错误", async () => {
      await expect(hashPassword(null as unknown as string)).rejects.toThrow(
        PasswordError,
      );
      await expect(
        hashPassword(undefined as unknown as string),
      ).rejects.toThrow(PasswordError);
      await expect(hashPassword(123 as unknown as string)).rejects.toThrow(
        PasswordError,
      );
    });

    it("超过 1024 字符的密码应抛出 INVALID_INPUT 错误", async () => {
      const longPassword = "a".repeat(1025);
      await expect(hashPassword(longPassword)).rejects.toThrow(PasswordError);
      await expect(hashPassword(longPassword)).rejects.toMatchObject({
        type: PasswordErrorType.INVALID_INPUT,
      });
    });

    it("恰好 1024 字符的密码应成功哈希", async () => {
      const maxLengthPassword = "a".repeat(1024);
      const hash = await hashPassword(maxLengthPassword);
      expect(hash).toMatch(/^\$argon2id\$/);
    });

    it("MASTER_SECRET 未设置时应抛出 CONFIG_ERROR 错误", async () => {
      delete process.env.MASTER_SECRET;
      resetConfigCache();
      await expect(hashPassword("password")).rejects.toThrow(PasswordError);
      await expect(hashPassword("password")).rejects.toMatchObject({
        type: PasswordErrorType.CONFIG_ERROR,
      });
    });

    it("MASTER_SECRET 长度不足 32 字符时应抛出 CONFIG_ERROR 错误", async () => {
      process.env.MASTER_SECRET = "too-short";
      resetConfigCache();
      await expect(hashPassword("password")).rejects.toThrow(PasswordError);
      await expect(hashPassword("password")).rejects.toMatchObject({
        type: PasswordErrorType.CONFIG_ERROR,
      });
    });
  });

  // ==========================================================================
  // verifyPassword
  // ==========================================================================

  describe("verifyPassword", () => {
    it("应验证正确的密码", async () => {
      const password = "correctPassword123";
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("应拒绝错误的密码", async () => {
      const hash = await hashPassword("correctPassword");
      const result = await verifyPassword(hash, "wrongPassword");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("空哈希值应返回 INVALID_INPUT 错误", async () => {
      const result = await verifyPassword("", "password");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(PasswordError);
      expect(result.error!.type).toBe(PasswordErrorType.INVALID_INPUT);
    });

    it("非字符串哈希值应返回 INVALID_INPUT 错误", async () => {
      const result = await verifyPassword(
        null as unknown as string,
        "password",
      );
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(PasswordError);
      expect(result.error!.type).toBe(PasswordErrorType.INVALID_INPUT);
    });

    it("空密码应返回 INVALID_INPUT 错误", async () => {
      const hash = await hashPassword("password");
      const result = await verifyPassword(hash, "");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(PasswordError);
      expect(result.error!.type).toBe(PasswordErrorType.INVALID_INPUT);
    });

    it("非字符串密码应返回 INVALID_INPUT 错误", async () => {
      const hash = await hashPassword("password");
      const result = await verifyPassword(hash, undefined as unknown as string);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(PasswordError);
      expect(result.error!.type).toBe(PasswordErrorType.INVALID_INPUT);
    });

    it("无效的哈希格式应返回 VERIFICATION_FAILED 错误", async () => {
      const result = await verifyPassword("not-a-valid-hash", "password");
      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(PasswordError);
      expect(result.error!.type).toBe(PasswordErrorType.VERIFICATION_FAILED);
    });
  });

  // ==========================================================================
  // verifyPasswordSimple
  // ==========================================================================

  describe("verifyPasswordSimple", () => {
    it("正确的密码应返回 true", async () => {
      const password = "simpleTestPassword";
      const hash = await hashPassword(password);
      expect(await verifyPasswordSimple(hash, password)).toBe(true);
    });

    it("错误的密码应返回 false", async () => {
      const hash = await hashPassword("correctPassword");
      expect(await verifyPasswordSimple(hash, "wrongPassword")).toBe(false);
    });

    it("无效输入应返回 false", async () => {
      expect(await verifyPasswordSimple("", "password")).toBe(false);
      expect(await verifyPasswordSimple("hash", "")).toBe(false);
    });
  });

  // ==========================================================================
  // needsRehash
  // ==========================================================================

  describe("needsRehash", () => {
    it("使用默认配置生成的哈希不需要重新哈希", async () => {
      const hash = await hashPassword("password");
      expect(needsRehash(hash)).toBe(false);
    });

    it("使用不同的 timeCost 应提示需要重新哈希", async () => {
      const hash = await hashPassword("password");
      expect(needsRehash(hash, { timeCost: 5 })).toBe(true);
    });

    it("使用不同的 memoryCost 应提示需要重新哈希", async () => {
      const hash = await hashPassword("password");
      expect(needsRehash(hash, { memoryCost: 131072 })).toBe(true);
    });

    it("空哈希值应返回 true", () => {
      expect(needsRehash("")).toBe(true);
    });

    it("非字符串哈希值应返回 true", () => {
      expect(needsRehash(null as unknown as string)).toBe(true);
      expect(needsRehash(undefined as unknown as string)).toBe(true);
    });

    it("无效的哈希格式应返回 true（出错时安全回退）", () => {
      expect(needsRehash("not-a-valid-hash")).toBe(true);
    });
  });

  // ==========================================================================
  // resetConfigCache
  // ==========================================================================

  describe("resetConfigCache", () => {
    it("重置缓存后应使用新的环境变量", async () => {
      // 使用原始密钥哈希
      const hash1 = await hashPassword("password");

      // 更改密钥并重置缓存
      process.env.MASTER_SECRET =
        "different-test-master-secret-key-that-is-at-least-32-characters";
      resetConfigCache();

      // 使用新密钥验证旧哈希应失败（因为 pepper 不同）
      const result = await verifyPassword(hash1, "password");
      expect(result.isValid).toBe(false);
    });
  });

  // ==========================================================================
  // 端到端集成测试
  // ==========================================================================

  describe("端到端集成", () => {
    it("哈希后应能成功验证密码", async () => {
      const password = "MyStr0ng!P@ssw0rd";
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result.isValid).toBe(true);
    });

    it("哈希后验证错误密码应失败", async () => {
      const password = "MyStr0ng!P@ssw0rd";
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, "WrongPassword");
      expect(result.isValid).toBe(false);
    });

    it("应支持 Unicode 密码", async () => {
      const password = "密码测试🔑🗝️";
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result.isValid).toBe(true);
    });

    it("应支持包含特殊字符的密码", async () => {
      const password = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result.isValid).toBe(true);
    });

    it("应支持包含空格的密码", async () => {
      const password = "  spaces  everywhere  ";
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result.isValid).toBe(true);
    });

    it("应支持单字符密码", async () => {
      const hash = await hashPassword("a");
      const result = await verifyPassword(hash, "a");
      expect(result.isValid).toBe(true);
    });

    it("应支持最大长度密码（1024 字符）", async () => {
      const password = "x".repeat(1024);
      const hash = await hashPassword(password);
      const result = await verifyPassword(hash, password);
      expect(result.isValid).toBe(true);
    });
  });
});
