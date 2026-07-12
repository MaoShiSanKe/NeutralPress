import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FunctionExecutionError,
  FunctionNotFoundError,
  useFunction,
} from "@/hooks/use-function";

// useFunction() 返回的是同一个单例 store 的访问器
// 因此可以通过 useFunction().getState() 直接测试
describe("useFunction store", () => {
  function getStore() {
    return useFunction().getState();
  }

  afterEach(() => {
    // 清理所有注册的函数
    const state = getStore();
    const names = state.getFunctionNames();
    names.forEach((name) => state.unregisterFunction(name));
  });

  it("初始状态下没有注册函数", () => {
    const state = getStore();
    expect(state.getFunctionNames()).toEqual([]);
    expect(state.getFunctionCount()).toBe(0);
  });

  it("registerFunction 注册函数", () => {
    const state = getStore();
    const fn = vi.fn(() => "result");

    state.registerFunction("myFunc", fn);
    expect(state.hasFunction("myFunc")).toBe(true);
    expect(state.getFunctionCount()).toBe(1);

    // 清理
    state.unregisterFunction("myFunc");
  });

  it("unregisterFunction 移除函数", () => {
    const state = getStore();
    const fn = vi.fn(() => "result");

    state.registerFunction("tempFunc", fn);
    expect(state.hasFunction("tempFunc")).toBe(true);

    state.unregisterFunction("tempFunc");
    expect(state.hasFunction("tempFunc")).toBe(false);
    expect(state.getFunctionCount()).toBe(0);
  });

  it("callFunction 调用已注册的函数并返回结果", async () => {
    const state = getStore();
    const add = vi.fn((a: number, b: number) => a + b);

    state.registerFunction("add", add as any);

    const result = await state.callFunction("add", 3, 5);
    expect(result).toBe(8);
    expect(add).toHaveBeenCalledWith(3, 5);

    // 清理
    state.unregisterFunction("add");
  });

  it("callFunction 对未注册的函数抛出 FunctionNotFoundError", async () => {
    const state = getStore();

    await expect(state.callFunction("nonexistent", "arg")).rejects.toThrow(
      FunctionNotFoundError,
    );
  });

  it("callFunction 捕获函数执行错误并抛出 FunctionExecutionError", async () => {
    const state = getStore();
    const failingFn = vi.fn(() => {
      throw new Error("execution failed");
    });

    state.registerFunction("failFn", failingFn);

    await expect(state.callFunction("failFn")).rejects.toThrow(
      FunctionExecutionError,
    );

    // 清理
    state.unregisterFunction("failFn");
  });

  it("callFunction 支持异步函数", async () => {
    const state = getStore();
    const asyncFn = vi.fn(async (value: string) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return `processed: ${value}`;
    });

    state.registerFunction("asyncFn", asyncFn as any);

    const result = await state.callFunction("asyncFn", "test");
    expect(result).toBe("processed: test");

    // 清理
    state.unregisterFunction("asyncFn");
  });

  it("callFunctionSync 同步调用函数", () => {
    const state = getStore();
    const multiply = vi.fn((a: number, b: number) => a * b);

    state.registerFunction("multiply", multiply as any);

    const result = state.callFunctionSync("multiply", 4, 6);
    expect(result).toBe(24);

    // 清理
    state.unregisterFunction("multiply");
  });

  it("callFunctionSync 对未注册的函数抛出 FunctionNotFoundError", () => {
    const state = getStore();

    expect(() => state.callFunctionSync("nonexistent")).toThrow(
      FunctionNotFoundError,
    );
  });

  it("callFunctionSync 捕获函数执行错误并抛出 FunctionExecutionError", () => {
    const state = getStore();
    const failingFn = vi.fn(() => {
      throw new Error("sync error");
    });

    state.registerFunction("syncFailFn", failingFn);

    expect(() => state.callFunctionSync("syncFailFn")).toThrow(
      FunctionExecutionError,
    );

    // 清理
    state.unregisterFunction("syncFailFn");
  });

  it("hasFunction 对已注册函数返回 true", () => {
    const state = getStore();
    state.registerFunction("exists", vi.fn());

    expect(state.hasFunction("exists")).toBe(true);

    // 清理
    state.unregisterFunction("exists");
  });

  it("hasFunction 对未注册函数返回 false", () => {
    const state = getStore();
    expect(state.hasFunction("notExists")).toBe(false);
  });

  it("getFunctionNames 返回所有注册的函数名", () => {
    const state = getStore();
    state.registerFunction("fnA", vi.fn());
    state.registerFunction("fnB", vi.fn());

    const names = state.getFunctionNames();
    expect(names).toContain("fnA");
    expect(names).toContain("fnB");

    // 清理
    state.unregisterFunction("fnA");
    state.unregisterFunction("fnB");
  });

  it("getFunctionCount 返回正确的数量", () => {
    const state = getStore();
    const initial = state.getFunctionCount();

    state.registerFunction("countFn1", vi.fn());
    state.registerFunction("countFn2", vi.fn());

    expect(state.getFunctionCount()).toBe(initial + 2);

    state.unregisterFunction("countFn1");
    expect(state.getFunctionCount()).toBe(initial + 1);

    // 清理
    state.unregisterFunction("countFn2");
  });

  it("registerFunction 覆盖同名函数", () => {
    const state = getStore();
    const fn1 = vi.fn(() => "first");
    const fn2 = vi.fn(() => "second");

    const countBefore = state.getFunctionCount();
    state.registerFunction("overridable", fn1);
    state.registerFunction("overridable", fn2);

    // 应该只有一个（覆盖了）
    expect(state.getFunctionCount()).toBe(countBefore + 1);

    // 清理
    state.unregisterFunction("overridable");
  });

  describe("FunctionNotFoundError", () => {
    it("包含正确的错误信息", () => {
      const error = new FunctionNotFoundError("myFunc");
      expect(error.message).toBe("Function 'myFunc' not found");
      expect(error.name).toBe("FunctionNotFoundError");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("FunctionExecutionError", () => {
    it("包含正确的错误信息和原始错误", () => {
      const originalError = new Error("original");
      const error = new FunctionExecutionError("myFunc", originalError);

      expect(error.message).toBe(
        "Function 'myFunc' execution failed: original",
      );
      expect(error.name).toBe("FunctionExecutionError");
      expect(error.cause).toBe(originalError);
      expect(error).toBeInstanceOf(Error);
    });

    it("处理非 Error 类型的原始错误", () => {
      const error = new FunctionExecutionError("myFunc", "string error");

      expect(error.message).toBe(
        "Function 'myFunc' execution failed: string error",
      );
    });
  });
});
