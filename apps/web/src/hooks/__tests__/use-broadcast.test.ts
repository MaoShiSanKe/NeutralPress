import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBroadcast, useBroadcastSender } from "@/hooks/use-broadcast";
import { useBroadcastStore } from "@/store/broadcast-store";

// 测试 broadcast store 的核心逻辑
// useBroadcast 和 useBroadcastSender 是对 store 的 thin wrapper
describe("useBroadcastStore", () => {
  afterEach(() => {
    // 清理所有注册的回调
    const state = useBroadcastStore.getState();
    state.callbacks.forEach((cb) => state.unregisterCallback(cb.id));
  });

  it("初始状态下没有回调", () => {
    const state = useBroadcastStore.getState();
    expect(state.callbacks).toHaveLength(0);
    expect(state.getCallbackCount()).toBe(0);
  });

  it("registerCallback 注册回调", () => {
    const state = useBroadcastStore.getState();
    const id = Symbol("test");
    const callback = vi.fn();

    state.registerCallback(id, callback);
    expect(state.getCallbackCount()).toBe(1);

    // 清理
    state.unregisterCallback(id);
  });

  it("unregisterCallback 移除回调", () => {
    const state = useBroadcastStore.getState();
    const id = Symbol("test");
    const callback = vi.fn();

    state.registerCallback(id, callback);
    expect(state.getCallbackCount()).toBe(1);

    state.unregisterCallback(id);
    expect(state.getCallbackCount()).toBe(0);
  });

  it("broadcast 调用所有注册的回调", async () => {
    const state = useBroadcastStore.getState();
    const id1 = Symbol("test1");
    const id2 = Symbol("test2");
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    state.registerCallback(id1, callback1);
    state.registerCallback(id2, callback2);

    await state.broadcast("hello");

    expect(callback1).toHaveBeenCalledWith("hello");
    expect(callback2).toHaveBeenCalledWith("hello");

    // 清理
    state.unregisterCallback(id1);
    state.unregisterCallback(id2);
  });

  it("broadcast 不调用已取消注册的回调", async () => {
    const state = useBroadcastStore.getState();
    const id1 = Symbol("test1");
    const id2 = Symbol("test2");
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    state.registerCallback(id1, callback1);
    state.registerCallback(id2, callback2);
    state.unregisterCallback(id1);

    await state.broadcast("hello");

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledWith("hello");

    // 清理
    state.unregisterCallback(id2);
  });

  it("broadcast 支持异步回调", async () => {
    const state = useBroadcastStore.getState();
    const id = Symbol("test");
    const results: string[] = [];
    const callback = vi.fn(async (msg: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(msg as string);
    });

    state.registerCallback(id, callback);
    await state.broadcast("async-message");

    expect(results).toEqual(["async-message"]);

    // 清理
    state.unregisterCallback(id);
  });

  it("broadcast 不会因为某个异步回调失败而中断", async () => {
    const state = useBroadcastStore.getState();
    const id1 = Symbol("test1");
    const id2 = Symbol("test2");
    // 使用异步回调抛出错误 - Promise.allSettled 可以捕获
    const callback1 = vi.fn(async () => {
      throw new Error("async callback error");
    });
    const callback2 = vi.fn(async () => "success");

    state.registerCallback(id1, callback1 as any);
    state.registerCallback(id2, callback2 as any);

    // broadcast 使用 Promise.allSettled，异步错误不会中断
    await expect(state.broadcast("msg")).resolves.not.toThrow();

    expect(callback2).toHaveBeenCalledWith("msg");

    // 清理
    state.unregisterCallback(id1);
    state.unregisterCallback(id2);
  });

  it("unregisterCallback 对不存在的 id 不报错", () => {
    const state = useBroadcastStore.getState();
    const id = Symbol("nonexistent");

    expect(() => state.unregisterCallback(id)).not.toThrow();
  });

  it("getCallbackCount 返回正确的数量", () => {
    const state = useBroadcastStore.getState();
    const initialCount = state.getCallbackCount();

    const id1 = Symbol("test1");
    const id2 = Symbol("test2");
    state.registerCallback(id1, vi.fn());
    state.registerCallback(id2, vi.fn());

    expect(state.getCallbackCount()).toBe(initialCount + 2);

    state.unregisterCallback(id1);
    expect(state.getCallbackCount()).toBe(initialCount + 1);

    state.unregisterCallback(id2);
    expect(state.getCallbackCount()).toBe(initialCount);
  });
});

