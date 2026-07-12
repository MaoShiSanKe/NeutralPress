import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock config-cache
const mockGetConfigs = vi.fn();
vi.mock("@/lib/server/config-cache", () => ({
  getConfigs: mockGetConfigs,
}));

describe("anti-hotlink", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetConfigs.mockResolvedValue([
      true, // media.antiHotLink.enable
      true, // media.antiHotLink.allowEmptyReferrer
      ["allowed.com", "*.trusted.com"], // media.antiHotLink.allowedDomains
      "https://example.com", // site.url
    ]);
  });

  describe("checkAntiHotLink", () => {
    it("当防盗链未启用时应允许访问", async () => {
      mockGetConfigs.mockResolvedValueOnce([
        false, // disabled
        true,
        [],
        "https://example.com",
      ]);

      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://other.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 为空且允许空 Referer 时应允许访问", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 为空且不允许空 Referer 时应拒绝访问", async () => {
      mockGetConfigs.mockResolvedValueOnce([
        true,
        false, // 不允许空 Referer
        [],
        "https://example.com",
      ]);

      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Empty referer");
    });

    it("当 Referer 域名与站点域名匹配时应允许访问", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://example.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 域名在白名单中时应允许访问", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://allowed.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 匹配通配符子域名时应允许访问", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://sub.trusted.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 匹配通配符基础域名时应允许访问", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://trusted.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 域名不在允许列表中时应拒绝访问", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://evil.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("evil.com");
    });
  });

  describe("generateFallbackImage", () => {
    it("应生成 SVG 格式的 Buffer", async () => {
      const { generateFallbackImage } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateFallbackImage({
        siteURL: "https://example.com",
        time: "2024-01-01 12:00:00",
        assetsURL: "/test.jpg",
        ip: "192.168.1.1",
        agents: "Mozilla/5.0",
        location: "CN",
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      const svg = result.toString("utf-8");
      expect(svg).toContain("<svg");
      expect(svg).toContain("ERROR...");
      expect(svg).toContain("HTTP 403 Forbidden");
    });

    it("应在 SVG 中包含传入的参数信息", async () => {
      const { generateFallbackImage } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateFallbackImage({
        siteURL: "https://example.com",
        time: "2024-01-01",
        assetsURL: "/image.jpg",
        ip: "10.0.0.1",
        agents: "TestAgent",
        location: "US",
      });

      const svg = result.toString("utf-8");
      expect(svg).toContain("10.0.0.1");
      expect(svg).toContain("2024-01-01");
      expect(svg).toContain("TestAgent");
    });

    it("应转义 SVG 中的特殊字符", async () => {
      const { generateFallbackImage } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateFallbackImage({
        siteURL: "https://example.com/<script>",
        time: "2024-01-01",
        assetsURL: "/test",
        ip: "1.1.1.1",
        agents: "agent",
        location: "loc",
      });

      const svg = result.toString("utf-8");
      // 应该转义 < 和 >
      expect(svg).toContain("&lt;script&gt;");
      expect(svg).not.toContain("<script>");
    });
  });

  describe("generateImageErrorShell", () => {
    it("应生成包含所有参数的 SVG", async () => {
      const { generateImageErrorShell } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateImageErrorShell({
        siteURL: "https://example.com",
        time: "2024-01-01",
        assetsURL: "/test.jpg",
        ip: "192.168.1.1",
        agents: "Mozilla/5.0",
        location: "CN",
        title: "CUSTOM TITLE",
        statusText: "CUSTOM STATUS",
        message: "Custom message",
        hintLine1: "Hint 1",
        hintLine2: "Hint 2",
      });

      const svg = result.toString("utf-8");
      expect(svg).toContain("CUSTOM TITLE");
      expect(svg).toContain("CUSTOM STATUS");
      expect(svg).toContain("Custom message");
      expect(svg).toContain("Hint 1");
      expect(svg).toContain("Hint 2");
    });

    it("应转义包含 XML 特殊字符的参数", async () => {
      const { generateImageErrorShell } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateImageErrorShell({
        siteURL: 'https://example.com/"quotes"',
        time: "2024-01-01",
        assetsURL: "/test",
        ip: "1.1.1.1",
        agents: "agent",
        location: "loc",
        title: "Title",
        statusText: "Status",
        message: "Message",
        hintLine1: "Hint",
        hintLine2: "Hint",
      });

      const svg = result.toString("utf-8");
      // 应该转义引号
      expect(svg).toContain("&quot;quotes&quot;");
    });

    it("应转义 & 字符", async () => {
      const { generateImageErrorShell } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateImageErrorShell({
        siteURL: "https://example.com?a=1&b=2",
        time: "2024-01-01",
        assetsURL: "/test",
        ip: "1.1.1.1",
        agents: "agent",
        location: "loc",
        title: "Title",
        statusText: "Status",
        message: "Message",
        hintLine1: "Hint",
        hintLine2: "Hint",
      });

      const svg = result.toString("utf-8");
      expect(svg).toContain("&amp;");
      expect(svg).not.toContain("&b=2"); // & 应被转义
    });

    it("应转义单引号", async () => {
      const { generateImageErrorShell } = await import(
        "@/lib/server/anti-hotlink"
      );
      const result = generateImageErrorShell({
        siteURL: "https://example.com/it's",
        time: "2024-01-01",
        assetsURL: "/test",
        ip: "1.1.1.1",
        agents: "agent",
        location: "loc",
        title: "Title",
        statusText: "Status",
        message: "Message",
        hintLine1: "Hint",
        hintLine2: "Hint",
      });

      const svg = result.toString("utf-8");
      expect(svg).toContain("&apos;");
    });
  });

  describe("checkAntiHotLink 边界情况", () => {
    it("当 Referer 包含端口时应正确提取域名", async () => {
      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://example.com:8080/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      expect(result.allowed).toBe(true);
    });

    it("当 Referer 为相对路径时应处理为空域名", async () => {
      mockGetConfigs.mockResolvedValueOnce([
        true,
        false, // 不允许空 Referer
        [],
        "https://example.com",
      ]);

      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("/relative/path"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      // 提取域名会失败（空字符串），应视为无效 Referer
      expect(result.allowed).toBe(false);
    });

    it("应处理空的 allowedDomains 配置", async () => {
      mockGetConfigs.mockResolvedValueOnce([
        true,
        true,
        [], // 空白名单
        "https://example.com",
      ]);

      const { checkAntiHotLink } = await import("@/lib/server/anti-hotlink");
      const mockRequest = {
        headers: {
          get: vi.fn().mockReturnValue("https://example.com/page"),
        },
      } as any;

      const result = await checkAntiHotLink(mockRequest);
      // 站点域名应始终被允许
      expect(result.allowed).toBe(true);
    });
  });
});
