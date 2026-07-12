import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 需要在模块加载前设置环境变量，因为 jwt.ts 在模块级别缓存密钥
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgvU/zT7DAv0JhbDpu
0BdfPTmds/LfRUuSbKl1xXSdGvChRANCAASx81ECkT30Da/h5UKSL4UpeNkADNWk
EE9J0zjYFglou9JJfD7jOefmR+H8i748Z2qDvypro4csvtrB/J8iiQWH
-----END PRIVATE KEY-----`;

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEsfNRApE99A2v4eVCki+FKXjZAAzV
pBBPSdM42BYJaLvSSXw+4znn5kfh/Iu+PGdqg78qa6OHLL7awfyfIokFhw==
-----END PUBLIC KEY-----`;

describe("jwt", () => {
  let jwtTokenSign: typeof import("@/lib/server/jwt").jwtTokenSign;
  let jwtTokenVerify: typeof import("@/lib/server/jwt").jwtTokenVerify;

  beforeEach(async () => {
    // 设置测试环境变量
    process.env.JWT_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.JWT_PUBLIC_KEY = TEST_PUBLIC_KEY;

    // 使用 vi.resetModules 清除模块缓存中的密钥缓存
    vi.resetModules();
    const jwtModule = await import("@/lib/server/jwt");
    jwtTokenSign = jwtModule.jwtTokenSign;
    jwtTokenVerify = jwtModule.jwtTokenVerify;
  });

  afterEach(() => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
  });

  // ==========================================================================
  // jwtTokenSign
  // ==========================================================================

  describe("jwtTokenSign", () => {
    it("应成功签发 JWT token", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      // JWT 格式: header.payload.signature
      expect(token.split(".")).toHaveLength(3);
    });

    it("应签发包含正确 payload 的 token", () => {
      const payload = {
        uid: 42,
        username: "admin",
        nickname: "Admin",
        role: "ADMIN",
      };
      const token = jwtTokenSign({ inner: payload });
      const decoded = jwtTokenVerify(token);

      expect(decoded).toBeDefined();
      expect(decoded!.uid).toBe(42);
      expect(decoded!.username).toBe("admin");
      expect(decoded!.nickname).toBe("Admin");
      expect(decoded!.role).toBe("ADMIN");
    });

    it("应自动添加 iat 和 exp 字段", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });
      const decoded = jwtTokenVerify(token);

      expect(decoded).toBeDefined();
      expect(decoded!.iat).toBeDefined();
      expect(decoded!.exp).toBeDefined();
      expect(decoded!.exp).toBeGreaterThan(decoded!.iat);
    });

    it("应支持自定义过期时间", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
        expired: "1h",
      });
      const decoded = jwtTokenVerify(token);

      expect(decoded).toBeDefined();
      // 1h = 3600秒，允许小误差
      const diff = decoded!.exp - decoded!.iat;
      expect(diff).toBeGreaterThanOrEqual(3590);
      expect(diff).toBeLessThanOrEqual(3610);
    });

    it("应支持数字形式的过期时间（秒）", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
        expired: 600,
      });
      const decoded = jwtTokenVerify(token);

      expect(decoded).toBeDefined();
      const diff = decoded!.exp - decoded!.iat;
      expect(diff).toBe(600);
    });

    it("默认过期时间应为 7 天", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });
      const decoded = jwtTokenVerify(token);

      expect(decoded).toBeDefined();
      const diff = decoded!.exp - decoded!.iat;
      // 7天 = 604800 秒
      expect(diff).toBe(604800);
    });

    it("JWT_PRIVATE_KEY 未设置时应抛出异常", async () => {
      delete process.env.JWT_PRIVATE_KEY;
      vi.resetModules();
      const mod = await import("@/lib/server/jwt");

      expect(() =>
        mod.jwtTokenSign({
          inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
        }),
      ).toThrow("JWT_PRIVATE_KEY environment variable is not set");
    });
  });

  // ==========================================================================
  // jwtTokenVerify
  // ==========================================================================

  describe("jwtTokenVerify", () => {
    it("应成功验证有效的 token", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });
      const result = jwtTokenVerify(token);

      expect(result).not.toBeNull();
      expect(result!.uid).toBe(1);
      expect(result!.username).toBe("test");
    });

    it("空字符串应返回 null", () => {
      expect(jwtTokenVerify("")).toBeNull();
    });

    it("无效 token 应返回 null", () => {
      expect(jwtTokenVerify("invalid.token.here")).toBeNull();
    });

    it("被篡改的 token 应返回 null", () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });
      // 篡改 payload 部分
      const parts = token.split(".");
      parts[1] = parts[1]!.slice(0, -5) + "XXXXX";
      const tamperedToken = parts.join(".");

      expect(jwtTokenVerify(tamperedToken)).toBeNull();
    });

    it("用不同密钥签发的 token 应返回 null", async () => {
      // 使用当前密钥签发
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });

      // 切换到另一组密钥
      const { generateKeyPairSync } = await import("crypto");
      const { privateKey, publicKey } = generateKeyPairSync("ec", {
        namedCurve: "P-256",
      });
      process.env.JWT_PRIVATE_KEY = privateKey.export({
        type: "pkcs8",
        format: "pem",
      }) as string;
      process.env.JWT_PUBLIC_KEY = publicKey.export({
        type: "spki",
        format: "pem",
      }) as string;

      vi.resetModules();
      const mod = await import("@/lib/server/jwt");

      expect(mod.jwtTokenVerify(token)).toBeNull();
    });

    it("应支持泛型类型参数", () => {
      interface CustomPayload {
        uid: number;
        customField: string;
        iat: number;
        exp: number;
      }

      const token = jwtTokenSign({
        inner: { uid: 1, customField: "hello" },
      });
      const result = jwtTokenVerify<CustomPayload>(token);

      expect(result).not.toBeNull();
      expect(result!.uid).toBe(1);
      expect(result!.customField).toBe("hello");
    });

    it("JWT_PUBLIC_KEY 未设置时应抛出异常", async () => {
      const token = jwtTokenSign({
        inner: { uid: 1, username: "test", nickname: "Test", role: "USER" },
      });

      // 需要重新加载以清除公钥缓存
      delete process.env.JWT_PUBLIC_KEY;
      vi.resetModules();
      const mod = await import("@/lib/server/jwt");

      // jwtTokenVerify 内部调用 getPublicKey() 会抛出异常
      // 但该异常会被 catch 捕获并返回 null
      expect(mod.jwtTokenVerify(token)).toBeNull();
    });
  });

  // ==========================================================================
  // 端到端签发-验证
  // ==========================================================================

  describe("签发-验证端到端", () => {
    it("签发后应能成功验证", () => {
      const payload = {
        uid: 100,
        username: "e2e_user",
        nickname: "E2E User",
        role: "EDITOR",
      };
      const token = jwtTokenSign({ inner: payload });
      const decoded = jwtTokenVerify(token);

      expect(decoded).toBeDefined();
      expect(decoded!.uid).toBe(100);
      expect(decoded!.username).toBe("e2e_user");
      expect(decoded!.nickname).toBe("E2E User");
      expect(decoded!.role).toBe("EDITOR");
    });

    it("不同用户的 token 应互不干扰", () => {
      const token1 = jwtTokenSign({
        inner: { uid: 1, username: "user1", nickname: "U1", role: "USER" },
      });
      const token2 = jwtTokenSign({
        inner: { uid: 2, username: "user2", nickname: "U2", role: "ADMIN" },
      });

      const decoded1 = jwtTokenVerify(token1);
      const decoded2 = jwtTokenVerify(token2);

      expect(decoded1!.uid).toBe(1);
      expect(decoded2!.uid).toBe(2);
      expect(decoded1!.role).toBe("USER");
      expect(decoded2!.role).toBe("ADMIN");
    });
  });
});
