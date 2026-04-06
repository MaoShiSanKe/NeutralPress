export type RichTextSourceMode = "markdown" | "mdx" | "html";

const ATX_HEADING_REGEX = /^\s{0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/;
const SETEXT_HEADING_REGEX = /^\s{0,3}(=+|-+)\s*$/;

function isFenceBoundary(line: string): boolean {
  const trimmed = line.trimStart();
  return /^(```|~~~)/.test(trimmed);
}

function getAtxHeading(line: string): { depth: number } | null {
  const match = line.match(ATX_HEADING_REGEX);
  if (!match?.[1]) {
    return null;
  }

  return {
    depth: match[1].length,
  };
}

function getSetextHeading(
  currentLine: string,
  nextLine: string | undefined,
): { depth: number } | null {
  if (!currentLine.trim() || !nextLine) {
    return null;
  }

  const markerMatch = nextLine.match(SETEXT_HEADING_REGEX);
  if (!markerMatch?.[1]) {
    return null;
  }

  return {
    depth: markerMatch[1].startsWith("=") ? 1 : 2,
  };
}

export function stripLeadingMarkdownH1(source: string): string {
  const lines = source.split(/\r?\n/);
  let isInFenceBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || "";

    if (isFenceBoundary(line)) {
      isInFenceBlock = !isInFenceBlock;
      continue;
    }

    if (isInFenceBlock) {
      continue;
    }

    const atxHeading = getAtxHeading(line);
    if (atxHeading?.depth === 1) {
      lines.splice(index, 1);
      return lines.join("\n");
    }

    const setextHeading = getSetextHeading(line, lines[index + 1]);
    if (setextHeading?.depth === 1) {
      lines.splice(index, 2);
      return lines.join("\n");
    }
  }

  return source;
}

export function prepareRichTextSource(
  source: string,
  mode: RichTextSourceMode,
  options?: { skipFirstH1?: boolean },
): string {
  if (options?.skipFirstH1 && mode !== "html") {
    return stripLeadingMarkdownH1(source);
  }

  return source;
}
