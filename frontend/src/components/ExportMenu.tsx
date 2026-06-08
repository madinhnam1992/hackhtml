"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContentType } from "@/lib/api";
import { downloadText, safeFilename, sourceFile } from "@/lib/download";

type Target = { kind: "doc"; id: string } | { kind: "public"; slug: string };

/**
 * "Export ▾" dropdown that gathers all the ways to take a document out of the app:
 * raw source (.html/.md), rendered HTML (Markdown only), and PDF (reuses exportToPdfViaServer).
 */
export default function ExportMenu({
  title,
  content,
  contentType,
  target,
}: {
  title: string;
  content: string;
  contentType: ContentType;
  target: Target;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const downloadSource = useCallback(() => {
    const { filename, mime } = sourceFile(title, contentType);
    downloadText(filename, content, mime);
    setOpen(false);
  }, [title, content, contentType]);

  const downloadHtml = useCallback(async () => {
    const { buildPrintDocument } = await import("@/lib/exportPdf");
    downloadText(
      `${safeFilename(title)}.html`,
      buildPrintDocument(title, content, "MARKDOWN"),
      "text/html"
    );
    setOpen(false);
  }, [title, content]);

  const exportPdf = useCallback(async () => {
    setOpen(false);
    const { exportToPdfViaServer } = await import("@/lib/exportPdf");
    await exportToPdfViaServer({ title, content, contentType, target });
  }, [title, content, contentType, target]);

  return (
    <div className="dropdown" ref={ref}>
      <button
        className="btn secondary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Export ▾
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          <button className="dropdown-item" role="menuitem" onClick={downloadSource}>
            Download source ({contentType === "HTML" ? ".html" : ".md"})
          </button>
          {contentType === "MARKDOWN" && (
            <button className="dropdown-item" role="menuitem" onClick={downloadHtml}>
              Download as HTML
            </button>
          )}
          <button className="dropdown-item" role="menuitem" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      )}
    </div>
  );
}
