import { beforeEach, describe, expect, it } from "vitest";

import { useFooterStore } from "@/store/footer-store";

describe("footer-store", () => {
  beforeEach(() => {
    useFooterStore.setState({ isFooterVisible: true });
  });

  describe("初始状态", () => {
    it("isFooterVisible 默认为 true", () => {
      expect(useFooterStore.getState().isFooterVisible).toBe(true);
    });
  });

  describe("setFooterVisible", () => {
    it("设置为 false 隐藏 footer", () => {
      useFooterStore.getState().setFooterVisible(false);
      expect(useFooterStore.getState().isFooterVisible).toBe(false);
    });

    it("设置为 true 显示 footer", () => {
      useFooterStore.setState({ isFooterVisible: false });
      useFooterStore.getState().setFooterVisible(true);
      expect(useFooterStore.getState().isFooterVisible).toBe(true);
    });

    it("重复设置相同值保持不变", () => {
      useFooterStore.getState().setFooterVisible(false);
      useFooterStore.getState().setFooterVisible(false);
      expect(useFooterStore.getState().isFooterVisible).toBe(false);
    });
  });
});
