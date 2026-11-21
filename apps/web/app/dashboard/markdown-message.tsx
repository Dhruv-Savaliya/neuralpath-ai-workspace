"use client";

import { memo, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";

function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const isInline = !className?.includes("language-") && !String(children).includes("\n");

  if (isInline) {
    return (
      <code className="np-inline-code" {...props}>
        {children}
      </code>
    );
  }

  const codeText = String(children).replace(/\n$/, "");
  const language = className ? className.replace("language-", "") : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  return (
    <div className="np-code-block-wrapper">
      <div className="np-code-block-header">
        <span className="np-code-lang">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="np-code-copy-btn"
          aria-label={copied ? "Code copied to clipboard" : "Copy code"}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="np-code-pre">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  useEffect(() => {
    if (!document.getElementById("katex-css")) {
      const link = document.createElement("link");
      link.id = "katex-css";
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="np-markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeBlock,
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="np-md-link" />
          ),
          table: ({ ...props }) => (
            <div className="np-table-container">
              <table className="np-table" {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
