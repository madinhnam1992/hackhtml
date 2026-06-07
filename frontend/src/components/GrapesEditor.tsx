"use client";

import { useEffect, useRef } from "react";
import grapesjs, { Editor } from "grapesjs";
import gjsBlocksBasic from "grapesjs-blocks-basic";
import "grapesjs/dist/css/grapes.min.css";
import { combineHtmlDoc, formatHtml, splitHtmlDoc } from "@/lib/htmlDoc";

export type DragMode = "flow" | "absolute";

export default function GrapesEditor({
  value,
  onChange,
  dragMode,
}: {
  value: string;
  onChange: (combined: string) => void;
  dragMode: DragMode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  const lastEmitted = useRef<string>(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest onChange without re-running the init effect.
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      height: "100%",
      width: "auto",
      fromElement: false,
      storageManager: false, // we persist via the app's own autosave
      plugins: [gjsBlocksBasic],
    });
    editorRef.current = editor;

    // Serialize the canvas to a formatted, complete HTML document.
    const serialize = () =>
      formatHtml(combineHtmlDoc(editor.getHtml(), editor.getCss() || ""));

    // Load current content into the canvas.
    const { html, css } = splitHtmlDoc(value);
    editor.setStyle(css);
    editor.setComponents(html);
    lastEmitted.current = serialize();

    // Apply initial drag mode ("" = flow/sortable, "absolute" = free positioning).
    editor.getModel().set("dragMode", dragMode === "absolute" ? "absolute" : "");

    const emit = () => {
      const combined = serialize();
      if (combined !== lastEmitted.current) {
        lastEmitted.current = combined;
        onChangeRef.current(combined);
      }
    };
    const scheduleEmit = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(emit, 500);
    };

    editor.on("update", scheduleEmit);
    editor.on("component:update", scheduleEmit);
    editor.on("styleable:change", scheduleEmit);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      try {
        emit(); // flush the latest edit before tearing down
      } catch {
        /* ignore */
      }
      editor.destroy();
      editorRef.current = null;
    };
    // Mount once; `value` is read at mount (component remounts when entering Design mode).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to drag-mode toggle from the toolbar.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.getModel().set("dragMode", dragMode === "absolute" ? "absolute" : "");
  }, [dragMode]);

  return <div className="gjs-wrap" ref={containerRef} />;
}
