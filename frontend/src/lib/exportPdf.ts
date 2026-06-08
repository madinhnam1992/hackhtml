import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Preview from "@/components/Preview";
import { api, ContentType } from "./api";
import { downloadBlob } from "./download";

/**
 * Export a document to PDF.
 *
 * Preferred path: the frontend builds the print-ready HTML here (so Markdown renders exactly like
 * the on-screen preview) and POSTs it to the backend, which uses headless Chromium to produce a
 * PDF with a page-number footer the browser print dialog can't give us — see exportToPdfViaServer.
 *
 * Fallback path (exportToPdf): the browser's native print-to-PDF. Highest fidelity with selectable
 * text and no server round-trip, but the header/footer is controlled by the browser, not us. We
 * render into a hidden iframe and call its print() so it doesn't trip popup blockers.
 */

const MARKDOWN_PRINT_CSS = `
  :root { color-scheme: light; }
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
         color: #111; line-height: 1.6; margin: 0; padding: 32px; }
  .markdown-body { max-width: 820px; margin: 0 auto; }
  h1,h2,h3,h4 { line-height: 1.25; margin: 1.4em 0 .6em; }
  h1 { font-size: 2em; border-bottom: 1px solid #ddd; padding-bottom: .3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: .3em; }
  p, ul, ol, blockquote, table, pre { margin: 0 0 1em; }
  code { background: #f3f4f6; padding: .15em .35em; border-radius: 4px;
         font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9em; }
  pre { background: #f3f4f6; padding: 14px 16px; border-radius: 8px; overflow: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #d1d5db; color: #555; padding-left: 1em; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 6px 10px; }
  img { max-width: 100%; }
  a { color: #2563eb; }
  @page { margin: 16mm; }
`;

function escapeText(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
}

/**
 * Print-only safety net for user HTML. `backdrop-filter` is rendered as an opaque black box by
 * headless Chromium's PDF path (with backgrounds on), so neutralize it for print only — it can't
 * sample a live backdrop in a static PDF anyway. Screen rendering is unaffected.
 */
const PRINT_SAFETY_CSS =
  "@media print{*,*::before,*::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;}}";

/** Inject a <title> (for the suggested filename) and the print safety CSS into an HTML document. */
function injectHead(htmlDoc: string, title: string): string {
  const head = `<title>${escapeText(title)}</title><style>${PRINT_SAFETY_CSS}</style>`;
  if (/<head[^>]*>/i.test(htmlDoc)) {
    return htmlDoc.replace(/<head[^>]*>/i, (m) => `${m}${head}`);
  }
  // No <head>: wrap whatever we have into a minimal document.
  return `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${htmlDoc}</body></html>`;
}

export function buildPrintDocument(
  title: string,
  content: string,
  contentType: ContentType
): string {
  if (contentType === "HTML") {
    return injectHead(content || "<p></p>", title);
  }
  // Markdown: render the same sanitized output the preview shows, then wrap with print CSS.
  const body = renderToStaticMarkup(
    React.createElement(Preview, { content, contentType: "MARKDOWN" })
  );
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<title>${escapeText(title)}</title><style>${MARKDOWN_PRINT_CSS}</style></head>` +
    `<body>${body}</body></html>`
  );
}

export function exportToPdf(opts: {
  title: string;
  content: string;
  contentType: ContentType;
}) {
  const title = (opts.title || "document").trim() || "document";
  const html = buildPrintDocument(title, opts.content, opts.contentType);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  } as CSSStyleDeclaration);

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    // Give the layout/fonts a tick before printing.
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        setTimeout(() => iframe.remove(), 1000);
      }
    }, 150);
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = html;
}

interface DocState {
  bodyClass?: string;
  htmlClass?: string;
  lang?: string;
}

/**
 * Ask the live preview iframe (via the bridge in Preview.tsx) for its current root classes/lang, so
 * runtime state like a language toggle (which only sets a `<body>` class) carries into the PDF.
 * Returns null if there's no preview, the bridge doesn't answer, or we're off the browser.
 */
function captureLivePreviewState(): Promise<DocState | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return Promise.resolve(null);
  const iframe = document.querySelector("iframe.preview-iframe") as HTMLIFrameElement | null;
  const win = iframe?.contentWindow;
  if (!win) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: DocState | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(v);
    };
    function onMessage(e: MessageEvent) {
      if (e.source === win && e.data && e.data.__hackhtml_state__) {
        finish({ bodyClass: e.data.bodyClass, htmlClass: e.data.htmlClass, lang: e.data.lang });
      }
    }
    window.addEventListener("message", onMessage);
    try {
      win.postMessage("__hackhtml_get_state__", "*");
    } catch {
      finish(null);
    }
    setTimeout(() => finish(null), 300);
  });
}

/** Set or replace an attribute on an element's opening tag (first match), escaping the value. */
function setTagAttr(html: string, tag: string, attr: string, value: string): string {
  const openRe = new RegExp(`<${tag}\\b[^>]*>`, "i");
  const match = html.match(openRe);
  if (!match) return html; // fragment without this tag — nothing to do
  const safe = value.replace(/"/g, "&quot;");
  const attrRe = new RegExp(`\\s${attr}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  const tagStr = attrRe.test(match[0])
    ? match[0].replace(attrRe, ` ${attr}="${safe}"`)
    : match[0].replace(new RegExp(`<${tag}\\b`, "i"), `<${tag} ${attr}="${safe}"`);
  return html.replace(openRe, tagStr);
}

/** Apply captured runtime state (root classes/lang) onto the stored HTML before rendering. */
function applyDocState(html: string, state: DocState | null): string {
  if (!state) return html;
  let out = html;
  if (state.bodyClass !== undefined) out = setTagAttr(out, "body", "class", state.bodyClass);
  if (state.htmlClass) out = setTagAttr(out, "html", "class", state.htmlClass);
  if (state.lang) out = setTagAttr(out, "html", "lang", state.lang);
  return out;
}

/**
 * Export to PDF via the backend (headless Chromium) so the file has our own page-number footer.
 * Builds the same print-ready HTML as the native path and POSTs it. For HTML it first captures the
 * preview's runtime state (e.g. selected language) so the PDF matches what's on screen. If the
 * server render fails (e.g. PDF disabled or busy), falls back to the browser print dialog.
 */
export async function exportToPdfViaServer(opts: {
  title: string;
  content: string;
  contentType: ContentType;
  target: { kind: "doc"; id: string } | { kind: "public"; slug: string };
}): Promise<void> {
  const title = (opts.title || "document").trim() || "document";
  let content = opts.content;
  if (opts.contentType === "HTML") {
    content = applyDocState(content, await captureLivePreviewState());
  }
  const html = buildPrintDocument(title, content, opts.contentType);
  try {
    const blob =
      opts.target.kind === "doc"
        ? await api.generateDocumentPdf(opts.target.id, html, title)
        : await api.generatePublicPdf(opts.target.slug, html, title);
    downloadBlob(blob, `${title}.pdf`);
  } catch (err) {
    console.warn("Server PDF export failed, falling back to browser print", err);
    exportToPdf({ title, content, contentType: opts.contentType });
  }
}
