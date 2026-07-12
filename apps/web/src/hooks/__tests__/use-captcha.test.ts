import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 模拟 @cap.js/widget - 使用 class 作为构造函数
const mockAddEventListener = vi.fn();
const mockSolve = vi
  .fn()
  .mockResolvedValue({ success: true, token: "test-token" });
const mockReset = vi.fn();

class MockCap {
  addEventListener = mockAddEventListener;
  solve = mockSolve;
  reset = mockReset;
}

vi.mock("@cap.js/widget", () => ({
  default: MockCap,
}));

// 模拟 server actions
vi.mock("@/actions/captcha", () => ({
  createChallenge: vi.fn().mockResolvedValue({
    success: true,
    data: { challenge: "test-challenge" },
  }),
  verifyChallenge: vi.fn().mockResolvedValue({
    success: true,
    data: { token: "verified-token" },
  }),
}));

describe("useCaptcha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清理 window 上的 CAP_CUSTOM_FETCH
    delete (window as unknown as Record<string, unknown>).CAP_CUSTOM_FETCH;
  });

  it("返回 solve、reset 和 isReady", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const { result } = renderHook(() => useCaptcha());

    expect(result.current.solve).toBeInstanceOf(Function);
    expect(result.current.reset).toBeInstanceOf(Function);
    expect(typeof result.current.isReady).toBe("boolean");
  });

  it("solve 调用 Cap 实例的 solve 方法", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const { result } = renderHook(() => useCaptcha());

    const response = await act(async () => {
      return await result.current.solve();
    });

    expect(response).toEqual({ success: true, token: "test-token" });
  });

  it("reset 调用 Cap 实例的 reset 方法", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const { result } = renderHook(() => useCaptcha());

    // 首先触发初始化
    await act(async () => {
      await result.current.solve();
    });

    act(() => {
      result.current.reset();
    });

    expect(mockReset).toHaveBeenCalled();
  });

  it("支持自定义回调", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const onError = vi.fn();
    const onProgress = vi.fn();
    const onSolve = vi.fn();
    const onReset = vi.fn();

    const { result } = renderHook(() =>
      useCaptcha({ onError, onProgress, onSolve, onReset }),
    );

    // 触发初始化
    await act(async () => {
      await result.current.solve();
    });

    // 验证 addEventListener 被调用并注册了自定义回调
    const eventTypes = mockAddEventListener.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(eventTypes).toContain("error");
    expect(eventTypes).toContain("progress");
    expect(eventTypes).toContain("solve");
    expect(eventTypes).toContain("reset");
  });

  it("不传回调时使用默认 console 方法", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useCaptcha());

    await act(async () => {
      await result.current.solve();
    });

    // 事件监听器已注册
    expect(mockAddEventListener).toHaveBeenCalled();

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe("useCaptcha CAP_CUSTOM_FETCH 设置", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as unknown as Record<string, unknown>).CAP_CUSTOM_FETCH;
  });

  it("设置 window.CAP_CUSTOM_FETCH", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    renderHook(() => useCaptcha());

    expect(window.CAP_CUSTOM_FETCH).toBeDefined();
    expect(typeof window.CAP_CUSTOM_FETCH).toBe("function");
  });

  it("CAP_CUSTOM_FETCH 处理 /challenge 请求", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const { createChallenge } = await import("@/actions/captcha");

    renderHook(() => useCaptcha());

    const fetchFn = (window as unknown as Record<string, unknown>)
      .CAP_CUSTOM_FETCH as (
      url: string,
      options?: Record<string, unknown>,
    ) => Promise<Response>;

    const response = await fetchFn("/challenge");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ challenge: "test-challenge" });
    expect(createChallenge).toHaveBeenCalled();
  });

  it("CAP_CUSTOM_FETCH 处理 /redeem 请求", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const { verifyChallenge } = await import("@/actions/captcha");

    renderHook(() => useCaptcha());

    const fetchFn = (window as unknown as Record<string, unknown>)
      .CAP_CUSTOM_FETCH as (
      url: string,
      options?: Record<string, unknown>,
    ) => Promise<Response>;

    const response = await fetchFn("/redeem", {
      body: JSON.stringify({ solution: "test-solution" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ token: "verified-token" });
    expect(verifyChallenge).toHaveBeenCalledWith({ solution: "test-solution" });
  });

  it("CAP_CUSTOM_FETCH 对未知 URL 返回 500", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");

    renderHook(() => useCaptcha());

    const fetchFn = (window as unknown as Record<string, unknown>)
      .CAP_CUSTOM_FETCH as (
      url: string,
      options?: Record<string, unknown>,
    ) => Promise<Response>;

    const response = await fetchFn("/unknown-url");

    expect(response.status).toBe(500);
  });

  it("CAP_CUSTOM_FETCH 当 createChallenge 失败时返回 500", async () => {
    const { useCaptcha } = await import("@/hooks/use-captcha");
    const { createChallenge } = await import("@/actions/captcha");

    vi.mocked(createChallenge).mockResolvedValueOnce({
      success: false,
      data: null,
    } as unknown as Awaited<ReturnType<typeof createChallenge>>);

    renderHook(() => useCaptcha());

    const fetchFn = (window as unknown as Record<string, unknown>)
      .CAP_CUSTOM_FETCH as (
      url: string,
      options?: Record<string, unknown>,
    ) => Promise<Response>;

    const response = await fetchFn("/challenge");
    expect(response.status).toBe(500);
  });
});
