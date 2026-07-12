import { describe, expect, it, vi } from "vitest";

import { resolveApiResponse } from "@/lib/client/run-with-auth";

// Mock server actions
vi.mock("@/actions/auth", () => ({
  refresh: vi.fn(),
}));

describe("resolveApiResponse", () => {
  it("应直接返回非 Response 对象", async () => {
    const apiResponse = { success: true, data: { id: 1 } };
    const result = await resolveApiResponse(apiResponse as any);
    expect(result).toBe(apiResponse);
  });

  it("应从 Response 对象中解析 JSON", async () => {
    const apiResponse = { success: true, data: { id: 1 } };
    const response = new Response(JSON.stringify(apiResponse));
    const result = await resolveApiResponse(response as any);
    expect(result).toEqual(apiResponse);
  });

  it("Response 解析失败时应返回 undefined", async () => {
    // 创建一个 body 已被消费的 Response
    const response = new Response("invalid json");
    // 先消费 body 使第二次解析失败
    await response.text();

    // clone 后解析无效 JSON
    const badResponse = new Response("{invalid json");
    const result = await resolveApiResponse(badResponse as any);
    expect(result).toBeUndefined();
  });

  it("应返回错误响应", async () => {
    const errorResponse = {
      success: false,
      error: { code: "UNAUTHORIZED", message: "未授权" },
    };
    const result = await resolveApiResponse(errorResponse as any);
    expect(result).toEqual(errorResponse);
  });

  it("应处理包含嵌套数据的响应", async () => {
    const complexResponse = {
      success: true,
      data: {
        user: { uid: 1, username: "test" },
        tokens: { access: "abc", refresh: "def" },
      },
    };
    const response = new Response(JSON.stringify(complexResponse));
    const result = await resolveApiResponse(response as any);
    expect(result).toEqual(complexResponse);
  });
});
