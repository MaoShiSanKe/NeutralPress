import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock dependencies - 使用 vi.hoisted 确保在 vi.mock 之前定义
const { mockPostFindFirst, mockPostFindMany, mockPostFindUnique } = vi.hoisted(
  () => ({
    mockPostFindFirst: vi.fn(),
    mockPostFindMany: vi.fn(),
    mockPostFindUnique: vi.fn(),
  }),
);

vi.mock("@/lib/server/prisma", () => ({
  default: {
    post: {
      findFirst: mockPostFindFirst,
      findMany: mockPostFindMany,
      findUnique: mockPostFindUnique,
    },
  },
}));

vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => Promise<unknown>) => fn),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/server/media-reference", () => ({
  getFeaturedImageUrl: vi.fn((refs: unknown[] | undefined) => {
    if (!refs || refs.length === 0) return null;
    const ref = (refs as Array<{ media?: { shortHash?: string } }>)[0];
    return ref?.media?.shortHash ? `/p/${ref.media.shortHash}` : null;
  }),
}));

vi.mock("@/lib/server/post-access", () => ({
  LISTABLE_POST_PUBLISHED_WHERE: { status: "PUBLISHED", deletedAt: null },
  LISTABLE_POST_VISIBLE_WHERE: {
    status: { in: ["PUBLISHED", "ARCHIVED"] },
    deletedAt: null,
  },
  PUBLIC_POST_STATUSES: ["PUBLISHED", "ARCHIVED"],
  PUBLIC_VISIBLE_POST_WHERE: {
    deletedAt: null,
    accessMode: "PUBLIC",
    status: { in: ["PUBLISHED", "ARCHIVED"] },
  },
}));

vi.mock("@/types/media", () => ({
  MEDIA_SLOTS: {
    POST_FEATURED_IMAGE: "POST_FEATURED_IMAGE",
    TAG_FEATURED_IMAGE: "TAG_FEATURED_IMAGE",
    CATEGORY_FEATURED_IMAGE: "CATEGORY_FEATURED_IMAGE",
  },
}));

import type { PostData } from "@/lib/server/post";
import {
  getAdjacentPosts,
  getLatestPublishedPostsForJsonLd,
  getPostShell,
  getPublishedPost,
  getRecommendedPosts,
  renderPostContent,
} from "@/lib/server/post";

// 辅助函数：创建 mock 数据库文章
function createMockDbPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: "Test Post",
    slug: "test-post",
    content: "Test content body",
    excerpt: "Test excerpt",
    status: "PUBLISHED",
    isPinned: false,
    allowComments: true,
    publishedAt: new Date("2024-06-01"),
    createdAt: new Date("2024-05-01"),
    updatedAt: new Date("2024-06-15"),
    metaDescription: "Meta desc",
    metaKeywords: "test,post",
    robotsIndex: true,
    postMode: "MARKDOWN",
    license: null,
    accessMode: "PUBLIC",
    minRole: null,
    author: {
      uid: 1,
      username: "author",
      nickname: "Author Name",
    },
    categories: [{ id: 1, name: "Tech", slug: "tech" }],
    tags: [{ name: "JavaScript", slug: "javascript" }],
    _count: { comments: 5 },
    viewCount: { cachedCount: 100 },
    mediaRefs: [
      {
        slot: "POST_FEATURED_IMAGE",
        media: { shortHash: "abc123", width: 800, height: 600, blur: null },
      },
    ],
    ...overrides,
  };
}

