"use client";

import { useState } from "react";
import { ContentType, Visibility } from "@/lib/api";

export interface NewDocumentValues {
  name: string;
  type: ContentType;
  visibility: Visibility;
}

export default function NewDocumentModal({
  onClose,
  onSubmit,
  busy,
}: {
  onClose: () => void;
  onSubmit: (values: NewDocumentValues) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ContentType>("HTML");
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim() || "Untitled", type, visibility });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form
        className="modal card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 style={{ marginTop: 0 }}>New document</h2>

        <div className="field">
          <label>Name</label>
          <input
            className="input"
            autoFocus
            value={name}
            placeholder="Untitled"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Format</label>
          <div className="mode-group">
            <button
              type="button"
              className={`seg ${type === "HTML" ? "active" : ""}`}
              onClick={() => setType("HTML")}
            >
              HTML
            </button>
            <button
              type="button"
              className={`seg ${type === "MARKDOWN" ? "active" : ""}`}
              onClick={() => setType("MARKDOWN")}
            >
              Markdown
            </button>
          </div>
        </div>

        <div className="field">
          <label>Visibility</label>
          <div className="mode-group">
            <button
              type="button"
              className={`seg ${visibility === "PRIVATE" ? "active" : ""}`}
              onClick={() => setVisibility("PRIVATE")}
            >
              Private
            </button>
            <button
              type="button"
              className={`seg ${visibility === "PUBLIC" ? "active" : ""}`}
              onClick={() => setVisibility("PUBLIC")}
            >
              Public
            </button>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "8px 0 0" }}>
            {visibility === "PUBLIC"
              ? "Anyone with the link can view; signed-in users can also edit."
              : "Only you can see and edit this document."}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
