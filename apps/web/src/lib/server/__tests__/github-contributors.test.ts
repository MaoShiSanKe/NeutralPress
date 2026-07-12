import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchGithubContributors,
  type GithubContributor,
} from "@/lib/server/github-contributors";

// ============================================================================
// 测试数据
// ============================================================================

function makeApiContributor(overrides?: Partial<GithubContributor>) {
  return {
    id: 1,
    login: "testuser",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    html_url: "https://github.com/testuser",
    contributions: 42,
    type: "User",
    ...overrides,
  };
}

function makeExpectedContributor(overrides?: Partial<GithubContributor>) {
  return {
    id: 1,
    login: "testuser",
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    profileUrl: "https://github.com/testuser",
    contributions: 42,
    type: "User",
    ...overrides,
  };
}

// ============================================================================
// 测试套件
// ============================================================================

describe("github-contributors", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("fetchGithubContributors", () => {
    it("返回单个贡献者", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([makeApiContributor()]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubContributors("owner", "repo");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(makeExpectedContributor());
    });

    it("正确映射 API 字段到 camelCase", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            makeApiContributor({
              id: 99,
              login: "contributor1",
              avatarUrl: "https://avatars.githubusercontent.com/u/99?v=4",
              profileUrl: "https://github.com/contributor1",
              contributions: 150,
              type: "User",
            }),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubContributors("owner", "repo");

      expect(result[0]!.id).toBe(99);
      expect(result[0]!.login).toBe("contributor1");
      expect(result[0]!.avatarUrl).toBe(
        "https://avatars.githubusercontent.com/u/99?v=4",
      );
      expect(result[0]!.profileUrl).toBe("https://github.com/contributor1");
      expect(result[0]!.contributions).toBe(150);
      expect(result[0]!.type).toBe("User");
    });

    it("返回多个贡献者", async () => {
      const contributors = [
        makeApiContributor({ id: 1, login: "user1" }),
        makeApiContributor({ id: 2, login: "user2" }),
        makeApiContributor({ id: 3, login: "user3" }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(contributors), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubContributors("owner", "repo");

      expect(result).toHaveLength(3);
      expect(result.map((c) => c.login)).toEqual(["user1", "user2", "user3"]);
    });

    it("根据 limit 参数限制返回数量", async () => {
      const contributors = Array.from({ length: 10 }, (_, i) =>
        makeApiContributor({ id: i + 1, login: `user${i + 1}` }),
      );

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(contributors), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubContributors("owner", "repo", {
        limit: 3,
      });

      expect(result).toHaveLength(3);
    });

    it("默认 limit 为 100", async () => {
      // 空数组表示没有贡献者
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchGithubContributors("owner", "repo");

      // 验证请求发送到了正确的 URL
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/repos/owner/repo/contributors"),
        expect.any(Object),
      );
    });

    it("HTTP 错误时抛出异常", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Not Found", { status: 404 }),
      );

      await expect(fetchGithubContributors("owner", "repo")).rejects.toThrow(
        "GitHub Contributors API 请求失败: HTTP 404",
      );
    });

    it("返回非数组时抛出异常", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "error" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(fetchGithubContributors("owner", "repo")).rejects.toThrow(
        "GitHub Contributors API 返回格式异常",
      );
    });

    it("空数组时返回空结果", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubContributors("owner", "repo");

      expect(result).toEqual([]);
    });

    it("发送正确的请求头", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchGithubContributors("myowner", "myrepo");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/repos/myowner/myrepo/contributors"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github+json",
            "User-Agent": "NeutralPress-CMS",
            "X-GitHub-Api-Version": "2022-11-28",
          }),
        }),
      );
    });

    it("使用正确的 URL 包含 per_page 和 page 参数", async () => {
      // 第一页返回满 100 条，设置 limit > 100 触发翻页；第二页返回 50 条
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        makeApiContributor({ id: i + 1, login: `user${i + 1}` }),
      );
      const secondPage = Array.from({ length: 50 }, (_, i) =>
        makeApiContributor({ id: 100 + i + 1, login: `user${100 + i + 1}` }),
      );

      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fullPage), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(secondPage), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const result = await fetchGithubContributors("owner", "repo", {
        limit: 200,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls[0]?.[0]).toContain("page=1");
      expect(fetchSpy.mock.calls[1]?.[0]).toContain("page=2");
      expect(result).toHaveLength(150);
    });

    it("当最后一页不满时停止翻页", async () => {
      const partialPage = Array.from({ length: 50 }, (_, i) =>
        makeApiContributor({ id: i + 1, login: `user${i + 1}` }),
      );

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(partialPage), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubContributors("owner", "repo");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(50);
    });

    it("处理 Bot 类型贡献者", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            makeApiContributor({
              id: 1,
              login: "dependabot[bot]",
              type: "Bot",
            }),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubContributors("owner", "repo");

      expect(result[0]?.type).toBe("Bot");
      expect(result[0]?.login).toBe("dependabot[bot]");
    });
  });
});
