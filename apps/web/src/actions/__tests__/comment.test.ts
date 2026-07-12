import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

const {
  mockLimitControl,
  mockAuthVerify,
  mockValidateData,
  mockHeaders,
  mockGetConfig,
  mockGetConfigs,
  mockVerifyToken,
  mockGetClientIP,
  mockResolveIpLocation,
  mockCalculateMD5,
  mockNormalizePageSlug,
  mockResolvePageAllowComments,
  mockIsAkismetEnabled,
  mockLogAuditEvent,
  mockGenerateCacheKey,
  mockGetCache,
  mockSetCache,
  mockPrismaCommentFindMany,
  mockPrismaCommentFindUnique,
  mockPrismaCommentFindFirst,
  mockPrismaCommentCreate,
  mockPrismaCommentUpdate,
  mockPrismaCommentUpdateMany,
  mockPrismaCommentCount,
  mockPrismaCommentLikeFindMany,
  mockPrismaCommentLikeFindUnique,
  mockPrismaPostFindUnique,
  mockPrismaPageFindUnique,
  mockPrismaPageFindFirst,
  mockPrismaUserFindMany,
  mockPrismaUserFindUnique,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockLimitControl: vi.fn(),
  mockAuthVerify: vi.fn(),
  mockValidateData: vi.fn(),
  mockHeaders: vi.fn(),
  mockGetConfig: vi.fn(),
  mockGetConfigs: vi.fn(),
  mockVerifyToken: vi.fn(),
  mockGetClientIP: vi.fn(),
  mockResolveIpLocation: vi.fn(),
  mockCalculateMD5: vi.fn(),
  mockNormalizePageSlug: vi.fn(),
  mockResolvePageAllowComments: vi.fn(),
  mockIsAkismetEnabled: vi.fn(),
  mockLogAuditEvent: vi.fn(),
  mockGenerateCacheKey: vi.fn(),
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn(),
  mockPrismaCommentFindMany: vi.fn(),
  mockPrismaCommentFindUnique: vi.fn(),
  mockPrismaCommentFindFirst: vi.fn(),
  mockPrismaCommentCreate: vi.fn(),
  mockPrismaCommentUpdate: vi.fn(),
  mockPrismaCommentUpdateMany: vi.fn(),
  mockPrismaCommentCount: vi.fn(),
  mockPrismaCommentLikeFindMany: vi.fn(),
  mockPrismaCommentLikeFindUnique: vi.fn(),
  mockPrismaPostFindUnique: vi.fn(),
  mockPrismaPageFindUnique: vi.fn(),
  mockPrismaPageFindFirst: vi.fn(),
  mockPrismaUserFindMany: vi.fn(),
  mockPrismaUserFindUnique: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  default: {
    comment: {
      findMany: mockPrismaCommentFindMany,
      findUnique: mockPrismaCommentFindUnique,
      findFirst: mockPrismaCommentFindFirst,
      create: mockPrismaCommentCreate,
      update: mockPrismaCommentUpdate,
      updateMany: mockPrismaCommentUpdateMany,
      count: mockPrismaCommentCount,
    },
    commentLike: {
      findMany: mockPrismaCommentLikeFindMany,
      findUnique: mockPrismaCommentLikeFindUnique,
      create: vi.fn(),
      delete: vi.fn(),
    },
    post: { findUnique: mockPrismaPostFindUnique },
    page: {
      findUnique: mockPrismaPageFindUnique,
      findFirst: mockPrismaPageFindFirst,
    },
    user: {
      findMany: mockPrismaUserFindMany,
      findUnique: mockPrismaUserFindUnique,
    },
    $transaction: mockPrismaTransaction,
  },
}));
vi.mock("@/lib/server/auth-verify", () => ({ authVerify: mockAuthVerify }));
vi.mock("@/lib/server/rate-limit", () => ({ default: mockLimitControl }));
vi.mock("@/lib/server/validator", () => ({ validateData: mockValidateData }));
vi.mock("@/lib/server/config-cache", () => ({
  getConfig: mockGetConfig,
  getConfigs: mockGetConfigs,
}));
vi.mock("@/lib/server/captcha", () => ({ verifyToken: mockVerifyToken }));
vi.mock("@/lib/server/get-client-info", () => ({
  getClientIP: mockGetClientIP,
}));
vi.mock("@/lib/server/ip-utils", () => ({
  resolveIpLocation: mockResolveIpLocation,
}));
vi.mock("@/lib/server/crypto", () => ({ calculateMD5: mockCalculateMD5 }));
vi.mock("@/lib/server/page-comments", () => ({
  normalizePageSlug: mockNormalizePageSlug,
  resolvePageAllowComments: mockResolvePageAllowComments,
}));
vi.mock("@/lib/server/post-access", () => ({
  PUBLIC_POST_STATUSES: ["PUBLISHED", "ARCHIVED"],
}));
vi.mock("@/lib/server/akismet", () => ({
  checkSpam: vi.fn(),
  isAkismetEnabled: mockIsAkismetEnabled,
}));
vi.mock("@/lib/server/audit", () => ({ logAuditEvent: mockLogAuditEvent }));
vi.mock("@/lib/server/cache", () => ({
  generateCacheKey: mockGenerateCacheKey,
  getCache: mockGetCache,
  setCache: mockSetCache,
}));
vi.mock("next/headers", () => ({ headers: mockHeaders }));
vi.mock("next/server", () => ({
  NextResponse: { json: vi.fn() },
  after: vi.fn((fn: () => Promise<void>) => fn()),
}));
vi.mock("@/lib/server/notice", () => ({ sendNotice: vi.fn() }));

