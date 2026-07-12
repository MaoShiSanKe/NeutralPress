import { describe, expect, it } from "vitest";

import {
  DEFAULT_POST_LICENSE,
  DEFAULT_POST_LICENSE_TEMPLATE,
  formatPostLicenseStatement,
  formatPostLicenseStatementSegments,
  fromStoredPostLicense,
  getPostLicenseMeta,
  getPostLicenseSelectionLabel,
  isPostLicenseValue,
  POST_LICENSE_VALUES,
  resolvePostLicense,
  toStoredPostLicense,
} from "@/lib/shared/post-license";

describe("post-license", () => {
  describe("POST_LICENSE_VALUES", () => {
    it("包含所有许可证值", () => {
      expect(POST_LICENSE_VALUES).toContain("cc-0");
      expect(POST_LICENSE_VALUES).toContain("cc-by");
      expect(POST_LICENSE_VALUES).toContain("cc-by-sa");
      expect(POST_LICENSE_VALUES).toContain("cc-by-nd");
      expect(POST_LICENSE_VALUES).toContain("cc-by-nc");
      expect(POST_LICENSE_VALUES).toContain("cc-by-nc-sa");
      expect(POST_LICENSE_VALUES).toContain("cc-by-nc-nd");
      expect(POST_LICENSE_VALUES).toContain("all-rights-reserved");
    });
  });

  describe("isPostLicenseValue", () => {
    it("有效许可证值返回 true", () => {
      expect(isPostLicenseValue("cc-0")).toBe(true);
      expect(isPostLicenseValue("cc-by")).toBe(true);
      expect(isPostLicenseValue("all-rights-reserved")).toBe(true);
    });

    it("无效值返回 false", () => {
      expect(isPostLicenseValue("invalid")).toBe(false);
      expect(isPostLicenseValue("")).toBe(false);
      expect(isPostLicenseValue(null)).toBe(false);
      expect(isPostLicenseValue(undefined)).toBe(false);
      expect(isPostLicenseValue(123)).toBe(false);
    });
  });

  describe("fromStoredPostLicense", () => {
    it("有效许可证值返回原值", () => {
      expect(fromStoredPostLicense("cc-by")).toBe("cc-by");
      expect(fromStoredPostLicense("all-rights-reserved")).toBe(
        "all-rights-reserved",
      );
    });

    it("无效值返回 'default'", () => {
      expect(fromStoredPostLicense("invalid")).toBe("default");
      expect(fromStoredPostLicense(null)).toBe("default");
      expect(fromStoredPostLicense(undefined)).toBe("default");
    });
  });

  describe("toStoredPostLicense", () => {
    it("'default' 返回 null", () => {
      expect(toStoredPostLicense("default")).toBeNull();
    });

    it("有效值返回原值", () => {
      expect(toStoredPostLicense("cc-by")).toBe("cc-by");
    });
  });

  describe("resolvePostLicense", () => {
    it("使用 storedLicense（如果有效）", () => {
      expect(resolvePostLicense("cc-by", "cc-0")).toBe("cc-by");
    });

    it("storedLicense 无效时使用 defaultLicense", () => {
      expect(resolvePostLicense("invalid", "cc-0")).toBe("cc-0");
    });

    it("两者都无效时使用 DEFAULT_POST_LICENSE", () => {
      expect(resolvePostLicense("invalid", "also-invalid")).toBe(
        DEFAULT_POST_LICENSE,
      );
    });

    it("两者都为 null 时使用默认值", () => {
      expect(resolvePostLicense(null, null)).toBe(DEFAULT_POST_LICENSE);
    });
  });

  describe("getPostLicenseMeta", () => {
    it("返回 cc-by 的元数据", () => {
      const meta = getPostLicenseMeta("cc-by");
      expect(meta.value).toBe("cc-by");
      expect(meta.shortLabel).toBe("CC BY");
      expect(meta.icons).toBeDefined();
      expect(meta.allow.length).toBeGreaterThan(0);
      expect(meta.disallow.length).toBeGreaterThan(0);
      expect(meta.referenceUrl).toBeDefined();
    });

    it("返回 all-rights-reserved 的元数据", () => {
      const meta = getPostLicenseMeta("all-rights-reserved");
      expect(meta.value).toBe("all-rights-reserved");
      expect(meta.shortLabel).toBe("All Rights Reserved");
    });

    it("所有许可证值都有对应的元数据", () => {
      for (const value of POST_LICENSE_VALUES) {
        const meta = getPostLicenseMeta(value);
        expect(meta).toBeDefined();
        expect(meta.value).toBe(value);
      }
    });
  });

  describe("getPostLicenseSelectionLabel", () => {
    it("'default' 返回默认标签", () => {
      expect(getPostLicenseSelectionLabel("default")).toBe(
        "默认（跟随站点设置）",
      );
    });

    it("cc-by 返回完整标签", () => {
      expect(getPostLicenseSelectionLabel("cc-by")).toBe("CC BY - 署名");
    });
  });

  describe("formatPostLicenseStatement", () => {
    it("all-rights-reserved 返回保留权利声明", () => {
      const result = formatPostLicenseStatement(
        DEFAULT_POST_LICENSE_TEMPLATE,
        "all-rights-reserved",
      );
      expect(result).toContain("All Rights Reserved");
    });

    it("使用默认模板格式化 cc-by 许可证", () => {
      const result = formatPostLicenseStatement(
        DEFAULT_POST_LICENSE_TEMPLATE,
        "cc-by",
      );
      expect(result).toContain("CC BY");
    });

    it("无 {LICENSE} 占位符时拼接模板和声明", () => {
      const result = formatPostLicenseStatement("本文使用许可协议。", "cc-by");
      expect(result).toContain("本文使用许可协议。");
      expect(result).toContain("CC BY");
    });
  });

  describe("formatPostLicenseStatementSegments", () => {
    it("all-rights-reserved 返回单个段落", () => {
      const segments = formatPostLicenseStatementSegments(
        DEFAULT_POST_LICENSE_TEMPLATE,
        "all-rights-reserved",
      );
      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toContain("All Rights Reserved");
      expect(segments[0]!.href).toBeUndefined();
    });

    it("cc-by 返回包含链接的段落", () => {
      const segments = formatPostLicenseStatementSegments(
        DEFAULT_POST_LICENSE_TEMPLATE,
        "cc-by",
      );
      expect(segments.length).toBeGreaterThan(0);
      // 应该有一个段落包含 referenceUrl
      const linkSegment = segments.find((s) => s.href);
      expect(linkSegment).toBeDefined();
      expect(linkSegment!.href).toContain("creativecommons.org");
    });

    it("无 {LICENSE} 占位符时正确处理", () => {
      const segments = formatPostLicenseStatementSegments(
        "固定文本。",
        "cc-by",
      );
      expect(segments.length).toBeGreaterThan(0);
    });
  });
});
