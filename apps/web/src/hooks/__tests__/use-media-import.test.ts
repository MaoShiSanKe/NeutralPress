import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaImport } from "@/hooks/use-media-import";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("useMediaImport", () => {
  const defaultOptions = {
    importMode: "transfer" as const,
    processMode: "lossy" as const,
    storageId: "storage-1",
    folderId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始化时返回空 items 和默认状态", () => {
    const { result } = renderHook(() => useMediaImport(defaultOptions));

    expect(result.current.items).toEqual([]);
    expect(result.current.importing).toBe(false);
    expect(result.current.urlInput).toBe("");
  });

  it("setUrlInput 更新 urlInput", () => {
    const { result } = renderHook(() => useMediaImport(defaultOptions));

    act(() => {
      result.current.setUrlInput("https://example.com/image.png");
    });

    expect(result.current.urlInput).toBe("https://example.com/image.png");
  });

  describe("parseUrls", () => {
    it("解析单个有效 URL", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });

      let parseResult: boolean | undefined;
      act(() => {
        parseResult = result.current.parseUrls();
      });

      expect(parseResult).toBe(true);
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.url).toBe(
        "https://example.com/image.png",
      );
      expect(result.current.items[0]!.fileName).toBe("image.png");
      expect(result.current.items[0]!.status).toBe("pending");
      // parseUrls should clear the input
      expect(result.current.urlInput).toBe("");
    });

    it("解析多个 URL（换行分隔）", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput(
          "https://example.com/a.png\nhttps://example.com/b.jpg",
        );
      });

      let parseResult: boolean | undefined;
      act(() => {
        parseResult = result.current.parseUrls();
      });

      expect(parseResult).toBe(true);
      expect(result.current.items).toHaveLength(2);
    });

    it("跳过无效 URL", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("not-a-url\nhttps://example.com/valid.png");
      });

      let parseResult: boolean | undefined;
      act(() => {
        parseResult = result.current.parseUrls();
      });

      expect(parseResult).toBe(true);
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.url).toBe(
        "https://example.com/valid.png",
      );
    });

    it("去重：重复 URL 不会添加", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });

      act(() => {
        result.current.parseUrls();
      });

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });

      let parseResult: boolean | undefined;
      act(() => {
        parseResult = result.current.parseUrls();
      });

      expect(parseResult).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });

    it("空输入返回 false", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("");
      });

      let parseResult: boolean | undefined;
      act(() => {
        parseResult = result.current.parseUrls();
      });

      expect(parseResult).toBe(false);
      expect(result.current.items).toHaveLength(0);
    });

    it("全部无效 URL 返回 false", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("not-a-url\nalso-not-url");
      });

      let parseResult: boolean | undefined;
      act(() => {
        parseResult = result.current.parseUrls();
      });

      expect(parseResult).toBe(false);
    });

    it("空行被跳过", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput(
          "https://example.com/a.png\n\n\nhttps://example.com/b.png",
        );
      });

      act(() => {
        result.current.parseUrls();
      });

      expect(result.current.items).toHaveLength(2);
    });
  });

  describe("URL 文件名提取", () => {
    it("从 URL 路径提取文件名", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://cdn.example.com/assets/photo.jpg");
      });

      act(() => {
        result.current.parseUrls();
      });

      expect(result.current.items[0]!.fileName).toBe("photo.jpg");
    });

    it("处理 URL 编码的文件名", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput(
          "https://example.com/%E5%9B%BE%E7%89%87.png",
        );
      });

      act(() => {
        result.current.parseUrls();
      });

      expect(result.current.items[0]!.fileName).toBe("图片.png");
    });

    it("URL 无文件名时使用默认名", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/");
      });

      act(() => {
        result.current.parseUrls();
      });

      expect(result.current.items[0]!.fileName).toBe("未命名文件");
    });
  });

  describe("handleInputKeyDown", () => {
    it("Enter 键触发解析", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });

      act(() => {
        result.current.handleInputKeyDown({
          key: "Enter",
          shiftKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLInputElement>);
      });

      expect(result.current.items).toHaveLength(1);
    });

    it("Shift+Enter 不触发解析", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });

      act(() => {
        result.current.handleInputKeyDown({
          key: "Enter",
          shiftKey: true,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLInputElement>);
      });

      expect(result.current.items).toHaveLength(0);
    });

    it("其他键不触发解析", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });

      act(() => {
        result.current.handleInputKeyDown({
          key: "a",
          shiftKey: false,
          preventDefault: vi.fn(),
        } as unknown as React.KeyboardEvent<HTMLInputElement>);
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe("handleInputPaste", () => {
    it("粘贴文本自动解析 URL", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.handleInputPaste({
          preventDefault: vi.fn(),
          clipboardData: {
            getData: () => "https://example.com/pasted.png",
          },
        } as unknown as React.ClipboardEvent<HTMLInputElement>);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.url).toBe(
        "https://example.com/pasted.png",
      );
    });

    it("粘贴多个 URL", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.handleInputPaste({
          preventDefault: vi.fn(),
          clipboardData: {
            getData: () =>
              "https://example.com/a.png\nhttps://example.com/b.png",
          },
        } as unknown as React.ClipboardEvent<HTMLInputElement>);
      });

      expect(result.current.items).toHaveLength(2);
    });

    it("粘贴空文本不添加项", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.handleInputPaste({
          preventDefault: vi.fn(),
          clipboardData: {
            getData: () => "",
          },
        } as unknown as React.ClipboardEvent<HTMLInputElement>);
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe("removeItem", () => {
    it("移除指定项", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/a.png");
      });
      act(() => {
        result.current.parseUrls();
      });

      const itemId = result.current.items[0]!.id;

      act(() => {
        result.current.removeItem(itemId);
      });

      expect(result.current.items).toHaveLength(0);
    });

    it("只移除匹配的项", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput(
          "https://example.com/a.png\nhttps://example.com/b.png",
        );
      });
      act(() => {
        result.current.parseUrls();
      });

      const itemId = result.current.items[0]!.id;

      act(() => {
        result.current.removeItem(itemId);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.url).toBe("https://example.com/b.png");
    });
  });

  describe("updateItemFileName", () => {
    it("更新项的自定义文件名", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });
      act(() => {
        result.current.parseUrls();
      });

      const itemId = result.current.items[0]!.id;

      act(() => {
        result.current.updateItemFileName(itemId, "custom-name.png");
      });

      expect(result.current.items[0]!.customFileName).toBe("custom-name.png");
    });
  });

  describe("getDisplayFileName", () => {
    it("默认返回原始文件名", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });
      act(() => {
        result.current.parseUrls();
      });

      const displayName = result.current.getDisplayFileName(
        result.current.items[0]!,
      );
      expect(displayName).toBe("image.png");
    });

    it("有自定义文件名时返回自定义文件名", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/image.png");
      });
      act(() => {
        result.current.parseUrls();
      });

      const itemId = result.current.items[0]!.id;
      act(() => {
        result.current.updateItemFileName(itemId, "renamed.png");
      });

      const displayName = result.current.getDisplayFileName(
        result.current.items[0]!,
      );
      expect(displayName).toBe("renamed.png");
    });
  });

  describe("handleImageError", () => {
    it("标记图片加载错误", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/broken.png");
      });
      act(() => {
        result.current.parseUrls();
      });

      const itemId = result.current.items[0]!.id;

      act(() => {
        result.current.handleImageError(itemId);
      });

      expect(result.current.items[0]!.imageLoadError).toBe(true);
    });
  });

  describe("clearItems", () => {
    it("清除所有项和输入", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setUrlInput("https://example.com/a.png");
      });
      act(() => {
        result.current.parseUrls();
      });

      act(() => {
        result.current.setUrlInput("some input");
      });

      act(() => {
        result.current.clearItems();
      });

      expect(result.current.items).toEqual([]);
      expect(result.current.urlInput).toBe("");
    });
  });

  describe("setItems", () => {
    it("可以直接设置 items", () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/test.png",
            fileName: "test.png",
            status: "pending",
          },
        ]);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]!.url).toBe("https://example.com/test.png");
    });
  });

  describe("importSingleItem", () => {
    it("成功导入单个项", async () => {
      const mockResult = {
        success: true,
        data: {
          id: 1,
          url: "https://storage.example.com/image.png",
          originalName: "image.png",
          shortHash: "abc123",
          imageId: "img-1",
          originalSize: 1024,
          processedSize: 512,
          isDuplicate: false,
          width: 100,
          height: 100,
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockResult),
      });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/image.png",
            fileName: "image.png",
            status: "pending",
          },
        ]);
      });

      let importResult: { success: boolean; data?: unknown };
      await act(async () => {
        importResult = await result.current.importSingleItem(
          result.current.items[0]!,
        );
      });

      expect(importResult!.success).toBe(true);
      expect(result.current.items[0]!.status).toBe("success");
      expect(result.current.items[0]!.result).toEqual(mockResult.data);
    });

    it("导入失败设置错误状态", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: false, message: "文件不存在" }),
      });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/missing.png",
            fileName: "missing.png",
            status: "pending",
          },
        ]);
      });

      let importResult: { success: boolean; data?: unknown };
      await act(async () => {
        importResult = await result.current.importSingleItem(
          result.current.items[0]!,
        );
      });

      expect(importResult!.success).toBe(false);
      expect(result.current.items[0]!.status).toBe("error");
      expect(result.current.items[0]!.error).toBe("文件不存在");
    });

    it("网络错误时设置错误状态", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/image.png",
            fileName: "image.png",
            status: "pending",
          },
        ]);
      });

      let importResult: { success: boolean; data?: unknown };
      await act(async () => {
        importResult = await result.current.importSingleItem(
          result.current.items[0]!,
        );
      });

      expect(importResult!.success).toBe(false);
      expect(result.current.items[0]!.status).toBe("error");
    });

    it("record 模式使用 original 处理模式", async () => {
      const recordOptions = {
        ...defaultOptions,
        importMode: "record" as const,
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      const { result } = renderHook(() => useMediaImport(recordOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/image.png",
            fileName: "image.png",
            status: "pending",
          },
        ]);
      });

      await act(async () => {
        await result.current.importSingleItem(result.current.items[0]!);
      });

      // Verify fetch was called with the right formData
      const [, fetchOptions] = mockFetch.mock.calls[0]!;
      const formData = fetchOptions.body as FormData;
      expect(formData.get("mode")).toBe("original");
    });

    it("传递自定义文件名", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/image.png",
            fileName: "image.png",
            status: "pending",
            customFileName: "custom.png",
          },
        ]);
      });

      await act(async () => {
        await result.current.importSingleItem(result.current.items[0]!);
      });

      const [, fetchOptions] = mockFetch.mock.calls[0]!;
      const formData = fetchOptions.body as FormData;
      expect(formData.get("displayName")).toBe("custom.png");
    });

    it("传递 folderId", async () => {
      const optionsWithFolder = { ...defaultOptions, folderId: 42 };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      const { result } = renderHook(() => useMediaImport(optionsWithFolder));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/image.png",
            fileName: "image.png",
            status: "pending",
          },
        ]);
      });

      await act(async () => {
        await result.current.importSingleItem(result.current.items[0]!);
      });

      const [, fetchOptions] = mockFetch.mock.calls[0]!;
      const formData = fetchOptions.body as FormData;
      expect(formData.get("folderId")).toBe("42");
    });
  });

  describe("retryItem", () => {
    it("重试指定项", async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, message: "临时失败" }),
        })
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({ success: true, data: { id: 1, url: "ok" } }),
        });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/image.png",
            fileName: "image.png",
            status: "pending",
          },
        ]);
      });

      // First import fails
      await act(async () => {
        await result.current.importSingleItem(result.current.items[0]!);
      });
      expect(result.current.items[0]!.status).toBe("error");

      // Retry
      let retryResult: { success: boolean; data?: unknown };
      await act(async () => {
        retryResult = await result.current.retryItem("test-1");
      });

      expect(retryResult!.success).toBe(true);
      expect(result.current.items[0]!.status).toBe("success");
    });

    it("重试不存在的项返回失败", async () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      let retryResult: { success: boolean; data?: unknown };
      await act(async () => {
        retryResult = await result.current.retryItem("nonexistent");
      });

      expect(retryResult!.success).toBe(false);
    });
  });

  describe("importAll", () => {
    it("没有待导入项时返回零计数", async () => {
      const { result } = renderHook(() => useMediaImport(defaultOptions));

      let importAllResult: {
        successCount: number;
        failCount: number;
        successfulResults: unknown[];
      };
      await act(async () => {
        importAllResult = await result.current.importAll();
      });

      expect(importAllResult!.successCount).toBe(0);
      expect(importAllResult!.failCount).toBe(0);
      expect(importAllResult!.successfulResults).toEqual([]);
    });

    it("批量导入所有待导入项", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({ success: true, data: { id: 1, url: "ok" } }),
      });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/a.png",
            fileName: "a.png",
            status: "pending",
          },
          {
            id: "test-2",
            url: "https://example.com/b.png",
            fileName: "b.png",
            status: "pending",
          },
        ]);
      });

      let importAllResult: {
        successCount: number;
        failCount: number;
        successfulResults: unknown[];
      };
      await act(async () => {
        importAllResult = await result.current.importAll();
      });

      expect(importAllResult!.successCount).toBe(2);
      expect(importAllResult!.failCount).toBe(0);
    });

    it("部分导入失败时正确计数", async () => {
      mockFetch
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({ success: true, data: { id: 1, url: "ok" } }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ success: false, message: "失败" }),
        });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/a.png",
            fileName: "a.png",
            status: "pending",
          },
          {
            id: "test-2",
            url: "https://example.com/b.png",
            fileName: "b.png",
            status: "pending",
          },
        ]);
      });

      let importAllResult: {
        successCount: number;
        failCount: number;
        successfulResults: unknown[];
      };
      await act(async () => {
        importAllResult = await result.current.importAll();
      });

      expect(importAllResult!.successCount).toBe(1);
      expect(importAllResult!.failCount).toBe(1);
    });

    it("只导入 pending 状态的项", async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({ success: true, data: { id: 1, url: "ok" } }),
      });

      const { result } = renderHook(() => useMediaImport(defaultOptions));

      act(() => {
        result.current.setItems([
          {
            id: "test-1",
            url: "https://example.com/a.png",
            fileName: "a.png",
            status: "success",
          },
          {
            id: "test-2",
            url: "https://example.com/b.png",
            fileName: "b.png",
            status: "pending",
          },
          {
            id: "test-3",
            url: "https://example.com/c.png",
            fileName: "c.png",
            status: "error",
          },
        ]);
      });

      let importAllResult: {
        successCount: number;
        failCount: number;
        successfulResults: unknown[];
      };
      await act(async () => {
        importAllResult = await result.current.importAll();
      });

      expect(importAllResult!.successCount).toBe(1);
      expect(importAllResult!.failCount).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