// ============================================================================
// Imports
// ============================================================================

import {
  createComment,
  deleteComments,
  deleteOwnComment,
  getCommentHistory,
  getCommentReplies,
  getCommentsAdmin,
  getCommentStats,
  getDirectChildren,
  getPostComments,
  likeComment,
  unlikeComment,
  updateCommentStatus,
} from "@/actions/comment";

// ============================================================================
// Helpers
// ============================================================================

const ADMIN_USER = { uid: 1, username: "admin", role: "ADMIN" as const };
const EDITOR_USER = { uid: 2, username: "editor", role: "EDITOR" as const };
const REGULAR_USER = { uid: 4, username: "user", role: "USER" as const };

const COMMENT_RECORD = {
  id: "comment-1",
  content: "Great post!",
  status: "APPROVED",
  createdAt: new Date("2025-01-01"),
  parentId: null,
  postId: 1,
  pageId: null,
  post: { slug: "test-post", title: "Test Post", publishedAt: new Date() },
  page: null,
  userUid: 4,
  authorName: "User",
  authorEmail: "user@test.com",
  authorWebsite: null,
  ipAddress: "127.0.0.1",
  userAgent: "Mozilla/5.0",
  depth: 0,
  path: "comment-1",
  sortKey: "0000000001",
  replyCount: 0,
  likeCount: 0,
  user: {
    uid: 4,
    username: "user",
    nickname: "User",
    avatar: null,
    website: null,
  },
  parent: null,
};

function mockAuthSuccess(user: any = ADMIN_USER) {
  mockAuthVerify.mockResolvedValue(user);
}
function mockAuthFailure() {
  mockAuthVerify.mockResolvedValue(null);
}
function mockRateLimitAllowed() {
  mockLimitControl.mockResolvedValue(true);
}
function mockValidationSuccess() {
  mockValidateData.mockReturnValue(null);
}

// ============================================================================
// Tests
// ============================================================================

