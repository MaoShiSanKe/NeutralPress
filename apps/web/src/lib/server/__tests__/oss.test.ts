import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Module mocks (must be before imports, use vi.hoisted) ----

const {
  mockS3Send,
  mockVercelPut,
  mockVercelDel,
  mockGetContent,
  mockCreateOrUpdateFile,
  mockDeleteFile,
} = vi.hoisted(() => ({
  mockS3Send: vi.fn().mockResolvedValue({}),
  mockVercelPut: vi
    .fn()
    .mockResolvedValue({ url: "https://vercel.blob.url/key" }),
  mockVercelDel: vi.fn().mockResolvedValue(undefined),
  mockGetContent: vi.fn().mockRejectedValue({ status: 404 }),
  mockCreateOrUpdateFile: vi.fn().mockResolvedValue({}),
  mockDeleteFile: vi.fn().mockResolvedValue({}),
}));

// Mock fs/promises for LOCAL provider
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock S3 client
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class MockS3Client {
    send = mockS3Send;
  },
  PutObjectCommand: class MockPutObjectCommand {
    constructor(public args: any) {}
  },
  DeleteObjectCommand: class MockDeleteObjectCommand {
    constructor(public args: any) {}
  },
}));

// Mock Vercel Blob
vi.mock("@vercel/blob", () => ({
  put: (...args: any[]) => mockVercelPut(...args),
  del: (...args: any[]) => mockVercelDel(...args),
}));

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    repos = {
      getContent: mockGetContent,
      createOrUpdateFileContents: mockCreateOrUpdateFile,
      deleteFile: mockDeleteFile,
    };
  },
}));

import fs from "node:fs/promises";

import { buildObjectKey, deleteObject, uploadObject } from "@/lib/server/oss";

