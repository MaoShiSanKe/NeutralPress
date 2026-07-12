import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @vercel/blob/client
vi.mock("@vercel/blob/client", () => ({
  put: vi.fn(),
}));

import { put as putBlob } from "@vercel/blob/client";

import { useMediaUpload } from "@/hooks/use-media-upload";

// Mock URL
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

// 保存原始 XMLHttpRequest
const OriginalXMLHttpRequest = global.XMLHttpRequest;

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createMockFile(
  name = "test.png",
  size = 1024,
  type = "image/png",
): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  } as unknown as FileList;
  files.forEach((f, i) => {
    (fileList as any)[i] = f;
  });
  return fileList;
}

/**
 * 创建一个会自动成功的 MockXMLHttpRequest（同步触发事件）
 */
function createSuccessXMLHttpRequest(responseText: string = "{}") {
  return class SuccessXMLHttpRequest {
    status = 200;
    statusText = "OK";
    responseText = responseText;
    withCredentials = false;
    upload = {
      addEventListener: vi.fn(),
    };
    private listeners: Record<string, ((...args: any[]) => any)[]> = {};

    addEventListener(event: string, cb: (...args: any[]) => any) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
    }

    open() {}
    setRequestHeader() {}
    send() {
      // 同步触发上传进度
      const progressCb = this.upload.addEventListener.mock.calls.find(
        (c: any) => c[0] === "progress",
      )?.[1];
      if (progressCb) {
        progressCb({ lengthComputable: true, loaded: 100, total: 100 });
      }
      // 同步触发上传完成
      const uploadLoadCb = this.upload.addEventListener.mock.calls.find(
        (c: any) => c[0] === "load",
      )?.[1];
      if (uploadLoadCb) uploadLoadCb();
      // 同步触发响应完成
      this.listeners["load"]?.forEach((cb) => cb());
    }
    abort() {}
  } as any;
}

/**
 * 创建一个会失败的 MockXMLHttpRequest（网络错误）
 */
function createErrorXMLHttpRequest() {
  return class ErrorXMLHttpRequest {
    status = 0;
    statusText = "";
    responseText = "";
    withCredentials = false;
    upload = {
      addEventListener: vi.fn(),
    };
    private listeners: Record<string, ((...args: any[]) => any)[]> = {};

    addEventListener(event: string, cb: (...args: any[]) => any) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
    }

    open() {}
    setRequestHeader() {}
    send() {
      // 同步触发错误
      this.listeners["error"]?.forEach((cb) => cb());
    }
    abort() {}
  } as any;
}

