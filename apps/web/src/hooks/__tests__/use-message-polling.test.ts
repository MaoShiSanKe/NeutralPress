import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 模拟 next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/messages"),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// 模拟 SWR
vi.mock("swr", () => {
  return {
    default: vi.fn().mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    }),
  };
});

// 模拟 server actions
vi.mock("@/actions/message", () => ({
  getConversationMessages: vi.fn().mockResolvedValue({
    success: true,
    data: { messages: [], hasMore: false, otherUserLastReadMessageId: null },
  }),
  getConversations: vi.fn().mockResolvedValue({
    success: true,
    data: { conversations: [], hasMore: false, total: 0 },
  }),
}));

// 模拟 broadcast hook
vi.mock("@/hooks/use-broadcast", () => ({
  useBroadcastSender: vi.fn().mockReturnValue({
    broadcast: vi.fn(),
  }),
}));

// 模拟 NotificationProvider 的 ConnectionStatus 类型
vi.mock("@/components/client/features/notice/NotificationProvider", () => ({
  // 空导出，仅用于类型
}));

describe("useMessagePolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("返回 triggerPoll 函数", async () => {
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    const { result } = renderHook(() =>
      useMessagePolling({
        enabled: true,
      }),
    );

    expect(result.current.triggerPoll).toBeInstanceOf(Function);
  });

  it("enabled=false 时不启用轮询", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: false,
      }),
    );

    // SWR key 应为 null（禁用轮询）
    const calls = vi.mocked(useSWR).mock.calls;
    const conversationsCall = calls.find(
      (call) => call[0] === "conversations" || call[0] === null,
    );
    // 当 enabled=false 时，key 应该是 null
    expect(conversationsCall?.[0]).toBeNull();
  });

  it("connectionStatus 为非 fallback 时不轮询", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: true,
        connectionStatus: "connected",
      }),
    );

    // 当 connectionStatus 非 fallback 时，SWR key 应为 null
    const calls = vi.mocked(useSWR).mock.calls;
    const conversationsCall = calls.find(
      (call) => call[0] === "conversations" || call[0] === null,
    );
    expect(conversationsCall?.[0]).toBeNull();
  });

  it("connectionStatus 为 fallback 且 enabled=true 时启用轮询", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: true,
        connectionStatus: "fallback",
      }),
    );

    // 第一个 SWR 调用的 key 应该是 "conversations"
    const firstCall = vi.mocked(useSWR).mock.calls[0];
    expect(firstCall![0]).toBe("conversations");
  });

  it("有 currentConversationId 时启用消息轮询", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: true,
        connectionStatus: "fallback",
        currentConversationId: "conv-123",
      }),
    );

    // 第二个 SWR 调用的 key 应该是 ["conversation-messages", "conv-123"]
    const secondCall = vi.mocked(useSWR).mock.calls[1];
    expect(secondCall![0]).toEqual(["conversation-messages", "conv-123"]);
  });

  it("没有 currentConversationId 时不启用消息轮询", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: true,
        connectionStatus: "fallback",
      }),
    );

    // 第二个 SWR 调用的 key 应该是 null
    const secondCall = vi.mocked(useSWR).mock.calls[1];
    expect(secondCall![0]).toBeNull();
  });

  it("SWR 配置包含正确的轮询间隔", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: true,
        connectionStatus: "fallback",
      }),
    );

    const firstCall = vi.mocked(useSWR).mock.calls[0];
    const config = firstCall![2];
    expect(config).toMatchObject({
      refreshInterval: 3000,
      dedupingInterval: 1000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
    });
  });

  it("默认 connectionStatus 为 fallback", async () => {
    const useSWR = (await import("swr")).default;
    const { useMessagePolling } = await import("@/hooks/use-message-polling");

    renderHook(() =>
      useMessagePolling({
        enabled: true,
      }),
    );

    // 默认 connectionStatus 为 "fallback"，所以应该启用轮询
    const firstCall = vi.mocked(useSWR).mock.calls[0];
    expect(firstCall![0]).toBe("conversations");
  });
});