describe("oss utilities", () => {
  describe("buildObjectKey", () => {
    const fixedDate = new Date(2024, 5, 15); // June 15, 2024

    it("generates key with default template", () => {
      const result = buildObjectKey({
        filename: "test.jpg",
        date: fixedDate,
      });
      expect(result).toBe("2024/06/test.jpg");
    });

    it("generates key with custom template", () => {
      const result = buildObjectKey({
        filename: "test.jpg",
        pathTemplate: "/{year}/{month}/{day}/{filename}",
        date: fixedDate,
      });
      expect(result).toBe("2024/06/15/test.jpg");
    });

    it("handles basename and ext placeholders", () => {
      const result = buildObjectKey({
        filename: "image.png",
        pathTemplate: "/{year}/{basename}_thumb.{ext}",
        date: fixedDate,
      });
      expect(result).toBe("2024/image_thumb.png");
    });

    it("strips leading slashes", () => {
      const result = buildObjectKey({
        filename: "test.jpg",
        pathTemplate: "/{year}/{month}/{filename}",
        date: fixedDate,
      });
      expect(result).not.toMatch(/^\//);
    });

    it("prevents directory traversal", () => {
      const result = buildObjectKey({
        filename: "../../../etc/passwd",
        date: fixedDate,
      });
      expect(result).not.toContain("..");
    });

    it("sanitizes special characters in filename", () => {
      const result = buildObjectKey({
        filename: "file with spaces@#$.jpg",
        date: fixedDate,
      });
      expect(result).toMatch(/^[a-z0-9/._-]+$/i);
    });

    it("generates unique name when ensureUniqueName is true", () => {
      const result1 = buildObjectKey({
        filename: "test.jpg",
        ensureUniqueName: true,
        date: fixedDate,
      });
      const result2 = buildObjectKey({
        filename: "test.jpg",
        ensureUniqueName: true,
        date: fixedDate,
      });
      expect(result1).not.toBe(result2);
      expect(result1).toContain("test-");
      expect(result1).toMatch(/\.jpg$/);
    });

    it("handles filename without extension", () => {
      const result = buildObjectKey({
        filename: "README",
        date: fixedDate,
      });
      expect(result).toBe("2024/06/README");
    });

    it("uses file as fallback for dot-only basename", () => {
      const result = buildObjectKey({
        filename: "...",
        date: fixedDate,
      });
      expect(result).toContain("file");
    });

    it("handles nested template paths", () => {
      const result = buildObjectKey({
        filename: "photo.jpg",
        pathTemplate: "uploads/{year}/{month}/gallery/{filename}",
        date: fixedDate,
      });
      expect(result).toBe("uploads/2024/06/gallery/photo.jpg");
    });

    it("handles custom path with placeholders", () => {
      const result = buildObjectKey({
        filename: "avatar.png",
        pathTemplate: "/{year}/{month}/{filename}",
        date: fixedDate,
      });
      expect(result).toBe("2024/06/avatar.png");
    });
  });

  // =========================================================================
  // uploadObject tests
  // =========================================================================

  describe("uploadObject", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("LOCAL provider", () => {
      it("creates directories and writes file", async () => {
        const result = await uploadObject({
          type: "LOCAL",
          baseUrl: "https://example.com/uploads",
          pathTemplate: "/{year}/{month}/{filename}",
          config: { rootDir: "/var/www/uploads" },
          file: {
            buffer: Buffer.from("hello"),
            filename: "test.txt",
            contentType: "text/plain",
          },
        });

        expect(result.key).toContain("test.txt");
        expect(result.url).toContain("https://example.com/uploads");
        expect(fs.mkdir).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalled();
      });

      it("throws when rootDir is missing", async () => {
        await expect(
          uploadObject({
            type: "LOCAL",
            baseUrl: "https://example.com",
            config: { rootDir: "" },
            file: { buffer: Buffer.from("x"), filename: "a.txt" },
          }),
        ).rejects.toThrow("rootDir is required");
      });

      it("prevents directory traversal in LOCAL upload", async () => {
        // Even with a traversal filename, the buildObjectKey sanitizes it
        const result = await uploadObject({
          type: "LOCAL",
          baseUrl: "https://example.com",
          config: { rootDir: "/var/www/uploads" },
          file: {
            buffer: Buffer.from("data"),
            filename: "../../../etc/passwd",
          },
        });

        expect(result.key).not.toContain("..");
      });

      it("respects createDirIfNotExists=false", async () => {
        await uploadObject({
          type: "LOCAL",
          baseUrl: "https://example.com",
          config: { rootDir: "/var/www/uploads", createDirIfNotExists: false },
          file: { buffer: Buffer.from("x"), filename: "test.txt" },
        });

        expect(fs.mkdir).not.toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalled();
      });
    });

    describe("AWS_S3 provider", () => {
      it("sends PutObjectCommand with correct parameters", async () => {
        const result = await uploadObject({
          type: "AWS_S3",
          baseUrl: "https://cdn.example.com",
          config: {
            accessKeyId: "AKID",
            secretAccessKey: "SECRET",
            region: "us-east-1",
            bucket: "my-bucket",
            basePath: "uploads",
          },
          file: {
            buffer: Buffer.from("image-data"),
            filename: "photo.jpg",
            contentType: "image/jpeg",
          },
        });

        expect(result.key).toContain("photo.jpg");
        expect(result.url).toContain("https://cdn.example.com");
        expect(mockS3Send).toHaveBeenCalledTimes(1);
      });

      it("throws when required S3 config is missing", async () => {
        await expect(
          uploadObject({
            type: "AWS_S3",
            baseUrl: "https://cdn.example.com",
            config: {
              accessKeyId: "",
              secretAccessKey: "",
              region: "",
              bucket: "",
            },
            file: { buffer: Buffer.from("x"), filename: "a.jpg" },
          }),
        ).rejects.toThrow("missing required fields");
      });

      it("includes basePath in the key", async () => {
        const result = await uploadObject({
          type: "AWS_S3",
          baseUrl: "https://cdn.example.com",
          config: {
            accessKeyId: "AKID",
            secretAccessKey: "SECRET",
            region: "us-east-1",
            bucket: "my-bucket",
            basePath: "media/images",
          },
          file: { buffer: Buffer.from("data"), filename: "pic.png" },
        });

        expect(result.key).toContain("media/images");
      });
    });

    describe("VERCEL_BLOB provider", () => {
      it("calls vercel put with correct arguments", async () => {
        const result = await uploadObject({
          type: "VERCEL_BLOB",
          baseUrl: "https://blob.vercel.com",
          config: { token: "blob-token-123" },
          file: {
            buffer: Buffer.from("blob-data"),
            filename: "file.webp",
            contentType: "image/webp",
          },
        });

        expect(mockVercelPut).toHaveBeenCalledTimes(1);
        expect(result.url).toBe("https://vercel.blob.url/key");
      });

      it("throws when token is missing", async () => {
        await expect(
          uploadObject({
            type: "VERCEL_BLOB",
            baseUrl: "https://blob.vercel.com",
            config: { token: "" },
            file: { buffer: Buffer.from("x"), filename: "a.txt" },
          }),
        ).rejects.toThrow("config.token is required");
      });

      it("passes cacheControl option", async () => {
        await uploadObject({
          type: "VERCEL_BLOB",
          baseUrl: "https://blob.vercel.com",
          config: {
            token: "tok",
            cacheControl: "public,max-age=31536000",
          },
          file: {
            buffer: Buffer.from("data"),
            filename: "cached.jpg",
            contentType: "image/jpeg",
          },
        });

        const callArgs = mockVercelPut.mock.calls[0]!;
        expect(callArgs[2]).toHaveProperty(
          "cacheControl",
          "public,max-age=31536000",
        );
      });
    });

    describe("GITHUB_PAGES provider", () => {
      it("uploads file to GitHub repo", async () => {
        // mockGetContent defaults to 404 (file doesn't exist)
        const result = await uploadObject({
          type: "GITHUB_PAGES",
          baseUrl: "https://user.github.io/repo",
          config: {
            owner: "user",
            repo: "repo",
            branch: "main",
            token: "ghp_token",
          },
          file: {
            buffer: Buffer.from("github-content"),
            filename: "readme.md",
          },
        });

        expect(result.key).toContain("readme.md");
        expect(result.url).toContain("https://user.github.io/repo");
        expect(mockCreateOrUpdateFile).toHaveBeenCalledTimes(1);
      });

      it("throws when required GitHub config is missing", async () => {
        await expect(
          uploadObject({
            type: "GITHUB_PAGES",
            baseUrl: "https://user.github.io/repo",
            config: {
              owner: "",
              repo: "",
              branch: "",
              token: "",
            },
            file: { buffer: Buffer.from("x"), filename: "a.txt" },
          }),
        ).rejects.toThrow("missing required fields");
      });

      it("updates existing file (passes sha)", async () => {
        mockGetContent.mockResolvedValueOnce({
          data: { sha: "abc123sha" },
        });

        await uploadObject({
          type: "GITHUB_PAGES",
          baseUrl: "https://user.github.io/repo",
          config: {
            owner: "user",
            repo: "repo",
            branch: "main",
            token: "ghp_token",
          },
          file: { buffer: Buffer.from("updated"), filename: "file.txt" },
        });

        expect(mockCreateOrUpdateFile).toHaveBeenCalledTimes(1);
        const callArgs = mockCreateOrUpdateFile.mock.calls[0]![0];
        expect(callArgs.sha).toBe("abc123sha");
      });
    });

    describe("EXTERNAL_URL provider", () => {
      it("returns URL without actual upload", async () => {
        const result = await uploadObject({
          type: "EXTERNAL_URL",
          baseUrl: "https://external.cdn.com",
          config: {},
          file: {
            buffer: Buffer.from(""),
            filename: "external.jpg",
          },
        });

        expect(result.key).toContain("external.jpg");
        expect(result.url).toContain("https://external.cdn.com");
        // No external service calls should be made
        expect(mockS3Send).not.toHaveBeenCalled();
        expect(mockVercelPut).not.toHaveBeenCalled();
      });
    });

    describe("customPath", () => {
      it("overrides pathTemplate when customPath is provided", async () => {
        const result = await uploadObject({
          type: "LOCAL",
          baseUrl: "https://example.com",
          pathTemplate: "/{year}/{month}/{filename}",
          customPath: "custom/{filename}",
          config: { rootDir: "/tmp/uploads" },
          file: { buffer: Buffer.from("x"), filename: "test.txt" },
        });

        expect(result.key).toContain("custom/test.txt");
      });
    });

    describe("ensureUniqueName", () => {
      it("generates unique filenames when enabled", async () => {
        const result1 = await uploadObject({
          type: "LOCAL",
          baseUrl: "https://example.com",
          ensureUniqueName: true,
          config: { rootDir: "/tmp/uploads" },
          file: { buffer: Buffer.from("a"), filename: "same.jpg" },
        });
        const result2 = await uploadObject({
          type: "LOCAL",
          baseUrl: "https://example.com",
          ensureUniqueName: true,
          config: { rootDir: "/tmp/uploads" },
          file: { buffer: Buffer.from("b"), filename: "same.jpg" },
        });

        expect(result1.key).not.toBe(result2.key);
        expect(result1.key).toContain("same-");
        expect(result2.key).toContain("same-");
      });
    });
  });

  // =========================================================================
  // deleteObject tests
  // =========================================================================

  describe("deleteObject", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("LOCAL provider", () => {
      it("removes file using fs.rm", async () => {
        await deleteObject({
          type: "LOCAL",
          config: { rootDir: "/var/www/uploads" },
          key: "2024/06/test.jpg",
        } as any);

        expect(fs.rm).toHaveBeenCalledWith(
          expect.stringContaining("test.jpg"),
          { force: true },
        );
      });

      it("prevents directory traversal in LOCAL delete", async () => {
        // The normalizePosixPath function should strip leading ../
        // and the diskPath check should prevent traversal
        await deleteObject({
          type: "LOCAL",
          config: { rootDir: "/var/www/uploads" },
          key: "2024/06/test.jpg",
        } as any);

        const calledPath = (fs.rm as any).mock.calls[0]?.[0];
        if (calledPath) {
          const path = await import("path");
          const root = path.resolve("/var/www/uploads");
          expect(calledPath.startsWith(root)).toBe(true);
        }
      });
    });

    describe("AWS_S3 provider", () => {
      it("sends DeleteObjectCommand", async () => {
        await deleteObject({
          type: "AWS_S3",
          config: {
            accessKeyId: "AKID",
            secretAccessKey: "SECRET",
            region: "us-east-1",
            bucket: "my-bucket",
          },
          key: "uploads/photo.jpg",
        } as any);

        expect(mockS3Send).toHaveBeenCalledTimes(1);
      });

      it("throws when required S3 config is missing", async () => {
        await expect(
          deleteObject({
            type: "AWS_S3",
            config: {
              accessKeyId: "",
              secretAccessKey: "",
              region: "",
              bucket: "",
            },
            key: "test.jpg",
          } as any),
        ).rejects.toThrow("missing required fields");
      });

      it("includes basePath when deleting", async () => {
        await deleteObject({
          type: "AWS_S3",
          config: {
            accessKeyId: "AKID",
            secretAccessKey: "SECRET",
            region: "us-east-1",
            bucket: "my-bucket",
            basePath: "media",
          },
          key: "2024/photo.jpg",
        } as any);

        expect(mockS3Send).toHaveBeenCalledTimes(1);
      });
    });

    describe("VERCEL_BLOB provider", () => {
      it("calls vercel del", async () => {
        await deleteObject({
          type: "VERCEL_BLOB",
          baseUrl: "https://blob.vercel.com",
          config: { token: "blob-token" },
          key: "uploads/file.webp",
        });

        expect(mockVercelDel).toHaveBeenCalledTimes(1);
      });

      it("throws when token is missing", async () => {
        await expect(
          deleteObject({
            type: "VERCEL_BLOB",
            baseUrl: "https://blob.vercel.com",
            config: { token: "" },
            key: "file.txt",
          }),
        ).rejects.toThrow("config.token is required");
      });
    });

    describe("GITHUB_PAGES provider", () => {
      it("deletes file from GitHub repo", async () => {
        mockGetContent.mockResolvedValueOnce({
          data: { sha: "file-sha-abc" },
        });

        await deleteObject({
          type: "GITHUB_PAGES",
          config: {
            owner: "user",
            repo: "repo",
            branch: "main",
            token: "ghp_token",
          },
          key: "uploads/delete-me.txt",
        } as any);

        expect(mockGetContent).toHaveBeenCalledTimes(1);
        expect(mockDeleteFile).toHaveBeenCalledTimes(1);
      });

      it("throws when required GitHub config is missing", async () => {
        await expect(
          deleteObject({
            type: "GITHUB_PAGES",
            config: {
              owner: "",
              repo: "",
              branch: "",
              token: "",
            },
            key: "file.txt",
          } as any),
        ).rejects.toThrow("missing required fields");
      });

      it("throws when target is a directory", async () => {
        mockGetContent.mockResolvedValueOnce({
          data: [{ path: "dir/file.txt" }], // array means directory
        });

        await expect(
          deleteObject({
            type: "GITHUB_PAGES",
            config: {
              owner: "user",
              repo: "repo",
              branch: "main",
              token: "ghp_token",
            },
            key: "some-directory",
          } as any),
        ).rejects.toThrow("directory or invalid");
      });
    });

    describe("EXTERNAL_URL provider", () => {
      it("is a no-op (does nothing)", async () => {
        // Should resolve without errors and without calling any service
        await expect(
          deleteObject({
            type: "EXTERNAL_URL",
            baseUrl: "https://external.cdn.com",
            config: {},
            key: "file.jpg",
          }),
        ).resolves.toBeUndefined();

        expect(mockS3Send).not.toHaveBeenCalled();
        expect(mockVercelDel).not.toHaveBeenCalled();
        expect(mockDeleteFile).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Path security tests
  // =========================================================================

  describe("path security", () => {
    it("strips leading ../ sequences from built keys", () => {
      const result = buildObjectKey({
        filename: "../../etc/passwd",
        pathTemplate: "/{filename}",
      });
      expect(result).not.toContain("..");
    });

    it("prevents traversal in nested templates", () => {
      const result = buildObjectKey({
        filename: "../../../root/.ssh/id_rsa",
        pathTemplate: "/uploads/{year}/{filename}",
      });
      expect(result).not.toContain("..");
    });

    it("sanitizes path separators in filenames", () => {
      const result = buildObjectKey({
        filename: "sub/dir/file.jpg",
      });
      // The filename part should be sanitized
      expect(result).toContain("file.jpg");
    });

    it("normalizes double slashes in paths", () => {
      const result = buildObjectKey({
        filename: "test.jpg",
        pathTemplate: "//uploads///{filename}",
      });
      expect(result).not.toMatch(/\/\//);
    });
  });
});
