/**
 * Helpers to round-trip between the stored HTML "file" (a single string) and the
 * body-HTML + CSS pair that GrapesJS works with.
 *
 * Stored form is a complete, valid HTML document so the read-only Preview iframe and
 * public viewer can render it directly:
 *
 *   <!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body>{html}</body></html>
 */

import { html as beautifyHtml } from "js-beautify";

export interface HtmlParts {
  html: string; // body inner HTML
  css: string; // collected <style> contents
}

/**
 * Pretty-print an HTML document (structure + embedded <style>/<script>) so the Code view stays
 * readable. GrapesJS emits compact HTML; we run this before storing the Design-mode output.
 */
export function formatHtml(doc: string): string {
  const text = doc ?? "";
  if (!text.trim()) return text;
  try {
    return beautifyHtml(text, {
      indent_size: 2,
      indent_inner_html: true,
      preserve_newlines: true,
      max_preserve_newlines: 2,
      wrap_line_length: 0,
      end_with_newline: true,
    });
  } catch {
    return text; // never block saving on a formatter hiccup
  }
}

/**
 * Split a stored content string into { html, css }.
 * - Full documents: body innerHTML + concatenated <style> text.
 * - Fragments / empty / legacy content: treated entirely as html, css empty.
 */
export function splitHtmlDoc(content: string): HtmlParts {
  const text = content ?? "";
  if (!text.trim()) {
    return { html: "", css: "" };
  }

  // Only parse as a full document when it actually looks like one.
  const looksLikeDoc = /<html[\s>]|<body[\s>]|<!doctype/i.test(text);
  if (!looksLikeDoc) {
    return { html: text, css: "" };
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return { html: text, css: "" };
  }

  const doc = new DOMParser().parseFromString(text, "text/html");
  const css = Array.from(doc.querySelectorAll("style"))
    .map((s) => s.textContent || "")
    .join("\n")
    .trim();
  const html = doc.body ? doc.body.innerHTML : text;
  return { html, css };
}

/** Combine GrapesJS output back into a complete, storable HTML document. */
export function combineHtmlDoc(html: string, css: string): string {
  const safeHtml = html ?? "";
  const styleBlock = css && css.trim() ? `<style>${css}</style>` : "";
  return (
    `<!doctype html><html><head><meta charset="utf-8">${styleBlock}</head>` +
    `<body>${safeHtml}</body></html>`
  );
}
