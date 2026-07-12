import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/ip-utils", () => ({
  isPrivateIP: vi.fn((ip: string) => {
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1")
      return true;
    if (ip.startsWith("10.")) return true;
    if (ip.startsWith("192.168.")) return true;
    if (ip.startsWith("172.")) {
      const second = parseInt(ip.split(".")[1] ?? "0", 10);
      if (second >= 16 && second <= 31) return true;
    }
    if (ip.startsWith("169.254.")) return true;
    if (ip === "0.0.0.0") return true;
    return false;
  }),
}));

const { mockLookup } = vi.hoisted(() => {
  return { mockLookup: vi.fn() };
});

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: mockLookup,
  },
}));

import {
  assertPublicHttpUrl,
  readResponseBufferWithLimit,
} from "@/lib/server/url-security";

describe("url-security expanded", () => {
  beforeEach(() => {
    mockLookup.mockReset();
  });

  describe("assertPublicHttpUrl - 协议扩展", () => {
    it("接受 http URL", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl("http://example.com");
      expect(result.url.protocol).toBe("http:");
      expect(result.resolvedIp).toBe("93.184.216.34");
    });

    it("接受 https URL", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl("https://example.com");
      expect(result.url.protocol).toBe("https:");
    });

    it("拒绝 ftp 协议", async () => {
      await expect(
        assertPublicHttpUrl("ftp://example.com/file"),
      ).rejects.toThrow("仅支持 HTTP/HTTPS 地址");
    });

    it("拒绝 file 协议", async () => {
      await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(
        "仅支持 HTTP/HTTPS 地址",
      );
    });

    it("requireHttps 时拒绝 http", async () => {
      await expect(
        assertPublicHttpUrl("http://example.com", { requireHttps: true }),
      ).rejects.toThrow("仅支持 HTTPS 地址");
    });

    it("requireHttps 时接受 https", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl("https://example.com", {
        requireHttps: true,
      });
      expect(result.url.protocol).toBe("https:");
    });
  });

  describe("assertPublicHttpUrl - 凭据校验", () => {
    it("拒绝包含用户名的 URL", async () => {
      await expect(
        assertPublicHttpUrl("http://user@example.com"),
      ).rejects.toThrow("URL 不允许包含账号信息");
    });

    it("拒绝包含用户名和密码的 URL", async () => {
      await expect(
        assertPublicHttpUrl("http://user:pass@example.com"),
      ).rejects.toThrow("URL 不允许包含账号信息");
    });
  });

  describe("assertPublicHttpUrl - 主机名校验", () => {
    it("拒绝 localhost", async () => {
      await expect(assertPublicHttpUrl("http://localhost")).rejects.toThrow(
        "不允许访问本地地址",
      );
    });

    it("拒绝 localhost.localdomain", async () => {
      await expect(
        assertPublicHttpUrl("http://localhost.localdomain"),
      ).rejects.toThrow("不允许访问本地地址");
    });
  });

  describe("assertPublicHttpUrl - IPv4 私有地址", () => {
    it("拒绝 127.0.0.1", async () => {
      await expect(assertPublicHttpUrl("http://127.0.0.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 10.x.x.x", async () => {
      await expect(assertPublicHttpUrl("http://10.0.0.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 192.168.x.x", async () => {
      await expect(assertPublicHttpUrl("http://192.168.1.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 172.16.x.x", async () => {
      await expect(assertPublicHttpUrl("http://172.16.0.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 0.0.0.0", async () => {
      await expect(assertPublicHttpUrl("http://0.0.0.0")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 169.254.x.x", async () => {
      await expect(assertPublicHttpUrl("http://169.254.1.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("接受公网 IPv4 地址", async () => {
      const result = await assertPublicHttpUrl("http://93.184.216.34");
      expect(result.resolvedIp).toBe("93.184.216.34");
    });
  });

  describe("assertPublicHttpUrl - IPv4 保留网段", () => {
    it("拒绝 100.64.x.x", async () => {
      await expect(assertPublicHttpUrl("http://100.64.0.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 198.18.x.x", async () => {
      await expect(assertPublicHttpUrl("http://198.18.0.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 224.0.0.1", async () => {
      await expect(assertPublicHttpUrl("http://224.0.0.1")).rejects.toThrow(
        "不允许访问内网或保留地址",
      );
    });

    it("拒绝 255.255.255.255", async () => {
      await expect(
        assertPublicHttpUrl("http://255.255.255.255"),
      ).rejects.toThrow("不允许访问内网或保留地址");
    });

    it("接受 100.63.x.x", async () => {
      const result = await assertPublicHttpUrl("http://100.63.0.1");
      expect(result.resolvedIp).toBe("100.63.0.1");
    });

    it("接受 100.128.0.1", async () => {
      const result = await assertPublicHttpUrl("http://100.128.0.1");
      expect(result.resolvedIp).toBe("100.128.0.1");
    });
  });

  describe("assertPublicHttpUrl - IPv6 保留地址", () => {
    it("拒绝 ::1", async () => {
      await expect(assertPublicHttpUrl("http://[::1]")).rejects.toThrow();
    });

    it("拒绝 fc00::1", async () => {
      await expect(assertPublicHttpUrl("http://[fc00::1]")).rejects.toThrow();
    });

    it("拒绝 fe80::1", async () => {
      await expect(assertPublicHttpUrl("http://[fe80::1]")).rejects.toThrow();
    });

    it("拒绝 ff02::1", async () => {
      await expect(assertPublicHttpUrl("http://[ff02::1]")).rejects.toThrow();
    });

    it("拒绝 2001:db8::1", async () => {
      await expect(
        assertPublicHttpUrl("http://[2001:db8::1]"),
      ).rejects.toThrow();
    });

    it("拒绝 ::ffff:127.0.0.1", async () => {
      await expect(
        assertPublicHttpUrl("http://[::ffff:127.0.0.1]"),
      ).rejects.toThrow();
    });
  });

  describe("assertPublicHttpUrl - DNS 解析", () => {
    it("拒绝解析到内网 IP 的域名", async () => {
      mockLookup.mockResolvedValue([{ address: "192.168.1.1", family: 4 }]);
      await expect(
        assertPublicHttpUrl("http://internal.example.com"),
      ).rejects.toThrow("目标地址解析到内网或保留地址");
    });

    it("接受解析到公网 IPv4 的域名", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl("http://example.com");
      expect(result.resolvedIp).toBe("93.184.216.34");
    });

    it("DNS 解析无结果时抛出错误", async () => {
      mockLookup.mockResolvedValue([]);
      await expect(
        assertPublicHttpUrl("http://nonexistent.example.com"),
      ).rejects.toThrow("无法解析目标地址");
    });

    it("DNS 解析失败时抛出错误", async () => {
      mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
      await expect(
        assertPublicHttpUrl("http://bad.example.com"),
      ).rejects.toThrow();
    });

    it("多个解析结果中只要有一个内网就拒绝", async () => {
      mockLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
        { address: "192.168.1.1", family: 4 },
      ]);
      await expect(
        assertPublicHttpUrl("http://mixed.example.com"),
      ).rejects.toThrow("目标地址解析到内网或保留地址");
    });

    it("多个公网 IP 时返回第一个", async () => {
      mockLookup.mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
        { address: "93.184.216.35", family: 4 },
      ]);
      const result = await assertPublicHttpUrl("http://example.com");
      expect(result.resolvedIp).toBe("93.184.216.34");
    });

    it("IPv6 公网地址解析成功", async () => {
      mockLookup.mockResolvedValue([{ address: "2606:4700::1", family: 6 }]);
      const result = await assertPublicHttpUrl("http://example.com");
      expect(result.resolvedIp).toBe("2606:4700::1");
    });

    it("解析结果中包含无效地址时过滤", async () => {
      mockLookup.mockResolvedValue([
        { address: "", family: 0 },
        { address: "93.184.216.34", family: 4 },
      ]);
      const result = await assertPublicHttpUrl("http://example.com");
      expect(result.resolvedIp).toBe("93.184.216.34");
    });

    it("所有解析结果都无效时抛出错误", async () => {
      mockLookup.mockResolvedValue([
        { address: "", family: 0 },
        { address: "invalid", family: 0 },
      ]);
      await expect(assertPublicHttpUrl("http://example.com")).rejects.toThrow(
        "无法解析目标地址",
      );
    });
  });

  describe("assertPublicHttpUrl - 边界情况", () => {
    it("URL 带端口号", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl("http://example.com:8080");
      expect(result.url.port).toBe("8080");
    });

    it("URL 带路径和查询参数", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl(
        "http://example.com/path?key=value&foo=bar",
      );
      expect(result.url.pathname).toBe("/path");
      expect(result.url.searchParams.get("key")).toBe("value");
      expect(result.url.searchParams.get("foo")).toBe("bar");
    });

    it("URL 大小写协议规范化", async () => {
      mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
      const result = await assertPublicHttpUrl("HTTP://example.com");
      expect(result.url.protocol).toBe("http:");
    });
  });

  describe("readResponseBufferWithLimit", () => {
    function createMockResponse(
      chunks: Uint8Array[],
      contentLength?: string,
    ): Response {
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const headers = new Headers();
      if (contentLength !== undefined) {
        headers.set("content-length", contentLength);
      }

      return new Response(stream, { headers });
    }

    it("读取正常大小的响应", async () => {
      const data = new TextEncoder().encode("hello world");
      const response = createMockResponse([data]);
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer.toString()).toBe("hello world");
    });

    it("多个 chunk 拼接正确", async () => {
      const chunk1 = new TextEncoder().encode("hello ");
      const chunk2 = new TextEncoder().encode("world");
      const response = createMockResponse([chunk1, chunk2]);
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer.toString()).toBe("hello world");
    });

    it("content-length 超限时立即抛出错误", async () => {
      const data = new TextEncoder().encode("too large");
      const response = createMockResponse([data], "99999");
      await expect(readResponseBufferWithLimit(response, 100)).rejects.toThrow(
        "文件大小超出限制",
      );
    });

    it("实际数据超限时抛出错误", async () => {
      const data = new TextEncoder().encode("a".repeat(200));
      const response = createMockResponse([data]);
      await expect(readResponseBufferWithLimit(response, 100)).rejects.toThrow(
        "文件大小超出限制",
      );
    });

    it("空响应体抛出错误", async () => {
      const response = new Response(null);
      await expect(readResponseBufferWithLimit(response, 1024)).rejects.toThrow(
        "响应体为空",
      );
    });

    it("content-length 为负数时不触发预检", async () => {
      const data = new TextEncoder().encode("small");
      const response = createMockResponse([data], "-1");
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer.toString()).toBe("small");
    });

    it("content-length 为非数字时不触发预检", async () => {
      const data = new TextEncoder().encode("test");
      const response = createMockResponse([data], "not-a-number");
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer.toString()).toBe("test");
    });

    it("边界值：数据恰好等于 maxBytes 时成功", async () => {
      const data = new TextEncoder().encode("a".repeat(100));
      const response = createMockResponse([data]);
      const buffer = await readResponseBufferWithLimit(response, 100);
      expect(buffer.length).toBe(100);
    });

    it("边界值：数据超过 maxBytes 一个字节时失败", async () => {
      const data = new TextEncoder().encode("a".repeat(101));
      const response = createMockResponse([data]);
      await expect(readResponseBufferWithLimit(response, 100)).rejects.toThrow(
        "文件大小超出限制",
      );
    });

    it("处理二进制数据", async () => {
      const binary = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const response = createMockResponse([binary]);
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer.length).toBe(6);
    });

    it("多个小 chunk 累积超限时抛出错误", async () => {
      const chunks = Array.from({ length: 10 }, () =>
        new TextEncoder().encode("a".repeat(15)),
      );
      const response = createMockResponse(chunks);
      await expect(readResponseBufferWithLimit(response, 100)).rejects.toThrow(
        "文件大小超出限制",
      );
    });

    it("空数组 chunks 返回空 Buffer", async () => {
      const response = createMockResponse([]);
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer.length).toBe(0);
    });

    it("无 content-length 头时正常读取", async () => {
      const data = new TextEncoder().encode("no content length header");
      const response = createMockResponse([data]);
      const buffer = await readResponseBufferWithLimit(response, 1024);
      expect(buffer.toString()).toBe("no content length header");
    });
  });
});
