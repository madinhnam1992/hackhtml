import { ContentType } from "./api";

/** Trigger a browser download for a Blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a text string as a file with the given MIME type. */
export function downloadText(filename: string, text: string, mime: string) {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

/** Sanitize a document title into a safe filename base (no extension). */
export function safeFilename(title: string): string {
  const base = (title || "").replace(/[\\/:*?"<>|\r\n]+/g, "_").trim();
  return base || "document";
}

/** Filename + MIME for downloading a document's raw source (html/md). */
export function sourceFile(title: string, contentType: ContentType): {
  filename: string;
  mime: string;
} {
  const isHtml = contentType === "HTML";
  return {
    filename: `${safeFilename(title)}.${isHtml ? "html" : "md"}`,
    mime: isHtml ? "text/html" : "text/markdown",
  };
}
