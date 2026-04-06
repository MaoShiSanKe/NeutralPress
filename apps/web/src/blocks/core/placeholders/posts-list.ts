import { LISTABLE_POST_PUBLISHED_WHERE } from "@/lib/server/post-access";
import prisma from "@/lib/server/prisma";

/**
 * 插值器：处理文章列表页面的占位符
 * 返回文章总数、分页数据和时间范围信息
 *
 * @param params - 参数对象
 *   - page: 页码（默认 1）
 *   - pageSize: 每页数量（默认 20）
 * @returns 包含文章列表页数据的对象
 */
export async function postsListInterpolator(
  params?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const page = parseInt(params?.page || "1", 10);
  const pageSize = parseInt(params?.pageSize || "20", 10);

  // 并发获取统计数据
  const [totalPosts, firstPost, _lastPost] = await Promise.all([
    // 统计已发布文章数
    prisma.post.count({
      where: LISTABLE_POST_PUBLISHED_WHERE,
    }),
    // 获取第一篇发布的文章
    prisma.post.findFirst({
      where: LISTABLE_POST_PUBLISHED_WHERE,
      orderBy: {
        publishedAt: "asc",
      },
      select: {
        publishedAt: true,
      },
    }),
    // 获取最后一篇更新的文章（已被 lastPublishDays 全局插值器替代）
    prisma.post.findFirst({
      where: LISTABLE_POST_PUBLISHED_WHERE,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        updatedAt: true,
      },
    }),
  ]);

  // 获取所有文章的 slug（用于随机链接）
  const allPosts = await prisma.post.findMany({
    where: LISTABLE_POST_PUBLISHED_WHERE,
    select: {
      slug: true,
    },
  });

  const postsList = allPosts.map((p) => `/posts/${p.slug}`);

  const totalPages = Math.ceil(totalPosts / pageSize);
  const firstPostNum = pageSize * (page - 1) + 1;
  const lastPostNum = Math.min(pageSize * page, totalPosts);

  return {
    postsList, // 用于随机链接
    postsListPage: page,
    postsListTotalPage: totalPages,
    postsListFirstPage: firstPostNum,
    postsListLastPage: lastPostNum,
    firstPublishAt: firstPost?.publishedAt?.toISOString() || "未知日期",
  };
}
