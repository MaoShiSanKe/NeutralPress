import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    tag: { findUnique: vi.fn().mockResolvedValue(null) },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    post: { count: vi.fn().mockResolvedValue(0) },
    page: { findMany: vi.fn().mockResolvedValue([]) },
    menu: { findMany: vi.fn().mockResolvedValue([]) },
    config: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => Promise<unknown>) => fn),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
}));

vi.mock("@/lib/server/category-utils", () => ({
  findCategoryByPath: vi.fn().mockResolvedValue(null),
  getAllDescendantIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/server/config-cache", () => ({
  getConfig: vi.fn().mockResolvedValue(null),
  getConfigs: vi.fn().mockResolvedValue([]),
  getRawConfig: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/server/post-access", () => ({
  LISTABLE_POST_PUBLISHED_WHERE: { status: "PUBLISHED" },
}));

vi.mock("@/lib/server/media-reference", () => ({
  getFeaturedImageUrl: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/shared/mdx-config-shared", () => ({
  markdownRemarkPlugins: [],
  markdownRehypePlugins: [],
}));

describe("seo expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStringValue 扩展", () => {
    it("返回空字符串作为默认 fallback", async () => {
      const { getStringValue } = await import("@/lib/server/seo");
      expect(getStringValue(undefined)).toBe("");
    });

    it("返回 false 布尔值的 fallback", async () => {
      const { getStringValue } = await import("@/lib/server/seo");
      expect(getStringValue(false)).toBe("");
    });

    it("返回零值的 fallback", async () => {
      const { getStringValue } = await import("@/lib/server/seo");
      expect(getStringValue(0)).toBe("");
    });
  });

  describe("getStringArrayValue 扩展", () => {
    it("返回空数组的 fallback", async () => {
      const { getStringArrayValue } = await import("@/lib/server/seo");
      expect(getStringArrayValue(undefined)).toEqual([]);
    });

    it("拆分包含空格的逗号分隔字符串", async () => {
      const { getStringArrayValue } = await import("@/lib/server/seo");
      expect(getStringArrayValue(" a , b , c ")).toEqual(["a", "b", "c"]);
    });

    it("处理空字符串", async () => {
      const { getStringArrayValue } = await import("@/lib/server/seo");
      expect(getStringArrayValue("")).toEqual([""]);
    });
  });

  describe("getBooleanValue 扩展", () => {
    it("返回 true 布尔值", async () => {
      const { getBooleanValue } = await import("@/lib/server/seo");
      expect(getBooleanValue(true)).toBe(true);
    });

    it("返回 false 布尔值", async () => {
      const { getBooleanValue } = await import("@/lib/server/seo");
      expect(getBooleanValue(false)).toBe(false);
    });

    it("使用自定义 fallback", async () => {
      const { getBooleanValue } = await import("@/lib/server/seo");
      expect(getBooleanValue(undefined, true)).toBe(true);
    });
  });

  describe("parseMetadataBase 扩展", () => {
    it("返回 undefined 对于空字符串", async () => {
      const { parseMetadataBase } = await import("@/lib/server/seo");
      expect(parseMetadataBase("")).toBeUndefined();
    });

    it("返回 undefined 对于无效 URL", async () => {
      const { parseMetadataBase } = await import("@/lib/server/seo");
      expect(parseMetadataBase("invalid")).toBeUndefined();
    });

    it("解析有效的 HTTPS URL", async () => {
      const { parseMetadataBase } = await import("@/lib/server/seo");
      const result = parseMetadataBase("https://example.com");
      expect(result).toBeInstanceOf(URL);
      expect(result!.hostname).toBe("example.com");
    });

    it("解析带有路径的 URL", async () => {
      const { parseMetadataBase } = await import("@/lib/server/seo");
      const result = parseMetadataBase("https://example.com/blog");
      expect(result!.pathname).toBe("/blog");
    });
  });

  describe("normalizeCanonicalPath 扩展", () => {
    it("返回 / 对于空字符串", async () => {
      const { normalizeCanonicalPath } = await import("@/lib/server/seo");
      expect(normalizeCanonicalPath("")).toBe("/");
    });

    it("返回 / 对于仅空格字符串", async () => {
      const { normalizeCanonicalPath } = await import("@/lib/server/seo");
      expect(normalizeCanonicalPath("   ")).toBe("/");
    });

    it("移除尾部斜杠", async () => {
      const { normalizeCanonicalPath } = await import("@/lib/server/seo");
      expect(normalizeCanonicalPath("/about/")).toBe("/about");
    });

    it("压缩多个斜杠", async () => {
      const { normalizeCanonicalPath } = await import("@/lib/server/seo");
      expect(normalizeCanonicalPath("//about//page")).toBe("/about/page");
    });

    it("移除 /page/1 后缀", async () => {
      const { normalizeCanonicalPath } = await import("@/lib/server/seo");
      expect(normalizeCanonicalPath("/posts/page/1")).toBe("/posts");
    });

    it("不移除 /page/2 后缀", async () => {
      const { normalizeCanonicalPath } = await import("@/lib/server/seo");
      expect(normalizeCanonicalPath("/posts/page/2")).toBe("/posts/page/2");
    });
  });

  describe("normalizePathname 扩展", () => {
    it("返回 undefined 对于 undefined 输入", async () => {
      const { normalizePathname } = await import("@/lib/server/seo");
      expect(normalizePathname(undefined)).toBeUndefined();
    });

    it("返回 undefined 对于空字符串", async () => {
      const { normalizePathname } = await import("@/lib/server/seo");
      expect(normalizePathname("")).toBeUndefined();
    });

    it("返回 undefined 对于仅空格字符串", async () => {
      const { normalizePathname } = await import("@/lib/server/seo");
      expect(normalizePathname("   ")).toBeUndefined();
    });

    it("规范化相对路径", async () => {
      const { normalizePathname } = await import("@/lib/server/seo");
      expect(normalizePathname("about")).toBe("/about");
    });

    it("规范化绝对 URL 的 pathname", async () => {
      const { normalizePathname } = await import("@/lib/server/seo");
      const result = normalizePathname("https://example.com//about//");
      expect(result).toBe("https://example.com/about");
    });
  });

  describe("shouldForceNoIndex 扩展", () => {
    it("返回 false 对于 undefined pathname", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex(undefined)).toBe(false);
    });

    it("返回 true 对于 /admin 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/admin")).toBe(true);
    });

    it("返回 true 对于 /login 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/login")).toBe(true);
    });

    it("返回 true 对于 /register 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/register")).toBe(true);
    });

    it("返回 true 对于 /settings 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/settings")).toBe(true);
    });

    it("返回 true 对于 /messages 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/messages")).toBe(true);
    });

    it("返回 true 对于 /logout 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/logout")).toBe(true);
    });

    it("返回 true 对于 /notifications 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/notifications")).toBe(true);
    });

    it("返回 true 对于 /reauth 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/reauth")).toBe(true);
    });

    it("返回 true 对于 /email-verify 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/email-verify")).toBe(true);
    });

    it("返回 true 对于 /reset-password 路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/reset-password")).toBe(true);
    });

    it("返回 false 对于公开路径", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/posts")).toBe(false);
      expect(shouldForceNoIndex("/about")).toBe(false);
      expect(shouldForceNoIndex("/")).toBe(false);
    });

    it("不匹配部分前缀", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("/administrator")).toBe(false);
      expect(shouldForceNoIndex("/logging")).toBe(false);
    });

    it("处理绝对 URL", async () => {
      const { shouldForceNoIndex } = await import("@/lib/server/seo");
      expect(shouldForceNoIndex("https://example.com/admin")).toBe(true);
      expect(shouldForceNoIndex("https://example.com/posts")).toBe(false);
    });
  });

  describe("shouldEmitJsonLd 扩展", () => {
    it("返回 true 对于公开页面", async () => {
      const { shouldEmitJsonLd } = await import("@/lib/server/seo");
      expect(shouldEmitJsonLd({ pathname: "/posts" })).toBe(true);
    });

    it("返回 false 对于 admin 页面", async () => {
      const { shouldEmitJsonLd } = await import("@/lib/server/seo");
      expect(shouldEmitJsonLd({ pathname: "/admin" })).toBe(false);
    });

    it("返回 false 当 robots 设置为 noindex", async () => {
      const { shouldEmitJsonLd } = await import("@/lib/server/seo");
      expect(
        shouldEmitJsonLd({ robots: { index: false, follow: false } }),
      ).toBe(false);
    });

    it("返回 true 当 robots 允许索引", async () => {
      const { shouldEmitJsonLd } = await import("@/lib/server/seo");
      expect(shouldEmitJsonLd({ robots: { index: true, follow: true } })).toBe(
        true,
      );
    });

    it("返回 false 当 forceNoIndex 为 true", async () => {
      const { shouldEmitJsonLd } = await import("@/lib/server/seo");
      expect(shouldEmitJsonLd({ pathname: "/posts", forceNoIndex: true })).toBe(
        false,
      );
    });

    it("返回 true 对于 undefined pathname", async () => {
      const { shouldEmitJsonLd } = await import("@/lib/server/seo");
      expect(shouldEmitJsonLd({})).toBe(true);
    });
  });

  describe("resolveRobotsNoIndex 扩展", () => {
    it("返回 false 对于 undefined", async () => {
      const { resolveRobotsNoIndex } = await import("@/lib/server/seo");
      expect(resolveRobotsNoIndex(undefined)).toBe(false);
    });

    it("返回 true 对于 noindex 字符串", async () => {
      const { resolveRobotsNoIndex } = await import("@/lib/server/seo");
      expect(resolveRobotsNoIndex("noindex, nofollow")).toBe(true);
    });

    it("返回 false 对于 index 字符串", async () => {
      const { resolveRobotsNoIndex } = await import("@/lib/server/seo");
      expect(resolveRobotsNoIndex("index, follow")).toBe(false);
    });

    it("返回 true 当 index 为 false", async () => {
      const { resolveRobotsNoIndex } = await import("@/lib/server/seo");
      expect(resolveRobotsNoIndex({ index: false, follow: true })).toBe(true);
    });

    it("返回 true 当 googleBot.index 为 false", async () => {
      const { resolveRobotsNoIndex } = await import("@/lib/server/seo");
      expect(
        resolveRobotsNoIndex({ googleBot: { index: false, follow: true } }),
      ).toBe(true);
    });

    it("返回 false 对于空对象", async () => {
      const { resolveRobotsNoIndex } = await import("@/lib/server/seo");
      expect(resolveRobotsNoIndex({})).toBe(false);
    });
  });

  describe("deepMergeMetadataValue 扩展", () => {
    it("返回 override 当 base 不是对象", async () => {
      const { deepMergeMetadataValue } = await import("@/lib/server/seo");
      expect(deepMergeMetadataValue("base", "override")).toBe("override");
    });

    it("返回 base 当 override 是 undefined", async () => {
      const { deepMergeMetadataValue } = await import("@/lib/server/seo");
      expect(deepMergeMetadataValue({ a: 1 }, undefined)).toEqual({ a: 1 });
    });

    it("合并扁平对象", async () => {
      const { deepMergeMetadataValue } = await import("@/lib/server/seo");
      expect(deepMergeMetadataValue({ a: 1 }, { b: 2 })).toEqual({
        a: 1,
        b: 2,
      });
    });

    it("override 覆盖 base", async () => {
      const { deepMergeMetadataValue } = await import("@/lib/server/seo");
      expect(deepMergeMetadataValue({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    });

    it("深度合并嵌套对象", async () => {
      const { deepMergeMetadataValue } = await import("@/lib/server/seo");
      const base = { nested: { a: 1, b: 2 } };
      const override = { nested: { b: 3, c: 4 } };
      expect(deepMergeMetadataValue(base, override)).toEqual({
        nested: { a: 1, b: 3, c: 4 },
      });
    });

    it("数组作为 override 值时直接替换", async () => {
      const { deepMergeMetadataValue } = await import("@/lib/server/seo");
      expect(deepMergeMetadataValue({ a: [1] }, { a: [2, 3] })).toEqual({
        a: [2, 3],
      });
    });
  });

  describe("mergeMetadata 扩展", () => {
    it("合并简单覆盖", async () => {
      const { mergeMetadata } = await import("@/lib/server/seo");
      const base = { title: "Base", description: "Base Desc" };
      const overrides = { description: "Override Desc" };
      const result = mergeMetadata(base, overrides);
      expect(result.title).toBe("Base");
      expect(result.description).toBe("Override Desc");
    });

    it("深度合并 openGraph", async () => {
      const { mergeMetadata } = await import("@/lib/server/seo");
      const base = { openGraph: { title: "OG", type: "website" as const } };
      const overrides = { openGraph: { description: "OG Desc" } };
      const result = mergeMetadata(base, overrides);
      expect(result.openGraph).toEqual({
        title: "OG",
        type: "website",
        description: "OG Desc",
      });
    });

    it("深度合并 twitter", async () => {
      const { mergeMetadata } = await import("@/lib/server/seo");
      const base = { twitter: { card: "summary" as const, site: "@site" } };
      const overrides = { twitter: { title: "Tweet" } };
      const result = mergeMetadata(base, overrides);
      expect(result.twitter).toEqual({
        card: "summary",
        site: "@site",
        title: "Tweet",
      });
    });

    it("深度合并 robots", async () => {
      const { mergeMetadata } = await import("@/lib/server/seo");
      const base = { robots: { index: true, follow: true } };
      const overrides = { robots: { nocache: true } };
      const result = mergeMetadata(base, overrides);
      expect(result.robots).toEqual({
        index: true,
        follow: true,
        nocache: true,
      });
    });

    it("保留 base 值当没有覆盖", async () => {
      const { mergeMetadata } = await import("@/lib/server/seo");
      const base = { title: "Title", description: "Desc", keywords: ["test"] };
      const result = mergeMetadata(base, {});
      expect(result).toEqual(base);
    });
  });

  describe("parseTitleTemplate 扩展", () => {
    it("替换 {title} 占位符", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(parseTitleTemplate("{title}", "My Site")).toBe("My Site");
    });

    it("替换 {pageTitle} 占位符", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(
        parseTitleTemplate(
          "{pageTitle} | {title}",
          "My Site",
          undefined,
          "Post",
        ),
      ).toBe("Post | My Site");
    });

    it("替换 {subtitle} 占位符", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(
        parseTitleTemplate("{title} - {subtitle}", "My Site", "Blog"),
      ).toBe("My Site - Blog");
    });

    it("当 subtitle 为空时移除可选部分", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(parseTitleTemplate("{title} (- {subtitle})", "My Site", "")).toBe(
        "My Site",
      );
    });

    it("当 subtitle 存在时保留可选部分", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(
        parseTitleTemplate("{title} (- {subtitle})", "My Site", "Blog"),
      ).toBe("My Site - Blog");
    });

    it("清理尾部管道符", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(parseTitleTemplate("{pageTitle} | {title}", "My Site")).toBe(
        "My Site",
      );
    });

    it("处理空模板", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(parseTitleTemplate("", "Site")).toBe("");
    });

    it("处理没有占位符的模板", async () => {
      const { parseTitleTemplate } = await import("@/lib/server/seo");
      expect(parseTitleTemplate("Static Title", "Site")).toBe("Static Title");
    });
  });

  describe("normalizeKeywordList 扩展", () => {
    it("返回空数组对于 null", async () => {
      const { normalizeKeywordList } = await import("@/lib/server/seo");
      expect(normalizeKeywordList(null)).toEqual([]);
    });

    it("返回空数组对于 undefined", async () => {
      const { normalizeKeywordList } = await import("@/lib/server/seo");
      expect(normalizeKeywordList(undefined)).toEqual([]);
    });

    it("修剪和过滤数组关键词", async () => {
      const { normalizeKeywordList } = await import("@/lib/server/seo");
      expect(normalizeKeywordList([" hello ", "", " world "])).toEqual([
        "hello",
        "world",
      ]);
    });

    it("拆分逗号分隔字符串", async () => {
      const { normalizeKeywordList } = await import("@/lib/server/seo");
      expect(normalizeKeywordList("hello,world,test")).toEqual([
        "hello",
        "world",
        "test",
      ]);
    });

    it("过滤空字符串", async () => {
      const { normalizeKeywordList } = await import("@/lib/server/seo");
      expect(normalizeKeywordList("hello,,world")).toEqual(["hello", "world"]);
    });
  });

  describe("normalizeDateValue 扩展", () => {
    it("返回 null 对于 null", async () => {
      const { normalizeDateValue } = await import("@/lib/server/seo");
      expect(normalizeDateValue(null)).toBeNull();
    });

    it("返回 null 对于 undefined", async () => {
      const { normalizeDateValue } = await import("@/lib/server/seo");
      expect(normalizeDateValue(undefined)).toBeNull();
    });

    it("转换 Date 为 ISO 字符串", async () => {
      const { normalizeDateValue } = await import("@/lib/server/seo");
      const date = new Date("2024-01-15T12:00:00Z");
      expect(normalizeDateValue(date)).toBe("2024-01-15T12:00:00.000Z");
    });

    it("转换日期字符串为 ISO 字符串", async () => {
      const { normalizeDateValue } = await import("@/lib/server/seo");
      expect(normalizeDateValue("2024-01-15T12:00:00Z")).toBe(
        "2024-01-15T12:00:00.000Z",
      );
    });

    it("返回 null 对于无效日期字符串", async () => {
      const { normalizeDateValue } = await import("@/lib/server/seo");
      expect(normalizeDateValue("not-a-date")).toBeNull();
    });
  });

  describe("interpolatePageTemplate 扩展", () => {
    it("替换单个占位符", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(interpolatePageTemplate("Hello {name}", { name: "World" })).toBe(
        "Hello World",
      );
    });

    it("替换多个占位符", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(
        interpolatePageTemplate("{greeting} {name}!", {
          greeting: "Hello",
          name: "World",
        }),
      ).toBe("Hello World!");
    });

    it("当数据中缺少 key 时保留占位符", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(interpolatePageTemplate("Hello {name}", {})).toBe("Hello {name}");
    });

    it("处理 null/undefined 值", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(interpolatePageTemplate("Hello {name}", { name: null })).toBe(
        "Hello ",
      );
      expect(interpolatePageTemplate("Hello {name}", { name: undefined })).toBe(
        "Hello ",
      );
    });

    it("将数字值转换为字符串", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(
        interpolatePageTemplate("Page {page} of {total}", {
          page: 1,
          total: 10,
        }),
      ).toBe("Page 1 of 10");
    });

    it("处理重复占位符", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(
        interpolatePageTemplate("{tag} and {tag}", { tag: "JavaScript" }),
      ).toBe("JavaScript and JavaScript");
    });

    it("空模板返回空字符串", async () => {
      const { interpolatePageTemplate } = await import("@/lib/server/seo");
      expect(interpolatePageTemplate("", { name: "test" })).toBe("");
    });
  });

  describe("serializeJsonLdGraph 扩展", () => {
    it("空图返回空字符串", async () => {
      const { serializeJsonLdGraph } = await import("@/lib/server/seo");
      expect(serializeJsonLdGraph([])).toBe("");
    });

    it("单节点不使用 @graph 包装", async () => {
      const { serializeJsonLdGraph } = await import("@/lib/server/seo");
      const graph = [{ "@type": "WebSite", name: "Test" }];
      const result = JSON.parse(serializeJsonLdGraph(graph));
      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@type"]).toBe("WebSite");
      expect(result["@graph"]).toBeUndefined();
    });

    it("多节点使用 @graph 包装", async () => {
      const { serializeJsonLdGraph } = await import("@/lib/server/seo");
      const graph = [
        { "@type": "WebSite", name: "Site" },
        { "@type": "Organization", name: "Org" },
      ];
      const result = JSON.parse(serializeJsonLdGraph(graph));
      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@graph"]).toHaveLength(2);
    });

    it("转义 HTML 防止 XSS", async () => {
      const { serializeJsonLdGraph } = await import("@/lib/server/seo");
      const graph = [{ "@type": "Thing", name: "<script>alert(1)</script>" }];
      const serialized = serializeJsonLdGraph(graph);
      expect(serialized).not.toContain("<script>");
    });
  });

  describe("buildMainMenuJsonLdBreadcrumb 扩展", () => {
    it("空菜单返回首页面包屑", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const result = buildMainMenuJsonLdBreadcrumb([]);
      expect(result).toEqual([{ name: "首页", item: "/" }]);
    });

    it("undefined 菜单返回首页面包屑", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const result = buildMainMenuJsonLdBreadcrumb(undefined);
      expect(result).toEqual([{ name: "首页", item: "/" }]);
    });

    it("从菜单构建面包屑", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        { name: "About", slug: "about", link: null, page: null },
        { name: "Blog", slug: "blog", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: "首页", item: "/" });
      expect(result[1]).toEqual({ name: "About", item: "/about" });
      expect(result[2]).toEqual({ name: "Blog", item: "/blog" });
    });

    it("跳过外部链接", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        {
          name: "External",
          slug: null,
          link: "https://example.com",
          page: null,
        },
        { name: "Internal", slug: "internal", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2);
      expect(result[1]!.name).toBe("Internal");
    });

    it("跳过 hash 链接", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        { name: "Anchor", slug: null, link: "#section", page: null },
        { name: "Page", slug: "page", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2);
    });

    it("跳过空名称", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        { name: "", slug: "empty", link: null, page: null },
        { name: "Valid", slug: "valid", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2);
    });

    it("去重路径", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        { name: "First", slug: "about", link: null, page: null },
        { name: "Second", slug: "about", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2);
    });

    it("尊重 maxItems 选项", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        { name: "A", slug: "a", link: null, page: null },
        { name: "B", slug: "b", link: null, page: null },
        { name: "C", slug: "c", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus, { maxItems: 2 });
      expect(result).toHaveLength(2);
    });

    it("使用自定义 homeName", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const result = buildMainMenuJsonLdBreadcrumb([], { homeName: "Home" });
      expect(result[0]!.name).toBe("Home");
    });

    it("修剪菜单名称空格", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        { name: "  About  ", slug: "about", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result[1]!.name).toBe("About");
    });

    it("优先使用 page.slug 而非 menu.slug", async () => {
      const { buildMainMenuJsonLdBreadcrumb } = await import(
        "@/lib/server/seo"
      );
      const menus = [
        {
          name: "About",
          slug: "menu-slug",
          link: null,
          page: { slug: "page-slug" },
        },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result[1]!.item).toBe("/page-slug");
    });
  });

  describe("buildAbsoluteUrl 扩展", () => {
    const metadataBase = new URL("https://example.com");

    it("从相对路径构建绝对 URL", async () => {
      const { buildAbsoluteUrl } = await import("@/lib/server/seo");
      expect(buildAbsoluteUrl("/about", metadataBase)).toBe(
        "https://example.com/about",
      );
    });

    it("返回 undefined 对于 undefined pathname", async () => {
      const { buildAbsoluteUrl } = await import("@/lib/server/seo");
      expect(buildAbsoluteUrl(undefined, metadataBase)).toBeUndefined();
    });

    it("处理绝对 URL 输入", async () => {
      const { buildAbsoluteUrl } = await import("@/lib/server/seo");
      expect(buildAbsoluteUrl("https://other.com/page", metadataBase)).toBe(
        "https://other.com/page",
      );
    });

    it("当 metadataBase 为 undefined 时返回 undefined", async () => {
      const { buildAbsoluteUrl } = await import("@/lib/server/seo");
      expect(buildAbsoluteUrl("/about", undefined)).toBeUndefined();
    });

    it("返回 undefined 对于空 pathname", async () => {
      const { buildAbsoluteUrl } = await import("@/lib/server/seo");
      expect(buildAbsoluteUrl("", metadataBase)).toBeUndefined();
    });
  });
});
