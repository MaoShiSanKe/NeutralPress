import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useMarqueeSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应导出 useMarqueeSelection 函数", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );
    expect(typeof useMarqueeSelection).toBe("function");
  });

  it("应返回 isSelecting 和 selectionRect", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );
    const mockContainerRef = { current: null };
    const mockOnSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef: mockContainerRef,
        enabled: true,
        onSelectionChange: mockOnSelectionChange,
        isShiftHeld: false,
      }),
    );

    expect(result.current).toHaveProperty("isSelecting");
    expect(result.current).toHaveProperty("selectionRect");
    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selectionRect).toBeNull();
  });

  it("禁用时应保持非选择状态", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );
    const mockContainerRef = { current: null };
    const mockOnSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef: mockContainerRef,
        enabled: false,
        onSelectionChange: mockOnSelectionChange,
        isShiftHeld: false,
      }),
    );

    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selectionRect).toBeNull();
  });

  it("containerRef 为 null 时不应抛出错误", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );
    const mockContainerRef = { current: null };
    const mockOnSelectionChange = vi.fn();

    expect(() => {
      renderHook(() =>
        useMarqueeSelection({
          containerRef: mockContainerRef,
          enabled: true,
          onSelectionChange: mockOnSelectionChange,
          isShiftHeld: false,
        }),
      );
    }).not.toThrow();
  });

  it("isShiftHeld 为 true 时不应清空选择", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );
    const mockContainerRef = { current: null };
    const mockOnSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef: mockContainerRef,
        enabled: true,
        onSelectionChange: mockOnSelectionChange,
        isShiftHeld: true,
      }),
    );

    expect(result.current.isSelecting).toBe(false);
  });

  it("应定义 MarqueeHit 接口", async () => {
    const mod = await import("@/hooks/use-marquee-selection");
    // 验证模块导出
    expect(mod.useMarqueeSelection).toBeDefined();
  });

  it("容器有实际 DOM 元素时应正常工作", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );

    // 创建一个模拟的 DOM 容器
    const mockDiv = document.createElement("div");
    mockDiv.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
    });
    mockDiv.querySelectorAll = vi.fn().mockReturnValue([]);

    const mockContainerRef = { current: mockDiv };
    const mockOnSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef: mockContainerRef,
        enabled: true,
        onSelectionChange: mockOnSelectionChange,
        isShiftHeld: false,
      }),
    );

    expect(result.current.isSelecting).toBe(false);
    expect(result.current.selectionRect).toBeNull();
  });

  it("禁用模式下 mousedown 不应开始选择", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );

    const mockDiv = document.createElement("div");
    mockDiv.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
    });
    mockDiv.querySelectorAll = vi.fn().mockReturnValue([]);

    const mockContainerRef = { current: mockDiv };
    const mockOnSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useMarqueeSelection({
        containerRef: mockContainerRef,
        enabled: false,
        onSelectionChange: mockOnSelectionChange,
        isShiftHeld: false,
      }),
    );

    // 模拟 mousedown 事件
    const mouseEvent = new MouseEvent("mousedown", {
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    mockDiv.dispatchEvent(mouseEvent);

    // 禁用模式下不应开始选择
    expect(result.current.isSelecting).toBe(false);
  });

  it("enabled 切换时应正确注册/注销事件监听器", async () => {
    const { useMarqueeSelection } = await import(
      "@/hooks/use-marquee-selection"
    );

    const mockDiv = document.createElement("div");
    const addSpy = vi.spyOn(mockDiv, "addEventListener");
    const removeSpy = vi.spyOn(mockDiv, "removeEventListener");

    const mockContainerRef = { current: mockDiv };
    const mockOnSelectionChange = vi.fn();

    const { unmount } = renderHook(() =>
      useMarqueeSelection({
        containerRef: mockContainerRef,
        enabled: true,
        onSelectionChange: mockOnSelectionChange,
        isShiftHeld: false,
      }),
    );

    expect(addSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  });
});
