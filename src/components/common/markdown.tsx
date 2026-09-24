import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

/**
 * Renders AI-written Markdown with KaTeX maths. Raw HTML is not allowed
 * (react-markdown escapes it by default), so model output cannot inject markup.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("md-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
        components={{
          a: ({ children }) => <span className="font-semibold">{children}</span>,
          img: () => null,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
