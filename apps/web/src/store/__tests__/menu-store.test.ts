import { beforeEach, describe, expect, it } from "vitest";

import { useMenuStore } from "@/store/menu-store";

describe("menu-store", () => {
  beforeEach(() => {
    useMenuStore.setState({ isMenuOpen: false });
  });

  describe("初始状态", () => {
    it("isMenuOpen 默认为 false", () => {
      expect(useMenuStore.getState().isMenuOpen).toBe(false);
    });
  });

  describe("setMenuOpen", () => {
    it("设置为 true 打开菜单", () => {
      useMenuStore.getState().setMenuOpen(true);
      expect(useMenuStore.getState().isMenuOpen).toBe(true);
    });

    it("设置为 false 关闭菜单", () => {
      useMenuStore.setState({ isMenuOpen: true });
      useMenuStore.getState().setMenuOpen(false);
      expect(useMenuStore.getState().isMenuOpen).toBe(false);
    });

    it("重复设置相同值保持不变", () => {
      useMenuStore.getState().setMenuOpen(true);
      useMenuStore.getState().setMenuOpen(true);
      expect(useMenuStore.getState().isMenuOpen).toBe(true);
    });
  });

  describe("toggleMenu", () => {
    it("从 false 切换为 true", () => {
      useMenuStore.getState().toggleMenu();
      expect(useMenuStore.getState().isMenuOpen).toBe(true);
    });

    it("从 true 切换为 false", () => {
      useMenuStore.setState({ isMenuOpen: true });
      useMenuStore.getState().toggleMenu();
      expect(useMenuStore.getState().isMenuOpen).toBe(false);
    });

    it("连续切换两次回到原始状态", () => {
      useMenuStore.getState().toggleMenu();
      useMenuStore.getState().toggleMenu();
      expect(useMenuStore.getState().isMenuOpen).toBe(false);
    });
  });
});
