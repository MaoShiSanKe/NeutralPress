import type { Message } from "@repo/shared-types/api/message";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOptimisticMessages } from "@/hooks/use-optimistic-messages";

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).substr(2, 9)}`,
    content: "test message",
    type: "TEXT",
    senderUid: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("useOptimisticMessages", () => {
  it("初始状态为空消息列表", () => {
    const { result } = renderHook(() => useOptimisticMessages());
    expect(result.current.messages).toEqual([]);
  });

  it("使用初始消息列表初始化", () => {
    const initial = [
      createMessage({ id: "msg-1" }),
      createMessage({ id: "msg-2" }),
    ];
    const { result } = renderHook(() => useOptimisticMessages(initial));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]!.id).toBe("msg-1");
    expect(result.current.messages[0]!.status).toBe("sent");
    expect(result.current.messages[1]!.id).toBe("msg-2");
    expect(result.current.messages[1]!.status).toBe("sent");
  });

  describe("addOptimisticMessage", () => {
    it("添加一条乐观消息并返回 tempId", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]!.content).toBe("hello");
      expect(result.current.messages[0]!.senderUid).toBe(1);
      expect(result.current.messages[0]!.status).toBe("sending");
      expect(result.current.messages[0]!.tempId).toBe(tempId!);
    });

    it("每次生成唯一的 tempId", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      const tempIds: string[] = [];
      act(() => {
        tempIds.push(result.current.addOptimisticMessage("msg1", 1));
        tempIds.push(result.current.addOptimisticMessage("msg2", 1));
        tempIds.push(result.current.addOptimisticMessage("msg3", 1));
      });

      expect(new Set(tempIds).size).toBe(3);
      expect(result.current.messages).toHaveLength(3);
    });

    it("添加的消息在列表末尾", () => {
      const initial = [createMessage({ id: "existing" })];
      const { result } = renderHook(() => useOptimisticMessages(initial));

      act(() => {
        result.current.addOptimisticMessage("new message", 2);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]!.id).toBe("existing");
      expect(result.current.messages[1]!.status).toBe("sending");
    });
  });

  describe("updateMessageStatus", () => {
    it("用真实消息替换乐观消息", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      const realMessage = createMessage({ id: "real-msg", content: "hello" });
      act(() => {
        result.current.updateMessageStatus(tempId!, realMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]!.id).toBe("real-msg");
      expect(result.current.messages[0]!.status).toBe("sent");
      expect(result.current.messages[0]!.tempId).toBeUndefined();
    });

    it("支持自定义状态", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      const realMessage = createMessage({ id: "real-msg" });
      act(() => {
        result.current.updateMessageStatus(tempId!, realMessage, "read");
      });

      expect(result.current.messages[0]!.status).toBe("read");
    });

    it("不影响不匹配的消息", () => {
      const initial = [createMessage({ id: "other-msg" })];
      const { result } = renderHook(() => useOptimisticMessages(initial));

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      const realMessage = createMessage({ id: "real-msg" });
      act(() => {
        result.current.updateMessageStatus(tempId!, realMessage);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]!.id).toBe("other-msg");
      expect(result.current.messages[1]!.id).toBe("real-msg");
    });
  });

  describe("markMessageFailed", () => {
    it("标记消息为发送失败", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      act(() => {
        result.current.markMessageFailed(tempId!);
      });

      expect(result.current.messages[0]!.status).toBe("failed");
    });

    it("不影响不匹配的消息", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId1: string;
      act(() => {
        tempId1 = result.current.addOptimisticMessage("msg1", 1);
        result.current.addOptimisticMessage("msg2", 1);
      });

      act(() => {
        result.current.markMessageFailed(tempId1!);
      });

      expect(result.current.messages[0]!.status).toBe("failed");
      expect(result.current.messages[1]!.status).toBe("sending");
    });
  });

  describe("retryMessage", () => {
    it("将失败的消息重新设为发送中", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      act(() => {
        result.current.markMessageFailed(tempId!);
      });
      expect(result.current.messages[0]!.status).toBe("failed");

      act(() => {
        result.current.retryMessage(tempId!);
      });
      expect(result.current.messages[0]!.status).toBe("sending");
    });
  });

  describe("removeMessage", () => {
    it("移除指定的乐观消息", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId: string;
      act(() => {
        tempId = result.current.addOptimisticMessage("hello", 1);
      });

      act(() => {
        result.current.removeMessage(tempId!);
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it("不影响不匹配的消息", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      let tempId1: string;
      let tempId2: string;
      act(() => {
        tempId1 = result.current.addOptimisticMessage("msg1", 1);
        tempId2 = result.current.addOptimisticMessage("msg2", 1);
      });

      act(() => {
        result.current.removeMessage(tempId1!);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]!.tempId).toBe(tempId2!);
    });
  });

  describe("addMessages", () => {
    it("批量添加新消息到列表头部", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      const newMessages = [
        createMessage({ id: "new-1" }),
        createMessage({ id: "new-2" }),
      ];

      act(() => {
        result.current.addMessages(newMessages);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]!.id).toBe("new-1");
      expect(result.current.messages[0]!.status).toBe("sent");
    });

    it("不添加重复 ID 的消息", () => {
      const existing = createMessage({ id: "existing-msg" });
      const { result } = renderHook(() => useOptimisticMessages([existing]));

      act(() => {
        result.current.addMessages([
          existing,
          createMessage({ id: "new-msg" }),
        ]);
      });

      expect(result.current.messages).toHaveLength(2);
      // 新消息在前，旧消息在后
      expect(result.current.messages[0]!.id).toBe("new-msg");
      expect(result.current.messages[1]!.id).toBe("existing-msg");
    });

    it("新消息在前，已有的乐观消息在后", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      act(() => {
        result.current.addOptimisticMessage("optimistic", 1);
      });

      act(() => {
        result.current.addMessages([createMessage({ id: "history-msg" })]);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]!.id).toBe("history-msg");
      expect(result.current.messages[1]!.status).toBe("sending");
    });
  });

  describe("updateReadStatus", () => {
    it("标记 lastReadMessageId 及之前的消息为已读", () => {
      const msg1 = createMessage({
        id: "msg-1",
        createdAt: "2024-01-01T00:00:00Z",
      });
      const msg2 = createMessage({
        id: "msg-2",
        createdAt: "2024-01-01T00:01:00Z",
      });
      const msg3 = createMessage({
        id: "msg-3",
        createdAt: "2024-01-01T00:02:00Z",
      });

      const { result } = renderHook(() =>
        useOptimisticMessages([msg1, msg2, msg3]),
      );

      act(() => {
        result.current.updateReadStatus("msg-2");
      });

      expect(result.current.messages[0]!.status).toBe("read");
      expect(result.current.messages[1]!.status).toBe("read");
      // msg3 的时间 > msg2 的时间，不标记
      expect(result.current.messages[2]!.status).toBe("sent");
    });

    it("null lastReadMessageId 不做任何操作", () => {
      const msg = createMessage({ id: "msg-1" });
      const { result } = renderHook(() => useOptimisticMessages([msg]));

      act(() => {
        result.current.updateReadStatus(null);
      });

      expect(result.current.messages[0]!.status).toBe("sent");
    });

    it("不存在的 lastReadMessageId 不做任何操作", () => {
      const msg = createMessage({ id: "msg-1" });
      const { result } = renderHook(() => useOptimisticMessages([msg]));

      act(() => {
        result.current.updateReadStatus("nonexistent-id");
      });

      expect(result.current.messages[0]!.status).toBe("sent");
    });

    it("只标记 sent 状态的消息为 read，不改变其他状态", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      act(() => {
        result.current.addOptimisticMessage("sending msg", 1);
      });

      // 消息处于 sending 状态，不应被标记为 read
      act(() => {
        result.current.updateReadStatus(result.current.messages[0]!.id);
      });

      expect(result.current.messages[0]!.status).toBe("sending");
    });
  });

  describe("resetMessages", () => {
    it("重置为空列表", () => {
      const initial = [createMessage(), createMessage()];
      const { result } = renderHook(() => useOptimisticMessages(initial));

      act(() => {
        result.current.resetMessages();
      });

      expect(result.current.messages).toEqual([]);
    });

    it("重置为新的消息列表", () => {
      const initial = [createMessage({ id: "old" })];
      const { result } = renderHook(() => useOptimisticMessages(initial));

      const newMessages = [
        createMessage({ id: "new-1" }),
        createMessage({ id: "new-2" }),
      ];
      act(() => {
        result.current.resetMessages(newMessages);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]!.id).toBe("new-1");
      expect(result.current.messages[0]!.status).toBe("sent");
    });
  });

  describe("appendMessages", () => {
    it("追加新消息到末尾", () => {
      const initial = [createMessage({ id: "existing" })];
      const { result } = renderHook(() => useOptimisticMessages(initial));

      act(() => {
        result.current.appendMessages([createMessage({ id: "appended" })]);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0]!.id).toBe("existing");
      expect(result.current.messages[1]!.id).toBe("appended");
    });

    it("不追加重复 ID 的消息", () => {
      const existing = createMessage({ id: "dup" });
      const { result } = renderHook(() => useOptimisticMessages([existing]));

      act(() => {
        result.current.appendMessages([existing, createMessage({ id: "new" })]);
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1]!.id).toBe("new");
    });

    it("提供 lastReadMessageId 时标记新追加的消息为已读", () => {
      const existing = createMessage({
        id: "msg-1",
        createdAt: "2024-01-01T00:00:00Z",
      });
      const { result } = renderHook(() => useOptimisticMessages([existing]));

      const newMsg = createMessage({
        id: "msg-2",
        createdAt: "2024-01-01T00:01:00Z",
      });

      act(() => {
        result.current.appendMessages([newMsg], "msg-2");
      });

      // 已有的消息保持原状态（appendMessages 只更新新消息的状态）
      expect(result.current.messages[0]!.status).toBe("sent");
      // 新消息的 createdAt <= lastReadMessageId 的 createdAt，标记为 read
      expect(result.current.messages[1]!.status).toBe("read");
    });

    it("提供 lastReadMessageId 时，时间晚于已读消息的新消息保持 sent 状态", () => {
      const existing = createMessage({
        id: "msg-1",
        createdAt: "2024-01-01T00:00:00Z",
      });
      const { result } = renderHook(() => useOptimisticMessages([existing]));

      const olderMsg = createMessage({
        id: "msg-read",
        createdAt: "2024-01-01T00:00:30Z",
      });
      const newerMsg = createMessage({
        id: "msg-unread",
        createdAt: "2024-01-01T00:02:00Z",
      });

      act(() => {
        result.current.appendMessages([olderMsg, newerMsg], "msg-read");
      });

      // olderMsg 的时间 <= lastReadTime，标记为 read
      expect(result.current.messages[1]!.status).toBe("read");
      // newerMsg 的时间 > lastReadTime，保持 sent
      expect(result.current.messages[2]!.status).toBe("sent");
    });

    it("不提供 lastReadMessageId 时消息状态为 sent", () => {
      const { result } = renderHook(() => useOptimisticMessages());

      act(() => {
        result.current.appendMessages([
          createMessage({ id: "msg-1" }),
          createMessage({ id: "msg-2" }),
        ]);
      });

      expect(result.current.messages[0]!.status).toBe("sent");
      expect(result.current.messages[1]!.status).toBe("sent");
    });
  });
});
