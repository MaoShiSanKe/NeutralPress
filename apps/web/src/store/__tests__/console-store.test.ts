import { beforeEach, describe, expect, it } from "vitest";

import { useConsoleStore } from "@/store/console-store";

describe("console-store", () => {
  beforeEach(() => {
    useConsoleStore.setState({ isConsoleOpen: false });
  });

  describe("初始状态", () => {
    it("isConsoleOpen 默认为 false", () => {
      expect(useConsoleStore.getState().isConsoleOpen).toBe(false);
    });
  });

  describe("setConsoleOpen", () => {
    it("设置为 true", () => {
      useConsoleStore.getState().setConsoleOpen(true);
      expect(useConsoleStore.getState().isConsoleOpen).toBe(true);
    });

    it("设置为 false", () => {
      useConsoleStore.setState({ isConsoleOpen: true });
      useConsoleStore.getState().setConsoleOpen(false);
      expect(useConsoleStore.getState().isConsoleOpen).toBe(false);
    });

    it("重复设置相同值保持不变", () => {
      useConsoleStore.getState().setConsoleOpen(true);
      useConsoleStore.getState().setConsoleOpen(true);
      expect(useConsoleStore.getState().isConsoleOpen).toBe(true);
    });
  });

  describe("toggleConsole", () => {
    it("从 false 切换为 true", () => {
      useConsoleStore.getState().toggleConsole();
      expect(useConsoleStore.getState().isConsoleOpen).toBe(true);
    });

    it("从 true 切换为 false", () => {
      useConsoleStore.setState({ isConsoleOpen: true });
      useConsoleStore.getState().toggleConsole();
      expect(useConsoleStore.getState().isConsoleOpen).toBe(false);
    });

    it("连续切换两次回到原始状态", () => {
      const state = useConsoleStore.getState();
      state.toggleConsole();
      useConsoleStore.getState().toggleConsole();
      expect(useConsoleStore.getState().isConsoleOpen).toBe(false);
    });
  });
});
