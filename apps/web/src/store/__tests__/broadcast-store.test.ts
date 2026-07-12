import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBroadcastStore } from "@/store/broadcast-store";

describe("broadcast-store", () => {
  beforeEach(() => {
    // 重置 store 状态
    useBroadcastStore.setState({ callbacks: [] });
  });

  describe("初始状态", () => {
    it("callbacks 初始为空数组", () => {
      const state = useBroadcastStore.getState();
      expect(state.callbacks).toEqual([]);
    });

    it("getCallbackCount 初始返回 0", () => {
      const state = useBroadcastStore.getState();
      expect(state.getCallbackCount()).toBe(0);
    });
  });

  describe("registerCallback", () => {
    it("注册单个回调", () => {
      const id = Symbol("test");
      const callback = vi.fn();
      useBroadcastStore.getState().registerCallback(id, callback);

      const state = useBroadcastStore.getState();
      expect(state.callbacks).toHaveLength(1);
      expect(state.callbacks[0]!.id).toBe(id);
      expect(state.callbacks[0]!.callback).toBe(callback);
    });

    it("注册多个回调", () => {
      const id1 = Symbol("test1");
      const id2 = Symbol("test2");
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const state = useBroadcastStore.getState();
      state.registerCallback(id1, callback1);
      state.registerCallback(id2, callback2);

      expect(useBroadcastStore.getState().callbacks).toHaveLength(2);
      expect(useBroadcastStore.getState().getCallbackCount()).toBe(2);
    });

    it("相同 id 可以重复注册", () => {
      const id = Symbol("test");
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const state = useBroadcastStore.getState();
      state.registerCallback(id, callback1);
      state.registerCallback(id, callback2);

      // Symbol 每次创建都是唯一的，所以实际上两个不同的 symbol
      expect(useBroadcastStore.getState().callbacks).toHaveLength(2);
    });
  });

  describe("unregisterCallback", () => {
    it("注销指定 id 的回调", () => {
      const id1 = Symbol("test1");
      const id2 = Symbol("test2");
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const state = useBroadcastStore.getState();
      state.registerCallback(id1, callback1);
      state.registerCallback(id2, callback2);

      state.unregisterCallback(id1);

      const updated = useBroadcastStore.getState();
      expect(updated.callbacks).toHaveLength(1);
      expect(updated.callbacks[0]!.id).toBe(id2);
    });

    it("注销不存在的 id 不影响其他回调", () => {
      const id1 = Symbol("test1");
      const idUnknown = Symbol("unknown");
      const callback1 = vi.fn();

      useBroadcastStore.getState().registerCallback(id1, callback1);
      useBroadcastStore.getState().unregisterCallback(idUnknown);

      expect(useBroadcastStore.getState().callbacks).toHaveLength(1);
    });

    it("注销所有回调后 callbacks 为空", () => {
      const id1 = Symbol("test1");
      const id2 = Symbol("test2");

      const state = useBroadcastStore.getState();
      state.registerCallback(id1, vi.fn());
      state.registerCallback(id2, vi.fn());

      state.unregisterCallback(id1);
      state.unregisterCallback(id2);

      expect(useBroadcastStore.getState().callbacks).toHaveLength(0);
      expect(useBroadcastStore.getState().getCallbackCount()).toBe(0);
    });
  });

  describe("broadcast", () => {
    it("调用所有已注册的回调", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const state = useBroadcastStore.getState();
      state.registerCallback(Symbol("1"), callback1);
      state.registerCallback(Symbol("2"), callback2);

      await state.broadcast("hello");

      expect(callback1).toHaveBeenCalledWith("hello");
      expect(callback2).toHaveBeenCalledWith("hello");
    });

    it("无回调时 broadcast 不抛出错误", async () => {
      await expect(
        useBroadcastStore.getState().broadcast("test"),
      ).resolves.toBeUndefined();
    });

    it("传递不同类型的消息", async () => {
      const callback = vi.fn();
      useBroadcastStore.getState().registerCallback(Symbol("test"), callback);

      const state = useBroadcastStore.getState();
      await state.broadcast({ type: "update", data: 42 });
      expect(callback).toHaveBeenCalledWith({ type: "update", data: 42 });

      await state.broadcast(null);
      expect(callback).toHaveBeenCalledWith(null);

      await state.broadcast([1, 2, 3]);
      expect(callback).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("异步回调也能正确执行", async () => {
      const asyncCallback = vi.fn().mockResolvedValue(undefined);

      useBroadcastStore
        .getState()
        .registerCallback(Symbol("test"), asyncCallback);
      await useBroadcastStore.getState().broadcast("async-msg");

      expect(asyncCallback).toHaveBeenCalledWith("async-msg");
    });

    it("某个回调抛出错误不影响其他回调执行", async () => {
      const errorCallback = vi.fn().mockRejectedValue(new Error("fail"));
      const normalCallback = vi.fn();

      const state = useBroadcastStore.getState();
      state.registerCallback(Symbol("err"), errorCallback);
      state.registerCallback(Symbol("ok"), normalCallback);

      await state.broadcast("test");

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe("getCallbackCount", () => {
    it("注册回调后计数增加", () => {
      const state = useBroadcastStore.getState();
      expect(state.getCallbackCount()).toBe(0);

      state.registerCallback(Symbol("1"), vi.fn());
      expect(useBroadcastStore.getState().getCallbackCount()).toBe(1);

      useBroadcastStore.getState().registerCallback(Symbol("2"), vi.fn());
      expect(useBroadcastStore.getState().getCallbackCount()).toBe(2);
    });

    it("注销回调后计数减少", () => {
      const id = Symbol("test");
      useBroadcastStore.getState().registerCallback(id, vi.fn());
      expect(useBroadcastStore.getState().getCallbackCount()).toBe(1);

      useBroadcastStore.getState().unregisterCallback(id);
      expect(useBroadcastStore.getState().getCallbackCount()).toBe(0);
    });
  });
});
