import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useUserInfo } from "@/hooks/use-user-info";

describe("useUserInfo", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("初始状态返回 null", () => {
    const { result } = renderHook(() => useUserInfo());
    expect(result.current).toBeNull();
  });

  it("从 localStorage 读取用户信息", () => {
    const userInfo = {
      uid: 1,
      username: "testuser",
      nickname: "Test User",
      role: "ADMIN",
    };
    localStorage.setItem("user_info", JSON.stringify(userInfo));

    const { result } = renderHook(() => useUserInfo());

    // useEffect 在下一帧执行
    expect(result.current).toEqual(userInfo);
  });

  it("返回完整的 UserInfo 对象", () => {
    const userInfo = {
      uid: 42,
      username: "admin",
      nickname: "管理员",
      role: "ADMIN",
      exp: "2025-12-31T23:59:59Z",
      lastRefresh: "2024-01-01T00:00:00Z",
    };
    localStorage.setItem("user_info", JSON.stringify(userInfo));

    const { result } = renderHook(() => useUserInfo());
    expect(result.current).toEqual(userInfo);
    expect(result.current?.uid).toBe(42);
    expect(result.current?.username).toBe("admin");
    expect(result.current?.role).toBe("ADMIN");
    expect(result.current?.exp).toBe("2025-12-31T23:59:59Z");
  });

  it("处理缺失可选字段的用户信息", () => {
    const userInfo = {
      uid: 1,
      username: "minimal",
      role: "USER",
    };
    localStorage.setItem("user_info", JSON.stringify(userInfo));

    const { result } = renderHook(() => useUserInfo());
    expect(result.current?.uid).toBe(1);
    expect(result.current?.nickname).toBeUndefined();
    expect(result.current?.exp).toBeUndefined();
  });

  it("处理无效 JSON 不抛出错误", () => {
    localStorage.setItem("user_info", "not-valid-json{{{");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useUserInfo());

    expect(result.current).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to parse user info:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("localStorage 为空时返回 null", () => {
    const { result } = renderHook(() => useUserInfo());
    expect(result.current).toBeNull();
  });

  it("处理空字符串", () => {
    localStorage.setItem("user_info", "");

    const { result } = renderHook(() => useUserInfo());

    // 空字符串是 falsy，所以不会尝试 JSON.parse
    expect(result.current).toBeNull();
  });

  it("不同角色值都正确处理", () => {
    const roles = ["USER", "ADMIN", "EDITOR"];

    for (const role of roles) {
      localStorage.setItem(
        "user_info",
        JSON.stringify({ uid: 1, username: "user", role }),
      );

      const { result } = renderHook(() => useUserInfo());
      expect(result.current?.role).toBe(role);

      localStorage.clear();
    }
  });
});
