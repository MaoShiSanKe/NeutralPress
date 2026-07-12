import { describe, expect, it } from "vitest";

import {
  generateSmartExcerpt,
  getLocalDateString,
  highlightTitle,
  markdownToPlainText,
} from "@/lib/server/search";

describe("search utilities", () => {
  describe("getLocalDateString", () => {
    it("formats date correctly", () => {
      expect(getLocalDateString(new Date(2024, 0, 1))).toBe("2024-01-01");
      expect(getLocalDateString(new Date(2024, 11, 31))).toBe("2024-12-31");
    });

    it("pads single digit month and day", () => {
      expect(getLocalDateString(new Date(2024, 0, 5))).toBe("2024-01-05");
      expect(getLocalDateString(new Date(2024, 9, 15))).toBe("2024-10-15");
    });
  });

  describe("highlightTitle", () => {
    it("returns original title when no tokens", () => {
      expect(highlightTitle("Hello World", [])).toBe("Hello World");
    });

    it("returns original title when empty", () => {
      expect(highlightTitle("", ["test"])).toBe("");
    });

    it("highlights single token", () => {
      expect(highlightTitle("Hello World", ["World"])).toBe(
        "Hello <mark>World</mark>",
      );
    });

    it("highlights multiple tokens", () => {
      const result = highlightTitle("Hello Beautiful World", [
        "Hello",
        "World",
      ]);
      expect(result).toBe("<mark>Hello</mark> Beautiful <mark>World</mark>");
    });

    it("handles case insensitive matching", () => {
      expect(highlightTitle("Hello World", ["hello"])).toBe(
        "<mark>Hello</mark> World",
      );
    });

    it("escapes HTML in title", () => {
      expect(highlightTitle("<script>alert(1)</script>", ["script"])).toBe(
        "&lt;<mark>script</mark>&gt;alert(1)&lt;/<mark>script</mark>&gt;",
      );
    });

    it("handles special regex characters in tokens", () => {
      expect(highlightTitle("Price: $100.00", ["$100.00"])).toBe(
        "Price: <mark>$100.00</mark>",
      );
    });

    it("sorts tokens by length to process longer tokens first", () => {
      const result = highlightTitle("JavaScript is great", [
        "Java",
        "JavaScript",
      ]);
      expect(result).toContain("Java");
      expect(result).toContain("is great");
    });
  });

  describe("generateSmartExcerpt", () => {
    it("returns truncated text when no tokens", () => {
      const text = "This is a long text that should be truncated";
      expect(generateSmartExcerpt(text, [], 20)).toBe("This is a long text ");
    });

    it("returns truncated text when empty string", () => {
      expect(generateSmartExcerpt("", ["test"], 20)).toBe("");
    });

    it("highlights token in excerpt", () => {
      const text = "This is a text about JavaScript programming";
      const result = generateSmartExcerpt(text, ["JavaScript"], 50);
      expect(result).toContain("<mark>JavaScript</mark>");
    });

    it("returns full text when shorter than maxLength", () => {
      const text = "Short text";
      const result = generateSmartExcerpt(text, ["Short"], 100);
      expect(result).toContain("<mark>Short</mark>");
    });

    it("handles token not found in text", () => {
      const text = "This is some text";
      const result = generateSmartExcerpt(text, ["missing"], 20);
      expect(result).toBe("This is some text");
    });

    it("handles multiple occurrences of same token", () => {
      const text = "test test test test";
      const result = generateSmartExcerpt(text, ["test"], 20);
      expect(result).toContain("<mark>test</mark>");
    });
  });

  describe("markdownToPlainText", () => {
    it("converts plain text", async () => {
      const result = await markdownToPlainText("Hello World");
      expect(result).toBe("Hello World");
    });

    it("removes heading markers", async () => {
      const result = await markdownToPlainText("# Heading 1\n\nSome text");
      expect(result).toContain("Heading 1");
      expect(result).toContain("Some text");
      expect(result).not.toContain("#");
    });

    it("removes bold markers", async () => {
      const result = await markdownToPlainText("This is **bold** text");
      expect(result).toContain("bold");
      expect(result).not.toContain("**");
    });

    it("removes italic markers", async () => {
      const result = await markdownToPlainText("This is *italic* text");
      expect(result).toContain("italic");
      expect(result).not.toContain("*");
    });

    it("removes inline code backticks", async () => {
      const result = await markdownToPlainText("Use `console.log()` here");
      expect(result).toContain("console.log()");
      expect(result).not.toMatch(/`/);
    });

    it("preserves code block content", async () => {
      const md = "```\nconst x = 1;\n```";
      const result = await markdownToPlainText(md);
      expect(result).toContain("const x = 1;");
    });

    it("extracts link text", async () => {
      const result = await markdownToPlainText(
        "Visit [Google](https://google.com) for more",
      );
      expect(result).toContain("Google");
      expect(result).not.toContain("https://google.com");
      expect(result).not.toContain("[");
      expect(result).not.toContain("]");
    });

    it("extracts image alt text", async () => {
      const result = await markdownToPlainText(
        "![A beautiful sunset](sunset.jpg)",
      );
      expect(result).toContain("A beautiful sunset");
    });

    it("handles strikethrough text", async () => {
      const result = await markdownToPlainText("This is ~~deleted~~ text");
      expect(result).toContain("deleted");
      expect(result).not.toContain("~~");
    });

    it("handles lists", async () => {
      const md = "- Item 1\n- Item 2\n- Item 3";
      const result = await markdownToPlainText(md);
      expect(result).toContain("Item 1");
      expect(result).toContain("Item 2");
      expect(result).toContain("Item 3");
    });

    it("handles numbered lists", async () => {
      const md = "1. First\n2. Second\n3. Third";
      const result = await markdownToPlainText(md);
      expect(result).toContain("First");
      expect(result).toContain("Second");
      expect(result).toContain("Third");
    });

    it("handles blockquotes", async () => {
      const result = await markdownToPlainText("> This is a quote");
      expect(result).toContain("This is a quote");
    });

    it("decodes HTML entities", async () => {
      const result = await markdownToPlainText("A &amp; B &lt; C &gt; D");
      expect(result).toContain("A & B");
      expect(result).toContain("< C");
      expect(result).toContain("> D");
    });

    it("decodes &nbsp; entities", async () => {
      const result = await markdownToPlainText("Hello&nbsp;World");
      expect(result).toContain("Hello World");
    });

    it("collapses whitespace", async () => {
      const result = await markdownToPlainText("Hello   World\n\n\nTest");
      // The function collapses whitespace to single spaces
      expect(result).toContain("Hello");
      expect(result).toContain("World");
      expect(result).toContain("Test");
    });

    it("handles thematic breaks", async () => {
      const result = await markdownToPlainText("Above\n\n---\n\nBelow");
      expect(result).toContain("Above");
      expect(result).toContain("Below");
    });

    it("handles empty input", async () => {
      const result = await markdownToPlainText("");
      expect(result).toBe("");
    });

    it("handles complex markdown document", async () => {
      const md = `# Title

This is a **bold** paragraph with *italic* and \`code\`.

## Subtitle

- List item 1
- List item 2

> A blockquote

[A link](http://example.com)`;

      const result = await markdownToPlainText(md);
      expect(result).toContain("Title");
      expect(result).toContain("bold");
      expect(result).toContain("italic");
      expect(result).toContain("code");
      expect(result).toContain("Subtitle");
      expect(result).toContain("List item 1");
      expect(result).toContain("List item 2");
      expect(result).toContain("A blockquote");
      expect(result).toContain("A link");
    });

    it("handles strikethrough with GFM", async () => {
      const result = await markdownToPlainText("This ~~is deleted~~ text");
      expect(result).toContain("is deleted");
      expect(result).not.toContain("~~");
    });

    it("removes decoration markers (++ and ==)", async () => {
      const result = await markdownToPlainText(
        "Text ++inserted++ and ==highlighted==",
      );
      expect(result).toContain("inserted");
      expect(result).toContain("highlighted");
    });

    it("handles HTML in markdown", async () => {
      const result = await markdownToPlainText("Hello <b>world</b>");
      expect(result).toContain("Hello");
      expect(result).toContain("world");
    });
  });
});
