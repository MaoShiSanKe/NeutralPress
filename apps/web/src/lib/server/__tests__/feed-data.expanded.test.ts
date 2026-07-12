import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock next/cache
vi.mock("next/cache", () => ({
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => Promise<unknown>) => fn),
}));

// Mock category-utils
vi.mock("@/lib/server/category-utils", () => ({
  batchGetCategoryPaths: vi.fn().mockResolvedValue(new Map()),
}));

// Mock config-cache
vi.mock("@/lib/server/config-cache", () => ({
  getRawConfig: vi.fn().mockResolvedValue(null),
}));

// Mock media-reference
vi.mock("@/lib/server/media-reference", () => ({
  getFeaturedImageUrl: vi.fn().mockReturnValue(null),
}));

// Mock post-access
vi.mock("@/lib/server/post-access", () => ({
  LISTABLE_POST_PUBLISHED_WHERE: { status: "PUBLISHED" },
}));

// Mock prisma
vi.mock("@/lib/server/prisma", () => ({
  default: {
    post: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    page: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    tag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock mdx-config-shared
vi.mock("@/lib/shared/mdx-config-shared", () => ({
  markdownRemarkPlugins: [],
  markdownRehypePlugins: [],
}));

describe("feed-data expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalizeFeedText 扩展边界", () => {
    it("处理全角空格", async () => {
      const { normalizeFeedText } = await import("@/lib/server/feed-data");
      expect(normalizeFeedText("a b")).toBe("a b");
    });

    it("处理连续 HTML 实体", async () => {
      const { normalizeFeedText } = await import("@/lib/server/feed-data");
      expect(normalizeFeedText("&amp;&lt;&gt;")).toBe("&<>");
    });

    it("保留中文字符", async () => {
      const { normalizeFeedText } = await import("@/lib/server/feed-data");
      expect(normalizeFeedText("你好世界")).toBe("你好世界");
    });

    it("处理混合内容", async () => {
      const { normalizeFeedText } = await import("@/lib/server/feed-data");
      const input = '<div class="test">Hello &amp; World</div>';
      expect(normalizeFeedText(input)).toBe("Hello & World");
    });
  });

  describe("stripLeadingMarkdownTitle 扩展", () => {
    it("不处理文档中间的标题", async () => {
      const { stripLeadingMarkdownTitle } = await import(
        "@/lib/server/feed-data"
      );
      const markdown = `Some content

# My Title

More content.`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe(markdown);
    });

    it("处理只有标题没有内容的情况", async () => {
      const { stripLeadingMarkdownTitle } = await import(
        "@/lib/server/feed-data"
      );
      const markdown = `# My Title`;
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      // 标题后面没有换行符时，正则不会匹配，所以返回原内容
      expect(result).toBe("# My Title");
    });

    it("处理 Windows 换行符", async () => {
      const { stripLeadingMarkdownTitle } = await import(
        "@/lib/server/feed-data"
      );
      const markdown = "# My Title\r\n\r\nContent";
      const result = stripLeadingMarkdownTitle(markdown, "My Title");
      expect(result).toBe("Content");
    });
  });

  describe("stripLeadingHtmlTitle 扩展", () => {
    it("不处理 h3 标签", async () => {
      const { stripLeadingHtmlTitle } = await import("@/lib/server/feed-data");
      const html = `<h3>My Title</h3><p>Content</p>`;
      const result = stripLeadingHtmlTitle(html, "My Title");
      expect(result).toBe(html);
    });

    it("处理没有 h1 的 HTML", async () => {
      const { stripLeadingHtmlTitle } = await import("@/lib/server/feed-data");
      const html = `<p>No heading</p>`;
      const result = stripLeadingHtmlTitle(html, "Title");
      expect(result).toBe(html);
    });
  });

  describe("buildFeedLeadHtml 扩展", () => {
    it("包含 feed-lead CSS 类", async () => {
      const { buildFeedLeadHtml } = await import("@/lib/server/feed-data");
      const result = buildFeedLeadHtml("https://example.com/post");
      expect(result).toContain('class="feed-lead"');
    });

    it("URL 正确嵌入 href 属性", async () => {
      const { buildFeedLeadHtml } = await import("@/lib/server/feed-data");
      const url = "https://example.com/posts/hello-world";
      const result = buildFeedLeadHtml(url);
      expect(result).toContain(`href="${url}"`);
    });
  });

  describe("prependFeedLead 扩展", () => {
    it("处理 undefined-like content", async () => {
      const { prependFeedLead } = await import("@/lib/server/feed-data");
      const result = prependFeedLead("", "https://example.com/post");
      expect(result).toContain("前往");
    });

    it("保持正确的顺序", async () => {
      const { prependFeedLead } = await import("@/lib/server/feed-data");
      const result = prependFeedLead("<p>Body</p>", "https://example.com/post");
      expect(result.indexOf("前往")).toBeLessThan(result.indexOf("Body"));
    });
  });

  describe("getFeedData", () => {
    it("当 RSS 未启用时返回空 posts", async () => {
      const { getRawConfig } = await import("@/lib/server/config-cache");
      const mockGetRawConfig = vi.mocked(getRawConfig);

      mockGetRawConfig.mockImplementation(async (key: string) => {
        if (key === "content.rss.enabled")
          return { key, value: { default: false }, updatedAt: new Date() };
        return { key, value: { default: "test" }, updatedAt: new Date() };
      });

      const { getFeedData } = await import("@/lib/server/feed-data");
      const result = await getFeedData();

      expect(result.posts).toEqual([]);
      expect(result.rssConfig.enabled).toBe(false);
    });

    it("当 RSS 启用时查询数据库", async () => {
      const { getRawConfig } = await import("@/lib/server/config-cache");
      const mockGetRawConfig = vi.mocked(getRawConfig);

      mockGetRawConfig.mockImplementation(async (key: string) => {
        const defaults: Record<string, any> = {
          "site.url": { default: "https://example.com" },
          "site.title": { default: "Test Site" },
          "seo.description": { default: "A test site" },
          "author.name": { default: "Test Author" },
          "content.rss.enabled": { default: true },
          "content.rss.postCount": { default: 10 },
          "content.rss.showFullContent": { default: true },
          "content.rss.autoGenerateExcerpt": { default: true },
          "content.rss.maxExcerptLength": { default: 200 },
        };
        return defaults[key]
          ? { key, value: defaults[key], updatedAt: new Date() }
          : null;
      });

      const prisma = (await import("@/lib/server/prisma")).default;
      vi.mocked(prisma.post.findMany).mockResolvedValue([]);
      vi.mocked(prisma.page.findMany).mockResolvedValue([]);
      vi.mocked(prisma.category.findMany).mockResolvedValue([]);
      vi.mocked(prisma.tag.findMany).mockResolvedValue([]);

      const { getFeedData } = await import("@/lib/server/feed-data");
      const result = await getFeedData();

      expect(result.siteConfig.url).toBe("https://example.com");
      expect(result.siteConfig.title).toBe("Test Site");
      expect(result.rssConfig.enabled).toBe(true);
    });
  });

  describe("类型定义验证", () => {
    it("FeedPost 类型应包含必要字段", async () => {
      // 类型检查：确保模块可以正确导入
      const mod = await import("@/lib/server/feed-data");
      expect(mod.normalizeFeedText).toBeDefined();
      expect(mod.stripLeadingMarkdownTitle).toBeDefined();
      expect(mod.stripLeadingHtmlTitle).toBeDefined();
      expect(mod.buildFeedLeadHtml).toBeDefined();
      expect(mod.prependFeedLead).toBeDefined();
      expect(mod.getFeedData).toBeDefined();
    });
  });
});
