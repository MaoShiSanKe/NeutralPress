import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock prisma
vi.mock("@/lib/server/prisma", () => ({
  default: {
    customDictionary: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => Promise<unknown>) => fn),
}));

import {
  analyzeText,
  getCurrentDictHash,
  resetTokenizerDictionary,
} from "@/lib/server/tokenizer";

describe("tokenizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeText", () => {
    it("应返回空数组当输入为空", async () => {
      const result = await analyzeText("");
      expect(result).toEqual([]);
    });

    it("应返回空数组当输入为 null/undefined", async () => {
      expect(await analyzeText(null as unknown as string)).toEqual([]);
      expect(await analyzeText(undefined as unknown as string)).toEqual([]);
    });

    it("应分词简单的英文文本", async () => {
      const result = await analyzeText("Hello World");
      expect(result.length).toBeGreaterThan(0);
      // 应包含小写形式
      expect(result).toContain("hello");
      expect(result).toContain("world");
    });

    it("应分词中文文本", async () => {
      const result = await analyzeText("这是一段测试文本");
      expect(result.length).toBeGreaterThan(0);
      // 中文分词应该产生有意义的词
      expect(result.some((t) => t.includes("测试"))).toBe(true);
      expect(result.some((t) => t.includes("文本"))).toBe(true);
    });

    it("应过滤停止词", async () => {
      const result = await analyzeText("the a an is are");
      // 英文停止词应该被过滤
      expect(result).not.toContain("the");
      expect(result).not.toContain("a");
      expect(result).not.toContain("an");
    });

    it("应处理混合中英文文本", async () => {
      const result = await analyzeText("使用 Next.js 开发");
      expect(result.length).toBeGreaterThan(0);
      // 应包含中文词
      expect(result.some((t) => t.includes("使用") || t.includes("开发"))).toBe(
        true,
      );
    });

    it("应识别 URL 格式", async () => {
      const result = await analyzeText("访问 https://example.com 获取更多信息");
      // URL 应该被识别并保留
      expect(result.some((t) => t.includes("example.com"))).toBe(true);
    });

    it("应识别版本号", async () => {
      const result = await analyzeText("使用 v1.2.3 版本");
      expect(
        result.some((t) => t.includes("1.2.3") || t.includes("v1.2.3")),
      ).toBe(true);
    });

    it("应处理纯数字文本", async () => {
      const result = await analyzeText("12345");
      expect(result.some((t) => t.includes("12345"))).toBe(true);
    });

    it("应处理包含特殊字符的文本", async () => {
      const result = await analyzeText("hello@example.com");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应过滤无效 token", async () => {
      // 纯符号应被过滤（除非是编程符号）
      const result = await analyzeText("@@@@");
      // 单独的 @ 符号应该被过滤
      expect(result.every((t) => t.trim().length > 0)).toBe(true);
    });

    it("应保留编程符号", async () => {
      const result = await analyzeText("npm install package@^1.0.0");
      // 编程符号如 ^ 应该被保留
      expect(result.some((t) => t === "^" || t.includes("^"))).toBe(true);
    });

    it("应处理长文本", async () => {
      const longText = "这是一段很长的文本 ".repeat(100);
      const result = await analyzeText(longText);
      expect(result.length).toBeGreaterThan(0);
    });

    it("应处理包含代码的文本", async () => {
      const result = await analyzeText(
        "const x = 1; function test() { return x; }",
      );
      expect(result.length).toBeGreaterThan(0);
      expect(
        result.some((t) => t.includes("const") || t.includes("function")),
      ).toBe(true);
    });

    it("应处理 IP 地址", async () => {
      const result = await analyzeText("服务器地址 192.168.1.1");
      expect(result.some((t) => t.includes("192.168.1.1"))).toBe(true);
    });

    it("应处理 email 地址", async () => {
      const result = await analyzeText("联系 admin@example.com");
      expect(result.some((t) => t.includes("admin@example.com"))).toBe(true);
    });
  });

  describe("resetTokenizerDictionary", () => {
    it("应成功重置词典", async () => {
      await expect(resetTokenizerDictionary()).resolves.not.toThrow();
    });
  });

  describe("getCurrentDictHash", () => {
    it("应返回字符串", () => {
      const hash = getCurrentDictHash();
      expect(typeof hash).toBe("string");
    });

    it("应返回32位MD5哈希", () => {
      const hash = getCurrentDictHash();
      // 首次调用可能为空字符串，初始化后应为32位十六进制
      if (hash.length > 0) {
        expect(hash).toMatch(/^[a-f0-9]{32}$/);
      }
    });
  });

  describe("analyzeText - 补充测试", () => {
    it("应处理空格和换行符", async () => {
      const result = await analyzeText("  hello   world  ");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应处理包含括号的文本", async () => {
      const result = await analyzeText("function() { return 1; }");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应识别 CLI 参数", async () => {
      const result = await analyzeText("npm install --save-dev");
      expect(
        result.some(
          (t) =>
            t.includes("save-dev") || t.includes("save") || t.includes("dev"),
        ),
      ).toBe(true);
    });

    it("应处理 Tailwind 类名", async () => {
      const result = await analyzeText("hover:bg-red-500");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应处理日期格式", async () => {
      const result = await analyzeText("发布日期 2024-01-15");
      expect(
        result.some(
          (t) =>
            t.includes("2024-01-15") ||
            t.includes("2024") ||
            t.includes("01") ||
            t.includes("15"),
        ),
      ).toBe(true);
    });

    it("应处理百分比和货币", async () => {
      const result = await analyzeText("折扣 $99.99 优惠 50%");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应处理 npm 包名", async () => {
      const result = await analyzeText("安装 @types/node");
      expect(
        result.some(
          (t) =>
            t.includes("@types/node") ||
            t.includes("types") ||
            t.includes("node"),
        ),
      ).toBe(true);
    });

    it("应处理 Python 包名带版本", async () => {
      const result = await analyzeText("pip install requests==2.31.0");
      expect(
        result.some((t) => t.includes("requests") || t.includes("2.31.0")),
      ).toBe(true);
    });

    it("应处理 UUID", async () => {
      const result = await analyzeText(
        "ID: 550e8400-e29b-41d4-a716-446655440000",
      );
      expect(result.some((t) => t.includes("550e8400"))).toBe(true);
    });

    it("应处理下划线复合词", async () => {
      const result = await analyzeText("user_name variable_name");
      expect(result.some((t) => t.includes("user") || t.includes("name"))).toBe(
        true,
      );
    });

    it("应处理路径格式", async () => {
      const result = await analyzeText("文件路径 /usr/bin/node");
      expect(
        result.some(
          (t) =>
            t.includes("/usr/bin/node") ||
            t.includes("usr") ||
            t.includes("bin") ||
            t.includes("node"),
        ),
      ).toBe(true);
    });

    it("应处理点文件", async () => {
      const result = await analyzeText("配置文件 .env.local");
      expect(
        result.some(
          (t) =>
            t.includes("env") ||
            t.includes("local") ||
            t.includes(".env.local"),
        ),
      ).toBe(true);
    });

    it("应处理纯中文停用词", async () => {
      const result = await analyzeText("的 了 在 是 我 有");
      // 中文停用词应该被大部分过滤
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it("应处理多行文本", async () => {
      const result = await analyzeText("第一行\n第二行\n第三行");
      expect(result.length).toBeGreaterThan(0);
    });

    it("应处理大段代码文本", async () => {
      const result = await analyzeText(
        "import React from 'react'; export default function App() { return <div>Hello</div>; }",
      );
      expect(
        result.some(
          (t) =>
            t.includes("react") ||
            t.includes("import") ||
            t.includes("export") ||
            t.includes("function"),
        ),
      ).toBe(true);
    });

    it("应处理 version with tag", async () => {
      const result = await analyzeText("版本 v2.0.1-beta");
      expect(
        result.some(
          (t) =>
            t.includes("v2.0.1-beta") ||
            t.includes("beta") ||
            t.includes("2.0.1"),
        ),
      ).toBe(true);
    });

    it("应处理 generic type", async () => {
      const result = await analyzeText("类型 List<String>");
      expect(
        result.some((t) => t.includes("list") || t.includes("string")),
      ).toBe(true);
    });

    it("应处理 decorator", async () => {
      const result = await analyzeText("Python装饰器 @app.route");
      expect(
        result.some(
          (t) =>
            t.includes("app") ||
            t.includes("route") ||
            t.includes("@app.route"),
        ),
      ).toBe(true);
    });

    it("应处理 IPv6 地址", async () => {
      const result = await analyzeText(
        "IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      );
      expect(result.some((t) => t.includes("2001") || t.includes("ipv6"))).toBe(
        true,
      );
    });
  });
});
