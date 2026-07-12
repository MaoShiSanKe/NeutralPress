import { beforeEach, describe, expect, it } from "vitest";

import { useGalleryLightboxStore } from "@/store/gallery-lightbox-store";

describe("gallery-lightbox-store", () => {
  beforeEach(() => {
    useGalleryLightboxStore.setState({
      sourceRect: null,
      openedPhotoId: null,
      thumbnailUrl: null,
    });
  });

  describe("初始状态", () => {
    it("sourceRect 默认为 null", () => {
      expect(useGalleryLightboxStore.getState().sourceRect).toBeNull();
    });

    it("openedPhotoId 默认为 null", () => {
      expect(useGalleryLightboxStore.getState().openedPhotoId).toBeNull();
    });

    it("thumbnailUrl 默认为 null", () => {
      expect(useGalleryLightboxStore.getState().thumbnailUrl).toBeNull();
    });
  });

  describe("setSourceRect", () => {
    it("设置图片位置信息", () => {
      const rect = { top: 100, left: 200, width: 300, height: 400 };
      useGalleryLightboxStore.getState().setSourceRect(rect, 42, "/thumb.jpg");

      const state = useGalleryLightboxStore.getState();
      expect(state.sourceRect).toEqual(rect);
      expect(state.openedPhotoId).toBe(42);
      expect(state.thumbnailUrl).toBe("/thumb.jpg");
    });

    it("覆盖之前的值", () => {
      const rect1 = { top: 10, left: 20, width: 30, height: 40 };
      const rect2 = { top: 50, left: 60, width: 70, height: 80 };

      useGalleryLightboxStore.getState().setSourceRect(rect1, 1, "/a.jpg");
      useGalleryLightboxStore.getState().setSourceRect(rect2, 2, "/b.jpg");

      const state = useGalleryLightboxStore.getState();
      expect(state.sourceRect).toEqual(rect2);
      expect(state.openedPhotoId).toBe(2);
      expect(state.thumbnailUrl).toBe("/b.jpg");
    });

    it("处理边界值（零尺寸图片）", () => {
      const rect = { top: 0, left: 0, width: 0, height: 0 };
      useGalleryLightboxStore.getState().setSourceRect(rect, 0, "");

      const state = useGalleryLightboxStore.getState();
      expect(state.sourceRect).toEqual(rect);
      expect(state.openedPhotoId).toBe(0);
      expect(state.thumbnailUrl).toBe("");
    });
  });

  describe("clear", () => {
    it("清除所有状态", () => {
      const rect = { top: 100, left: 200, width: 300, height: 400 };
      useGalleryLightboxStore.getState().setSourceRect(rect, 42, "/thumb.jpg");

      useGalleryLightboxStore.getState().clear();

      const state = useGalleryLightboxStore.getState();
      expect(state.sourceRect).toBeNull();
      expect(state.openedPhotoId).toBeNull();
      expect(state.thumbnailUrl).toBeNull();
    });

    it("在未设置状态时调用 clear 不报错", () => {
      expect(() => {
        useGalleryLightboxStore.getState().clear();
      }).not.toThrow();
    });
  });
});
