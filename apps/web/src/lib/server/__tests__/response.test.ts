import { beforeEach, describe, expect, it, vi } from "vitest";

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
  createCacheHeaders,
  createPaginationMeta,
  createSecurityHeaders,
  default as ResponseBuilder,
  fieldError,
} from "@/lib/server/response";

// ============================================================================
// createSecurityHeaders
// ============================================================================
describe("createSecurityHeaders", () => {
  it("包含默认安全头", () => {
    const headers = createSecurityHeaders() as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Security-Policy"]).toBe(
      "default-src 'none'; frame-ancestors 'none';",
    );
    expect(headers["Cache-Control"]).toBe("no-store");
  });

  it("自定义头可以覆盖默认值", () => {
    const headers = createSecurityHeaders({
      "Cache-Control": "max-age=60",
      "X-Custom": "value",
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("max-age=60");
    expect(headers["X-Custom"]).toBe("value");
    // 其他默认头仍然存在
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("可以添加额外的自定义头", () => {
    const headers = createSecurityHeaders({
      "X-Request-Id": "abc-123",
    }) as Record<string, string>;
    expect(headers["X-Request-Id"]).toBe("abc-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

// ============================================================================
// createCacheHeaders
// ============================================================================
describe("createCacheHeaders", () => {
  it("无配置时返回 no-store", () => {
    const headers = createCacheHeaders() as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("no-store");
  });

  it("noStore 优先级最高", () => {
    const headers = createCacheHeaders({
      noStore: true,
      maxAge: 3600,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("no-store");
  });

  it("noCache 配置正确", () => {
    const headers = createCacheHeaders({
      noCache: true,
      maxAge: 3600,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("no-cache");
  });

  it("max-age 配置正确", () => {
    const headers = createCacheHeaders({
      maxAge: 3600,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("max-age=3600");
  });

  it("s-maxage 配置正确", () => {
    const headers = createCacheHeaders({
      sMaxAge: 86400,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("s-maxage=86400");
  });

  it("stale-while-revalidate 配置正确", () => {
    const headers = createCacheHeaders({
      staleWhileRevalidate: 60,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("stale-while-revalidate=60");
  });

  it("must-revalidate 配置正确", () => {
    const headers = createCacheHeaders({
      mustRevalidate: true,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("must-revalidate");
  });

  it("多个缓存指令组合", () => {
    const headers = createCacheHeaders({
      maxAge: 3600,
      sMaxAge: 86400,
      staleWhileRevalidate: 60,
      mustRevalidate: true,
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe(
      "max-age=3600, s-maxage=86400, stale-while-revalidate=60, must-revalidate",
    );
  });

  it("空配置对象（无任何字段）默认 no-store", () => {
    const headers = createCacheHeaders({}) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("no-store");
  });

  it("设置 ETag", () => {
    const headers = createCacheHeaders({
      etag: '"abc123"',
    }) as Record<string, string>;
    expect(headers["ETag"]).toBe('"abc123"');
  });

  it("设置 Last-Modified", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    const headers = createCacheHeaders({
      lastModified: date,
    }) as Record<string, string>;
    expect(headers["Last-Modified"]).toBe(date.toUTCString());
  });

  it("组合 maxAge 和 ETag", () => {
    const headers = createCacheHeaders({
      maxAge: 300,
      etag: '"v1"',
    }) as Record<string, string>;
    expect(headers["Cache-Control"]).toBe("max-age=300");
    expect(headers["ETag"]).toBe('"v1"');
  });
});

// ============================================================================
// createPaginationMeta
// ============================================================================
describe("createPaginationMeta", () => {
  it("基本分页元数据", () => {
    const meta = createPaginationMeta(1, 10, 100);
    expect(meta).toEqual({
      page: 1,
      pageSize: 10,
      total: 100,
      totalPages: 10,
      hasNext: true,
      hasPrev: false,
    });
  });

  it("最后一页", () => {
    const meta = createPaginationMeta(10, 10, 100);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it("第一页（只有一页）", () => {
    const meta = createPaginationMeta(1, 10, 5);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });

  it("中间页", () => {
    const meta = createPaginationMeta(3, 10, 100);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });

  it("total 为 0", () => {
    const meta = createPaginationMeta(1, 10, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });

  it("不能整除时向上取整", () => {
    const meta = createPaginationMeta(1, 10, 25);
    expect(meta.totalPages).toBe(3);
  });

  it("pageSize 为 1", () => {
    const meta = createPaginationMeta(1, 1, 3);
    expect(meta.totalPages).toBe(3);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(false);
  });
});

// ============================================================================
// fieldError
// ============================================================================
describe("fieldError", () => {
  it("创建基本字段错误", () => {
    const error = fieldError("email", "格式不正确");
    expect(error).toEqual({
      code: "FIELD_VALIDATION_ERROR",
      message: "email: 格式不正确",
      field: "email",
      details: undefined,
    });
  });

  it("包含详情信息", () => {
    const details = { minLength: "5", maxLength: "100" };
    const error = fieldError("username", "长度不符合要求", details);
    expect(error.code).toBe("FIELD_VALIDATION_ERROR");
    expect(error.field).toBe("username");
    expect(error.details).toEqual(details);
  });

  it("字段名嵌入消息中", () => {
    const error = fieldError("password", "不能为空");
    expect(error.message).toBe("password: 不能为空");
  });
});

// ============================================================================
// ResponseBuilder - serveraction 模式（返回纯对象，无需 NextResponse）
// ============================================================================
describe("ResponseBuilder", () => {
  describe("serveraction 模式", () => {
    let builder: InstanceType<typeof ResponseBuilder>;

    beforeEach(() => {
      builder = new ResponseBuilder("serveraction");
    });

    describe("ok", () => {
      it("返回默认成功响应", () => {
        const res = builder.ok() as any;
        expect(res.success).toBe(true);
        expect(res.message).toBe("请求成功");
        expect(res.data).toBeNull();
        expect(res.timestamp).toBeDefined();
        expect(res.requestId).toBeDefined();
      });

      it("返回带数据的成功响应", () => {
        const res = builder.ok({ data: { id: 1, name: "test" } }) as any;
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ id: 1, name: "test" });
      });

      it("自定义消息", () => {
        const res = builder.ok({ message: "获取成功" }) as any;
        expect(res.message).toBe("获取成功");
      });

      it("带分页元数据", () => {
        const meta = {
          page: 1,
          pageSize: 10,
          total: 100,
          totalPages: 10,
          hasNext: true,
          hasPrev: false,
        };
        const res = builder.ok({ data: [1, 2, 3], meta }) as any;
        expect(res.meta).toEqual(meta);
      });
    });

    describe("created", () => {
      it("返回默认创建成功响应", () => {
        const res = builder.created() as any;
        expect(res.success).toBe(true);
        expect(res.message).toBe("创建成功");
      });

      it("返回带数据的创建成功响应", () => {
        const res = builder.created({ data: { id: 42 } }) as any;
        expect(res.data).toEqual({ id: 42 });
      });
    });

    describe("noContent", () => {
      it("返回无内容响应", () => {
        const res = builder.noContent() as any;
        expect(res.success).toBe(true);
        expect(res.message).toBe("操作成功");
        expect(res.data).toBeNull();
      });
    });

    describe("notModified", () => {
      it("返回未修改响应", () => {
        const res = builder.notModified() as any;
        expect(res.success).toBe(true);
        expect(res.message).toBe("未修改");
        expect(res.data).toBeNull();
      });
    });

    describe("badRequest", () => {
      it("返回默认 400 响应", () => {
        const res = builder.badRequest() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("请求参数错误");
        expect(res.error).toEqual({
          code: "BAD_REQUEST",
          message: "请求参数错误",
        });
      });

      it("自定义消息和错误", () => {
        const res = builder.badRequest({
          message: "缺少必要参数",
          error: { code: "MISSING_FIELD", message: "name 字段必填" },
        }) as any;
        expect(res.message).toBe("缺少必要参数");
        expect(res.error.code).toBe("MISSING_FIELD");
      });

      it("字符串错误转为 ApiError", () => {
        const res = builder.badRequest({
          error: "自定义错误",
        }) as any;
        expect(res.error).toEqual({
          code: "CUSTOM_ERROR",
          message: "自定义错误",
        });
      });
    });

    describe("unauthorized", () => {
      it("返回 401 响应", () => {
        const res = builder.unauthorized() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("未授权访问");
        expect(res.error.code).toBe("UNAUTHORIZED");
      });
    });

    describe("forbidden", () => {
      it("返回 403 响应", () => {
        const res = builder.forbidden() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("禁止访问");
        expect(res.error.code).toBe("FORBIDDEN");
      });
    });

    describe("notFound", () => {
      it("返回 404 响应", () => {
        const res = builder.notFound() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("资源未找到");
        expect(res.error.code).toBe("NOT_FOUND");
      });
    });

    describe("conflict", () => {
      it("返回 409 响应", () => {
        const res = builder.conflict() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("资源冲突");
        expect(res.error.code).toBe("CONFLICT");
      });
    });

    describe("unprocessableEntity", () => {
      it("返回 422 响应", () => {
        const res = builder.unprocessableEntity() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("验证失败");
        expect(res.error.code).toBe("UNPROCESSABLE_ENTITY");
      });
    });

    describe("tooManyRequests", () => {
      it("返回 429 响应", () => {
        const res = builder.tooManyRequests() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("请求过于频繁，请稍后再试");
        expect(res.error.code).toBe("TOO_MANY_REQUESTS");
      });
    });

    describe("serverError", () => {
      it("返回 500 响应", () => {
        const res = builder.serverError() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("服务器内部错误");
        expect(res.error.code).toBe("INTERNAL_SERVER_ERROR");
      });
    });

    describe("badGateway", () => {
      it("返回 502 响应（使用 500 状态码）", () => {
        const res = builder.badGateway() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("服务器网关错误");
        expect(res.error.code).toBe("INTERNAL_SERVER_ERROR");
      });
    });

    describe("serviceUnavailable", () => {
      it("返回 503 响应", () => {
        const res = builder.serviceUnavailable() as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("服务暂时不可用");
        expect(res.error.code).toBe("SERVICE_UNAVAILABLE");
      });
    });

    describe("cached", () => {
      it("返回带缓存配置的成功响应", () => {
        const res = builder.cached({
          data: { items: [1, 2, 3] },
          cacheConfig: { maxAge: 3600 },
        }) as any;
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ items: [1, 2, 3] });
      });
    });

    describe("validationError", () => {
      it("返回字段验证错误", () => {
        const res = builder.validationError({
          field: "email",
          errorMessage: "格式不正确",
        }) as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("数据验证失败");
        expect(res.error.code).toBe("FIELD_VALIDATION_ERROR");
        expect(res.error.field).toBe("email");
      });

      it("自定义消息", () => {
        const res = builder.validationError({
          field: "username",
          message: "用户信息验证失败",
          errorMessage: "不能为空",
        }) as any;
        expect(res.message).toBe("用户信息验证失败");
      });

      it("包含错误详情", () => {
        const res = builder.validationError({
          field: "age",
          errorMessage: "必须为正数",
          details: { min: "0" },
        }) as any;
        expect(res.error.details).toEqual({ min: "0" });
      });
    });

    describe("response（通用方法）", () => {
      it("默认 status 200 为成功", () => {
        const res = builder.response({}) as any;
        expect(res.success).toBe(true);
        expect(res.message).toBe("请求成功");
      });

      it("非 2xx 状态码自动判定为失败", () => {
        const res = builder.response({ status: 500 }) as any;
        expect(res.success).toBe(false);
        expect(res.message).toBe("请求失败");
      });

      it("显式指定 success 覆盖自动判定", () => {
        const res = builder.response({
          status: 404,
          success: true,
          message: "忽略",
        }) as any;
        expect(res.success).toBe(true);
      });

      it("传递分页元数据", () => {
        const meta = {
          page: 2,
          pageSize: 5,
          total: 50,
          totalPages: 10,
          hasNext: true,
          hasPrev: true,
        };
        const res = builder.response({ data: [], meta }) as any;
        expect(res.meta).toEqual(meta);
      });

      it("error 为 undefined 时不包含 error 字段", () => {
        const res = builder.response({}) as any;
        expect(res.error).toBeUndefined();
      });
    });
  });

  describe("serverless 模式", () => {
    let builder: InstanceType<typeof ResponseBuilder>;

    beforeEach(() => {
      builder = new ResponseBuilder("serverless");
    });

    it("ok 返回带 status 和 headers 的对象", () => {
      const res = builder.ok({ data: "hello" }) as any;
      expect(res.status).toBe(200);
      expect(res.headers).toBeDefined();
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBe("hello");
    });

    it("notFound 返回 404", () => {
      const res = builder.notFound() as any;
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("serverError 返回 500", () => {
      const res = builder.serverError() as any;
      expect(res.status).toBe(500);
    });

    it("badRequest 返回 400", () => {
      const res = builder.badRequest({
        error: { code: "BAD_REQUEST", message: "无效参数" },
      }) as any;
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });
  });

  describe("默认环境", () => {
    it("默认为 serverless 环境", () => {
      const builder = new ResponseBuilder();
      const res = builder.ok() as any;
      expect(res.status).toBe(200);
    });
  });
});
