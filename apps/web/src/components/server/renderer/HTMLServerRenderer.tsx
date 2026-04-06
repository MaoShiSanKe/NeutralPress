import "server-only";

import { ensureHtmlHeadingIds } from "@/lib/server/rich-text-outline";

interface HTMLServerRendererProps {
  source: string;
  className?: string;
}

/**
 * 服务端 HTML 渲染器
 * - 与 Markdown/MDX 保持一致的内容容器样式
 */
export default function HTMLServerRenderer({
  source,
  className = "max-w-4xl mx-auto md-content",
}: HTMLServerRendererProps) {
  const processedSource = ensureHtmlHeadingIds(source);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: processedSource }}
    />
  );
}
