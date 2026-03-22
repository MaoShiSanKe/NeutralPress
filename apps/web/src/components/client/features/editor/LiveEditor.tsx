"use client";

import { useDeferredValue, useEffect, useRef } from "react";
import type { editor } from "monaco-editor";

import { LivePreview } from "@/components/client/features/editor/LivePreview";
import { MonacoEditor } from "@/components/client/features/editor/MonacoEditor";
import { useMobile } from "@/hooks/use-mobile";
import { Drawer } from "@/ui/Drawer";

export interface LiveEditorProps {
  content: string;
  onChange: (content: string) => void;
  mode: "markdown" | "mdx" | "html";
  className?: string;
  onEditorReady?: (editor: editor.IStandaloneCodeEditor) => void;
  mobilePreviewOpen?: boolean;
  onMobilePreviewOpenChange?: (open: boolean) => void;
}

export function LiveEditor({
  content,
  onChange,
  mode,
  className = "",
  onEditorReady,
  mobilePreviewOpen = false,
  onMobilePreviewOpenChange,
}: LiveEditorProps) {
  const isMobile = useMobile();
  const monacoContainerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const deferredPreviewContent = useDeferredValue(content);
  const useDrawerPreview = isMobile && (mode === "markdown" || mode === "mdx");

  const handleEditorReady = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    onEditorReady?.(editor);
  };

  // Monaco 滚动时同步预览区域
  useEffect(() => {
    const editor = editorRef.current;
    const previewContainer = previewContainerRef.current?.querySelector(
      ".md-content",
    ) as HTMLDivElement;

    if (!editor || !previewContainer) return;

    const handleMonacoScroll = () => {
      const scrollTop = editor.getScrollTop();
      const scrollHeight = editor.getScrollHeight();
      const visibleHeight = editor.getLayoutInfo().height;

      // 计算滚动百分比
      const maxEditorScrollable = Math.max(scrollHeight - visibleHeight, 1);
      const scrollPercentage = scrollTop / maxEditorScrollable;

      // 同步预览区域滚动
      const previewScrollHeight =
        previewContainer.scrollHeight - previewContainer.clientHeight;
      previewContainer.scrollTop = previewScrollHeight * scrollPercentage;
    };

    // 监听 Monaco 滚动事件
    const disposable = editor.onDidScrollChange(handleMonacoScroll);

    return () => {
      disposable.dispose();
    };
  }, [mode, useDrawerPreview]);

  if (useDrawerPreview) {
    return (
      <>
        <div className={`h-full w-full ${className}`}>
          <div
            ref={monacoContainerRef}
            className="h-full w-full"
            onClick={() => {
              editorRef.current?.focus();
            }}
          >
            <MonacoEditor
              value={content}
              onChange={onChange}
              language={mode}
              onEditorReady={handleEditorReady}
              className="h-full"
            />
          </div>
        </div>

        <Drawer
          open={mobilePreviewOpen}
          onClose={() => onMobilePreviewOpenChange?.(false)}
          initialSize={0.72}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-medium tracking-[0.18em] text-foreground/50">
                预览
              </div>
            </div>
            <div
              ref={previewContainerRef}
              className="min-h-0 flex-1 overflow-hidden rounded-xl border border-foreground/10 bg-background"
            >
              <LivePreview
                content={deferredPreviewContent}
                mode={mode}
                className="h-full"
              />
            </div>
          </div>
        </Drawer>
      </>
    );
  }

  return (
    <div className={`flex h-full w-full ${className}`}>
      {/* 左侧: Monaco 编辑器 */}
      <div
        ref={monacoContainerRef}
        className="h-full w-1/2 border-r border-foreground/10"
        onClick={() => {
          // 点击时确保编辑器获得焦点
          editorRef.current?.focus();
        }}
      >
        <MonacoEditor
          value={content}
          onChange={onChange}
          language={mode}
          onEditorReady={handleEditorReady}
          className="h-full"
        />
      </div>

      {/* 右侧: 实时预览 */}
      <div ref={previewContainerRef} className="h-full w-1/2">
        <LivePreview content={deferredPreviewContent} mode={mode} />
      </div>
    </div>
  );
}
