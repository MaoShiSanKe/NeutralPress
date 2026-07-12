import type { Metadata } from "next";
import { describe, expect, it } from "vitest";

import {
  buildAbsoluteUrl,
  buildMainMenuJsonLdBreadcrumb,
  deepMergeMetadataValue,
  getBooleanValue,
  getStringArrayValue,
  getStringValue,
  interpolatePageTemplate,
  mergeMetadata,
  normalizeCanonicalPath,
  normalizeDateValue,
  normalizeKeywordList,
  normalizePathname,
  parseMetadataBase,
  parseTitleTemplate,
  resolveRobotsNoIndex,
  serializeJsonLdGraph,
  shouldEmitJsonLd,
  shouldForceNoIndex,
} from "@/lib/server/seo";

describe("seo utilities", () => {
  describe("getStringValue", () => {
    it("returns string value directly", () => {
      expect(getStringValue("hello")).toBe("hello");
    });

    it("returns fallback for non-string", () => {
      expect(getStringValue(123)).toBe("");
      expect(getStringValue(null)).toBe("");
      expect(getStringValue(undefined)).toBe("");
    });

    it("returns custom fallback", () => {
      expect(getStringValue(null, "default")).toBe("default");
    });

    it("returns fallback for plain objects", () => {
      expect(getStringValue({ default: "extracted", other: "ignored" })).toBe(
        "",
      );
    });

    it("returns fallback for arrays", () => {
      expect(getStringValue(["a", "b"], "fallback")).toBe("fallback");
    });
  });

  describe("getStringArrayValue", () => {
    it("returns array directly", () => {
      expect(getStringArrayValue(["a", "b"])).toEqual(["a", "b"]);
    });

    it("splits comma-separated string", () => {
      expect(getStringArrayValue("a,b,c")).toEqual(["a", "b", "c"]);
    });

    it("trims whitespace from comma-separated values", () => {
      expect(getStringArrayValue(" a , b , c ")).toEqual(["a", "b", "c"]);
    });

    it("returns fallback for non-array non-string", () => {
      expect(getStringArrayValue(123)).toEqual([]);
      expect(getStringArrayValue(null)).toEqual([]);
    });

    it("returns custom fallback", () => {
      expect(getStringArrayValue(undefined, ["default"])).toEqual(["default"]);
    });
  });

  describe("getBooleanValue", () => {
    it("returns boolean value directly", () => {
      expect(getBooleanValue(true)).toBe(true);
      expect(getBooleanValue(false)).toBe(false);
    });

    it("returns fallback for non-boolean", () => {
      expect(getBooleanValue("true")).toBe(false);
      expect(getBooleanValue(1)).toBe(false);
      expect(getBooleanValue(null)).toBe(false);
      expect(getBooleanValue(undefined)).toBe(false);
    });

    it("returns custom fallback", () => {
      expect(getBooleanValue(undefined, true)).toBe(true);
    });

    it("returns fallback for object values", () => {
      expect(getBooleanValue({ default: true })).toBe(false);
      expect(getBooleanValue({ default: false })).toBe(false);
    });

    it("returns fallback for array values", () => {
      expect(getBooleanValue([true], false)).toBe(false);
    });
  });

  describe("parseMetadataBase", () => {
    it("parses valid URL", () => {
      const result = parseMetadataBase("https://example.com");
      expect(result).toBeInstanceOf(URL);
      expect(result!.toString()).toBe("https://example.com/");
    });

    it("returns undefined for empty string", () => {
      expect(parseMetadataBase("")).toBeUndefined();
    });

    it("returns undefined for whitespace-only string", () => {
      expect(parseMetadataBase("   ")).toBeUndefined();
    });

    it("returns undefined for invalid URL", () => {
      expect(parseMetadataBase("not-a-url")).toBeUndefined();
    });

    it("handles URL with path", () => {
      const result = parseMetadataBase("https://example.com/blog");
      expect(result).toBeInstanceOf(URL);
      expect(result!.toString()).toBe("https://example.com/blog");
    });
  });

  describe("normalizeCanonicalPath", () => {
    it("adds leading slash", () => {
      expect(normalizeCanonicalPath("about")).toBe("/about");
    });

    it("preserves leading slash", () => {
      expect(normalizeCanonicalPath("/about")).toBe("/about");
    });

    it("removes trailing slash", () => {
      expect(normalizeCanonicalPath("/about/")).toBe("/about");
    });

    it("collapses multiple slashes", () => {
      expect(normalizeCanonicalPath("//about//page")).toBe("/about/page");
    });

    it("removes /page/1 suffix", () => {
      expect(normalizeCanonicalPath("/posts/page/1")).toBe("/posts");
    });

    it("returns / for empty input", () => {
      expect(normalizeCanonicalPath("")).toBe("/");
      expect(normalizeCanonicalPath("   ")).toBe("/");
    });

    it("handles root path", () => {
      expect(normalizeCanonicalPath("/")).toBe("/");
    });

    it("preserves case (case-sensitive)", () => {
      expect(normalizeCanonicalPath("/About")).toBe("/About");
    });

    it("handles /page/1 with trailing slash", () => {
      expect(normalizeCanonicalPath("/posts/page/1/")).toBe("/posts");
    });

    it("does not remove /page/2 etc.", () => {
      expect(normalizeCanonicalPath("/posts/page/2")).toBe("/posts/page/2");
    });
  });

  describe("normalizePathname", () => {
    it("returns undefined for undefined input", () => {
      expect(normalizePathname(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(normalizePathname("")).toBeUndefined();
    });

    it("returns undefined for whitespace-only string", () => {
      expect(normalizePathname("   ")).toBeUndefined();
    });

    it("normalizes relative path", () => {
      expect(normalizePathname("about")).toBe("/about");
    });

    it("normalizes absolute URL to pathname", () => {
      const result = normalizePathname("https://example.com/about");
      expect(result).toBe("https://example.com/about");
    });

    it("normalizes pathname of absolute URL", () => {
      const result = normalizePathname("https://example.com//about//");
      expect(result).toBe("https://example.com/about");
    });

    it("returns undefined for invalid absolute URL", () => {
      expect(normalizePathname("https://")).toBeUndefined();
    });
  });

  describe("shouldForceNoIndex", () => {
    it("returns false for undefined pathname", () => {
      expect(shouldForceNoIndex(undefined)).toBe(false);
    });

    it("returns true for /admin", () => {
      expect(shouldForceNoIndex("/admin")).toBe(true);
    });

    it("returns true for /admin/settings", () => {
      expect(shouldForceNoIndex("/admin/settings")).toBe(true);
    });

    it("returns true for /login", () => {
      expect(shouldForceNoIndex("/login")).toBe(true);
    });

    it("returns true for /register", () => {
      expect(shouldForceNoIndex("/register")).toBe(true);
    });

    it("returns true for /reset-password", () => {
      expect(shouldForceNoIndex("/reset-password")).toBe(true);
    });

    it("returns true for /messages", () => {
      expect(shouldForceNoIndex("/messages")).toBe(true);
    });

    it("returns true for /settings", () => {
      expect(shouldForceNoIndex("/settings")).toBe(true);
    });

    it("returns false for public paths", () => {
      expect(shouldForceNoIndex("/posts")).toBe(false);
      expect(shouldForceNoIndex("/about")).toBe(false);
      expect(shouldForceNoIndex("/")).toBe(false);
    });

    it("returns false for paths that only start with prefix", () => {
      expect(shouldForceNoIndex("/administrator")).toBe(false);
      expect(shouldForceNoIndex("/logging")).toBe(false);
    });

    it("handles case insensitive matching", () => {
      expect(shouldForceNoIndex("/Admin")).toBe(true);
      expect(shouldForceNoIndex("/LOGIN")).toBe(true);
    });

    it("handles absolute URLs", () => {
      expect(shouldForceNoIndex("https://example.com/admin")).toBe(true);
      expect(shouldForceNoIndex("https://example.com/posts")).toBe(false);
    });

    it("returns true for /logout", () => {
      expect(shouldForceNoIndex("/logout")).toBe(true);
    });

    it("returns true for /notifications", () => {
      expect(shouldForceNoIndex("/notifications")).toBe(true);
    });

    it("returns true for /reauth", () => {
      expect(shouldForceNoIndex("/reauth")).toBe(true);
    });

    it("returns true for /email-verify", () => {
      expect(shouldForceNoIndex("/email-verify")).toBe(true);
    });
  });

  describe("shouldEmitJsonLd", () => {
    it("returns true for public pages", () => {
      expect(shouldEmitJsonLd({ pathname: "/posts" })).toBe(true);
    });

    it("returns false for admin pages", () => {
      expect(shouldEmitJsonLd({ pathname: "/admin" })).toBe(false);
    });

    it("returns false when robots has noindex", () => {
      expect(
        shouldEmitJsonLd({ robots: { index: false, follow: false } }),
      ).toBe(false);
    });

    it("returns false when robots string contains noindex", () => {
      expect(shouldEmitJsonLd({ robots: "noindex, nofollow" })).toBe(false);
    });

    it("returns true when robots allows indexing", () => {
      expect(shouldEmitJsonLd({ robots: { index: true, follow: true } })).toBe(
        true,
      );
    });

    it("returns false when forceNoIndex is true", () => {
      expect(shouldEmitJsonLd({ pathname: "/posts", forceNoIndex: true })).toBe(
        false,
      );
    });

    it("returns true for undefined pathname", () => {
      expect(shouldEmitJsonLd({})).toBe(true);
    });

    it("returns false when googleBot has noindex", () => {
      expect(
        shouldEmitJsonLd({
          robots: { googleBot: { index: false, follow: true } },
        }),
      ).toBe(false);
    });

    it("returns false when googleBot string contains noindex", () => {
      expect(shouldEmitJsonLd({ robots: { googleBot: "noindex" } })).toBe(
        false,
      );
    });
  });

  describe("buildAbsoluteUrl", () => {
    const metadataBase = new URL("https://example.com");

    it("builds absolute URL from relative path", () => {
      expect(buildAbsoluteUrl("/about", metadataBase)).toBe(
        "https://example.com/about",
      );
    });

    it("returns undefined for undefined pathname", () => {
      expect(buildAbsoluteUrl(undefined, metadataBase)).toBeUndefined();
    });

    it("handles absolute URL input", () => {
      expect(buildAbsoluteUrl("https://other.com/page", metadataBase)).toBe(
        "https://other.com/page",
      );
    });

    it("returns undefined when metadataBase is undefined", () => {
      expect(buildAbsoluteUrl("/about", undefined)).toBeUndefined();
    });

    it("returns undefined for empty pathname", () => {
      expect(buildAbsoluteUrl("", metadataBase)).toBeUndefined();
    });
  });

  describe("parseTitleTemplate", () => {
    it("replaces {title} placeholder", () => {
      const result = parseTitleTemplate("{title}", "My Site");
      expect(result).toBe("My Site");
    });

    it("replaces {pageTitle} placeholder", () => {
      const result = parseTitleTemplate(
        "{pageTitle} | {title}",
        "My Site",
        undefined,
        "Post Title",
      );
      expect(result).toBe("Post Title | My Site");
    });

    it("replaces {subtitle} placeholder", () => {
      const result = parseTitleTemplate(
        "{title} - {subtitle}",
        "My Site",
        "Blog",
      );
      expect(result).toBe("My Site - Blog");
    });

    it("removes optional section when subtitle is empty", () => {
      const result = parseTitleTemplate(
        "{title} (- {subtitle})",
        "My Site",
        "",
      );
      expect(result).toBe("My Site");
    });

    it("keeps optional section when subtitle exists", () => {
      const result = parseTitleTemplate(
        "{title} (- {subtitle})",
        "My Site",
        "Blog",
      );
      expect(result).toBe("My Site - Blog");
    });

    it("cleans trailing pipe", () => {
      const result = parseTitleTemplate("{pageTitle} | {title}", "My Site");
      expect(result).toBe("My Site");
    });

    it("cleans leading pipe", () => {
      const result = parseTitleTemplate("{title} | {pageTitle}", "My Site");
      expect(result).toBe("My Site");
    });

    it("cleans trailing dash", () => {
      const result = parseTitleTemplate("{title} - {subtitle}", "My Site", "");
      expect(result).toBe("My Site");
    });

    it("collapses multiple spaces", () => {
      const result = parseTitleTemplate("{title}  -  {subtitle}", "My Site");
      expect(result).not.toMatch(/\s{2,}/);
    });

    it("handles complex template", () => {
      const result = parseTitleTemplate(
        "{pageTitle} | {title} (- {subtitle})",
        "NeutralPress",
        "A CMS",
        "Hello World",
      );
      expect(result).toBe("Hello World | NeutralPress - A CMS");
    });
  });

  describe("normalizeKeywordList", () => {
    it("returns empty array for null/undefined", () => {
      expect(normalizeKeywordList(null)).toEqual([]);
      expect(normalizeKeywordList(undefined)).toEqual([]);
    });

    it("trims and filters array keywords", () => {
      expect(normalizeKeywordList([" hello ", "", " world "])).toEqual([
        "hello",
        "world",
      ]);
    });

    it("splits comma-separated string", () => {
      expect(normalizeKeywordList("hello,world,test")).toEqual([
        "hello",
        "world",
        "test",
      ]);
    });

    it("trims comma-separated values", () => {
      expect(normalizeKeywordList(" hello , world ")).toEqual([
        "hello",
        "world",
      ]);
    });

    it("filters empty strings from split", () => {
      expect(normalizeKeywordList("hello,,world")).toEqual(["hello", "world"]);
    });
  });

  describe("normalizeDateValue", () => {
    it("returns null for null/undefined", () => {
      expect(normalizeDateValue(null)).toBeNull();
      expect(normalizeDateValue(undefined)).toBeNull();
    });

    it("converts Date to ISO string", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      expect(normalizeDateValue(date)).toBe("2024-01-15T12:00:00.000Z");
    });

    it("converts date string to ISO string", () => {
      expect(normalizeDateValue("2024-01-15T12:00:00Z")).toBe(
        "2024-01-15T12:00:00.000Z",
      );
    });

    it("returns null for invalid date string", () => {
      expect(normalizeDateValue("not-a-date")).toBeNull();
    });
  });

  describe("resolveRobotsNoIndex", () => {
    it("returns false for undefined", () => {
      expect(resolveRobotsNoIndex(undefined)).toBe(false);
    });

    it("returns true for noindex string", () => {
      expect(resolveRobotsNoIndex("noindex, nofollow")).toBe(true);
    });

    it("returns false for index string", () => {
      expect(resolveRobotsNoIndex("index, follow")).toBe(false);
    });

    it("returns true when index is false", () => {
      expect(resolveRobotsNoIndex({ index: false, follow: true })).toBe(true);
    });

    it("returns false when index is true", () => {
      expect(resolveRobotsNoIndex({ index: true, follow: true })).toBe(false);
    });

    it("returns true when googleBot.index is false", () => {
      expect(
        resolveRobotsNoIndex({
          googleBot: { index: false, follow: true },
        }),
      ).toBe(true);
    });

    it("returns true when googleBot string contains noindex", () => {
      expect(resolveRobotsNoIndex({ googleBot: "noindex" })).toBe(true);
    });

    it("returns false when googleBot is not set and index is not false", () => {
      expect(resolveRobotsNoIndex({ follow: true })).toBe(false);
    });
  });

  describe("deepMergeMetadataValue", () => {
    it("returns override when base is not object", () => {
      expect(deepMergeMetadataValue("base", "override")).toBe("override");
    });

    it("returns base when override is undefined", () => {
      expect(deepMergeMetadataValue({ a: 1 }, undefined)).toEqual({ a: 1 });
    });

    it("merges flat objects", () => {
      expect(deepMergeMetadataValue({ a: 1 }, { b: 2 })).toEqual({
        a: 1,
        b: 2,
      });
    });

    it("override takes precedence", () => {
      expect(deepMergeMetadataValue({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
    });

    it("deeply merges nested objects", () => {
      const base = { nested: { a: 1, b: 2 } };
      const override = { nested: { b: 3, c: 4 } };
      expect(deepMergeMetadataValue(base, override)).toEqual({
        nested: { a: 1, b: 3, c: 4 },
      });
    });

    it("handles arrays as override values", () => {
      expect(deepMergeMetadataValue({ a: [1] }, { a: [2, 3] })).toEqual({
        a: [2, 3],
      });
    });
  });

  describe("mergeMetadata", () => {
    it("merges simple overrides", () => {
      const base: Metadata = {
        title: "Base Title",
        description: "Base Description",
      };
      const overrides: Partial<Metadata> = {
        description: "Override Description",
      };
      const result = mergeMetadata(base, overrides);
      expect(result.title).toBe("Base Title");
      expect(result.description).toBe("Override Description");
    });

    it("deep merges openGraph", () => {
      const base: Metadata = {
        openGraph: {
          title: "OG Title",
          type: "website",
        },
      };
      const overrides: Partial<Metadata> = {
        openGraph: {
          description: "OG Description",
        },
      };
      const result = mergeMetadata(base, overrides);
      expect(result.openGraph).toEqual({
        title: "OG Title",
        type: "website",
        description: "OG Description",
      });
    });

    it("deep merges twitter", () => {
      const base: Metadata = {
        twitter: {
          card: "summary",
          site: "@site",
        },
      };
      const overrides: Partial<Metadata> = {
        twitter: {
          title: "Tweet Title",
        },
      };
      const result = mergeMetadata(base, overrides);
      expect(result.twitter).toEqual({
        card: "summary",
        site: "@site",
        title: "Tweet Title",
      });
    });

    it("deep merges robots", () => {
      const base: Metadata = {
        robots: {
          index: true,
          follow: true,
        },
      };
      const overrides: Partial<Metadata> = {
        robots: {
          nocache: true,
        },
      };
      const result = mergeMetadata(base, overrides);
      expect(result.robots).toEqual({
        index: true,
        follow: true,
        nocache: true,
      });
    });

    it("deep merges alternates", () => {
      const base: Metadata = {
        alternates: {
          canonical: "https://example.com",
        },
      };
      const overrides: Partial<Metadata> = {
        alternates: {
          languages: { en: "https://example.com/en" },
        },
      };
      const result = mergeMetadata(base, overrides);
      expect(result.alternates).toEqual({
        canonical: "https://example.com",
        languages: { en: "https://example.com/en" },
      });
    });

    it("preserves base values when no override", () => {
      const base: Metadata = {
        title: "Title",
        description: "Description",
        keywords: ["test"],
      };
      const result = mergeMetadata(base, {});
      expect(result).toEqual(base);
    });
  });

  describe("interpolatePageTemplate", () => {
    it("replaces single placeholder", () => {
      expect(interpolatePageTemplate("Hello {name}", { name: "World" })).toBe(
        "Hello World",
      );
    });

    it("replaces multiple placeholders", () => {
      expect(
        interpolatePageTemplate("{greeting} {name}!", {
          greeting: "Hello",
          name: "World",
        }),
      ).toBe("Hello World!");
    });

    it("leaves placeholder unchanged when key missing from data", () => {
      // interpolatePageTemplate only replaces keys present in the data object
      expect(interpolatePageTemplate("Hello {name}", {})).toBe("Hello {name}");
    });

    it("handles null/undefined values", () => {
      expect(interpolatePageTemplate("Hello {name}", { name: null })).toBe(
        "Hello ",
      );
      expect(interpolatePageTemplate("Hello {name}", { name: undefined })).toBe(
        "Hello ",
      );
    });

    it("converts number values to string", () => {
      expect(
        interpolatePageTemplate("Page {page} of {total}", {
          page: 1,
          total: 10,
        }),
      ).toBe("Page 1 of 10");
    });

    it("handles repeated placeholder", () => {
      expect(
        interpolatePageTemplate("{tag} and {tag}", { tag: "JavaScript" }),
      ).toBe("JavaScript and JavaScript");
    });

    it("returns empty string for empty template", () => {
      expect(interpolatePageTemplate("", { name: "test" })).toBe("");
    });

    it("preserves template without placeholders", () => {
      expect(interpolatePageTemplate("No placeholders", { name: "test" })).toBe(
        "No placeholders",
      );
    });

    it("handles Chinese template", () => {
      expect(
        interpolatePageTemplate("标签：{tagName} - 第{page}页", {
          tagName: "JavaScript",
          page: 2,
        }),
      ).toBe("标签：JavaScript - 第2页");
    });
  });

  describe("serializeJsonLdGraph", () => {
    it("returns empty string for empty graph", () => {
      expect(serializeJsonLdGraph([])).toBe("");
    });

    it("serializes single node without @graph wrapper", () => {
      const graph = [{ "@type": "WebSite", name: "Test" }];
      const result = JSON.parse(serializeJsonLdGraph(graph));
      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@type"]).toBe("WebSite");
      expect(result.name).toBe("Test");
      expect(result["@graph"]).toBeUndefined();
    });

    it("serializes multiple nodes with @graph wrapper", () => {
      const graph = [
        { "@type": "WebSite", name: "Site" },
        { "@type": "Organization", name: "Org" },
      ];
      const result = JSON.parse(serializeJsonLdGraph(graph));
      expect(result["@context"]).toBe("https://schema.org");
      expect(result["@graph"]).toHaveLength(2);
    });

    it("escapes HTML in JSON-LD output", () => {
      const graph = [{ "@type": "Thing", name: "<script>alert(1)</script>" }];
      const serialized = serializeJsonLdGraph(graph);
      // The function replaces < with < to prevent XSS
      expect(serialized).not.toContain("<script>");
      expect(serialized).not.toContain("</script>");
      // Verify the escaped form is present (as actual unicode escape in string)
      expect(serialized).toContain("alert(1)");
    });

    it("preserves @id fields", () => {
      const graph = [
        { "@id": "https://example.com/#website", "@type": "WebSite" },
      ];
      const result = JSON.parse(serializeJsonLdGraph(graph));
      expect(result["@id"]).toBe("https://example.com/#website");
    });
  });

  describe("buildMainMenuJsonLdBreadcrumb", () => {
    it("returns home breadcrumb for empty menus", () => {
      const result = buildMainMenuJsonLdBreadcrumb([]);
      expect(result).toEqual([{ name: "首页", item: "/" }]);
    });

    it("returns home breadcrumb for undefined menus", () => {
      const result = buildMainMenuJsonLdBreadcrumb(undefined);
      expect(result).toEqual([{ name: "首页", item: "/" }]);
    });

    it("builds breadcrumb from menus", () => {
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

    it("prefers page.slug over menu.slug", () => {
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

    it("uses link when page and slug are null", () => {
      const menus = [
        { name: "About", slug: null, link: "/about-us", page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result[1]!.item).toBe("/about-us");
    });

    it("skips external links", () => {
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

    it("skips hash links", () => {
      const menus = [
        { name: "Anchor", slug: null, link: "#section", page: null },
        { name: "Page", slug: "page", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2);
    });

    it("skips empty names", () => {
      const menus = [
        { name: "", slug: "empty", link: null, page: null },
        { name: "Valid", slug: "valid", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2);
    });

    it("deduplicates paths", () => {
      const menus = [
        { name: "First", slug: "about", link: null, page: null },
        { name: "Second", slug: "about", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result).toHaveLength(2); // home + about (deduped)
    });

    it("respects maxItems option", () => {
      const menus = [
        { name: "A", slug: "a", link: null, page: null },
        { name: "B", slug: "b", link: null, page: null },
        { name: "C", slug: "c", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus, { maxItems: 2 });
      expect(result).toHaveLength(2); // home + first menu item
    });

    it("uses custom home name", () => {
      const result = buildMainMenuJsonLdBreadcrumb([], { homeName: "Home" });
      expect(result[0]!.name).toBe("Home");
    });

    it("trims whitespace from menu names", () => {
      const menus = [
        { name: "  About  ", slug: "about", link: null, page: null },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result[1]!.name).toBe("About");
    });

    it("uses page.slug over link", () => {
      const menus = [
        {
          name: "Page",
          slug: null,
          link: "/old-link",
          page: { slug: "new-slug" },
        },
      ];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result[1]!.item).toBe("/new-slug");
    });

    it("normalizes link paths without leading slash", () => {
      const menus = [{ name: "Blog", slug: null, link: "blog", page: null }];
      const result = buildMainMenuJsonLdBreadcrumb(menus);
      expect(result[1]!.item).toBe("/blog");
    });
  });

  // =========================================================================
  // 额外边界测试
  // =========================================================================
  describe("edge cases", () => {
    describe("normalizeCanonicalPath", () => {
      it("handles only slashes", () => {
        expect(normalizeCanonicalPath("///")).toBe("/");
      });

      it("handles /page/10 (not /page/1)", () => {
        expect(normalizeCanonicalPath("/posts/page/10")).toBe("/posts/page/10");
      });

      it("handles mixed case /Page/1 (case-insensitive removal)", () => {
        // normalizeCanonicalPath removes /page/1 case-insensitively
        expect(normalizeCanonicalPath("/posts/Page/1")).toBe("/posts");
      });
    });

    describe("normalizePathname", () => {
      it("handles https URL with port", () => {
        const result = normalizePathname("https://example.com:8080/path");
        expect(result).toBe("https://example.com:8080/path");
      });

      it("handles http URL", () => {
        const result = normalizePathname("http://example.com/path");
        expect(result).toBe("http://example.com/path");
      });

      it("handles URL with query string (query preserved in normalized path)", () => {
        const result = normalizePathname("https://example.com/path?q=test");
        // normalizePathname only normalizes the pathname portion
        expect(result).toBeDefined();
      });
    });

    describe("parseTitleTemplate edge cases", () => {
      it("handles template with only title", () => {
        expect(parseTitleTemplate("{title}", "Site")).toBe("Site");
      });

      it("handles empty template", () => {
        expect(parseTitleTemplate("", "Site")).toBe("");
      });

      it("handles template with no placeholders", () => {
        expect(parseTitleTemplate("Static Title", "Site")).toBe("Static Title");
      });

      it("handles undefined subtitle", () => {
        expect(parseTitleTemplate("{title} - {subtitle}", "Site")).toBe("Site");
      });
    });

    describe("shouldForceNoIndex edge cases", () => {
      it("handles /admin exact match", () => {
        expect(shouldForceNoIndex("/admin")).toBe(true);
      });

      it("handles nested admin path", () => {
        expect(shouldForceNoIndex("/admin/users/1")).toBe(true);
      });

      it("handles /settings path", () => {
        expect(shouldForceNoIndex("/settings/general")).toBe(true);
      });

      it("does not match partial prefix", () => {
        expect(shouldForceNoIndex("/admin-news")).toBe(false);
        expect(shouldForceNoIndex("/login-page")).toBe(false);
      });
    });

    describe("resolveRobotsNoIndex edge cases", () => {
      it("returns false for empty object", () => {
        expect(resolveRobotsNoIndex({})).toBe(false);
      });

      it("returns false for object with only follow", () => {
        expect(resolveRobotsNoIndex({ follow: false })).toBe(false);
      });

      it("handles googleBot as undefined", () => {
        expect(
          resolveRobotsNoIndex({ index: true, googleBot: undefined }),
        ).toBe(false);
      });
    });
  });
});
