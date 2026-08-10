import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function SafeMarkdown({ children }: { children: string }) {
  return <div className="forum-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{children}</ReactMarkdown></div>;
}