// Hook 级别测试
describe("useBroadcast hook", () => {
  afterEach(() => {
    const state = useBroadcastStore.getState();
    state.callbacks.forEach((cb) => state.unregisterCallback(cb.id));
  });

  it("注册回调并在收到广播时调用", async () => {
    const callback = vi.fn();
    renderHook(() => useBroadcast(callback));

    expect(useBroadcastStore.getState().getCallbackCount()).toBeGreaterThan(0);

    await useBroadcastStore.getState().broadcast("test-message");

    expect(callback).toHaveBeenCalledWith("test-message");
  });

  it("卸载时自动取消注册回调", () => {
    const callback = vi.fn();
    const initialCount = useBroadcastStore.getState().getCallbackCount();

    const { unmount } = renderHook(() => useBroadcast(callback));

    expect(useBroadcastStore.getState().getCallbackCount()).toBe(
      initialCount + 1,
    );

    unmount();

    expect(useBroadcastStore.getState().getCallbackCount()).toBe(initialCount);
  });

  it("回调引用更新后使用最新回调", async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(({ cb }) => useBroadcast(cb), {
      initialProps: { cb: callback1 },
    });

    // 更新回调
    rerender({ cb: callback2 });

    await useBroadcastStore.getState().broadcast("msg");

    // 应该调用最新的回调（通过 ref 更新）
    expect(callback2).toHaveBeenCalledWith("msg");
  });

  it("支持异步回调", async () => {
    const results: string[] = [];
    const callback = vi.fn(async (msg: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(msg);
    });

    renderHook(() => useBroadcast(callback));

    await useBroadcastStore.getState().broadcast("async-msg");

    expect(results).toEqual(["async-msg"]);
  });

  it("支持泛型类型参数", async () => {
    interface CustomMessage {
      type: string;
      payload: number;
    }

    const callback = vi.fn();
    renderHook(() => useBroadcast<CustomMessage>(callback));

    const msg: CustomMessage = { type: "update", payload: 42 };
    await useBroadcastStore.getState().broadcast(msg);

    expect(callback).toHaveBeenCalledWith(msg);
  });
});

describe("useBroadcastSender hook", () => {
  afterEach(() => {
    const state = useBroadcastStore.getState();
    state.callbacks.forEach((cb) => state.unregisterCallback(cb.id));
  });

  it("返回 broadcast 函数", () => {
    const { result } = renderHook(() => useBroadcastSender<string>());
    expect(typeof result.current.broadcast).toBe("function");
  });

  it("broadcast 函数发送消息给所有注册的回调", async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    renderHook(() => useBroadcast(callback1));
    renderHook(() => useBroadcast(callback2));

    const { result } = renderHook(() => useBroadcastSender<string>());

    await act(async () => {
      await result.current.broadcast("hello from sender");
    });

    expect(callback1).toHaveBeenCalledWith("hello from sender");
    expect(callback2).toHaveBeenCalledWith("hello from sender");
  });

  it("没有注册回调时 broadcast 不报错", async () => {
    const { result } = renderHook(() => useBroadcastSender<string>());

    await act(async () => {
      await expect(
        result.current.broadcast("no listeners"),
      ).resolves.not.toThrow();
    });
  });

  it("broadcast 函数引用保持稳定", () => {
    const { result, rerender } = renderHook(() => useBroadcastSender<string>());

    const firstBroadcast = result.current.broadcast;

    rerender();

    expect(result.current.broadcast).toBe(firstBroadcast);
  });

  it("支持泛型类型参数", async () => {
    interface CustomMessage {
      action: string;
    }

    const callback = vi.fn();
    renderHook(() => useBroadcast<CustomMessage>(callback));

    const { result } = renderHook(() => useBroadcastSender<CustomMessage>());

    await act(async () => {
      await result.current.broadcast({ action: "test" });
    });

    expect(callback).toHaveBeenCalledWith({ action: "test" });
  });
});
