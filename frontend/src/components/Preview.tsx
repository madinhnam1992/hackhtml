"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { ContentType } from "@/lib/api";

/**
 * Tiny bridge appended to the preview's srcDoc. The sandbox is opaque-origin (no allow-same-origin),
 * so the host app can't read the iframe DOM directly. On request it posts back the current root
 * classes/lang, letting "Export PDF" capture runtime state (e.g. a language toggle that only sets a
 * body class) so the PDF matches what's on screen. See exportToPdfViaServer in lib/exportPdf.ts.
 */
const EXPORT_BRIDGE =
  "\n<script>(function(){window.addEventListener('message',function(e){" +
  "if(e&&e.data==='__hackhtml_get_state__'){var t=e.source||window.parent;t&&t.postMessage({" +
  "__hackhtml_state__:true,bodyClass:document.body?document.body.className:''," +
  "htmlClass:document.documentElement.className," +
  "lang:document.documentElement.getAttribute('lang')||''},'*');}});})();</script>";

/**
 * In-document anchor handler. An `about:srcdoc` document inherits its base URL from the parent app,
 * so a table-of-contents link like <a href="#section"> would otherwise resolve against the app URL
 * and try to navigate the iframe away (404) instead of scrolling. We intercept fragment-only clicks
 * and scroll within the document, which works even on the opaque-origin sandbox.
 */
const ANCHOR_SCROLL =
  "\n<script>(function(){document.addEventListener('click',function(e){" +
  "var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;" +
  "var href=a.getAttribute('href');if(!href||href.charAt(0)!=='#')return;" +
  "e.preventDefault();var id=href.slice(1);" +
  "if(!id){window.scrollTo(0,0);return;}" +
  "try{id=decodeURIComponent(id);}catch(_){}" +
  "var t=document.getElementById(id);" +
  "if(!t){try{t=document.querySelector('a[name=\"'+(window.CSS&&CSS.escape?CSS.escape(id):id)+'\"]');}catch(_){}}" +
  "if(t)t.scrollIntoView({behavior:'smooth'});},true);})();</script>";

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
        srcDoc={content + ANCHOR_SCROLL + EXPORT_BRIDGE}
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
