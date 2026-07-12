import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfig = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
}));

describe("ably-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue("test-app.keyId:keySecret");
  });

  describe("isAblyEnabled", () => {
    it("当配置了 Ably API Key 时应返回 true", async () => {
      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const result = await isAblyEnabled();

      expect(result).toBe(true);
    });

    it("当未配置 Ably API Key 时应返回 false", async () => {
      mockGetConfig.mockResolvedValueOnce(undefined);

      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const result = await isAblyEnabled();

      expect(result).toBe(false);
    });

    it("当 Ably API Key 为空字符串时应返回 false", async () => {
      mockGetConfig.mockResolvedValueOnce("");

      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const result = await isAblyEnabled();

      expect(result).toBe(false);
    });

    it("当 Ably API Key 为 null 时应返回 false", async () => {
      mockGetConfig.mockResolvedValueOnce(null);

      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const result = await isAblyEnabled();

      expect(result).toBe(false);
    });
  });

  describe("getAblyApiKey", () => {
    it("应返回配置的 API Key", async () => {
      const { getAblyApiKey } = await import("@/lib/server/ably-config");
      const result = await getAblyApiKey();

      expect(result).toBe("test-app.keyId:keySecret");
    });

    it("当未配置时应返回 undefined", async () => {
      mockGetConfig.mockResolvedValueOnce(undefined);

      const { getAblyApiKey } = await import("@/lib/server/ably-config");
      const result = await getAblyApiKey();

      expect(result).toBeUndefined();
    });

    it("当配置为空字符串时应返回 undefined", async () => {
      mockGetConfig.mockResolvedValueOnce("");

      const { getAblyApiKey } = await import("@/lib/server/ably-config");
      const result = await getAblyApiKey();

      expect(result).toBeUndefined();
    });
  });

  describe("getAblyConfig", () => {
    it("应返回完整的 Ably 配置对象", async () => {
      const { getAblyConfig } = await import("@/lib/server/ably-config");
      const config = await getAblyConfig();

      expect(config.apiKey).toBe("test-app.keyId:keySecret");
      expect(config.isEnabled).toBe(true);
      expect(config.tokenTTL).toBe(3600000);
      expect(config.fallbackEnabled).toBe(true);
    });

    it("当未配置时应返回 isEnabled 为 false", async () => {
      // isAblyEnabled 和 getAblyApiKey 都会调用 getConfig
      // isAblyEnabled 先调用，getAblyApiKey 后调用
      mockGetConfig
        .mockResolvedValueOnce(undefined) // isAblyEnabled -> getConfig("notice.ably.key")
        .mockResolvedValueOnce(undefined); // getAblyApiKey -> getConfig("notice.ably.key")

      const { getAblyConfig } = await import("@/lib/server/ably-config");
      const config = await getAblyConfig();

      expect(config.apiKey).toBeUndefined();
      expect(config.isEnabled).toBe(false);
    });

    it("应返回正确的 tokenTTL", async () => {
      const { getAblyConfig } = await import("@/lib/server/ably-config");
      const config = await getAblyConfig();

      expect(config.tokenTTL).toBe(3600000);
      expect(typeof config.tokenTTL).toBe("number");
    });

    it("应默认启用轮询回退机制", async () => {
      const { getAblyConfig } = await import("@/lib/server/ably-config");
      const config = await getAblyConfig();

      expect(config.fallbackEnabled).toBe(true);
    });

    it("应返回 const 断言的配置对象", async () => {
      const { getAblyConfig } = await import("@/lib/server/ably-config");
      const config = await getAblyConfig();

      // 验证返回的对象包含所有必需字段
      expect(config).toHaveProperty("apiKey");
      expect(config).toHaveProperty("isEnabled");
      expect(config).toHaveProperty("tokenTTL");
      expect(config).toHaveProperty("fallbackEnabled");
    });
  });

  describe("边界情况", () => {
    it("当 API Key 为 falsy 数值时应返回 false", async () => {
      mockGetConfig.mockResolvedValueOnce(0);

      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const result = await isAblyEnabled();

      expect(result).toBe(false);
    });

    it("当 API Key 为 false 布尔值时应返回 false", async () => {
      mockGetConfig.mockResolvedValueOnce(false);

      const { isAblyEnabled } = await import("@/lib/server/ably-config");
      const result = await isAblyEnabled();

      expect(result).toBe(false);
    });

    it("当 API Key 包含特殊字符时应原样返回", async () => {
      const specialKey = "app-id.key-id+special/chars==";
      mockGetConfig.mockResolvedValueOnce(specialKey);

      const { getAblyApiKey } = await import("@/lib/server/ably-config");
      const result = await getAblyApiKey();

      expect(result).toBe(specialKey);
    });
  });
});