describe("comment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimitAllowed();
    mockValidationSuccess();
    mockHeaders.mockResolvedValue(new Headers());
    mockGetConfig.mockResolvedValue(true);
    mockGetConfigs.mockResolvedValue([true, true, true, false, false]);
    mockGetClientIP.mockResolvedValue("127.0.0.1");
    mockResolveIpLocation.mockReturnValue(null);
    mockCalculateMD5.mockReturnValue("md5hash");
    mockIsAkismetEnabled.mockResolvedValue(false);
    mockGenerateCacheKey.mockReturnValue("cache-key");
    mockNormalizePageSlug.mockImplementation((s: string) => s);
  });

  describe("getPostComments", () => {
    it("成功获取评论列表", async () => {
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: true,
        userUid: 1,
        publishedAt: new Date(),
      });
      mockAuthVerify.mockResolvedValue(null);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentCount.mockResolvedValue(1);
      mockPrismaCommentLikeFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("评论功能关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("目标不存在时返回 404", async () => {
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPageFindFirst.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await getPostComments(
        { slug: "nonexistent", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("评论关闭的文章返回禁止", async () => {
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: false,
        userUid: 1,
        publishedAt: new Date(),
      });
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("速率限制时返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment", () => {
    it("登录用户成功创建评论", async () => {
      mockVerifyToken.mockResolvedValue({ success: true });
      mockGetConfigs.mockResolvedValue([true, true, true, false, false]);
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: true,
        userUid: 1,
        publishedAt: new Date(),
      });
      mockAuthSuccess(REGULAR_USER);
      mockPrismaUserFindUnique.mockResolvedValue({
        uid: 4,
        username: "user",
        nickname: "User",
        email: "user@test.com",
        avatar: null,
        website: null,
      });
      mockPrismaCommentCreate.mockResolvedValue({ id: "new-comment" });
      mockPrismaCommentUpdate.mockResolvedValue({});
      mockPrismaCommentFindUnique.mockResolvedValue({
        ...COMMENT_RECORD,
        id: "new-comment",
      });
      const result = await createComment(
        {
          slug: "test-post",
          content: "Nice article!",
          captcha_token: "captcha",
          access_token: "token",
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("验证码失败时返回错误", async () => {
      mockVerifyToken.mockResolvedValue({ success: false });
      const result = await createComment(
        {
          slug: "test-post",
          content: "Comment",
          captcha_token: "bad",
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("匿名评论关闭时未登录用户返回未授权", async () => {
      mockVerifyToken.mockResolvedValue({ success: true });
      mockGetConfigs.mockResolvedValue([false, true, true, false, false]);
      mockPrismaPageFindUnique.mockResolvedValue(null);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        slug: "test-post",
        title: "Test Post",
        allowComments: true,
        userUid: 1,
        publishedAt: new Date(),
      });
      mockAuthFailure();
      const result = await createComment(
        {
          slug: "test-post",
          content: "Comment",
          captcha_token: "captcha",
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus", () => {
    it("ADMIN 成功更新评论状态", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentUpdateMany.mockResolvedValue({ count: 1 });
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "REJECTED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments", () => {
    it("ADMIN 成功删除评论", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentUpdateMany.mockResolvedValue({ count: 1 });
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentsAdmin", () => {
    it("成功返回管理评论列表", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockPrismaCommentCount.mockResolvedValue(1);
      mockPrismaCommentFindMany.mockResolvedValue([COMMENT_RECORD]);
      mockPrismaCommentLikeFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 10,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("未认证时返回未授权", async () => {
      mockAuthFailure();
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 10,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory", () => {
    it("成功返回评论历史", async () => {
      mockAuthSuccess(EDITOR_USER);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
      expect((result as any).data).toHaveLength(7);
    });
  });

  describe("getCommentStats", () => {
    it("成功返回评论统计", async () => {
      mockAuthSuccess(ADMIN_USER);
      mockGetCache.mockResolvedValue(null);
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats(
        { access_token: "token" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
      expect(result.data!.total).toBe(0);
    });
  });

  describe("likeComment", () => {
    it("成功点赞评论", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue({ id: "comment-1" });
      mockPrismaTransaction.mockImplementation(async (fn: any) =>
        fn({
          commentLike: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(),
          },
          comment: {
            update: vi.fn().mockResolvedValue({ likeCount: 1 }),
            findUnique: vi.fn().mockResolvedValue({ likeCount: 1 }),
          },
        }),
      );
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("未登录时返回未授权", async () => {
      mockAuthFailure();
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("评论不存在时返回 404", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000099" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("unlikeComment", () => {
    it("成功取消点赞", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaTransaction.mockImplementation(async (fn: any) =>
        fn({
          commentLike: {
            findUnique: vi
              .fn()
              .mockResolvedValue({ commentId: "c1", userUid: 4 }),
            delete: vi.fn(),
          },
          comment: {
            update: vi.fn().mockResolvedValue({ likeCount: 0 }),
            findUnique: vi.fn().mockResolvedValue({ likeCount: 0 }),
          },
        }),
      );
      const result = await unlikeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("deleteOwnComment", () => {
    it("成功删除自己的评论", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        userUid: 4,
      });
      mockPrismaCommentUpdate.mockResolvedValue({});
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("删除他人评论时返回禁止", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        userUid: 999,
      });
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("评论不存在时返回 404", async () => {
      mockAuthSuccess(REGULAR_USER);
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000099" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  // ---------- 补充测试 ----------

  describe("getPostComments 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("likeComment 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("unlikeComment 补充测试", () => {
    it("速率限制时应返回 429", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await unlikeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  // ==================== getCommentReplies ====================

  describe("getCommentReplies", () => {
    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getCommentReplies(
          { commentId: "00000000-0000-0000-0000-000000000001", maxDepth: 3 },
          { environment: "serveraction" },
        );
        expect((result as any).success).toBe(false);
      });
    });

    describe("业务逻辑", () => {
      it("评论不存在时应返回 404", async () => {
        mockPrismaCommentFindUnique.mockResolvedValue(null);
        const result = await getCommentReplies(
          { commentId: "00000000-0000-0000-0000-000000000099", maxDepth: 3 },
          { environment: "serveraction" },
        );
        expect((result as any).success).toBe(false);
      });
    });
  });

  // ==================== getDirectChildren ====================

  describe("getDirectChildren", () => {
    describe("速率限制", () => {
      it("速率限制时应返回失败", async () => {
        mockLimitControl.mockResolvedValue(false);
        const result = await getDirectChildren(
          { postSlug: "test-post", parentId: null, pageSize: 10 },
          { environment: "serveraction" },
        );
        expect((result as any).success).toBe(false);
      });
    });

    describe("业务逻辑", () => {
      it("评论功能关闭时应返回禁止", async () => {
        mockGetConfig.mockResolvedValue(false);
        const result = await getDirectChildren(
          { postSlug: "test-post", parentId: null, pageSize: 10 },
          { environment: "serveraction" },
        );
        expect((result as any).success).toBe(false);
      });

      it("目标不存在时应返回 404", async () => {
        mockGetConfig.mockResolvedValue(true);
        mockNormalizePageSlug.mockReturnValue("test-post");
        mockPrismaPostFindUnique.mockResolvedValue(null);
        mockPrismaPageFindFirst.mockResolvedValue(null);
        const result = await getDirectChildren(
          { postSlug: "nonexistent", parentId: null, pageSize: 10 },
          { environment: "serveraction" },
        );
        expect((result as any).success).toBe(false);
      });
    });
  });

  // ==================== 补充分支覆盖测试 ====================

  describe("getPostComments 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("likeComment 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("unlikeComment 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await unlikeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteOwnComment 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("未登录时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentReplies 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000001", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getDirectChildren(
        { postSlug: "test-post", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("likeComment 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("unlikeComment 补充测试 2", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await unlikeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 3", () => {
    it("评论功能关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 3", () => {
    it("数据库错误时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCreate.mockRejectedValue(new Error("DB error"));
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteOwnComment 补充测试 2", () => {
    it("评论不存在时返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000099" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("删除他人评论时返回 403", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        userUid: 999,
      });
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentReplies 补充测试 2", () => {
    it("评论不存在时返回 404", async () => {
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000099", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试 2", () => {
    it("评论功能关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(false);
      const result = await getDirectChildren(
        { postSlug: "test-post", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 4", () => {
    it("目标不存在时返回 404", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("nonexistent");
      mockPrismaPostFindUnique.mockResolvedValue(null);
      mockPrismaPageFindFirst.mockResolvedValue(null);
      const result = await getPostComments(
        { slug: "nonexistent", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 4", () => {
    it("评论功能关闭时返回禁止", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(false);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("likeComment 补充测试 3", () => {
    it("已点赞时应返回成功（重复点赞）", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        postId: 1,
      });
      mockPrismaCommentLikeFindUnique.mockResolvedValue({
        id: "like-1",
        commentId: "comment-1",
        userUid: 1,
      });
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("unlikeComment 补充测试 3", () => {
    it("未点赞时应返回成功", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        postId: 1,
      });
      mockPrismaCommentLikeFindUnique.mockResolvedValue(null);
      const result = await unlikeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getPostComments 补充测试 5", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 5", () => {
    it("评论内容为空时应返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      const result = await createComment(
        { slug: "test-post", content: "" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 4", () => {
    it("成功返回评论统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(100);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentsAdmin 补充测试 3", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 2,
          pageSize: 10,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getPostComments 补充测试 6", () => {
    it("无评论时应返回空数组", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
      expect((result as any).data).toEqual([]);
    });
  });

  describe("getCommentStats 补充测试 5", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 4", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory 补充测试 4", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 7", () => {
    it("评论关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: false,
      });
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 7", () => {
    it("目标不存在时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteOwnComment 补充测试 3", () => {
    it("成功删除自己的评论", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: "comment-1",
        userUid: 1,
      });
      mockPrismaCommentUpdate.mockResolvedValue({});
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("likeComment 补充测试 4", () => {
    it("评论不存在时返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000099" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 5", () => {
    it("状态筛选应正确工作", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          status: ["PENDING"] as const,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentStats 补充测试 6", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentReplies 补充测试 3", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000001", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试 3", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getDirectChildren(
        { postSlug: "test-post", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 8", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 8", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 4", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 4", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 6", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 3,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 补充测试 5", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 7", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 9", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 9", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 10", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("updateCommentStatus 补充测试 5", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 5", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 7", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory 补充测试 6", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 8", () => {
    it("成功返回评论统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(100);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentReplies 补充测试 4", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000001", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试 4", () => {
    it("目标不存在时应返回 404", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("nonexistent");
      mockPrismaPostFindUnique.mockResolvedValue(null);
      mockPrismaPageFindFirst.mockResolvedValue(null);
      const result = await getDirectChildren(
        { postSlug: "nonexistent", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 11", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 10", () => {
    it("评论内容为空时应返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      const result = await createComment(
        { slug: "test-post", content: "" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 6", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 6", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 8", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 5,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 补充测试 7", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 9", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 12", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 5, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 11", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 7", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 7", () => {
    it("非管理员应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 9", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory 补充测试 8", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 10", () => {
    it("成功返回评论统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(100);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentReplies 补充测试 5", () => {
    it("评论不存在时返回 404", async () => {
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000099", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试 5", () => {
    it("评论功能关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(false);
      const result = await getDirectChildren(
        { postSlug: "test-post", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 13", () => {
    it("评论关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: false,
      });
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 12", () => {
    it("目标不存在时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteOwnComment 补充测试 4", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 14", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 5, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 13", () => {
    it("评论内容为空时应返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      const result = await createComment(
        { slug: "test-post", content: "" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 8", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 8", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 10", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 3,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 补充测试 9", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 11", () => {
    it("成功返回评论统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(100);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(true);
    });
  });

  describe("likeComment 补充测试 5", () => {
    it("评论不存在时返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000099" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentReplies 补充测试 6", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000001", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试 6", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getDirectChildren(
        { postSlug: "test-post", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 15", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 14", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 9", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 9", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 11", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 5,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 补充测试 10", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 12", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 16", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 15", () => {
    it("评论内容为空时应返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      const result = await createComment(
        { slug: "test-post", content: "" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 10", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 10", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 12", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 5,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 补充测试 11", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 13", () => {
    it("成功返回评论统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(100);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(true);
    });
  });

  describe("getPostComments 补充测试 17", () => {
    it("评论关闭时返回禁止", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: false,
      });
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 补充测试 16", () => {
    it("目标不存在时返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockPrismaPostFindUnique.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteOwnComment 补充测试 5", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentReplies 补充测试 7", () => {
    it("评论不存在时返回 404", async () => {
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await getCommentReplies(
        { commentId: "00000000-0000-0000-0000-000000000099", maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getDirectChildren 补充测试 7", () => {
    it("目标不存在时应返回 404", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("nonexistent");
      mockPrismaPostFindUnique.mockResolvedValue(null);
      mockPrismaPageFindFirst.mockResolvedValue(null);
      const result = await getDirectChildren(
        { postSlug: "nonexistent", parentId: null, pageSize: 10 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 18", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 5, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("updateCommentStatus 补充测试 11", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 11", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 13", () => {
    it("分页参数应正确传递", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 5,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 补充测试 12", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 14", () => {
    it("成功返回评论统计", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "ADMIN" });
      mockPrismaCommentCount.mockResolvedValue(100);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(true);
    });
  });

  describe("likeComment 补充测试 6", () => {
    it("评论不存在时返回 404", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockPrismaCommentFindUnique.mockResolvedValue(null);
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000099" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 19", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 17", () => {
    it("未认证时应返回未授权", async () => {
      mockAuthVerify.mockResolvedValue(null);
      const result = await createComment(
        { slug: "test-post", content: "Test" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("updateCommentStatus 补充测试 12", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await updateCommentStatus(
        { ids: ["comment-1"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteComments 补充测试 12", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 补充测试 14", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 25,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentHistory 补充测试 13", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentStats 补充测试 15", () => {
    it("速率限制时应返回失败", async () => {
      mockLimitControl.mockResolvedValue(false);
      const result = await getCommentStats({}, { environment: "serveraction" });
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 补充测试 20", () => {
    it("分页参数应正确传递", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getPostComments(
        { slug: "test-post", pageSize: 10, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("createComment 补充测试 18", () => {
    it("评论内容为空时应返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      const result = await createComment(
        { slug: "test-post", content: "" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  // ===== 深层分支覆盖测试 =====

  describe("createComment 回复嵌套分支", () => {
    it("parentId 对应的父评论不存在返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
        status: "PUBLISHED",
        deletedAt: null,
      });
      mockPrismaCommentFindUnique.mockResolvedValue(null); // parent not found
      const result = await createComment(
        {
          slug: "test-post",
          content: "Reply",
          parentId: "00000000-0000-0000-0000-000000000099",
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("parentId 对应的父评论属于不同文章返回失败", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
        status: "PUBLISHED",
        deletedAt: null,
      });
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: 999,
        postId: 2, // different post
        depth: 0,
        path: "999",
        sortKey: "00000999",
        replyCount: 0,
      });
      const result = await createComment(
        {
          slug: "test-post",
          content: "Reply",
          parentId: "00000000-0000-0000-0000-000000000099",
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("createComment 匿名用户分支", () => {
    it("匿名允许但需要邮箱且未提供返回失败", async () => {
      mockAuthVerify.mockResolvedValue(null); // anonymous
      mockGetConfig
        .mockResolvedValueOnce(true) // comment enabled
        .mockResolvedValueOnce(true) // allowAnonymous
        .mockResolvedValueOnce(true) // requireAnonEmail
        .mockResolvedValueOnce(false) // reviewAnon
        .mockResolvedValueOnce(false) // reviewAll
        .mockResolvedValueOnce(false); // akismet
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
        status: "PUBLISHED",
        deletedAt: null,
      });
      const result = await createComment(
        { slug: "test-post", content: "Anonymous comment" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getPostComments 数据返回分支", () => {
    it("有评论数据时正确返回", async () => {
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(2);
      mockPrismaCommentFindMany
        .mockResolvedValueOnce([
          {
            id: 1,
            content: "Root comment",
            status: "APPROVED",
            postId: 1,
            parentId: null,
            depth: 0,
            path: "1",
            sortKey: "00000001",
            replyCount: 1,
            likeCount: 5,
            createdAt: new Date(),
            user: { uid: 1, username: "user1", nickname: "User 1" },
            post: { title: "Test", slug: "test" },
            page: null,
            parent: null,
          },
        ]) // root comments
        .mockResolvedValueOnce([
          {
            id: 2,
            content: "Child comment",
            status: "APPROVED",
            postId: 1,
            parentId: 1,
            depth: 1,
            path: "1/2",
            sortKey: "00000001.00000002",
            replyCount: 0,
            likeCount: 1,
            createdAt: new Date(),
            user: { uid: 2, username: "user2", nickname: "User 2" },
            post: { title: "Test", slug: "test" },
            page: null,
            parent: { id: 1 },
          },
        ]) // level-1 children
        .mockResolvedValueOnce([]); // level-2 children
      mockPrismaCommentLikeFindMany.mockResolvedValue([]);

      const result = await getPostComments(
        { slug: "test-post", pageSize: 20, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
      expect((result as any).data).toBeDefined();
    });

    it("登录用户看到自己的待审评论", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 1, role: "USER" });
      mockGetConfig.mockResolvedValue(true);
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaPostFindUnique.mockResolvedValue({
        id: 1,
        allowComments: true,
      });
      mockPrismaCommentCount.mockResolvedValue(1);
      mockPrismaCommentFindMany
        .mockResolvedValueOnce([
          {
            id: 1,
            content: "My pending comment",
            status: "PENDING",
            postId: 1,
            parentId: null,
            depth: 0,
            path: "1",
            sortKey: "00000001",
            replyCount: 0,
            likeCount: 0,
            createdAt: new Date(),
            user: { uid: 1, username: "user1", nickname: "User 1" },
            post: { title: "Test", slug: "test" },
            page: null,
            parent: null,
          },
        ])
        .mockResolvedValueOnce([]); // no children
      mockPrismaCommentLikeFindMany.mockResolvedValue([]);

      const result = await getPostComments(
        { slug: "test-post", pageSize: 20, maxDepth: 3 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentStats 分支", () => {
    it("AUTHOR 角色过滤到自己的文章", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 5, role: "AUTHOR" });
      mockPrismaCommentCount.mockResolvedValue(3);
      mockPrismaCommentFindMany.mockResolvedValue([
        { status: "APPROVED" },
        { status: "APPROVED" },
        { status: "PENDING" },
      ]);
      const result = await getCommentStats(
        { force: true },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  // ===== 分支覆盖补充测试 =====

  describe("getCommentStats 补充分支", () => {
    it("缓存命中时返回缓存数据", async () => {
      const { getCache } = await import("@/lib/server/cache");
      vi.mocked(getCache).mockResolvedValue({
        total: 10,
        approved: 8,
        pending: 1,
        spam: 1,
        todayCount: 2,
        weekCount: 5,
      });
      const result = await getCommentStats(
        { force: false },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("force=true 时跳过缓存", async () => {
      mockPrismaCommentCount.mockResolvedValue(20);
      mockPrismaCommentFindMany.mockResolvedValue([
        { status: "APPROVED" },
        { status: "PENDING" },
      ]);
      const result = await getCommentStats(
        { force: true },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("AUTHOR 角色过滤到自己的文章", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 5, role: "AUTHOR" });
      mockPrismaCommentCount.mockResolvedValue(3);
      mockPrismaCommentFindMany.mockResolvedValue([
        { status: "APPROVED" },
        { status: "APPROVED" },
        { status: "PENDING" },
      ]);
      const result = await getCommentStats(
        { force: true },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("数据库错误时返回失败", async () => {
      mockPrismaCommentCount.mockRejectedValue(new Error("DB error"));
      const result = await getCommentStats(
        { force: true },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("getCommentsAdmin 分支", () => {
    it("AUTHOR 角色过滤到自己的文章", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 5, role: "AUTHOR" });
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 20,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("带 uid 过滤", async () => {
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 20,
          uid: 3,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("带 parentOnly 过滤", async () => {
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 20,
          parentOnly: true,
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("带 status 数组过滤", async () => {
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 20,
          status: ["APPROVED", "PENDING"],
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("带 slug 过滤", async () => {
      mockNormalizePageSlug.mockReturnValue("test-post");
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 20,
          slug: "test-post",
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("带 search 过滤", async () => {
      mockPrismaCommentCount.mockResolvedValue(0);
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentsAdmin(
        {
          page: 1,
          pageSize: 20,
          search: "keyword",
          sortBy: "createdAt" as const,
          sortOrder: "desc" as const,
        },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("deleteComments 分支", () => {
    it("AUTHOR 角色删除自己的评论", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 5, role: "AUTHOR" });
      mockPrismaCommentFindMany.mockResolvedValue([{ id: 1 }]);
      mockPrismaCommentUpdateMany.mockResolvedValue({ count: 1 });
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-000000000001"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("无匹配评论时返回成功", async () => {
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await deleteComments(
        { ids: ["00000000-0000-0000-0000-00000000000999"] },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("updateCommentStatus 分支", () => {
    it("AUTHOR 角色更新自己文章的评论状态", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 5, role: "AUTHOR" });
      mockPrismaCommentFindMany.mockResolvedValue([{ id: 1 }]);
      mockPrismaCommentUpdateMany.mockResolvedValue({ count: 1 });
      const result = await updateCommentStatus(
        { ids: ["00000000-0000-0000-0000-000000000001"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("无匹配评论时返回成功", async () => {
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await updateCommentStatus(
        { ids: ["00000000-0000-0000-0000-00000000000999"], status: "APPROVED" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("getCommentHistory 分支", () => {
    it("AUTHOR 角色过滤到自己的文章", async () => {
      mockAuthVerify.mockResolvedValue({ uid: 5, role: "AUTHOR" });
      mockPrismaCommentFindMany.mockResolvedValue([]);
      const result = await getCommentHistory(
        { days: 30 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });

    it("有数据时正确聚合", async () => {
      const now = new Date();
      mockPrismaCommentFindMany.mockResolvedValue([
        {
          id: 1,
          createdAt: now,
          postId: 1,
          post: { title: "Post 1", slug: "post-1" },
          pageId: null,
          page: null,
        },
        {
          id: 2,
          createdAt: now,
          postId: 1,
          post: { title: "Post 1", slug: "post-1" },
          pageId: null,
          page: null,
        },
      ]);
      const result = await getCommentHistory(
        { days: 7 },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe("likeComment/unlikeComment 错误分支", () => {
    it("likeComment 事务失败返回错误", async () => {
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: 1,
        status: "APPROVED",
      });
      mockPrismaTransaction.mockRejectedValue(new Error("TX error"));
      const result = await likeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });

    it("unlikeComment 事务失败返回错误", async () => {
      mockPrismaTransaction.mockRejectedValue(new Error("TX error"));
      const result = await unlikeComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });

  describe("deleteOwnComment 错误分支", () => {
    it("数据库错误时返回失败", async () => {
      mockPrismaCommentFindUnique.mockResolvedValue({
        id: 1,
        userUid: 1,
        status: "APPROVED",
      });
      mockPrismaCommentUpdate.mockRejectedValue(new Error("DB error"));
      const result = await deleteOwnComment(
        { commentId: "00000000-0000-0000-0000-000000000001" },
        { environment: "serveraction" },
      );
      expect((result as any).success).toBe(false);
    });
  });
});
