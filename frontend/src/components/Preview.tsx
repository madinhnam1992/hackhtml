"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ContentType } from "@/lib/api";

export default function Preview({
  content,
  contentType,
}: {
  content: string;
  contentType: ContentType;
}) {
  if (contentType === "HTML") {
    // Run the document's own scripts (inline handlers, CDN libs like mermaid) so it behaves like
    // opening the file in a browser. We deliberately enable allow-scripts WITHOUT allow-same-origin:
    // the srcdoc would otherwise be same-origin with the app and its scripts could read the parent's
    // localStorage (the JWT). With an opaque origin the document runs but cannot touch the host app.
    return (
      <iframe
        className="preview-iframe"
        sandbox="allow-scripts allow-popups allow-modals allow-forms"
        srcDoc={content}
        title="HTML preview"
      />
    );
  }

  // Markdown: GitHub-flavored, sanitized before rendering.
  return (
    <div className="preview-pane markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
