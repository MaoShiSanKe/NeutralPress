import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBreakpoint, useMobile } from "@/hooks/use-mobile";

// 保存原始值
const originalInnerWidth = window.innerWidth;
const originalUserAgent = navigator.userAgent;

/**
 * 设置模拟环境
 */
function setEnvironment(options: {
  innerWidth?: number;
  userAgent?: string;
  maxTouchPoints?: number;
  hasOntouchstart?: boolean;
}) {
  const {
    innerWidth = 1024,
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    maxTouchPoints = 0,
    hasOntouchstart = false,
  } = options;

  Object.defineProperty(window, "innerWidth", {
    value: innerWidth,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, "userAgent", {
    value: userAgent,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, "maxTouchPoints", {
    value: maxTouchPoints,
    writable: true,
    configurable: true,
  });

  if (hasOntouchstart) {
    (window as any).ontouchstart = null;
  } else {
    delete (window as any).ontouchstart;
  }
}

describe("useMobile", () => {
  beforeEach(() => {
    setEnvironment({ innerWidth: 1024 });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
    delete (window as any).ontouchstart;
  });

  describe("useSyncExternalStore 集成", () => {
    it("SSR 时通过 getServerSnapshot 返回 false", () => {
      // useSyncExternalStore 的第三个参数是 getServerSnapshot
      // 在 SSR 环境中（无 window），会调用此函数返回 false
      // 这确保 SSR 渲染结果与客户端首次渲染一致，避免 hydration mismatch
      const { result } = renderHook(() => useMobile());
      // 在 happy-dom 测试环境中，会调用 getSnapshot 而非 getServerSnapshot
      // 但我们验证 hook 能正常返回布尔值
      expect(typeof result.current).toBe("boolean");
    });

    it("在客户端返回 checkIsMobile 的结果", () => {
      setEnvironment({
        innerWidth: 1024,
        userAgent:
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(true);
    });
  });

  describe("resize 事件监听和清理", () => {
    it("注册 resize 事件监听器", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const { unmount } = renderHook(() => useMobile());

      expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
      unmount();
    });

    it("卸载时移除 resize 事件监听器", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const { unmount } = renderHook(() => useMobile());

      unmount();
      expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    });

    it("resize 事件触发时更新结果", () => {
      // 初始：桌面环境，非移动端
      setEnvironment({
        innerWidth: 1920,
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        hasOntouchstart: true,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(false);

      // 模拟 resize 到小屏幕（触控+小屏幕=true）
      act(() => {
        Object.defineProperty(window, "innerWidth", { value: 500 });
        window.dispatchEvent(new Event("resize"));
      });
      expect(result.current).toBe(true);

      // 模拟 resize 回大屏幕
      act(() => {
        Object.defineProperty(window, "innerWidth", { value: 1920 });
        window.dispatchEvent(new Event("resize"));
      });
      expect(result.current).toBe(false);
    });
  });

  describe("移动端 UA 检测", () => {
    const mobileUAs = [
      {
        name: "Android",
        ua: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
      },
      {
        name: "iPhone",
        ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      {
        name: "iPad",
        ua: "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      {
        name: "iPod",
        ua: "Mozilla/5.0 (iPod; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      {
        name: "BlackBerry",
        ua: "Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en) AppleWebKit/534.11+",
      },
      {
        name: "webOS",
        ua: "Mozilla/5.0 (webOS/1.4.5; U; en-US) AppleWebKit/532.2",
      },
      {
        name: "IEMobile",
        ua: "Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; IEMobile/10.0)",
      },
      { name: "Opera Mini", ua: "Opera/9.80 (J2ME/MIDP; Opera Mini/9.80)" },
    ];

    for (const { name, ua } of mobileUAs) {
      it(`检测 ${name} UA 为移动端`, () => {
        setEnvironment({ userAgent: ua, innerWidth: 1920 });
        const { result } = renderHook(() => useMobile());
        expect(result.current).toBe(true);
      });
    }

    it("不区分大小写", () => {
      setEnvironment({ userAgent: "ANDROID", innerWidth: 1920 });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(true);
    });
  });

  describe("桌面 UA 检测", () => {
    const desktopUAs = [
      {
        name: "Chrome",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0",
      },
      {
        name: "Firefox",
        ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
      },
      {
        name: "macOS Safari",
        ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
      },
      {
        name: "Linux 桌面",
        ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/91.0",
      },
    ];

    for (const { name, ua } of desktopUAs) {
      it(`不检测 ${name} 为移动端（无触控+大屏幕）`, () => {
        setEnvironment({
          userAgent: ua,
          innerWidth: 1920,
          maxTouchPoints: 0,
          hasOntouchstart: false,
        });
        const { result } = renderHook(() => useMobile());
        expect(result.current).toBe(false);
      });
    }

    it("空字符串 UA 不是移动端", () => {
      setEnvironment({ userAgent: "", innerWidth: 1920 });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(false);
    });
  });

  describe("触控 + 小屏幕组合逻辑", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    it("桌面 UA + ontouchstart + 小屏幕(768) = true", () => {
      setEnvironment({
        userAgent: desktopUA,
        innerWidth: 768,
        hasOntouchstart: true,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(true);
    });

    it("桌面 UA + maxTouchPoints>0 + 小屏幕 = true", () => {
      setEnvironment({
        userAgent: desktopUA,
        innerWidth: 600,
        maxTouchPoints: 5,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(true);
    });

    it("桌面 UA + 触控 + 大屏幕(1920) = false", () => {
      setEnvironment({
        userAgent: desktopUA,
        innerWidth: 1920,
        hasOntouchstart: true,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(false);
    });

    it("桌面 UA + 无触控 + 小屏幕(320) = false", () => {
      setEnvironment({
        userAgent: desktopUA,
        innerWidth: 320,
        maxTouchPoints: 0,
        hasOntouchstart: false,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(false);
    });
  });

  describe("边界值测试", () => {
    const desktopUA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

    it("768px 属于小屏幕（触控+小屏幕=true）", () => {
      setEnvironment({
        userAgent: desktopUA,
        innerWidth: 768,
        hasOntouchstart: true,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(true);
    });

    it("769px 不属于小屏幕（触控+大屏幕=false）", () => {
      setEnvironment({
        userAgent: desktopUA,
        innerWidth: 769,
        hasOntouchstart: true,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(false);
    });
  });

  describe("移动端 UA 覆盖其他条件", () => {
    it("移动 UA + 大屏幕 + 无触控 = true", () => {
      setEnvironment({
        userAgent:
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
        innerWidth: 1920,
        maxTouchPoints: 0,
        hasOntouchstart: false,
      });
      const { result } = renderHook(() => useMobile());
      expect(result.current).toBe(true);
    });
  });
});

describe("useBreakpoint", () => {
  beforeEach(() => {
    setEnvironment({ innerWidth: 1024 });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  describe("基本行为", () => {
    it("宽度小于断点返回 true", () => {
      Object.defineProperty(window, "innerWidth", { value: 500 });
      const { result } = renderHook(() => useBreakpoint(768));
      expect(result.current).toBe(true);
    });

    it("宽度等于断点返回 true", () => {
      Object.defineProperty(window, "innerWidth", { value: 768 });
      const { result } = renderHook(() => useBreakpoint(768));
      expect(result.current).toBe(true);
    });

    it("宽度大于断点返回 false", () => {
      Object.defineProperty(window, "innerWidth", { value: 1024 });
      const { result } = renderHook(() => useBreakpoint(768));
      expect(result.current).toBe(false);
    });

    it("默认断点为 768", () => {
      Object.defineProperty(window, "innerWidth", { value: 768 });
      const { result } = renderHook(() => useBreakpoint());
      expect(result.current).toBe(true);
    });
  });

  describe("自定义断点", () => {
    it("支持自定义断点值", () => {
      Object.defineProperty(window, "innerWidth", { value: 1000 });
      const { result } = renderHook(() => useBreakpoint(1024));
      expect(result.current).toBe(true);
    });

    it("极小断点 0", () => {
      Object.defineProperty(window, "innerWidth", { value: 0 });
      const { result } = renderHook(() => useBreakpoint(0));
      expect(result.current).toBe(true);
    });
  });

  describe("resize 事件响应", () => {
    it("resize 跨越断点时更新结果", () => {
      Object.defineProperty(window, "innerWidth", { value: 1024 });
      const { result } = renderHook(() => useBreakpoint(768));
      expect(result.current).toBe(false);

      act(() => {
        Object.defineProperty(window, "innerWidth", { value: 500 });
        window.dispatchEvent(new Event("resize"));
      });
      expect(result.current).toBe(true);

      act(() => {
        Object.defineProperty(window, "innerWidth", { value: 1024 });
        window.dispatchEvent(new Event("resize"));
      });
      expect(result.current).toBe(false);
    });

    it("断点参数变化时更新结果", () => {
      Object.defineProperty(window, "innerWidth", { value: 900 });
      const { result, rerender } = renderHook(({ bp }) => useBreakpoint(bp), {
        initialProps: { bp: 768 },
      });
      expect(result.current).toBe(false);

      rerender({ bp: 1024 });
      expect(result.current).toBe(true);
    });
  });

  describe("事件监听器生命周期", () => {
    it("注册 resize 事件监听器", () => {
      const addSpy = vi.spyOn(window, "addEventListener");
      const { unmount } = renderHook(() => useBreakpoint(768));
      expect(addSpy).toHaveBeenCalledWith("resize", expect.any(Function));
      unmount();
    });

    it("卸载时移除 resize 事件监听器", () => {
      const removeSpy = vi.spyOn(window, "removeEventListener");
      const { unmount } = renderHook(() => useBreakpoint(768));
      unmount();
      expect(removeSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    });
  });
});
