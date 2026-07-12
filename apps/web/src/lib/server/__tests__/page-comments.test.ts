import { describe, expect, it } from "vitest";

import {
  normalizePageSlug,
  resolvePageAllowComments,
} from "@/lib/server/page-comments";

describe("page-comments", () => {
  describe("normalizePageSlug", () => {
    it("返回 / 当输入为空字符串", () => {
      expect(normalizePageSlug("")).toBe("/");
    });

    it("返回 / 当输入为空白字符串", () => {
      expect(normalizePageSlug("   ")).toBe("/");
    });

    it("添加前导斜杠", () => {
      expect(normalizePageSlug("about")).toBe("/about");
    });

    it("保留已有前导斜杠", () => {
      expect(normalizePageSlug("/about")).toBe("/about");
    });

    it("移除尾部斜杠", () => {
      expect(normalizePageSlug("/about/")).toBe("/about");
    });

    it("合并连续斜杠", () => {
      expect(normalizePageSlug("//about//page")).toBe("/about/page");
    });

    it("处理根路径", () => {
      expect(normalizePageSlug("/")).toBe("/");
    });

    it("处理只有斜杠的输入", () => {
      expect(normalizePageSlug("//")).toBe("/");
    });

    it("处理尾部多个斜杠", () => {
      expect(normalizePageSlug("/about///")).toBe("/about");
    });

    it("修剪首尾空白", () => {
      expect(normalizePageSlug("  /about  ")).toBe("/about");
    });

    it("处理多层路径", () => {
      expect(normalizePageSlug("blog/posts/hello-world")).toBe(
        "/blog/posts/hello-world",
      );
    });

    it("处理带前导斜杠的多层路径", () => {
      expect(normalizePageSlug("/blog/posts/hello-world/")).toBe(
        "/blog/posts/hello-world",
      );
    });

    it("合并路径中的连续斜杠", () => {
      expect(normalizePageSlug("/blog//posts///hello")).toBe(
        "/blog/posts/hello",
      );
    });
  });

  describe("resolvePageAllowComments", () => {
    it("返回 false 当 config 为 null", () => {
      expect(resolvePageAllowComments(null)).toBe(false);
    });

    it("返回 false 当 config 为 undefined", () => {
      expect(resolvePageAllowComments(undefined)).toBe(false);
    });

    it("返回 false 当 config 为字符串", () => {
      expect(resolvePageAllowComments("string")).toBe(false);
    });

    it("返回 false 当 config 为数字", () => {
      expect(resolvePageAllowComments(123)).toBe(false);
    });

    it("返回 true 当 allowComments 为 true", () => {
      expect(resolvePageAllowComments({ allowComments: true })).toBe(true);
    });

    it("返回 false 当 allowComments 为 false", () => {
      expect(resolvePageAllowComments({ allowComments: false })).toBe(false);
    });

    it("返回 true 当 allowComments 为字符串 'true'", () => {
      expect(resolvePageAllowComments({ allowComments: "true" })).toBe(true);
    });

    it("返回 true 当 allowComments 为字符串 '1'", () => {
      expect(resolvePageAllowComments({ allowComments: "1" })).toBe(true);
    });

    it("返回 false 当 allowComments 为字符串 'false'", () => {
      expect(resolvePageAllowComments({ allowComments: "false" })).toBe(false);
    });

    it("返回 false 当 allowComments 为字符串 '0'", () => {
      expect(resolvePageAllowComments({ allowComments: "0" })).toBe(false);
    });

    it("返回 false 当 allowComments 为其他字符串", () => {
      expect(resolvePageAllowComments({ allowComments: "yes" })).toBe(false);
    });

    it("返回 false 当 allowComments 为数字", () => {
      expect(resolvePageAllowComments({ allowComments: 1 })).toBe(false);
    });

    it("返回 false 当 config 对象没有 allowComments 属性", () => {
      expect(resolvePageAllowComments({ otherField: "value" })).toBe(false);
    });

    it("处理带空白的字符串 'true'", () => {
      expect(resolvePageAllowComments({ allowComments: "  true  " })).toBe(
        true,
      );
    });

    it("处理大小写混合的 'TRUE'", () => {
      expect(resolvePageAllowComments({ allowComments: "TRUE" })).toBe(true);
    });

    it("返回 false 当 allowComments 为数组", () => {
      expect(resolvePageAllowComments({ allowComments: [true] })).toBe(false);
    });

    it("返回 false 当 allowComments 为对象", () => {
      expect(resolvePageAllowComments({ allowComments: {} })).toBe(false);
    });
  });
});
