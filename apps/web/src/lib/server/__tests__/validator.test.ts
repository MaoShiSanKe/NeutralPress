import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock NextResponse before importing the module
vi.mock("next/server", () => {
  return {
    NextResponse: {
      json: vi.fn(
        (body: unknown, init?: { status?: number; headers?: HeadersInit }) => {
          const headers = new Headers(init?.headers);
          return {
            body,
            status: init?.status ?? 200,
            headers,
          };
        },
      ),
    },
  };
});

import {
  validate,
  validateData,
  validateRequestData,
  validateSearchParams,
} from "@/lib/server/validator";

// ============================================================================
// validateData - 已有测试 + 补充
// ============================================================================
describe("validator utilities", () => {
  describe("validateData", () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      age: z.number().min(0).max(150),
    });

    it("returns undefined for valid data", () => {
      const result = validateData(
        { name: "John", email: "john@example.com", age: 25 },
        schema,
      );
      expect(result).toBeUndefined();
    });

    it("returns error response for invalid data", () => {
      const result = validateData(
        { name: "", email: "invalid", age: -1 },
        schema,
      );
      expect(result).toBeDefined();
      expect(result!.error.code).toBe("VALIDATION_ERROR");
    });

    it("includes field-level error details", () => {
      const result = validateData(
        { name: "", email: "invalid", age: -1 },
        schema,
      );
      expect(result!.error.details).toBeDefined();
      expect(result!.error.details!.errors.length).toBeGreaterThan(0);
    });

    it("uses custom error message", () => {
      const result = validateData({ name: "" }, schema, {
        errorMessage: "Custom error",
      });
      expect(result!.message).toBe("Custom error");
    });

    it("uses custom error code", () => {
      const result = validateData({ name: "" }, schema, {
        errorCode: "CUSTOM_CODE",
      });
      expect(result!.error.code).toBe("CUSTOM_CODE");
    });

    it("handles nested schema validation", () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            bio: z.string().max(100),
          }),
        }),
      });

      const result = validateData(
        { user: { profile: { bio: "a".repeat(101) } } },
        nestedSchema,
      );
      expect(result).toBeDefined();
      expect(result!.error.details!.errors[0]!.field).toBe("user.profile.bio");
    });

    it("handles array schema validation", () => {
      const arraySchema = z.object({
        items: z.array(z.string().min(1)),
      });

      const result = validateData(
        { items: ["valid", "", "also-valid"] },
        arraySchema,
      );
      expect(result).toBeDefined();
    });

    // === 补充的测试 ===

    it("验证 null 输入", () => {
      const result = validateData(null, schema);
      expect(result).toBeDefined();
      expect(result!.error.code).toBe("VALIDATION_ERROR");
    });

    it("验证 undefined 输入", () => {
      const result = validateData(undefined, schema);
      expect(result).toBeDefined();
    });

    it("验证空对象", () => {
      const result = validateData({}, schema);
      expect(result).toBeDefined();
      expect(result!.error.details!.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("单字段错误时正确报告字段路径", () => {
      const result = validateData(
        { name: "John", email: "not-an-email", age: 25 },
        schema,
      );
      expect(result).toBeDefined();
      const errors = result!.error.details!.errors;
      expect(errors).toHaveLength(1);
      expect(errors[0]!.field).toBe("email");
    });

    it("多个字段错误时全部报告", () => {
      const result = validateData(
        { name: "", email: "invalid", age: -1 },
        schema,
      );
      expect(result).toBeDefined();
      const fields = result!.error.details!.errors.map((e) => e.field);
      expect(fields).toContain("name");
      expect(fields).toContain("email");
      expect(fields).toContain("age");
    });

    it("验证成功时返回 undefined（不修改输入对象）", () => {
      const input = { name: "John", email: "john@example.com", age: 25 };
      const original = { ...input };
      const result = validateData(input, schema);
      expect(result).toBeUndefined();
      expect(input).toEqual(original);
    });

    it("默认错误消息为 '数据验证失败'", () => {
      const result = validateData({ name: "" }, schema);
      expect(result!.message).toBe("数据验证失败");
    });

    it("默认错误码为 'VALIDATION_ERROR'", () => {
      const result = validateData({ name: "" }, schema);
      expect(result!.error.code).toBe("VALIDATION_ERROR");
    });

    it("默认子错误消息为 '数据格式不正确'", () => {
      const result = validateData({ name: "" }, schema);
      expect(result!.error.message).toBe("数据格式不正确");
    });

    it("使用简单 schema（string）", () => {
      const stringSchema = z.string().min(5);
      expect(validateData("hello", stringSchema)).toBeUndefined();
      expect(validateData("hi", stringSchema)).toBeDefined();
    });

    it("使用 enum schema", () => {
      const enumSchema = z.enum(["a", "b", "c"]);
      expect(validateData("a", enumSchema)).toBeUndefined();
      expect(validateData("d", enumSchema)).toBeDefined();
    });

    it("使用可选字段 schema", () => {
      const optionalSchema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      });
      expect(validateData({ name: "John" }, optionalSchema)).toBeUndefined();
      expect(
        validateData({ name: "John", nickname: "JD" }, optionalSchema),
      ).toBeUndefined();
    });

    it("使用 union schema", () => {
      const unionSchema = z.union([z.string(), z.number()]);
      expect(validateData("hello", unionSchema)).toBeUndefined();
      expect(validateData(42, unionSchema)).toBeUndefined();
      expect(validateData(true, unionSchema)).toBeDefined();
    });

    it("错误详情中的字段路径使用点号分隔嵌套层级", () => {
      const deepSchema = z.object({
        a: z.object({
          b: z.object({
            c: z.string().min(1),
          }),
        }),
      });
      const result = validateData({ a: { b: { c: "" } } }, deepSchema);
      expect(result!.error.details!.errors[0]!.field).toBe("a.b.c");
    });

    it("数组元素的字段路径包含索引", () => {
      const arraySchema = z.object({
        tags: z.array(z.string().min(1)),
      });
      const result = validateData({ tags: ["ok", "", "ok"] }, arraySchema);
      expect(result).toBeDefined();
      expect(result!.error.details!.errors[0]!.field).toBe("tags.1");
    });
  });

  // ============================================================================
  // validateRequestData
  // ============================================================================
  describe("validateRequestData", () => {
    const schema = z.object({
      title: z.string().min(1),
      count: z.number().int().positive(),
    });

    it("验证成功时返回数据", () => {
      const result = validateRequestData(
        { title: "test", count: 5 },
        schema,
      ) as any;
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ title: "test", count: 5 });
      }
    });

    it("验证失败时返回 NextResponse 对象（带 body 和 status）", () => {
      const result = validateRequestData(
        { title: "", count: -1 },
        schema,
      ) as any;
      expect(result.success).toBeUndefined();
      const res = result as any;
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("验证失败时包含字段错误详情", () => {
      const result = validateRequestData({ title: "", count: -1 }, schema);
      const res = result as any;
      const errors = res.body.error.details.errors;
      expect(errors.length).toBeGreaterThan(0);
      const fields = errors.map((e: any) => e.field);
      expect(fields).toContain("title");
      expect(fields).toContain("count");
    });

    it("null 输入触发验证失败", () => {
      const result = validateRequestData(null, schema);
      const res = result as any;
      expect(res.status).toBe(400);
    });

    it("空对象触发验证失败", () => {
      const result = validateRequestData({}, schema);
      const res = result as any;
      expect(res.status).toBe(400);
    });

    it("部分字段缺失触发验证失败", () => {
      const result = validateRequestData({ title: "test" }, schema);
      const res = result as any;
      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // validateSearchParams
  // ============================================================================
  describe("validateSearchParams", () => {
    const schema = z.object({
      page: z.string().transform(Number).pipe(z.number().int().positive()),
      keyword: z.string().optional(),
    });

    it("验证成功的搜索参数", () => {
      const params = new URLSearchParams("page=1&keyword=test");
      const result = validateSearchParams(params, schema) as any;
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.keyword).toBe("test");
      }
    });

    it("单个参数验证成功", () => {
      const params = new URLSearchParams("page=5");
      const result = validateSearchParams(params, schema) as any;
      expect(result.success).toBe(true);
    });

    it("验证失败时返回 NextResponse", () => {
      const params = new URLSearchParams("page=invalid");
      const result = validateSearchParams(params, schema);
      const res = result as any;
      expect(res.status).toBe(400);
    });

    it("空参数触发验证失败（缺少必填字段）", () => {
      const params = new URLSearchParams();
      const result = validateSearchParams(params, schema);
      const res = result as any;
      expect(res.status).toBe(400);
    });

    it("重复键参数转换为数组", () => {
      const arraySchema = z.object({
        tags: z.array(z.string()),
      });
      const params = new URLSearchParams("tags=a&tags=b&tags=c");
      const result = validateSearchParams(params, arraySchema) as any;
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual(["a", "b", "c"]);
      }
    });

    it("单值不被转换为数组", () => {
      const schema = z.object({
        name: z.string(),
      });
      const params = new URLSearchParams("name=test");
      const result = validateSearchParams(params, schema) as any;
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("test");
      }
    });
  });

  // ============================================================================
  // validate（快捷函数）
  // ============================================================================
  describe("validate", () => {
    const schema = z.object({
      id: z.number(),
    });

    it("验证成功返回数据", () => {
      const result = validate({ id: 1 }, schema) as any;
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(1);
      }
    });

    it("验证失败返回 NextResponse", () => {
      const result = validate({ id: "not-a-number" }, schema);
      const res = result as any;
      expect(res.status).toBe(400);
    });
  });
});
