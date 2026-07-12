import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/headers
const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

// Mock server-only
vi.mock("server-only", () => ({}));

describe("get-client-info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getClientIP", () => {
    it("returns IP from x-forwarded-for header", async () => {
      const { getClientIP } = await import("@/lib/server/get-client-info");
      mockHeaders.mockResolvedValue(
        new Map([
          ["x-forwarded-for", "203.0.113.50, 70.41.3.18, 150.172.238.178"],
        ]),
      );

      const ip = await getClientIP();
      expect(ip).toBe("203.0.113.50");
    });

    it("trims whitespace from x-forwarded-for", async () => {
      const { getClientIP } = await import("@/lib/server/get-client-info");
      mockHeaders.mockResolvedValue(
        new Map([["x-forwarded-for", "  203.0.113.50  , 70.41.3.18"]]),
      );

      const ip = await getClientIP();
      expect(ip).toBe("203.0.113.50");
    });

    it("returns IP from x-real-ip when x-forwarded-for is absent", async () => {
      const { getClientIP } = await import("@/lib/server/get-client-info");
      mockHeaders.mockResolvedValue(new Map([["x-real-ip", "198.51.100.76"]]));

      const ip = await getClientIP();
      expect(ip).toBe("198.51.100.76");
    });

    it("prioritizes x-forwarded-for over x-real-ip", async () => {
      const { getClientIP } = await import("@/lib/server/get-client-info");
      mockHeaders.mockResolvedValue(
        new Map([
          ["x-forwarded-for", "203.0.113.50"],
          ["x-real-ip", "198.51.100.76"],
        ]),
      );

      const ip = await getClientIP();
      expect(ip).toBe("203.0.113.50");
    });

    it("returns 'unknown' when no IP headers present", async () => {
      const { getClientIP } = await import("@/lib/server/get-client-info");
      mockHeaders.mockResolvedValue(new Map());

      const ip = await getClientIP();
      expect(ip).toBe("unknown");
    });

    it("returns 'unknown' when headers are empty", async () => {
      const { getClientIP } = await import("@/lib/server/get-client-info");
      mockHeaders.mockResolvedValue(new Map());

      const ip = await getClientIP();
      expect(ip).toBe("unknown");
    });
  });

  describe("getClientUserAgent", () => {
    it("returns user-agent from headers", async () => {
      const { getClientUserAgent } = await import(
        "@/lib/server/get-client-info"
      );
      mockHeaders.mockResolvedValue(
        new Map([["user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"]]),
      );

      const ua = await getClientUserAgent();
      expect(ua).toBe("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    });

    it("returns 'unknown' when user-agent is absent", async () => {
      const { getClientUserAgent } = await import(
        "@/lib/server/get-client-info"
      );
      mockHeaders.mockResolvedValue(new Map());

      const ua = await getClientUserAgent();
      expect(ua).toBe("unknown");
    });

    it("returns 'unknown' when user-agent is empty string", async () => {
      const { getClientUserAgent } = await import(
        "@/lib/server/get-client-info"
      );
      mockHeaders.mockResolvedValue(new Map([["user-agent", ""]]));

      const ua = await getClientUserAgent();
      expect(ua).toBe("unknown");
    });
  });
});
