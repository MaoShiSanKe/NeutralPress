import { describe, expect, it } from "vitest";

import { parseRedisConnectionOptions } from "@/lib/shared/redis-url";

describe("redis-url", () => {
  describe("parseRedisConnectionOptions", () => {
    it("解析基本 redis:// URL", () => {
      const result = parseRedisConnectionOptions("redis://localhost:6379");
      expect(result.host).toBe("localhost");
      expect(result.port).toBe(6379);
      expect(result.username).toBeUndefined();
      expect(result.password).toBeUndefined();
      expect(result.db).toBeUndefined();
      expect(result.tls).toBeUndefined();
    });

    it("解析带密码的 URL", () => {
      const result = parseRedisConnectionOptions(
        "redis://:mypassword@localhost:6379",
      );
      expect(result.password).toBe("mypassword");
    });

    it("解析带用户名和密码的 URL", () => {
      const result = parseRedisConnectionOptions(
        "redis://user:pass@localhost:6379",
      );
      expect(result.username).toBe("user");
      expect(result.password).toBe("pass");
    });

    it("解析带数据库编号的 URL", () => {
      const result = parseRedisConnectionOptions("redis://localhost:6379/3");
      expect(result.db).toBe(3);
    });

    it("解析 rediss:// 协议（TLS）", () => {
      const result = parseRedisConnectionOptions("rediss://localhost:6380");
      expect(result.tls).toEqual({});
      expect(result.port).toBe(6380);
    });

    it("无端口时使用默认 6379", () => {
      const result = parseRedisConnectionOptions("redis://localhost");
      expect(result.port).toBe(6379);
    });

    it("解析 IP 地址", () => {
      const result = parseRedisConnectionOptions("redis://192.168.1.100:6379");
      expect(result.host).toBe("192.168.1.100");
    });

    it("URL 编码的密码被正确解码", () => {
      const result = parseRedisConnectionOptions(
        "redis://:p%40ssword@localhost:6379",
      );
      expect(result.password).toBe("p@ssword");
    });

    it("无效 URL 格式抛出错误", () => {
      expect(() => parseRedisConnectionOptions("not-a-url")).toThrow(
        "Invalid REDIS_URL format",
      );
    });

    it("不支持的协议抛出错误", () => {
      expect(() =>
        parseRedisConnectionOptions("http://localhost:6379"),
      ).toThrow("Unsupported REDIS_URL protocol");
    });

    it("空数据库路径返回 undefined", () => {
      const result = parseRedisConnectionOptions("redis://localhost:6379/");
      expect(result.db).toBeUndefined();
    });
  });
});
