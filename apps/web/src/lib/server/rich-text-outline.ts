import "server-only";

import type { PostTocItem } from "@repo/shared-types/api/post";

import { createHeadingProcessor } from "@/lib/shared/heading-utils";
import {
  prepareRichTextSource,
  type RichTextSourceMode,
} from "@/lib/shared/rich-text-source";

interface BuildTocFromSourceOptions {
  source: string;
  mode: RichTextSourceMode;
  skipFirstH1?: boolean;
}

const ATX_HEADING_REGEX = /^\s{0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/;
const SETEXT_HEADING_REGEX = /^\s{0,3}(=+|-+)\s*$/;

function normalizeHeadingText(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFenceBoundary(line: string): boolean {
  const trimmed = line.trimStart();
  return /^(```|~~~)/.test(trimmed);
}

function getAtxHeading(line: string): { depth: number; text: string } | null {
  const match = line.match(ATX_HEADING_REGEX);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const text = normalizeHeadingText(match[2]);
  if (!text) {
    return null;
  }

  return {
    depth: match[1].length,
    text,
  };
}

function getSetextHeading(
  currentLine: string,
  nextLine: string | undefined,
): { depth: number; text: string } | null {
  if (!nextLine) {
    return null;
  }

  const markerMatch = nextLine.match(SETEXT_HEADING_REGEX);
  if (!markerMatch?.[1]) {
    return null;
  }

  const text = normalizeHeadingText(currentLine);
  if (!text) {
    return null;
  }

  return {
    depth: markerMatch[1].startsWith("=") ? 1 : 2,
    text,
  };
}

function normalizeTocLevel(level: number): number {
  const adjustedLevel = level === 1 ? 2 : level;
  return Math.max(1, adjustedLevel - 1);
}

function buildMarkdownLikeToc(source: string): PostTocItem[] {
  const processor = createHeadingProcessor();
  const items: PostTocItem[] = [];
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
    if (atxHeading) {
      items.push({
        id: processor.generateSlug(atxHeading.text),
        text: atxHeading.text,
        level: normalizeTocLevel(atxHeading.depth),
      });
      continue;
    }

    const setextHeading = getSetextHeading(line, lines[index + 1]);
    if (setextHeading) {
      items.push({
        id: processor.generateSlug(setextHeading.text),
        text: setextHeading.text,
        level: normalizeTocLevel(setextHeading.depth),
      });
      index += 1;
    }
  }

  return items;
}

export function buildTocFromSource({
  source,
  mode,
  skipFirstH1 = false,
}: BuildTocFromSourceOptions): PostTocItem[] {
  const preparedSource = prepareRichTextSource(source, mode, { skipFirstH1 });

  if (mode === "html") {
    const processor = createHeadingProcessor();
    return processor.extractTocItems(preparedSource);
  }

  return buildMarkdownLikeToc(preparedSource);
}

export function ensureHtmlHeadingIds(source: string): string {
  const processor = createHeadingProcessor();
  return processor.processHtmlHeadings(source);
}