describe("useMediaUpload", () => {
  const defaultOptions = {
    mode: "lossy" as const,
    storageId: "storage-1",
    folderId: null,
    multiple: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
  });

  afterEach(() => {
    global.XMLHttpRequest = OriginalXMLHttpRequest;
  });

  describe("初始状态", () => {
    it("返回空文件数组和 uploading=false", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));
      expect(result.current.files).toEqual([]);
      expect(result.current.uploading).toBe(false);
    });
  });

  describe("handleFileSelect", () => {
    describe("多选模式", () => {
      it("追加新文件到现有文件列表", () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("a.png")]),
          );
        });
        expect(result.current.files).toHaveLength(1);

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("b.png"), createMockFile("c.png")]),
          );
        });
        expect(result.current.files).toHaveLength(3);
      });

      it("为每个文件创建预览 URL", () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));
        const file = createMockFile("test.png");

        act(() => {
          result.current.handleFileSelect(createFileList([file]));
        });

        expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
        expect(result.current.files[0]!.previewUrl).toBe("blob:mock-url");
      });

      it("记录原始文件大小", () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));
        const file = createMockFile("big.png", 2048);

        act(() => {
          result.current.handleFileSelect(createFileList([file]));
        });

        expect(result.current.files[0]!.originalSize).toBe(2048);
      });

      it("设置状态为 pending", () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("test.png")]),
          );
        });

        expect(result.current.files[0]!.status).toBe("pending");
      });

      it("生成唯一 ID", () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("a.png"), createMockFile("b.png")]),
          );
        });

        expect(result.current.files[0]!.id).not.toBe(
          result.current.files[1]!.id,
        );
      });
    });

    describe("单选模式", () => {
      const singleOptions = { ...defaultOptions, multiple: false };

      it("替换现有文件", () => {
        const { result } = renderHook(() => useMediaUpload(singleOptions));

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("a.png")]),
          );
        });
        expect(result.current.files).toHaveLength(1);
        expect(result.current.files[0]!.file.name).toBe("a.png");

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("b.png")]),
          );
        });
        expect(result.current.files).toHaveLength(1);
        expect(result.current.files[0]!.file.name).toBe("b.png");
      });

      it("替换时清理旧预览 URL", () => {
        const { result } = renderHook(() => useMediaUpload(singleOptions));

        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("a.png")]),
          );
        });
        act(() => {
          result.current.handleFileSelect(
            createFileList([createMockFile("b.png")]),
          );
        });

        expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
      });

      it("只取第一个文件", () => {
        const { result } = renderHook(() => useMediaUpload(singleOptions));

        act(() => {
          result.current.handleFileSelect(
            createFileList([
              createMockFile("first.png"),
              createMockFile("second.png"),
            ]),
          );
        });

        expect(result.current.files).toHaveLength(1);
        expect(result.current.files[0]!.file.name).toBe("first.png");
      });
    });

    it("null 输入不做任何操作", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(null);
      });

      expect(result.current.files).toHaveLength(0);
    });
  });

  describe("handlePaste", () => {
    it("从剪贴板创建图片文件", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));
      const mockFile = createMockFile("clipboard.png");

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: {
            items: [{ type: "image/png", getAsFile: () => mockFile }],
          },
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(1);
    });

    it("剪贴板为 null 时不处理", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: null,
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(0);
    });

    it("忽略非图片项", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: {
            items: [{ type: "text/plain", getAsFile: () => null }],
          },
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(0);
    });

    it("找到图片时调用 preventDefault", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));
      const preventDefault = vi.fn();

      act(() => {
        result.current.handlePaste({
          preventDefault,
          clipboardData: {
            items: [
              {
                type: "image/png",
                getAsFile: () => createMockFile("test.png"),
              },
            ],
          },
        } as unknown as ClipboardEvent);
      });

      expect(preventDefault).toHaveBeenCalled();
    });

    it("单选模式只取第一个图片", () => {
      const { result } = renderHook(() =>
        useMediaUpload({ ...defaultOptions, multiple: false }),
      );

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: {
            items: [
              {
                type: "image/png",
                getAsFile: () => createMockFile("first.png"),
              },
              {
                type: "image/png",
                getAsFile: () => createMockFile("second.png"),
              },
            ],
          },
        } as unknown as ClipboardEvent);
      });

      expect(result.current.files).toHaveLength(1);
    });

    it("生成带时间戳的文件名", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));
      const mockFile = createMockFile("original.png");

      act(() => {
        result.current.handlePaste({
          preventDefault: vi.fn(),
          clipboardData: {
            items: [{ type: "image/png", getAsFile: () => mockFile }],
          },
        } as unknown as ClipboardEvent);
      });

      const fileName = result.current.files[0]!.file.name;
      expect(fileName).toMatch(/^粘贴的图片_.*\.png$/);
    });
  });

  describe("uploadSingleFile - server 策略", () => {
    it("完整上传流程：uploading -> processing -> success", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({
          success: true,
          data: {
            id: 1,
            originalName: "test.png",
            processedSize: 512,
          },
        }),
      );

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png", 1024, "image/png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      let uploadResult: { success: boolean; data?: any };
      await act(async () => {
        uploadResult = await result.current.uploadSingleFile(
          result.current.files[0]!,
        );
      });

      expect(uploadResult!.success).toBe(true);
      expect(uploadResult!.data!.id).toBe(1);
      expect(uploadResult!.data!.processedSize).toBe(512);
    });

    it("验证 init 请求参数", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({ success: true, data: { id: 1 } }),
      );

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("photo.jpg", 2048, "image/jpeg"),
            id: "test-1",
            status: "pending",
            originalSize: 2048,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      const initCall = mockFetch.mock.calls[0];
      expect(initCall![0]).toBe("/admin/media/upload");
      expect(initCall![1].method).toBe("POST");
      expect(initCall![1].credentials).toBe("include");
    });

    it("使用 customName 上传", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({ success: true, data: { id: 1 } }),
      );

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("original.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
            customName: "custom-name.png",
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("success");
    });

    describe("错误处理", () => {
      it("init 响应失败时设置错误状态", async () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));

        act(() => {
          result.current.setFiles([
            {
              file: createMockFile("test.png"),
              id: "test-1",
              status: "pending",
              originalSize: 1024,
            },
          ]);
        });

        mockFetch.mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              success: false,
              message: "初始化失败",
            }),
        });

        let uploadResult: { success: boolean };
        await act(async () => {
          uploadResult = await result.current.uploadSingleFile(
            result.current.files[0]!,
          );
        });

        expect(uploadResult!.success).toBe(false);
        expect(result.current.files[0]!.status).toBe("error");
        expect(result.current.files[0]!.error).toBe("初始化失败");
      });

      it("init 返回缺少 data 时设置错误状态", async () => {
        const { result } = renderHook(() => useMediaUpload(defaultOptions));

        act(() => {
          result.current.setFiles([
            {
              file: createMockFile("test.png"),
              id: "test-1",
              status: "pending",
              originalSize: 1024,
            },
          ]);
        });

        mockFetch.mockResolvedValueOnce({
          json: () => Promise.resolve({ success: true }),
        });

        await act(async () => {
          await result.current.uploadSingleFile(result.current.files[0]!);
        });

        expect(result.current.files[0]!.status).toBe("error");
      });

      it("网络错误时设置错误状态", async () => {
        global.XMLHttpRequest = createErrorXMLHttpRequest();

        const { result } = renderHook(() => useMediaUpload(defaultOptions));

        act(() => {
          result.current.setFiles([
            {
              file: createMockFile("test.png"),
              id: "test-1",
              status: "pending",
              originalSize: 1024,
            },
          ]);
        });

        mockFetch.mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              success: true,
              data: { uploadStrategy: "server", providerType: "LOCAL" },
            }),
        });

        await act(async () => {
          await result.current.uploadSingleFile(result.current.files[0]!);
        });

        expect(result.current.files[0]!.status).toBe("error");
      });
    });
  });

  describe("uploadSingleFile - client 策略 (AWS_S3)", () => {
    it("完整流程：init -> XHR PUT -> complete", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest();

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              uploadStrategy: "client",
              providerType: "AWS_S3",
              tempKey: "temp-key-123",
              uploadUrl: "https://s3.amazonaws.com/bucket/key",
              uploadHeaders: { "Content-Type": "image/png" },
            },
          }),
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 1,
              originalName: "test.png",
              processedSize: 1024,
            },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("success");
    });

    it("缺少 uploadUrl 时设置错误状态", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              uploadStrategy: "client",
              providerType: "AWS_S3",
              tempKey: "temp-key-123",
            },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("error");
    });
  });

  describe("uploadSingleFile - client 策略 (VERCEL_BLOB)", () => {
    it("完整流程：init -> putBlob -> complete", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              uploadStrategy: "client",
              providerType: "VERCEL_BLOB",
              tempKey: "temp-key-123",
              blobPathname: "uploads/test.png",
              blobClientToken: "blob-token",
            },
          }),
      });

      (putBlob as any).mockResolvedValueOnce({});

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 1,
              originalName: "test.png",
              processedSize: 1024,
            },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("success");
      expect(putBlob).toHaveBeenCalledWith(
        "uploads/test.png",
        expect.any(File),
        expect.objectContaining({
          access: "public",
          token: "blob-token",
          multipart: true,
        }),
      );
    });

    it("缺少 blobPathname 时设置错误状态", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              uploadStrategy: "client",
              providerType: "VERCEL_BLOB",
              tempKey: "temp-key-123",
            },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("error");
    });

    it("putBlob 抛出异常时设置错误状态", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              uploadStrategy: "client",
              providerType: "VERCEL_BLOB",
              tempKey: "temp-key-123",
              blobPathname: "uploads/test.png",
              blobClientToken: "blob-token",
            },
          }),
      });

      (putBlob as any).mockRejectedValueOnce(new Error("Blob upload failed"));

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("error");
    });
  });

  describe("uploadSingleFile - 不支持的存储类型", () => {
    it("设置错误状态", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              uploadStrategy: "client",
              providerType: "UNSUPPORTED",
              tempKey: "temp-key-123",
            },
          }),
      });

      await act(async () => {
        await result.current.uploadSingleFile(result.current.files[0]!);
      });

      expect(result.current.files[0]!.status).toBe("error");
    });
  });

  describe("uploadAll", () => {
    it("没有待上传文件时返回零计数", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      let uploadAllResult: any;
      await act(async () => {
        uploadAllResult = await result.current.uploadAll();
      });

      expect(uploadAllResult.successCount).toBe(0);
      expect(uploadAllResult.failCount).toBe(0);
      expect(uploadAllResult.successfulResults).toEqual([]);
    });

    it("设置 uploading 状态", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({ success: true, data: { id: 1 } }),
      );

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      await act(async () => {
        await result.current.uploadAll();
      });

      expect(result.current.uploading).toBe(false);
    });

    it("跳过非 pending 状态的文件", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({ success: true, data: { id: 1 } }),
      );

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("success.png"),
            id: "test-1",
            status: "success",
            originalSize: 1024,
          },
          {
            file: createMockFile("error.png"),
            id: "test-2",
            status: "error",
            originalSize: 1024,
          },
          {
            file: createMockFile("pending.png"),
            id: "test-3",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      let uploadAllResult: any;
      await act(async () => {
        uploadAllResult = await result.current.uploadAll();
      });

      expect(uploadAllResult.successCount).toBe(1);
    });

    it("正确统计成功和失败数量", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("good.png"),
            id: "test-1",
            status: "pending",
            originalSize: 1024,
          },
          {
            file: createMockFile("bad.png"),
            id: "test-2",
            status: "pending",
            originalSize: 1024,
          },
        ]);
      });

      // 第一个文件使用成功 XHR
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({
          success: true,
          data: { id: 1, processedSize: 512 },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      // 第二个文件失败（init 失败）
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            message: "init 失败",
          }),
      });

      let uploadAllResult: any;
      await act(async () => {
        uploadAllResult = await result.current.uploadAll();
      });

      expect(uploadAllResult.successCount).toBe(1);
      expect(uploadAllResult.failCount).toBe(1);
      expect(uploadAllResult.successfulResults).toHaveLength(1);
    });
  });

  describe("retryFile", () => {
    it("重新上传失败的文件", async () => {
      global.XMLHttpRequest = createSuccessXMLHttpRequest(
        JSON.stringify({ success: true, data: { id: 1 } }),
      );

      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.setFiles([
          {
            file: createMockFile("test.png"),
            id: "test-1",
            status: "error",
            originalSize: 1024,
            error: "之前的错误",
          },
        ]);
      });

      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { uploadStrategy: "server", providerType: "LOCAL" },
          }),
      });

      let retryResult: any;
      await act(async () => {
        retryResult = await result.current.retryFile("test-1");
      });

      expect(retryResult.success).toBe(true);
    });

    it("不存在的文件返回失败", async () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      let retryResult: any;
      await act(async () => {
        retryResult = await result.current.retryFile("nonexistent");
      });

      expect(retryResult.success).toBe(false);
    });
  });

  describe("removeFile", () => {
    it("移除文件并清理预览 URL", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("test.png")]),
        );
      });

      const fileId = result.current.files[0]!.id;
      act(() => {
        result.current.removeFile(fileId);
      });

      expect(result.current.files).toHaveLength(0);
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("不影响其他文件", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("a.png"), createMockFile("b.png")]),
        );
      });

      act(() => {
        result.current.removeFile(result.current.files[0]!.id);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]!.file.name).toBe("b.png");
    });
  });

  describe("updateFileName", () => {
    it("设置自定义文件名", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("original.png")]),
        );
      });

      act(() => {
        result.current.updateFileName(
          result.current.files[0]!.id,
          "custom.png",
        );
      });

      expect(result.current.files[0]!.customName).toBe("custom.png");
    });

    it("不影响其他文件", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("a.png"), createMockFile("b.png")]),
        );
      });

      act(() => {
        result.current.updateFileName(
          result.current.files[0]!.id,
          "renamed.png",
        );
      });

      expect(result.current.files[0]!.customName).toBe("renamed.png");
      expect(result.current.files[1]!.customName).toBeUndefined();
    });
  });

  describe("getDisplayFileName", () => {
    it("有自定义名称时返回自定义名称", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("original.png")]),
        );
      });

      act(() => {
        result.current.updateFileName(
          result.current.files[0]!.id,
          "custom.png",
        );
      });

      expect(result.current.getDisplayFileName(result.current.files[0]!)).toBe(
        "custom.png",
      );
    });

    it("无自定义名称时返回原始文件名", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("original.png")]),
        );
      });

      expect(result.current.getDisplayFileName(result.current.files[0]!)).toBe(
        "original.png",
      );
    });
  });

  describe("handleImageError", () => {
    it("标记图片加载错误", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("broken.png")]),
        );
      });

      act(() => {
        result.current.handleImageError(result.current.files[0]!.id);
      });

      expect(result.current.files[0]!.imageLoadError).toBe(true);
    });
  });

  describe("clearFiles", () => {
    it("清除所有文件并清理预览 URL", () => {
      const { result } = renderHook(() => useMediaUpload(defaultOptions));

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("a.png"), createMockFile("b.png")]),
        );
      });

      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.files).toEqual([]);
      expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe("组件卸载清理", () => {
    it("卸载时清理所有预览 URL", () => {
      const { result, unmount } = renderHook(() =>
        useMediaUpload(defaultOptions),
      );

      act(() => {
        result.current.handleFileSelect(
          createFileList([createMockFile("test.png")]),
        );
      });

      unmount();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});
