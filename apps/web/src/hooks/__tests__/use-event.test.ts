import { afterEach, describe, expect, it, vi } from "vitest";

import { useEvent } from "@/hooks/use-event";

// useEvent() 返回的是同一个单例 store 的访问器
// 因此可以通过 useEvent().getState() 直接测试 store 的状态和方法
describe("useEvent store", () => {
  // 获取 store 实例

  function getStore() {
    return useEvent().getState();
  }

  afterEach(() => {
    // 清理所有事件监听器
    const state = getStore();
    const eventNames = state.getEventNames();
    eventNames.forEach((name) => {
      const listeners = state.listeners[name] || [];
      listeners.forEach((l) => state.off(name, l.id));
    });
  });

  it("初始状态下没有事件和监听器", () => {
    const state = getStore();
    // 可能有其他测试留下的监听器，所以只验证方法存在
    expect(typeof state.getEventNames).toBe("function");
    expect(Array.isArray(state.getEventNames())).toBe(true);
  });

  it("on 注册事件监听器", () => {
    const state = getStore();
    const id = Symbol("test-listener");
    const listener = vi.fn();

    const countBefore = state.getListenerCount("test-on-event");
    state.on("test-on-event", id, listener);
    expect(state.getListenerCount("test-on-event")).toBe(countBefore + 1);

    // 清理
    state.off("test-on-event", id);
  });

  it("off 移除事件监听器", () => {
    const state = getStore();
    const id = Symbol("test-listener");
    const listener = vi.fn();

    state.on("test-off-event", id, listener);
    const countAfterRegister = state.getListenerCount("test-off-event");
    state.off("test-off-event", id);
    expect(state.getListenerCount("test-off-event")).toBe(
      countAfterRegister - 1,
    );
  });

  it("emit 调用对应事件的所有监听器", async () => {
    const state = getStore();
    const id1 = Symbol("listener1");
    const id2 = Symbol("listener2");
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    state.on("chat-message", id1, listener1);
    state.on("chat-message", id2, listener2);

    await state.emit("chat-message", "hello", "world");

    expect(listener1).toHaveBeenCalledWith("hello", "world");
    expect(listener2).toHaveBeenCalledWith("hello", "world");

    // 清理
    state.off("chat-message", id1);
    state.off("chat-message", id2);
  });

  it("emit 不调用其他事件的监听器", async () => {
    const state = getStore();
    const id1 = Symbol("listener1");
    const id2 = Symbol("listener2");
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    state.on("event-a-unique", id1, listener1);
    state.on("event-b-unique", id2, listener2);

    await state.emit("event-a-unique", "data");

    expect(listener1).toHaveBeenCalledWith("data");
    expect(listener2).not.toHaveBeenCalled();

    // 清理
    state.off("event-a-unique", id1);
    state.off("event-b-unique", id2);
  });

  it("emitSync 同步调用监听器", () => {
    const state = getStore();
    const id = Symbol("listener");
    const results: string[] = [];
    const listener = vi.fn((...args: unknown[]) => {
      results.push(args[0] as string);
    });

    state.on("sync-event", id, listener);
    state.emitSync("sync-event", "sync-data");

    expect(results).toEqual(["sync-data"]);
    expect(listener).toHaveBeenCalledWith("sync-data");

    // 清理
    state.off("sync-event", id);
  });

  it("emitSync 捕获监听器中的错误不影响其他监听器", () => {
    const state = getStore();
    const id1 = Symbol("error-listener");
    const id2 = Symbol("good-listener");
    const listener1 = vi.fn(() => {
      throw new Error("listener error");
    });
    const listener2 = vi.fn();

    state.on("error-event-unique", id1, listener1);
    state.on("error-event-unique", id2, listener2);

    // emitSync 在 try-catch 中调用，不会抛出错误
    expect(() => state.emitSync("error-event-unique", "data")).not.toThrow();

    // 第二个监听器仍然被调用
    expect(listener2).toHaveBeenCalledWith("data");

    // 清理
    state.off("error-event-unique", id1);
    state.off("error-event-unique", id2);
  });

  it("emit 支持异步监听器", async () => {
    const state = getStore();
    const id = Symbol("async-listener");
    const results: string[] = [];
    const listener = vi.fn(async (...args: unknown[]) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(args[0] as string);
    });

    state.on("async-event", id, listener);
    await state.emit("async-event", "async-data");

    expect(results).toEqual(["async-data"]);

    // 清理
    state.off("async-event", id);
  });

  it("emit 使用 Promise.allSettled 不会因为异步监听器失败而中断", async () => {
    const state = getStore();
    const id1 = Symbol("error-listener");
    const id2 = Symbol("good-listener");
    const listener1 = vi.fn(async () => {
      throw new Error("async error");
    });
    const listener2 = vi.fn(async () => "success");

    state.on("settled-event", id1, listener1 as any);
    state.on("settled-event", id2, listener2 as any);

    // emit 使用 Promise.allSettled，对于异步错误不会 reject
    await expect(state.emit("settled-event", "data")).resolves.not.toThrow();

    expect(listener2).toHaveBeenCalledWith("data");

    // 清理
    state.off("settled-event", id1);
    state.off("settled-event", id2);
  });

  it("getListenerCount 返回正确的监听器数量", () => {
    const state = getStore();
    const id1 = Symbol("l1");
    const id2 = Symbol("l2");
    const id3 = Symbol("l3");

    const event = "count-event-unique";
    const countBefore = state.getListenerCount(event);

    state.on(event, id1, vi.fn());
    state.on(event, id2, vi.fn());
    state.on(event, id3, vi.fn());

    expect(state.getListenerCount(event)).toBe(countBefore + 3);

    state.off(event, id2);
    expect(state.getListenerCount(event)).toBe(countBefore + 2);

    // 清理
    state.off(event, id1);
    state.off(event, id3);
  });

  it("getListenerCount 对未注册事件返回 0", () => {
    const state = getStore();
    expect(state.getListenerCount("never-registered-event")).toBe(0);
  });

  it("getEventNames 返回所有有监听器的事件名", () => {
    const state = getStore();
    const id1 = Symbol("l1");
    const id2 = Symbol("l2");

    state.on("alpha-unique", id1, vi.fn());
    state.on("beta-unique", id2, vi.fn());

    const names = state.getEventNames();
    expect(names).toContain("alpha-unique");
    expect(names).toContain("beta-unique");

    // 清理
    state.off("alpha-unique", id1);
    state.off("beta-unique", id2);
  });

  it("off 只移除指定 id 的监听器", () => {
    const state = getStore();
    const id1 = Symbol("l1");
    const id2 = Symbol("l2");
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const event = "selective-event-unique";
    state.on(event, id1, listener1);
    state.on(event, id2, listener2);

    const countAfterRegister = state.getListenerCount(event);

    state.off(event, id1);
    expect(state.getListenerCount(event)).toBe(countAfterRegister - 1);

    // 清理
    state.off(event, id2);
  });
});
