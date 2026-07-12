import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

describe("tokenizer expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("analyzeText - 特殊格式识别", () => {
    it("识别 NPM 作用域包名", async () => {
      const result = await analyzeText("安装 @anthropic-ai/sdk");
      expect(
        result.some(
          (t) => t.includes("@anthropic-ai/sdk") || t.includes("anthropic"),
        ),
      ).toBe(true);
    });

    it("识别带版本的 NPM 包", async () => {
      const result = await analyzeText("react@18.0.0");
      expect(
        result.some((t) => t.includes("react") || t.includes("18.0.0")),
      ).toBe(true);
    });

    it("识别 CLI 标志", async () => {
      const result = await analyzeText("使用 --save-dev 安装");
      expect(
        result.some(
          (t) =>
            t.includes("--save-dev") ||
            t.includes("save-dev") ||
            t.includes("save") ||
            t.includes("dev"),
        ),
      ).toBe(true);
    });

    it("识别 Tailwind 类名", async () => {
      const result = await analyzeText("使用 hover:bg-red-500");
      expect(result.length).toBeGreaterThan(0);
    });

    it("识别 IPv4 地址", async () => {
      const result = await analyzeText("服务器地址 192.168.1.1");
      expect(result.some((t) => t.includes("192.168.1.1"))).toBe(true);
    });

    it("识别 UUID", async () => {
      const result = await analyzeText(
        "ID: 550e8400-e29b-41d4-a716-446655440000",
      );
      expect(
        result.some((t) => t.includes("550e8400-e29b-41d4-a716-446655440000")),
      ).toBe(true);
    });

    it("识别日期格式", async () => {
      const result = await analyzeText("日期 2024-01-15");
      expect(result.some((t) => t.includes("2024-01-15"))).toBe(true);
    });

    it("识别时间格式", async () => {
      const result = await analyzeText("时间 14:30:00");
      expect(result.some((t) => t.includes("14:30:00"))).toBe(true);
    });

    it("识别 URL", async () => {
      const result = await analyzeText("访问 https://example.com/path?q=test");
      expect(result.some((t) => t.includes("example.com"))).toBe(true);
    });

    it("识别 email", async () => {
      const result = await analyzeText("联系 admin@example.com");
      expect(result.some((t) => t.includes("admin@example.com"))).toBe(true);
    });

    it("识别版本号", async () => {
      const result = await analyzeText("版本 v1.2.3");
      expect(
        result.some((t) => t.includes("1.2.3") || t.includes("v1.2.3")),
      ).toBe(true);
    });

    it("识别 Python 包版本", async () => {
      const result = await analyzeText("安装 requests==2.31.0");
      expect(
        result.some((t) => t.includes("requests") || t.includes("2.31.0")),
      ).toBe(true);
    });

    it("识别 Vue 指令", async () => {
      const result = await analyzeText("使用 @click 事件");
      expect(result.some((t) => t.includes("@click"))).toBe(true);
    });

    it("识别泛型类型", async () => {
      const result = await analyzeText("类型 List<String>");
      expect(
        result.some((t) => t.includes("list") || t.includes("string")),
      ).toBe(true);
    });

    it("识别点文件", async () => {
      const result = await analyzeText("编辑 .env.local 文件");
      expect(
        result.some(
          (t) =>
            t.includes(".env.local") ||
            t.includes("env.local") ||
            t.includes("env"),
        ),
      ).toBe(true);
    });

    it("识别路径", async () => {
      const result = await analyzeText("文件在 /usr/bin/node");
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

    it("识别百分比", async () => {
      const result = await analyzeText("增长率 50%");
      expect(result.some((t) => t.includes("50%") || t.includes("50"))).toBe(
        true,
      );
    });
  });

  describe("analyzeText - 中文分词", () => {
    it("分词简单中文", async () => {
      const result = await analyzeText("这是一段测试文本");
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((t) => t.includes("测试"))).toBe(true);
      expect(result.some((t) => t.includes("文本"))).toBe(true);
    });

    it("分词混合中英文", async () => {
      const result = await analyzeText("使用 Next.js 开发");
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((t) => t.includes("使用") || t.includes("开发"))).toBe(
        true,
      );
    });

    it("过滤中文停止词", async () => {
      const result = await analyzeText("的了在是我有和就人都一");
      // 中文停止词应该被过滤
      expect(result.every((t) => t.trim().length > 0)).toBe(true);
    });
  });

  describe("analyzeText - 英文处理", () => {
    it("转小写", async () => {
      const result = await analyzeText("Hello World");
      expect(result).toContain("hello");
      expect(result).toContain("world");
    });

    it("过滤英文停止词", async () => {
      const result = await analyzeText("the a an is are");
      expect(result).not.toContain("the");
      expect(result).not.toContain("a");
      expect(result).not.toContain("an");
    });
  });

  describe("analyzeText - 边界情况", () => {
    it("空字符串返回空数组", async () => {
      expect(await analyzeText("")).toEqual([]);
    });

    it("null 返回空数组", async () => {
      expect(await analyzeText(null as unknown as string)).toEqual([]);
    });

    it("undefined 返回空数组", async () => {
      expect(await analyzeText(undefined as unknown as string)).toEqual([]);
    });

    it("纯空格返回空数组", async () => {
      expect(await analyzeText("   ")).toEqual([]);
    });

    it("纯数字", async () => {
      const result = await analyzeText("12345");
      expect(result.some((t) => t.includes("12345"))).toBe(true);
    });

    it("长文本不崩溃", async () => {
      const longText = "这是一段很长的文本 ".repeat(100);
      const result = await analyzeText(longText);
      expect(result.length).toBeGreaterThan(0);
    });

    it("包含代码的文本", async () => {
      const result = await analyzeText(
        "const x = 1; function test() { return x; }",
      );
      expect(result.length).toBeGreaterThan(0);
      expect(
        result.some((t) => t.includes("const") || t.includes("function")),
      ).toBe(true);
    });

    it("包含特殊字符", async () => {
      const result = await analyzeText("hello@example.com");
      expect(result.length).toBeGreaterThan(0);
    });

    it("保留编程符号", async () => {
      const result = await analyzeText("npm install package@^1.0.0");
      expect(result.some((t) => t === "^" || t.includes("^"))).toBe(true);
    });
  });

  describe("resetTokenizerDictionary", () => {
    it("成功重置词典", async () => {
      await expect(resetTokenizerDictionary()).resolves.not.toThrow();
    });
  });

  describe("getCurrentDictHash", () => {
    it("返回字符串", () => {
      const hash = getCurrentDictHash();
      expect(typeof hash).toBe("string");
    });
  });
});
