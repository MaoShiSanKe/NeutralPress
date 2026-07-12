import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchGithubReleases } from "@/lib/server/github-releases";

// ============================================================================
// 测试数据工厂
// ============================================================================

function makeApiAsset(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    name: "release.zip",
    size: 1024,
    download_count: 42,
    browser_download_url:
      "https://github.com/owner/repo/releases/download/v1.0.0/release.zip",
    ...overrides,
  };
}

function makeApiRelease(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    tag_name: "v1.0.0",
    name: "Release 1.0.0",
    html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
    body: "Release notes here",
    draft: false,
    prerelease: false,
    published_at: "2024-01-15T12:00:00Z",
    created_at: "2024-01-10T12:00:00Z",
    updated_at: "2024-01-15T12:00:00Z",
    target_commitish: "main",
    author: { login: "testuser" },
    assets: [makeApiAsset()],
    ...overrides,
  };
}

// ============================================================================
// 测试套件
// ============================================================================

describe("github-releases", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("fetchGithubReleases", () => {
    it("返回单个发布并正确映射字段", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([makeApiRelease()]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result).toHaveLength(1);
      expect(result[0]?.tagName).toBe("v1.0.0");
      expect(result[0]?.name).toBe("Release 1.0.0");
      expect(result[0]?.htmlUrl).toBe(
        "https://github.com/owner/repo/releases/tag/v1.0.0",
      );
      expect(result[0]?.body).toBe("Release notes here");
      expect(result[0]?.draft).toBe(false);
      expect(result[0]?.prerelease).toBe(false);
      expect(result[0]?.publishedAt).toBe("2024-01-15T12:00:00Z");
      expect(result[0]?.createdAt).toBe("2024-01-10T12:00:00Z");
      expect(result[0]?.updatedAt).toBe("2024-01-15T12:00:00Z");
      expect(result[0]?.targetCommitish).toBe("main");
      expect(result[0]?.authorLogin).toBe("testuser");
    });

    it("正确映射 assets 字段", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            makeApiRelease({
              assets: [
                makeApiAsset({
                  id: 10,
                  name: "app-linux-x64.tar.gz",
                  size: 50_000_000,
                  download_count: 1234,
                  browser_download_url:
                    "https://github.com/owner/repo/releases/download/v1.0.0/app-linux-x64.tar.gz",
                }),
              ],
            }),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubReleases("owner", "repo");
      const asset = result[0]?.assets[0];

      expect(asset?.id).toBe(10);
      expect(asset?.name).toBe("app-linux-x64.tar.gz");
      expect(asset?.size).toBe(50_000_000);
      expect(asset?.downloadCount).toBe(1234);
      expect(asset?.downloadUrl).toBe(
        "https://github.com/owner/repo/releases/download/v1.0.0/app-linux-x64.tar.gz",
      );
    });

    it("当 name 为 null 时使用 tag_name 作为 name", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([makeApiRelease({ name: null, tag_name: "v2.0.0" })]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result[0]?.name).toBe("v2.0.0");
    });

    it("当 name 为空字符串时使用 tag_name", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([makeApiRelease({ name: "   ", tag_name: "v3.0.0" })]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result[0]?.name).toBe("v3.0.0");
    });

    it("当 author 为 null 时 authorLogin 为 null", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([makeApiRelease({ author: null })]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result[0]?.authorLogin).toBeNull();
    });

    it("按发布时间降序排列（publishedAt 优先）", async () => {
      const releases = [
        makeApiRelease({
          id: 1,
          tag_name: "v1.0.0",
          published_at: "2023-01-01T00:00:00Z",
        }),
        makeApiRelease({
          id: 3,
          tag_name: "v3.0.0",
          published_at: "2025-01-01T00:00:00Z",
        }),
        makeApiRelease({
          id: 2,
          tag_name: "v2.0.0",
          published_at: "2024-01-01T00:00:00Z",
        }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(releases), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result.map((r) => r.tagName)).toEqual([
        "v3.0.0",
        "v2.0.0",
        "v1.0.0",
      ]);
    });

    it("当 publishedAt 为 null 时使用 createdAt 排序", async () => {
      const releases = [
        makeApiRelease({
          id: 1,
          tag_name: "v1.0.0",
          published_at: null,
          created_at: "2023-01-01T00:00:00Z",
        }),
        makeApiRelease({
          id: 2,
          tag_name: "v2.0.0",
          published_at: null,
          created_at: "2025-01-01T00:00:00Z",
        }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(releases), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result.map((r) => r.tagName)).toEqual(["v2.0.0", "v1.0.0"]);
    });

    it("空数组返回空结果", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result).toEqual([]);
    });

    it("HTTP 错误时抛出异常", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Server Error", { status: 500 }),
      );

      await expect(fetchGithubReleases("owner", "repo")).rejects.toThrow(
        "GitHub Releases API 请求失败: HTTP 500",
      );
    });

    it("返回非数组时抛出异常", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "bad request" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(fetchGithubReleases("owner", "repo")).rejects.toThrow(
        "GitHub Releases API 返回格式异常",
      );
    });

    it("发送正确的请求头", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchGithubReleases("myowner", "myrepo");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/repos/myowner/myrepo/releases"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github+json",
            "User-Agent": "NeutralPress-CMS",
            "X-GitHub-Api-Version": "2022-11-28",
          }),
        }),
      );
    });

    it("包含 per_page 和 page 参数", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchGithubReleases("owner", "repo");

      const url = fetchSpy.mock.calls[0]?.[0] as string;
      expect(url).toContain("per_page=100");
      expect(url).toContain("page=1");
    });

    it("满一页时自动翻页", async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        makeApiRelease({ id: i + 1, tag_name: `v${i + 1}.0.0` }),
      );

      fetchSpy
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fullPage), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const result = await fetchGithubReleases("owner", "repo");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(100);
    });

    it("处理 draft 和 prerelease 标记", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            makeApiRelease({ draft: true, prerelease: false }),
            makeApiRelease({ id: 2, draft: false, prerelease: true }),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result[0]?.draft).toBe(true);
      expect(result[0]?.prerelease).toBe(false);
      expect(result[1]?.draft).toBe(false);
      expect(result[1]?.prerelease).toBe(true);
    });

    it("处理无 assets 的发布", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify([makeApiRelease({ assets: [] })]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result[0]?.assets).toEqual([]);
    });

    it("处理多个 assets", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            makeApiRelease({
              assets: [
                makeApiAsset({ id: 1, name: "linux.zip" }),
                makeApiAsset({ id: 2, name: "windows.zip" }),
                makeApiAsset({ id: 3, name: "mac.zip" }),
              ],
            }),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await fetchGithubReleases("owner", "repo");

      expect(result[0]?.assets).toHaveLength(3);
      expect(result[0]?.assets.map((a) => a.name)).toEqual([
        "linux.zip",
        "windows.zip",
        "mac.zip",
      ]);
    });
  });
});