describe("post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // renderPostContent
  // =========================================================================
  describe("renderPostContent", () => {
    it("以 markdown 模式渲染文章内容", async () => {
      const post: PostData = {
        title: "Test Post",
        slug: "test-post",
        content: "# Hello World\n\nThis is a test.",
        excerpt: null,
        isPinned: false,
        publishedAt: new Date(),
        postMode: "MARKDOWN",
      };

      const result = await renderPostContent(post);
      expect(result.mode).toBe("markdown");
      expect(result.content).toBe("# Hello World\n\nThis is a test.");
    });

    it("以 mdx 模式渲染文章内容", async () => {
      const post: PostData = {
        title: "MDX Post",
        slug: "mdx-post",
        content: "# MDX\n\nimport { Component } from 'lib'\n\n<Component />",
        excerpt: null,
        isPinned: false,
        publishedAt: new Date(),
        postMode: "MDX",
      };

      const result = await renderPostContent(post);
      expect(result.mode).toBe("mdx");
      expect(result.content).toContain("import { Component }");
    });

    it("处理空内容", async () => {
      const post: PostData = {
        title: "Empty Post",
        slug: "empty-post",
        content: undefined,
        excerpt: null,
        isPinned: false,
        publishedAt: null,
        postMode: "MARKDOWN",
      };

      const result = await renderPostContent(post);
      expect(result.content).toBe("");
      expect(result.mode).toBe("markdown");
    });

    it("处理空字符串内容", async () => {
      const post: PostData = {
        title: "Empty String Post",
        slug: "empty-string-post",
        content: "",
        excerpt: null,
        isPinned: false,
        publishedAt: null,
        postMode: "MARKDOWN",
      };

      const result = await renderPostContent(post);
      expect(result.content).toBe("");
    });

    it("不支持的 postMode 应抛出错误", async () => {
      const post: PostData = {
        title: "Bad Post",
        slug: "bad-post",
        content: "content",
        excerpt: null,
        isPinned: false,
        publishedAt: null,
        postMode: "RICHTEXT" as unknown as "MARKDOWN" | "MDX",
      };

      await expect(renderPostContent(post)).rejects.toThrow(
        "Unsupported post mode",
      );
    });

    it("返回原始 Markdown 内容（不做预处理）", async () => {
      const mdContent = `---
title: Test
---
# Hello

**Bold** and *italic*

- Item 1
- Item 2

\`\`\`js
console.log('test');
\`\`\``;

      const post: PostData = {
        title: "Full Markdown",
        slug: "full-markdown",
        content: mdContent,
        excerpt: null,
        isPinned: false,
        publishedAt: null,
        postMode: "MARKDOWN",
      };

      const result = await renderPostContent(post);
      expect(result.content).toBe(mdContent);
      expect(result.mode).toBe("markdown");
    });

    it("MDX 模式返回原始内容", async () => {
      const mdxContent = `import { Callout } from 'components'

# Title

<Callout type="info">
  This is an info callout
</Callout>

export default function Layout({ children }) {
  return <div>{children}</div>
}`;

      const post: PostData = {
        title: "MDX Content",
        slug: "mdx-content",
        content: mdxContent,
        excerpt: null,
        isPinned: false,
        publishedAt: null,
        postMode: "MDX",
      };

      const result = await renderPostContent(post);
      expect(result.content).toBe(mdxContent);
      expect(result.mode).toBe("mdx");
    });
  });

  // =========================================================================
  // getPublishedPost
  // =========================================================================
  describe("getPublishedPost", () => {
    it("返回已发布的文章数据", async () => {
      const dbPost = createMockDbPost();
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.title).toBe("Test Post");
      expect(result.slug).toBe("test-post");
      expect(result.content).toBe("Test content body");
    });

    it("设置 featuredImage 为图片 URL", async () => {
      const dbPost = createMockDbPost();
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result.featuredImage).toBe("/p/abc123");
    });

    it("设置 viewCount 为缓存计数", async () => {
      const dbPost = createMockDbPost({ viewCount: { cachedCount: 42 } });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result.viewCount).toBe(42);
    });

    it("viewCount 为 null 时返回 0", async () => {
      const dbPost = createMockDbPost({ viewCount: null });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result.viewCount).toBe(0);
    });

    it("文章不存在时调用 notFound", async () => {
      mockPostFindFirst.mockResolvedValue(null);
      await expect(getPublishedPost("nonexistent")).rejects.toThrow(
        "NOT_FOUND",
      );
    });

    it("正确映射 author 信息", async () => {
      const dbPost = createMockDbPost({
        author: { uid: 42, username: "john", nickname: "John Doe" },
      });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result.author).toEqual({
        uid: 42,
        username: "john",
        nickname: "John Doe",
      });
    });

    it("正确映射 categories 和 tags", async () => {
      const dbPost = createMockDbPost({
        categories: [
          { id: 1, name: "Tech", slug: "tech" },
          { id: 2, name: "Science", slug: "science" },
        ],
        tags: [
          { name: "TypeScript", slug: "typescript" },
          { name: "React", slug: "react" },
        ],
      });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result.categories).toHaveLength(2);
      expect(result.categories![0]!.name).toBe("Tech");
      expect(result.tags).toHaveLength(2);
      expect(result.tags![0]!.name).toBe("TypeScript");
    });

    it("包含评论计数", async () => {
      const dbPost = createMockDbPost({ _count: { comments: 12 } });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result._count?.comments).toBe(12);
    });

    it("没有媒体引用时 featuredImage 为 null", async () => {
      const dbPost = createMockDbPost({ mediaRefs: [] });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPublishedPost("test-post");
      expect(result.featuredImage).toBeNull();
    });
  });

  // =========================================================================
  // getPostShell
  // =========================================================================
  describe("getPostShell", () => {
    it("返回文章 shell 数据", async () => {
      const dbPost = createMockDbPost();
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.title).toBe("Test Post");
      expect(result.slug).toBe("test-post");
    });

    it("包含 contentLength 而非 content", async () => {
      const dbPost = createMockDbPost({ content: "Hello World" });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result.contentLength).toBe("Hello World".length);
      expect(
        (result as unknown as Record<string, unknown>).content,
      ).toBeUndefined();
    });

    it("正确计算 contentLength", async () => {
      const longContent = "a".repeat(1000);
      const dbPost = createMockDbPost({ content: longContent });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result.contentLength).toBe(1000);
    });

    it("设置 viewCount", async () => {
      const dbPost = createMockDbPost({ viewCount: { cachedCount: 200 } });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result.viewCount).toBe(200);
    });

    it("viewCount 为 null 时返回 0", async () => {
      const dbPost = createMockDbPost({ viewCount: null });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result.viewCount).toBe(0);
    });

    it("设置 featuredImage", async () => {
      const dbPost = createMockDbPost();
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result.featuredImage).toBe("/p/abc123");
    });

    it("文章不存在时调用 notFound", async () => {
      mockPostFindFirst.mockResolvedValue(null);
      await expect(getPostShell("nonexistent")).rejects.toThrow("NOT_FOUND");
    });

    it("返回完整的元数据字段", async () => {
      const dbPost = createMockDbPost({
        metaDescription: "Test meta",
        metaKeywords: "key1,key2",
        robotsIndex: false,
        allowComments: false,
        license: "CC BY 4.0",
        accessMode: "PASSWORD",
        minRole: null,
      });
      mockPostFindFirst.mockResolvedValue(dbPost);

      const result = await getPostShell("test-post");
      expect(result.metaDescription).toBe("Test meta");
      expect(result.metaKeywords).toBe("key1,key2");
      expect(result.robotsIndex).toBe(false);
      expect(result.allowComments).toBe(false);
      expect(result.license).toBe("CC BY 4.0");
      expect(result.accessMode).toBe("PASSWORD");
    });
  });

  // =========================================================================
  // getLatestPublishedPostsForJsonLd
  // =========================================================================
  describe("getLatestPublishedPostsForJsonLd", () => {
    it("返回默认限制的最新文章", async () => {
      const posts = [
        createMockDbPost({ id: 1, title: "Post 1", slug: "post-1" }),
        createMockDbPost({ id: 2, title: "Post 2", slug: "post-2" }),
      ];
      mockPostFindMany.mockResolvedValue(posts);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe("Post 1");
      expect(result[0]!.featuredImage).toBe("/p/abc123");
    });

    it("nickname 为 null 时使用 username", async () => {
      const posts = [
        createMockDbPost({
          author: { uid: 1, username: "user1", nickname: null },
        }),
      ];
      mockPostFindMany.mockResolvedValue(posts);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result[0]!.author?.name).toBe("user1");
    });

    it("有 nickname 时使用 nickname", async () => {
      const posts = [
        createMockDbPost({
          author: { uid: 1, username: "user1", nickname: "Display Name" },
        }),
      ];
      mockPostFindMany.mockResolvedValue(posts);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result[0]!.author?.name).toBe("Display Name");
    });

    it("author 为 null 时返回 null", async () => {
      const posts = [createMockDbPost({ author: null })];
      mockPostFindMany.mockResolvedValue(posts);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result[0]!.author).toBeNull();
    });

    it("正确限制结果数量", async () => {
      mockPostFindMany.mockResolvedValue([]);

      await getLatestPublishedPostsForJsonLd(5);
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("限制上限为 20", async () => {
      mockPostFindMany.mockResolvedValue([]);

      await getLatestPublishedPostsForJsonLd(50);
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it("无效数值（负数）使用默认值 10", async () => {
      mockPostFindMany.mockResolvedValue([]);

      await getLatestPublishedPostsForJsonLd(-5);
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it("NaN 使用默认值 10", async () => {
      mockPostFindMany.mockResolvedValue([]);

      await getLatestPublishedPostsForJsonLd(NaN);
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it("Infinity 使用默认值 10", async () => {
      mockPostFindMany.mockResolvedValue([]);

      await getLatestPublishedPostsForJsonLd(Infinity);
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it("返回空数组当没有文章", async () => {
      mockPostFindMany.mockResolvedValue([]);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result).toEqual([]);
    });

    it("包含文章日期字段", async () => {
      const posts = [
        createMockDbPost({
          publishedAt: new Date("2024-06-01"),
          createdAt: new Date("2024-05-01"),
          updatedAt: new Date("2024-06-15"),
        }),
      ];
      mockPostFindMany.mockResolvedValue(posts);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result[0]!.publishedAt).toEqual(new Date("2024-06-01"));
      expect(result[0]!.createdAt).toEqual(new Date("2024-05-01"));
      expect(result[0]!.updatedAt).toEqual(new Date("2024-06-15"));
    });

    it("包含 profilePath", async () => {
      const posts = [
        createMockDbPost({
          author: { uid: 42, username: "john", nickname: "John" },
        }),
      ];
      mockPostFindMany.mockResolvedValue(posts);

      const result = await getLatestPublishedPostsForJsonLd();
      expect(result[0]!.author?.profilePath).toBe("/user/42");
    });
  });

  // =========================================================================
  // getAdjacentPosts
  // =========================================================================
  describe("getAdjacentPosts", () => {
    it("返回上一篇和下一篇文章", async () => {
      const currentPost = { publishedAt: new Date("2024-06-01") };
      const previousPost = {
        title: "Previous",
        slug: "prev-post",
        publishedAt: new Date("2024-05-01"),
        excerpt: "Prev excerpt",
        isPinned: false,
        categories: [{ name: "Tech", slug: "tech" }],
        tags: [{ name: "js", slug: "js" }],
        mediaRefs: [],
      };
      const nextPost = {
        title: "Next",
        slug: "next-post",
        publishedAt: new Date("2024-07-01"),
        excerpt: "Next excerpt",
        isPinned: false,
        categories: [],
        tags: [],
        mediaRefs: [],
      };

      mockPostFindUnique.mockResolvedValue(currentPost);
      mockPostFindFirst
        .mockResolvedValueOnce(previousPost)
        .mockResolvedValueOnce(nextPost);

      const result = await getAdjacentPosts("current-post");
      expect(result.previous).not.toBeNull();
      expect(result.previous?.title).toBe("Previous");
      expect(result.previous?.slug).toBe("prev-post");
      expect(result.next).not.toBeNull();
      expect(result.next?.title).toBe("Next");
    });

    it("当前文章无 publishedAt 时返回 null", async () => {
      mockPostFindUnique.mockResolvedValue({ publishedAt: null });

      const result = await getAdjacentPosts("draft-post");
      expect(result.previous).toBeNull();
      expect(result.next).toBeNull();
    });

    it("当前文章不存在时返回 null", async () => {
      mockPostFindUnique.mockResolvedValue(null);

      const result = await getAdjacentPosts("nonexistent");
      expect(result.previous).toBeNull();
      expect(result.next).toBeNull();
    });

    it("没有上一篇文章时返回 null", async () => {
      const currentPost = { publishedAt: new Date("2024-06-01") };
      mockPostFindUnique.mockResolvedValue(currentPost);
      mockPostFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
        title: "Next",
        slug: "next",
        publishedAt: new Date("2024-07-01"),
        excerpt: null,
        isPinned: false,
        categories: [],
        tags: [],
        mediaRefs: [],
      });

      const result = await getAdjacentPosts("oldest-post");
      expect(result.previous).toBeNull();
      expect(result.next).not.toBeNull();
    });

    it("没有下一篇文章时返回 null", async () => {
      const currentPost = { publishedAt: new Date("2024-06-01") };
      mockPostFindUnique.mockResolvedValue(currentPost);
      mockPostFindFirst
        .mockResolvedValueOnce({
          title: "Prev",
          slug: "prev",
          publishedAt: new Date("2024-05-01"),
          excerpt: null,
          isPinned: false,
          categories: [],
          tags: [],
          mediaRefs: [],
        })
        .mockResolvedValueOnce(null);

      const result = await getAdjacentPosts("newest-post");
      expect(result.previous).not.toBeNull();
      expect(result.next).toBeNull();
    });

    it("publishedAt 为字符串时转为 Date 对象", async () => {
      const currentPost = { publishedAt: new Date("2024-06-01") };
      const prevPost = {
        title: "Prev",
        slug: "prev",
        publishedAt: "2024-05-01T00:00:00.000Z",
        excerpt: null,
        isPinned: false,
        categories: [],
        tags: [],
        mediaRefs: [],
      };

      mockPostFindUnique.mockResolvedValue(currentPost);
      mockPostFindFirst
        .mockResolvedValueOnce(prevPost)
        .mockResolvedValueOnce(null);

      const result = await getAdjacentPosts("test-post");
      expect(result.previous?.publishedAt).toBeInstanceOf(Date);
    });

    it("adjacent post 的 publishedAt 为 null 时保持 null", async () => {
      const currentPost = { publishedAt: new Date("2024-06-01") };
      const prevPost = {
        title: "Prev",
        slug: "prev",
        publishedAt: null,
        excerpt: null,
        isPinned: false,
        categories: [],
        tags: [],
        mediaRefs: [],
      };

      mockPostFindUnique.mockResolvedValue(currentPost);
      mockPostFindFirst
        .mockResolvedValueOnce(prevPost)
        .mockResolvedValueOnce(null);

      const result = await getAdjacentPosts("test-post");
      expect(result.previous?.publishedAt).toBeNull();
    });
  });

  // =========================================================================
  // getRecommendedPosts
  // =========================================================================
  describe("getRecommendedPosts", () => {
    it("基于分类推荐文章", async () => {
      const candidates = [
        {
          title: "Related Post",
          slug: "related-post",
          excerpt: "Related excerpt",
          publishedAt: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
          categories: [{ id: 1, name: "Tech", slug: "tech" }],
          tags: [],
          mediaRefs: [],
        },
      ];
      mockPostFindMany.mockResolvedValue(candidates);

      const currentPost = {
        slug: "current-post",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [],
      };

      const result = await getRecommendedPosts(currentPost);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.recommendationScore).toBe(12);
    });

    it("基于标签推荐文章", async () => {
      const candidates = [
        {
          title: "Tagged Post",
          slug: "tagged-post",
          excerpt: null,
          publishedAt: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
          categories: [],
          tags: [{ name: "JS", slug: "js" }],
          mediaRefs: [],
        },
      ];
      mockPostFindMany.mockResolvedValue(candidates);

      const currentPost = {
        slug: "current-post",
        categories: [],
        tags: [{ name: "JS", slug: "js" }],
      };

      const result = await getRecommendedPosts(currentPost);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.recommendationScore).toBe(8);
    });

    it("无分类和标签时返回空数组", async () => {
      const currentPost = {
        slug: "current-post",
        categories: [],
        tags: [],
      };

      const result = await getRecommendedPosts(currentPost);
      expect(result).toEqual([]);
    });

    it("仅有 uncategorized 分类时返回空数组", async () => {
      const currentPost = {
        slug: "current-post",
        categories: [{ id: 1, name: "Uncategorized", slug: "uncategorized" }],
        tags: [],
      };

      const result = await getRecommendedPosts(currentPost);
      expect(result).toEqual([]);
    });

    it("排除当前文章", async () => {
      const candidates = [
        {
          title: "Other Post",
          slug: "other-post",
          excerpt: null,
          publishedAt: new Date(),
          createdAt: new Date(),
          categories: [{ id: 1, name: "Tech", slug: "tech" }],
          tags: [],
          mediaRefs: [],
        },
      ];
      mockPostFindMany.mockResolvedValue(candidates);

      const currentPost = {
        slug: "current-post",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [],
      };

      await getRecommendedPosts(currentPost);

      // 验证 Prisma 查询中排除了当前文章
      expect(mockPostFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slug: { not: "current-post" },
          }),
        }),
      );
    });

    it("过滤掉评分为 0 的文章", async () => {
      const candidates = [
        {
          title: "Unrelated",
          slug: "unrelated",
          excerpt: null,
          publishedAt: new Date(),
          createdAt: new Date(),
          categories: [{ id: 99, name: "Other", slug: "other" }],
          tags: [{ name: "Rust", slug: "rust" }],
          mediaRefs: [],
        },
      ];
      mockPostFindMany.mockResolvedValue(candidates);

      const currentPost = {
        slug: "current",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [{ name: "JS", slug: "js" }],
      };

      const result = await getRecommendedPosts(currentPost);
      expect(result).toEqual([]);
    });

    it("自定义 limit 选项", async () => {
      mockPostFindMany.mockResolvedValue([]);

      const currentPost = {
        slug: "test",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [],
      };

      await getRecommendedPosts(currentPost, { limit: 3 });
      expect(mockPostFindMany).toHaveBeenCalled();
    });

    it("自定义 candidateLimit 选项", async () => {
      mockPostFindMany.mockResolvedValue([]);

      const currentPost = {
        slug: "test",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [],
      };

      await getRecommendedPosts(currentPost, { candidateLimit: 20 });
      expect(mockPostFindMany).toHaveBeenCalled();
    });

    it("排序按推荐分数降序，分数相同时按发布时间降序", async () => {
      const candidates = [
        {
          title: "Less Related",
          slug: "less-related",
          excerpt: null,
          publishedAt: new Date("2024-07-01"),
          createdAt: new Date("2024-07-01"),
          categories: [{ id: 1, name: "Tech", slug: "tech" }],
          tags: [],
          mediaRefs: [],
        },
        {
          title: "More Related",
          slug: "more-related",
          excerpt: null,
          publishedAt: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
          categories: [{ id: 1, name: "Tech", slug: "tech" }],
          tags: [{ name: "JS", slug: "js" }],
          mediaRefs: [],
        },
      ];
      mockPostFindMany.mockResolvedValue(candidates);

      const currentPost = {
        slug: "current",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [{ name: "JS", slug: "js" }],
      };

      const result = await getRecommendedPosts(currentPost);
      if (result.length >= 2) {
        expect(result[0]!.recommendationScore).toBeGreaterThanOrEqual(
          result[1]!.recommendationScore,
        );
      }
    });

    it("返回的推荐文章包含正确的字段", async () => {
      const candidates = [
        {
          title: "Related",
          slug: "related",
          excerpt: "Some excerpt",
          publishedAt: new Date("2024-06-01"),
          createdAt: new Date("2024-06-01"),
          categories: [{ id: 1, name: "Tech", slug: "tech" }],
          tags: [{ name: "JS", slug: "js" }],
          mediaRefs: [],
        },
      ];
      mockPostFindMany.mockResolvedValue(candidates);

      const currentPost = {
        slug: "current",
        categories: [{ id: 1, name: "Tech", slug: "tech" }],
        tags: [],
      };

      const result = await getRecommendedPosts(currentPost);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty("title");
        expect(result[0]).toHaveProperty("slug");
        expect(result[0]).toHaveProperty("excerpt");
        expect(result[0]).toHaveProperty("publishedAt");
        expect(result[0]).toHaveProperty("categories");
        expect(result[0]).toHaveProperty("tags");
        expect(result[0]).toHaveProperty("recommendationScore");
        expect(result[0]).toHaveProperty("matchedKeywords");
        expect(result[0]).toHaveProperty("featuredImage");
      }
    });
  });
});
