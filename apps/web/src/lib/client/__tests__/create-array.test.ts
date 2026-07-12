import { describe, expect, it } from "vitest";

import { createArray } from "@/lib/client/create-array";

describe("createArray", () => {
  it("应创建从 from 到 to 的连续数组", () => {
    expect(createArray(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("当 from 等于 to 时应返回单元素数组", () => {
    expect(createArray(3, 3)).toEqual([3]);
  });

  it("应支持从 1 到 12 的范围（GridArea 范围）", () => {
    const result = createArray(1, 12);
    expect(result).toHaveLength(12);
    expect(result[0]).toBe(1);
    expect(result[11]).toBe(12);
  });

  it("当 from 大于 to 时应返回空数组", () => {
    expect(createArray(5, 3)).toEqual([]);
  });

  it("应支持从 0 开始的范围", () => {
    expect(createArray(0, 3)).toEqual([0, 1, 2, 3]);
  });
});
