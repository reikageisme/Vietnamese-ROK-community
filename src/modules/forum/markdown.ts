import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import type { Element, Root } from "hast";

function allowedImageHosts() {
  return [process.env.S3_PUBLIC_URL, process.env.S3_ENDPOINT, process.env.APP_URL]
    .filter(Boolean)
    .flatMap((value) => { try { return [new URL(value!).host]; } catch { return []; } });
}

function restrictImages() {
  const hosts = new Set(allowedImageHosts());
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "img") return;
      const src = typeof node.properties.src === "string" ? node.properties.src : "";
      let allowed = src.startsWith("/api/uploads/") || src.startsWith("/uploads/");
      if (!allowed) {
        try { allowed = hosts.has(new URL(src).host); } catch { allowed = false; }
      }
      if (!allowed && parent && typeof index === "number") parent.children.splice(index, 1);
    });
  };
}

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "img"],
  attributes: { ...defaultSchema.attributes, img: ["src", "alt", "title", "width", "height"] },
};

export async function renderForumMarkdown(markdown: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(restrictImages)
    .use(rehypeStringify)
    .process(markdown);
  return String(result);
}

