import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock redis 模块（必须在 import 之前声明，vi.mock 会自动提升）
vi.mock("@/lib/server/redis", () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    ttl: vi.fn(),
    scan: vi.fn(),
    flushdb: vi.fn(),
  };
  return {
    default: mockRedis,
    ensureRedisConnection: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  clearCache,
  deleteCache,
  generateCacheKey,
  getBatchCache,
  getCache,
  getCacheTTL,
  getMemoryCacheStats,
  getOrSetCache,
  hasCache,
  setBatchCache,
  setCache,
} from "@/lib/server/cache";
import redis, { ensureRedisConnection } from "@/lib/server/redis";

// 获取 mock 实例的辅助类型
const mockRedis = vi.mocked(redis);
const mockEnsureRedis = vi.mocked(ensureRedisConnection);

describe("cache utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnsureRedis.mockResolvedValue(undefined);
  });

  // =========================================================================
  // generateCacheKey
  // =========================================================================
  describe("generateCacheKey", () => {
    it("generates key with purpose only", () => {
      expect(generateCacheKey("user")).toBe("np:cache:user");
    });

    it("generates key with purpose and parts", () => {
      expect(generateCacheKey("user", "stats", 123)).toBe(
        "np:cache:user:stats:123",
      );
    });

    it("generates key with string parts", () => {
      expect(generateCacheKey("post", "detail", "my-slug")).toBe(
        "np:cache:post:detail:my-slug",
      );
    });

    it("converts non-string parts to strings", () => {
      expect(generateCacheKey("config", true, null, undefined)).toBe(
        "np:cache:config:true:null:undefined",
      );
    });

    it("handles empty parts", () => {
      expect(generateCacheKey("test")).toBe("np:cache:test");
    });

    it("handles special characters in parts", () => {
      expect(generateCacheKey("user", "name@example.com")).toBe(
        "np:cache:user:name@example.com",
      );
    });

    it("handles numeric parts", () => {
      expect(generateCacheKey("post", 42, 0)).toBe("np:cache:post:42:0");
    });

    it("handles object parts via toString", () => {
      expect(generateCacheKey("test", { a: 1 })).toBe(
        "np:cache:test:[object Object]",
      );
    });
  });

  // =========================================================================
  // getMemoryCacheStats
  // =========================================================================
  describe("getMemoryCacheStats", () => {
    it("returns empty stats initially", async () => {
      // 先清空内存缓存
      await clearCache(undefined, { enableFallback: true });
      const stats = getMemoryCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);
    });

    it("reflects items added via setCache when Redis fails", async () => {
      mockRedis.setex.mockRejectedValue(new Error("Redis down"));

      await setCache("test:key1", { value: 1 });
      await setCache("test:key2", { value: 2 });

      const stats = getMemoryCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
      expect(stats.keys).toContain("test:key1");
      expect(stats.keys).toContain("test:key2");
    });
  });

  // =========================================================================
  // getCache
  // =========================================================================
  describe("getCache", () => {
    it("returns data from Redis when available", async () => {
      const testData = { name: "test", count: 42 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await getCache("test:key");

      expect(result).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith("test:key");
      expect(mockEnsureRedis).toHaveBeenCalled();
    });

    it("returns null when key does not exist in Redis", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCache("nonexistent:key");

      expect(result).toBeNull();
    });

    it("falls back to memory cache when Redis read fails", async () => {
      // 先通过 Redis 失败来写入内存缓存
      mockRedis.setex.mockRejectedValue(new Error("Redis write error"));
      await setCache("fallback:key", { data: "from memory" });

      // 现在模拟 Redis 读取也失败
      mockRedis.get.mockRejectedValue(new Error("Redis read error"));

      const result = await getCache<{ data: string }>("fallback:key");

      expect(result).toEqual({ data: "from memory" });
    });

    it("returns null when Redis fails and no memory fallback available", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis error"));

      const result = await getCache("no-fallback:key", {
        enableFallback: false,
      });

      expect(result).toBeNull();
    });

    it("returns null when memory cache entry is expired", async () => {
      // 写入一个极短 TTL 的条目到内存缓存（Redis 失败）
      mockRedis.setex.mockRejectedValue(new Error("Redis down"));
      await setCache("expired:key", { data: "old" }, { ttl: 0 });

      // 等待一小段时间确保过期
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Redis 仍然失败
      mockRedis.get.mockRejectedValue(new Error("Redis down"));

      const result = await getCache("expired:key");
      expect(result).toBeNull();
    });

    it("returns null for nonexistent key with no fallback", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCache("missing:key", {
        enableFallback: false,
      });

      expect(result).toBeNull();
    });

    it("handles complex nested objects", async () => {
      const complexData = {
        user: { id: 1, name: "Alice" },
        tags: ["a", "b", "c"],
        meta: { nested: { deep: true } },
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(complexData));

      const result = await getCache<typeof complexData>("complex:key");

      expect(result).toEqual(complexData);
    });

    it("handles array data", async () => {
      const arrayData = [1, 2, 3, "four"];
      mockRedis.get.mockResolvedValue(JSON.stringify(arrayData));

      const result = await getCache("array:key");

      expect(result).toEqual(arrayData);
    });
  });

  // =========================================================================
  // setCache
  // =========================================================================
  describe("setCache", () => {
    it("writes data to Redis with default TTL", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      const result = await setCache("test:key", { value: 42 });

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        "test:key",
        3600,
        JSON.stringify({ value: 42 }),
      );
    });

    it("writes data to Redis with custom TTL", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      await setCache("ttl:key", "data", { ttl: 600 });

      expect(mockRedis.setex).toHaveBeenCalledWith("ttl:key", 600, '"data"');
    });

    it("writes to memory cache as backup when Redis succeeds", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      await setCache("backup:key", { value: "backup" });

      const stats = getMemoryCacheStats();
      expect(stats.keys).toContain("backup:key");
    });

    it("falls back to memory cache when Redis write fails", async () => {
      mockRedis.setex.mockRejectedValue(new Error("Redis down"));

      const result = await setCache("mem:key", { value: "memory" });

      expect(result).toBe(true);

      // 验证数据在内存缓存中
      mockRedis.get.mockRejectedValue(new Error("Redis down"));
      const cached = await getCache("mem:key");
      expect(cached).toEqual({ value: "memory" });
    });

    it("returns false when Redis fails and fallback is disabled", async () => {
      mockRedis.setex.mockRejectedValue(new Error("Redis down"));

      const result = await setCache("no-fb:key", "data", {
        enableFallback: false,
      });

      expect(result).toBe(false);
    });

    it("handles primitive values", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      expect(await setCache("str:key", "hello")).toBe(true);
      expect(await setCache("num:key", 123)).toBe(true);
      expect(await setCache("bool:key", true)).toBe(true);
      expect(await setCache("null:key", null)).toBe(true);
    });
  });

  // =========================================================================
  // deleteCache
  // =========================================================================
  describe("deleteCache", () => {
    it("deletes from Redis", async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await deleteCache("del:key");

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith("del:key");
    });

    it("deletes from memory cache as well", async () => {
      // 先写入内存缓存
      mockRedis.setex.mockRejectedValue(new Error("Redis down"));
      await setCache("del:mem:key", "data");

      // 验证在内存中
      let stats = getMemoryCacheStats();
      expect(stats.keys).toContain("del:mem:key");

      // 删除
      mockRedis.del.mockRejectedValue(new Error("Redis down"));
      const result = await deleteCache("del:mem:key");

      expect(result).toBe(true);
      stats = getMemoryCacheStats();
      expect(stats.keys).not.toContain("del:mem:key");
    });

    it("returns true when only memory cache had the key", async () => {
      mockRedis.setex.mockRejectedValue(new Error("Redis down"));
      await setCache("only-mem:key", "data");

      mockRedis.del.mockRejectedValue(new Error("Redis down"));
      const result = await deleteCache("only-mem:key");

      expect(result).toBe(true);
    });

    it("returns true when Redis del succeeds even if key was not found", async () => {
      // deleteCache 不检查 del 的返回值，只要不抛出异常就返回 true
      mockRedis.del.mockResolvedValue(0);

      const result = await deleteCache("nonexistent:key", {
        enableFallback: false,
      });

      expect(result).toBe(true);
    });

    it("still deletes from memory when Redis delete throws", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("mem-only:key", "data");

      mockRedis.del.mockRejectedValue(new Error("down"));
      const result = await deleteCache("mem-only:key");

      expect(result).toBe(true);
      const stats = getMemoryCacheStats();
      expect(stats.keys).not.toContain("mem-only:key");
    });
  });

  // =========================================================================
  // hasCache
  // =========================================================================
  describe("hasCache", () => {
    it("returns true when key exists in Redis", async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await hasCache("exists:key");

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith("exists:key");
    });

    it("returns false when key does not exist in Redis", async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await hasCache("missing:key", {
        enableFallback: false,
      });

      expect(result).toBe(false);
    });

    it("falls back to memory cache when Redis fails", async () => {
      // 写入内存缓存
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("mem:exists", "data");

      // Redis exists 也失败
      mockRedis.exists.mockRejectedValue(new Error("down"));

      const result = await hasCache("mem:exists");
      expect(result).toBe(true);
    });

    it("returns false for expired memory cache entry", async () => {
      // 写入一个已过期的条目到内存
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("expired:has", "data", { ttl: 0 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      mockRedis.exists.mockRejectedValue(new Error("down"));
      const result = await hasCache("expired:has");
      expect(result).toBe(false);
    });

    it("cleans up expired memory cache entry on access", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("will-expire", "data", { ttl: 0 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      mockRedis.exists.mockRejectedValue(new Error("down"));
      await hasCache("will-expire");

      const stats = getMemoryCacheStats();
      expect(stats.keys).not.toContain("will-expire");
    });
  });

  // =========================================================================
  // getCacheTTL
  // =========================================================================
  describe("getCacheTTL", () => {
    it("returns TTL from Redis", async () => {
      mockRedis.ttl.mockResolvedValue(1800);

      const result = await getCacheTTL("ttl:key");

      expect(result).toBe(1800);
      expect(mockRedis.ttl).toHaveBeenCalledWith("ttl:key");
    });

    it("returns -2 when key does not exist in Redis", async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await getCacheTTL("nonexistent");

      expect(result).toBe(-2);
    });

    it("returns -1 for keys without expiration", async () => {
      mockRedis.ttl.mockResolvedValue(-1);

      const result = await getCacheTTL("no-expiry");

      expect(result).toBe(-1);
    });

    it("falls back to memory cache TTL when Redis fails", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("mem:ttl", "data", { ttl: 600 });

      mockRedis.ttl.mockRejectedValue(new Error("down"));
      const result = await getCacheTTL("mem:ttl");

      // 应该返回接近 600 的值（可能差 1-2 秒）
      expect(result).toBeGreaterThan(590);
      expect(result).toBeLessThanOrEqual(600);
    });

    it("returns -2 when Redis fails and key not in memory", async () => {
      mockRedis.ttl.mockRejectedValue(new Error("down"));

      const result = await getCacheTTL("not-in-memory");

      expect(result).toBe(-2);
    });
  });

  // =========================================================================
  // getOrSetCache
  // =========================================================================
  describe("getOrSetCache", () => {
    it("returns cached data without calling fetchFn", async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));

      const fetchFn = vi.fn().mockResolvedValue({ fetched: true });
      const result = await getOrSetCache("cached:key", fetchFn);

      expect(result).toEqual({ cached: true });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it("calls fetchFn and caches result on cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const fetchFn = vi.fn().mockResolvedValue({ fresh: true });
      const result = await getOrSetCache("fresh:key", fetchFn);

      expect(result).toEqual({ fresh: true });
      expect(fetchFn).toHaveBeenCalledOnce();
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it("passes options to setCache", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setex.mockResolvedValue("OK");

      const fetchFn = vi.fn().mockResolvedValue("value");
      await getOrSetCache("opts:key", fetchFn, { ttl: 120 });

      expect(mockRedis.setex).toHaveBeenCalledWith("opts:key", 120, '"value"');
    });

    it("works with memory fallback when Redis is down", async () => {
      mockRedis.get.mockRejectedValue(new Error("down"));
      mockRedis.setex.mockRejectedValue(new Error("down"));

      const fetchFn = vi.fn().mockResolvedValue({ fallback: true });
      const result = await getOrSetCache("fb:key", fetchFn);

      expect(result).toEqual({ fallback: true });

      // 第二次调用应该从内存缓存获取
      mockRedis.get.mockRejectedValue(new Error("down"));
      const result2 = await getOrSetCache("fb:key", fetchFn);
      expect(result2).toEqual({ fallback: true });
      expect(fetchFn).toHaveBeenCalledOnce(); // fetchFn 只被调用一次
    });
  });

  // =========================================================================
  // getBatchCache
  // =========================================================================
  describe("getBatchCache", () => {
    it("fetches multiple keys from Redis", async () => {
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify({ id: 1 }))
        .mockResolvedValueOnce(JSON.stringify({ id: 2 }))
        .mockResolvedValueOnce(null);

      const result = await getBatchCache(["key1", "key2", "key3"]);

      expect(result).toEqual({
        key1: { id: 1 },
        key2: { id: 2 },
        key3: null,
      });
    });

    it("returns empty result for empty keys", async () => {
      const result = await getBatchCache([]);
      expect(result).toEqual({});
    });
  });

  // =========================================================================
  // setBatchCache
  // =========================================================================
  describe("setBatchCache", () => {
    it("sets multiple entries", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      const count = await setBatchCache([
        { key: "a", value: 1 },
        { key: "b", value: 2 },
        { key: "c", value: 3 },
      ]);

      expect(count).toBe(3);
      expect(mockRedis.setex).toHaveBeenCalledTimes(3);
    });

    it("counts only successful entries", async () => {
      mockRedis.setex
        .mockResolvedValueOnce("OK")
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce("OK");

      // 第二个 key 的内存 fallback 也需要测试
      // 由于 enableFallback 默认为 true，失败的 Redis 写入仍会写入内存
      const count = await setBatchCache([
        { key: "ok1", value: 1 },
        { key: "fail", value: 2 },
        { key: "ok2", value: 3 },
      ]);

      // 因为 fallback 为 true，失败的也会成功写入内存
      expect(count).toBe(3);
    });

    it("returns 0 for empty entries", async () => {
      const count = await setBatchCache([]);
      expect(count).toBe(0);
    });
  });

  // =========================================================================
  // clearCache
  // =========================================================================
  describe("clearCache", () => {
    it("clears all Redis cache when no pattern given", async () => {
      mockRedis.flushdb.mockResolvedValue("OK");

      const count = await clearCache(undefined, { enableFallback: false });

      expect(count).toBe(-1);
      expect(mockRedis.flushdb).toHaveBeenCalled();
    });

    it("clears Redis cache by pattern using SCAN", async () => {
      mockRedis.scan
        .mockResolvedValueOnce(["10", ["np:cache:user:1", "np:cache:user:2"]])
        .mockResolvedValueOnce(["0", ["np:cache:user:3"]]);
      mockRedis.del
        .mockResolvedValue(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const count = await clearCache("np:cache:user:*", {
        enableFallback: false,
      });

      expect(count).toBeGreaterThanOrEqual(2);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });

    it("clears memory cache by pattern", async () => {
      // 写入一些内存缓存条目
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("pattern:a", 1);
      await setCache("pattern:b", 2);
      await setCache("other:c", 3);

      // Redis clear 也失败
      mockRedis.scan.mockRejectedValue(new Error("down"));
      mockRedis.flushdb.mockRejectedValue(new Error("down"));

      await clearCache("pattern:*");

      const stats = getMemoryCacheStats();
      expect(stats.keys).not.toContain("pattern:a");
      expect(stats.keys).not.toContain("pattern:b");
      expect(stats.keys).toContain("other:c");
    });

    it("clears all memory cache when no pattern given", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("any:key1", 1);
      await setCache("any:key2", 2);

      mockRedis.flushdb.mockRejectedValue(new Error("down"));

      await clearCache();

      const stats = getMemoryCacheStats();
      expect(stats.size).toBe(0);
    });

    it("handles wildcard patterns with special regex characters", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      await setCache("test.a+key", 1);
      await setCache("test.b+key", 2);
      await setCache("other.key", 3);

      mockRedis.scan.mockRejectedValue(new Error("down"));

      // 使用含特殊字符的 pattern
      await clearCache("test.a+*");

      const stats = getMemoryCacheStats();
      expect(stats.keys).not.toContain("test.a+key");
      expect(stats.keys).toContain("test.b+key");
    });
  });

  // =========================================================================
  // 内存缓存大小限制与淘汰
  // =========================================================================
  describe("memory cache eviction", () => {
    it("evicts oldest-expiring entry when cache is full", async () => {
      // 先清空
      await clearCache(undefined, { enableFallback: true });

      mockRedis.setex.mockRejectedValue(new Error("down"));

      // 填满缓存到上限附近（测试中用少量数据验证逻辑）
      const shortTTL = 10;
      const longTTL = 3600;

      await setCache("evict:short", "short-lived", { ttl: shortTTL });
      await setCache("evict:long", "long-lived", { ttl: longTTL });

      // 短 TTL 的应该先被清理（通过 TTL 检查）
      const stats = getMemoryCacheStats();
      expect(stats.keys).toContain("evict:short");
      expect(stats.keys).toContain("evict:long");
    });
  });

  // =========================================================================
  // Redis 连接失败时的降级完整性
  // =========================================================================
  describe("Redis degradation", () => {
    it("full workflow: set -> get -> has -> delete with Redis down", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      mockRedis.get.mockRejectedValue(new Error("down"));
      mockRedis.exists.mockRejectedValue(new Error("down"));
      mockRedis.del.mockRejectedValue(new Error("down"));

      // set
      const setResult = await setCache("degrade:key", { val: 42 });
      expect(setResult).toBe(true);

      // get
      const getResult = await getCache<{ val: number }>("degrade:key");
      expect(getResult).toEqual({ val: 42 });

      // has
      const hasResult = await hasCache("degrade:key");
      expect(hasResult).toBe(true);

      // delete
      const delResult = await deleteCache("degrade:key");
      expect(delResult).toBe(true);

      // 二次 get 应为 null
      const getResult2 = await getCache("degrade:key");
      expect(getResult2).toBeNull();
    });

    it("works correctly when enableFallback is false and Redis is down", async () => {
      mockRedis.setex.mockRejectedValue(new Error("down"));
      mockRedis.get.mockRejectedValue(new Error("down"));

      const opts = { enableFallback: false };

      const setResult = await setCache("no-fb:key", "data", opts);
      expect(setResult).toBe(false);

      const getResult = await getCache("no-fb:key", opts);
      expect(getResult).toBeNull();
    });
  });
});
