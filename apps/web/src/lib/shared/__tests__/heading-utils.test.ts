import { describe, expect, it } from "vitest";

import {
  createHeadingProcessor,
  rehypeStableHeadingIds,
} from "@/lib/shared/heading-utils";

describe("heading-utils", () => {
  describe("createHeadingProcessor", () => {
    describe("generateSlug", () => {
      it("生成基本 slug", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("Hello World");
        expect(slug).toBe("hello-world-1");
      });

      it("处理中文标题", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("你好世界");
        expect(slug).toBe("你好世界-1");
      });

      it("处理特殊字符", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("Hello, World! @#$%");
        expect(slug).toMatch(/^hello-world-1$/);
      });

      it("连续空格合并为单个连字符", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("Hello   World");
        expect(slug).toBe("hello-world-1");
      });

      it("空标题使用 'heading' 作为基础", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("");
        expect(slug).toBe("heading-1");
      });

      it("仅包含特殊字符的标题使用 'heading'", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("!@#$%^&*()");
        expect(slug).toBe("heading-1");
      });

      it("每个标题递增计数器", () => {
        const processor = createHeadingProcessor();
        expect(processor.generateSlug("First")).toBe("first-1");
        expect(processor.generateSlug("Second")).toBe("second-2");
        expect(processor.generateSlug("Third")).toBe("third-3");
      });

      it("数字后缀避免 CSS 选择器问题", () => {
        const processor = createHeadingProcessor();
        const slug = processor.generateSlug("Test");
        // slug 不以数字开头
        expect(slug).toMatch(/^[a-z一-龥]/);
      });
    });

    describe("reset", () => {
      it("重置计数器", () => {
        const processor = createHeadingProcessor();
        processor.generateSlug("First");
        processor.generateSlug("Second");
        processor.reset();
        const slug = processor.generateSlug("Third");
        expect(slug).toBe("third-1");
      });
    });

    describe("processHtmlHeadings", () => {
      it("为标题添加 id 属性", () => {
        const processor = createHeadingProcessor();
        const html = "<h2>Hello World</h2>";
        const result = processor.processHtmlHeadings(html);
        expect(result).toContain('id="hello-world-1"');
      });

      it("h1 转换为 h2", () => {
        const processor = createHeadingProcessor();
        const html = "<h1>Title</h1>";
        const result = processor.processHtmlHeadings(html);
        expect(result).toContain("<h2");
        expect(result).not.toContain("<h1");
      });

      it("已有 id 的标题不添加新 id", () => {
        const processor = createHeadingProcessor();
        const html = '<h2 id="existing">Title</h2>';
        const result = processor.processHtmlHeadings(html);
        expect(result).toContain('id="existing"');
      });

      it("处理多级标题", () => {
        const processor = createHeadingProcessor();
        const html = "<h2>First</h2><h3>Second</h3><h4>Third</h4>";
        const result = processor.processHtmlHeadings(html);
        expect(result).toContain('id="first-1"');
        expect(result).toContain('id="second-2"');
        expect(result).toContain('id="third-3"');
      });

      it("处理带子标签的标题", () => {
        const processor = createHeadingProcessor();
        const html = "<h2><strong>Bold</strong> Title</h2>";
        const result = processor.processHtmlHeadings(html);
        expect(result).toContain('id="bold-title-1"');
      });
    });

    describe("extractTocItems", () => {
      it("提取目录项", () => {
        const processor = createHeadingProcessor();
        const html = "<h2>First</h2><h3>Second</h3>";
        const items = processor.extractTocItems(html);
        expect(items).toHaveLength(2);
        expect(items[0]!.text).toBe("First");
        expect(items[0]!.level).toBe(1); // h2 -> level 1
        expect(items[1]!.text).toBe("Second");
        expect(items[1]!.level).toBe(2); // h3 -> level 2
      });

      it("h1 调整为 h2 级别", () => {
        const processor = createHeadingProcessor();
        const html = "<h1>Title</h1>";
        const items = processor.extractTocItems(html);
        expect(items).toHaveLength(1);
        expect(items[0]!.level).toBe(1); // h1->h2->level 1
      });

      it("空 HTML 返回空数组", () => {
        const processor = createHeadingProcessor();
        expect(processor.extractTocItems("")).toEqual([]);
      });

      it("无标题 HTML 返回空数组", () => {
        const processor = createHeadingProcessor();
        expect(processor.extractTocItems("<p>No headings</p>")).toEqual([]);
      });

      it("生成的 id 与 processHtmlHeadings 一致", () => {
        // 注意：processHtmlHeadings 和 extractTocItems 共享同一个计数器
        // 所以需要分别用独立的处理器来比较生成逻辑
        const processor1 = createHeadingProcessor();
        const html = "<h2>Test Title</h2>";
        const processed = processor1.processHtmlHeadings(html);

        const processor2 = createHeadingProcessor();
        const items = processor2.extractTocItems(html);
        expect(processed).toContain(items[0]!.id);
      });
    });
  });

  describe("rehypeStableHeadingIds", () => {
    it("返回一个函数", () => {
      expect(typeof rehypeStableHeadingIds()).toBe("function");
    });

    it("为 h1-h6 元素添加 id", () => {
      const plugin = rehypeStableHeadingIds();
      const tree = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "h2",
            properties: {},
            children: [{ type: "text", value: "Hello" }],
          },
        ],
      };
      plugin(tree);
      expect((tree.children[0] as any).properties.id).toMatch(/^hello-\d+$/);
    });

    it("跳过非标题元素", () => {
      const plugin = rehypeStableHeadingIds();
      const tree = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [{ type: "text", value: "Not a heading" }],
          },
        ],
      };
      plugin(tree);
      expect((tree.children[0] as any).properties.id).toBeUndefined();
    });

    it("递归处理子节点", () => {
      const plugin = rehypeStableHeadingIds();
      const tree = {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "h3",
                properties: {},
                children: [{ type: "text", value: "Nested" }],
              },
            ],
          },
        ],
      };
      plugin(tree);
      const h3 = (tree.children[0] as any).children[0];
      expect(h3.properties.id).toMatch(/^nested-\d+$/);
    });

    it("处理 undefined 节点不报错", () => {
      const plugin = rehypeStableHeadingIds();
      expect(() => plugin({ type: "root", children: [] })).not.toThrow();
    });
  });
});
