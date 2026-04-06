import React from "react";

import MDXClientRenderer from "@/components/client/renderer/MDXClientRenderer";
import HTMLServerRenderer from "@/components/server/renderer/HTMLServerRenderer";
import MarkdownServerRenderer from "@/components/server/renderer/MarkdownServerRenderer";
import type { MediaFileInfo } from "@/lib/shared/image-utils";
import type { ShikiTheme } from "@/lib/shared/mdx-config-shared";
import { prepareRichTextSource } from "@/lib/shared/rich-text-source";

interface UniversalRendererProps {
  source: string;
  mode: "markdown" | "mdx" | "html";
  mediaFileMap?: Map<string, MediaFileInfo>;
  /** 是否跳过渲染第一个 h1 标题（用于文章页面，因为封面已经显示了标题） */
  skipFirstH1?: boolean;
  /** Shiki 主题配置 */
  shikiTheme?: ShikiTheme;
}

/**
 * MDX/Markdown 统一渲染器
 */
export default async function UniversalRenderer({
  source,
  mode,
  mediaFileMap,
  skipFirstH1 = false,
  shikiTheme,
}: UniversalRendererProps) {
  // 如果需要跳过第一个 h1，在渲染前处理内容
  const processedSource = prepareRichTextSource(source, mode, { skipFirstH1 });

  if (mode === "mdx") {
    // MDX 模式：使用客户端渲染器（支持交互式组件）
    return <MDXClientRenderer source={processedSource} />;
  }

  if (mode === "html") {
    return <HTMLServerRenderer source={processedSource} />;
  }

  // Markdown 模式：使用服务端渲染器（SSR + Shiki 代码高亮）
  return (
    <MarkdownServerRenderer
      source={processedSource}
      mediaFileMap={mediaFileMap}
      shikiTheme={shikiTheme}
    />
  );
}
