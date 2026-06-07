"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import Preview from "./Preview";
import type { DragMode } from "./GrapesEditor";
import { api, DocumentDetail, Visibility } from "@/lib/api";

// GrapesJS touches the DOM and is heavy; load it only when Design mode is opened.
const GrapesEditor = dynamic(() => import("./GrapesEditor"), { ssr: false });

type SaveState = "saved" | "saving" | "unsaved";
type ViewMode = "editor" | "split" | "preview" | "design";

export default function Editor({ initial }: { initial: DocumentDetail }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [shareSlug, setShareSlug] = useState<string | null>(initial.shareSlug);
  const [saveState, setSaveState] = useState<SaveState>("saved");

  // View mode + resizable split
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [editorPct, setEditorPct] = useState(50); // editor width % in split mode
  const [dragging, setDragging] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Visual ("Design") editing — HTML documents only
  const isHtml = initial.contentType === "HTML";
  const [dragMode, setDragMode] = useState<DragMode>("flow");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const langExtension = initial.contentType === "HTML" ? html() : markdown();

  const saveContent = useCallback(
    async (value: string) => {
      setSaveState("saving");
      try {
        await api.saveContent(initial.id, value);
        setSaveState("saved");
      } catch {
        setSaveState("unsaved");
      }
    },
    [initial.id]
  );

  const onContentChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveState("unsaved");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveContent(value), 800);
    },
    [saveContent]
  );

  const onTitleChange = useCallback((value: string) => {
    setTitle(value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      api.updateMetadata(initial.id, value).catch(() => {});
    }, 600);
  }, [initial.id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  // --- splitter drag (split mode only) ---
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const el = bodyRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setEditorPct(Math.min(85, Math.max(15, pct)));
    }
    function onUp() {
      setDragging(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const isDesign = viewMode === "design";
  const showEditor = viewMode === "editor" || viewMode === "split";
  const showPreview = viewMode === "preview" || viewMode === "split";
  const isSplit = viewMode === "split";

  async function changeVisibility(v: Visibility) {
    setVisibility(v);
    const updated = await api.share(initial.id, v);
    setShareSlug(updated.shareSlug);
  }

  const handleExportPdf = useCallback(async () => {
    const { exportToPdf } = await import("@/lib/exportPdf");
    exportToPdf({ title, content, contentType: initial.contentType });
  }, [title, content, initial.contentType]);

  const handleFormat = useCallback(async () => {
    const { formatHtml } = await import("@/lib/htmlDoc");
    const formatted = formatHtml(content);
    if (formatted !== content) onContentChange(formatted);
  }, [content, onContentChange]);

  const shareUrl =
    shareSlug && typeof window !== "undefined"
      ? `${window.location.origin}/s/${shareSlug}`
      : null;

  return (
    <div className="editor-shell">
      <div className="toolbar">
        <button className="btn secondary" onClick={() => router.push("/dashboard")}>
          ← Back
        </button>
        <input
          className="title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
        />
        <span className="badge">{initial.contentType}</span>
        <div className="mode-group" role="group" aria-label="View mode">
          <button
            className={`seg ${viewMode === "editor" ? "active" : ""}`}
            onClick={() => setViewMode("editor")}
            title="Editor only"
          >
            Editor
          </button>
          <button
            className={`seg ${viewMode === "split" ? "active" : ""}`}
            onClick={() => setViewMode("split")}
            title="Editor and preview"
          >
            Split
          </button>
          <button
            className={`seg ${viewMode === "preview" ? "active" : ""}`}
            onClick={() => setViewMode("preview")}
            title="Preview only"
          >
            Preview
          </button>
          {isHtml && (
            <button
              className={`seg ${viewMode === "design" ? "active" : ""}`}
              onClick={() => setViewMode("design")}
              title="Visual editing: edit text inline & drag elements"
            >
              Design
            </button>
          )}
        </div>

        {viewMode === "design" && (
          <div className="mode-group" role="group" aria-label="Drag mode">
            <button
              className={`seg ${dragMode === "flow" ? "active" : ""}`}
              onClick={() => setDragMode("flow")}
              title="Drag to reorder within the layout flow"
            >
              Flow
            </button>
            <button
              className={`seg ${dragMode === "absolute" ? "active" : ""}`}
              onClick={() => setDragMode("absolute")}
              title="Drag to position elements freely (absolute)"
            >
              Absolute
            </button>
          </div>
        )}
        <span className="save-state">
          {saveState === "saved" ? "✓ Saved" : saveState === "saving" ? "Saving…" : "Unsaved"}
        </span>
        <button className="btn" onClick={() => saveContent(content)}>
          Save
        </button>
        {isHtml && !isDesign && (
          <button
            className="btn secondary"
            onClick={handleFormat}
            title="Auto-format HTML"
          >
            Format
          </button>
        )}
        <button
          className="btn secondary"
          onClick={handleExportPdf}
          title="Export to PDF (via browser print)"
        >
          Export PDF
        </button>
        <select
          className="input"
          style={{ width: "auto" }}
          value={visibility}
          onChange={(e) => changeVisibility(e.target.value as Visibility)}
        >
          <option value="PRIVATE">Private</option>
          <option value="UNLISTED">Unlisted (link only)</option>
          <option value="PUBLIC">Public</option>
        </select>
        {shareUrl && (
          <button
            className="btn secondary"
            onClick={() => {
              navigator.clipboard?.writeText(shareUrl);
            }}
            title={shareUrl}
          >
            Copy share link
          </button>
        )}
      </div>

      <div className={`editor-body ${dragging ? "dragging" : ""}`} ref={bodyRef}>
        {isDesign && (
          <div className="gjs-host">
            <GrapesEditor
              value={content}
              onChange={onContentChange}
              dragMode={dragMode}
            />
          </div>
        )}

        {!isDesign && showEditor && (
          <div
            className="editor-pane"
            style={{
              flexBasis: isSplit ? `${editorPct}%` : "100%",
              flexGrow: isSplit ? 0 : 1,
              flexShrink: 0,
            }}
          >
            <CodeMirror
              value={content}
              height="100%"
              theme="dark"
              extensions={[langExtension]}
              onChange={onContentChange}
            />
          </div>
        )}

        {isSplit && (
          <div
            className="gutter"
            onMouseDown={startDrag}
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
          />
        )}

        {showPreview && (
          <div
            className="preview-pane"
            style={{
              padding: 0,
              flexBasis: isSplit ? `${100 - editorPct}%` : "100%",
              flexGrow: 1,
              flexShrink: 1,
            }}
          >
            <Preview content={content} contentType={initial.contentType} />
          </div>
        )}
      </div>
    </div>
  );
}
