import { describe, expect, it } from "vitest";

import {
  buildTocFromSource,
  ensureHtmlHeadingIds,
} from "@/lib/server/rich-text-outline";

describe("rich-text-outline", () => {
  describe("buildTocFromSource", () => {
    describe("markdown mode", () => {
      it("extracts ATX headings", () => {
        const source = `# Heading 1
## Heading 2
### Heading 3`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc).toHaveLength(3);
        expect(toc[0]!.text).toBe("Heading 1");
        // normalizeTocLevel: h1 -> 2 (if block) -> max(1, 2-1) = 1
        expect(toc[0]!.level).toBe(1);
        expect(toc[1]!.text).toBe("Heading 2");
        // normalizeTocLevel: h2 -> 2 -> max(1, 2-1) = 1
        expect(toc[1]!.level).toBe(1);
        expect(toc[2]!.text).toBe("Heading 3");
        // normalizeTocLevel: h3 -> 3 -> max(1, 3-1) = 2
        expect(toc[2]!.level).toBe(2);
      });

      it("extracts setext headings", () => {
        const source = `Heading 1
=========

Heading 2
---------`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc).toHaveLength(2);
        expect(toc[0]!.text).toBe("Heading 1");
        // setext h1 -> normalizeTocLevel: 1 -> 2 -> max(1, 2-1) = 1
        expect(toc[0]!.level).toBe(1);
        expect(toc[1]!.text).toBe("Heading 2");
        // setext h2 -> normalizeTocLevel: 2 -> 2 -> max(1, 2-1) = 1
        expect(toc[1]!.level).toBe(1);
      });

      it("generates unique IDs for headings", () => {
        const source = `# Hello
## Hello
### Hello`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        const ids = toc.map((item) => item.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });

      it("skips headings inside code fences", () => {
        const source = `# Real Heading

\`\`\`
# Not a heading
\`\`\`

## Another Real Heading`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc).toHaveLength(2);
        expect(toc[0]!.text).toBe("Real Heading");
        expect(toc[1]!.text).toBe("Another Real Heading");
      });

      it("handles tilde code fences", () => {
        const source = `# Before

~~~
# Inside tilde fence
~~~

# After`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc).toHaveLength(2);
        expect(toc[0]!.text).toBe("Before");
        expect(toc[1]!.text).toBe("After");
      });

      it("normalizes heading text by removing markdown formatting", () => {
        const source = `# **Bold** heading
## \`code\` heading
### [Link](http://example.com) heading`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc[0]!.text).toBe("Bold heading");
        expect(toc[1]!.text).toBe("code heading");
        expect(toc[2]!.text).toBe("Link heading");
      });

      it("strips HTML tags from headings", () => {
        const source = `# <span>HTML</span> heading`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc[0]!.text).toContain("HTML");
        expect(toc[0]!.text).toContain("heading");
      });

      it("handles empty document", () => {
        const toc = buildTocFromSource({ source: "", mode: "markdown" });
        expect(toc).toHaveLength(0);
      });

      it("handles document without headings", () => {
        const source = `Just some text
And more text`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc).toHaveLength(0);
      });

      it("handles mixed heading levels", () => {
        const source = `# H1
## H2
### H3
## H2 again
#### H4`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc).toHaveLength(5);
        // normalizeTocLevel: h1->1, h2->1, h3->2, h2->1, h4->3
        expect(toc.map((t) => t.level)).toEqual([1, 1, 2, 1, 3]);
      });

      it("normalizes heading levels correctly", () => {
        // normalizeTocLevel: level === 1 ? 2 : level, then Math.max(1, level - 1)
        // h1 -> 2 -> 2-1 = 1, h2 -> 2 -> 2-1 = 1, h3 -> 3 -> 3-1 = 2, h4 -> 4 -> 4-1 = 3
        const source = `# H1
## H2
### H3
#### H4`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc[0]!.level).toBe(1); // h1 -> 2 -> 1
        expect(toc[1]!.level).toBe(1); // h2 -> 2 -> 1
        expect(toc[2]!.level).toBe(2); // h3 -> 3 -> 2
        expect(toc[3]!.level).toBe(3); // h4 -> 4 -> 3
      });

      it("handles skipFirstH1 option", () => {
        const source = `# First H1
## Sub Heading
# Second H1`;
        const toc = buildTocFromSource({
          source,
          mode: "markdown",
          skipFirstH1: true,
        });
        // skipFirstH1 removes the first H1 from the source
        expect(toc).toHaveLength(2);
        expect(toc[0]!.text).toBe("Sub Heading");
        expect(toc[1]!.text).toBe("Second H1");
      });

      it("handles image alt text in headings", () => {
        const source = `# Heading with ![image](http://example.com/img.png)`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc[0]!.text).toContain("image");
        expect(toc[0]!.text).not.toContain("!");
        expect(toc[0]!.text).not.toContain("![");
      });

      it("handles nested formatting in headings", () => {
        const source = `# **bold _and italic_** heading`;
        const toc = buildTocFromSource({ source, mode: "markdown" });
        expect(toc[0]!.text).toContain("bold");
        expect(toc[0]!.text).toContain("and italic");
        expect(toc[0]!.text).toContain("heading");
        expect(toc[0]!.text).not.toContain("**");
        expect(toc[0]!.text).not.toContain("_");
      });
    });

    describe("html mode", () => {
      it("extracts headings from HTML", () => {
        const source = `<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>`;
        const toc = buildTocFromSource({ source, mode: "html" });
        expect(toc).toHaveLength(3);
        expect(toc[0]!.text).toBe("Title");
        expect(toc[1]!.text).toBe("Subtitle");
        expect(toc[2]!.text).toBe("Section");
      });

      it("handles empty HTML", () => {
        const toc = buildTocFromSource({ source: "", mode: "html" });
        expect(toc).toHaveLength(0);
      });

      it("handles HTML without headings", () => {
        const source = `<p>Just a paragraph</p>`;
        const toc = buildTocFromSource({ source, mode: "html" });
        expect(toc).toHaveLength(0);
      });

      it("handles headings with nested HTML", () => {
        const source = `<h2><strong>Bold</strong> Title</h2>`;
        const toc = buildTocFromSource({ source, mode: "html" });
        expect(toc).toHaveLength(1);
        expect(toc[0]!.text).toContain("Bold");
        expect(toc[0]!.text).toContain("Title");
      });
    });

    describe("mdx mode", () => {
      it("extracts headings from MDX content", () => {
        const source = `# MDX Heading

Some content with <Component />

## Another Heading`;
        const toc = buildTocFromSource({ source, mode: "mdx" });
        expect(toc).toHaveLength(2);
        expect(toc[0]!.text).toBe("MDX Heading");
        expect(toc[1]!.text).toBe("Another Heading");
      });
    });
  });

  describe("ensureHtmlHeadingIds", () => {
    it("adds IDs to headings that don't have them", () => {
      const html = "<h2>Hello</h2><h3>World</h3>";
      const result = ensureHtmlHeadingIds(html);
      expect(result).toMatch(/id="[^"]+"/);
      expect(result).toContain("<h2");
      expect(result).toContain("<h3");
    });

    it("preserves existing IDs", () => {
      const html = '<h2 id="custom-id">Hello</h2>';
      const result = ensureHtmlHeadingIds(html);
      expect(result).toContain('id="custom-id"');
    });

    it("converts h1 to h2", () => {
      const html = "<h1>Title</h1>";
      const result = ensureHtmlHeadingIds(html);
      expect(result).toContain("<h2");
      expect(result).not.toContain("<h1");
    });

    it("handles empty HTML", () => {
      const result = ensureHtmlHeadingIds("");
      expect(result).toBe("");
    });

    it("handles HTML without headings", () => {
      const html = "<p>No headings here</p>";
      const result = ensureHtmlHeadingIds(html);
      expect(result).toBe("<p>No headings here</p>");
    });

    it("generates unique IDs for duplicate heading text", () => {
      const html = "<h2>Same</h2><h2>Same</h2>";
      const result = ensureHtmlHeadingIds(html);
      const idMatches = result.match(/id="([^"]+)"/g);
      expect(idMatches).toHaveLength(2);
      expect(idMatches![0]).not.toBe(idMatches![1]);
    });

    it("handles headings with nested elements", () => {
      const html = "<h2><strong>Bold</strong> Title</h2>";
      const result = ensureHtmlHeadingIds(html);
      expect(result).toMatch(/id="[^"]+"/);
    });

    it("handles all heading levels", () => {
      const html =
        "<h1>H1</h1><h2>H2</h2><h3>H3</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>";
      const result = ensureHtmlHeadingIds(html);
      // h1 is converted to h2
      expect(result).not.toContain("<h1");
      const idMatches = result.match(/id="([^"]+)"/g);
      expect(idMatches).toHaveLength(6);
    });
  });
});
