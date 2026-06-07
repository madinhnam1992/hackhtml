"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Preview from "@/components/Preview";
import { useAuth } from "@/lib/auth";
import { api, DocumentDetail } from "@/lib/api";

export default function PublicViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = params.slug as string;
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPublic(slug)
      .then(setDoc)
      .catch((e) => setError(e instanceof Error ? e.message : "Not found"));
  }, [slug]);

  if (error) {
    return (
      <div className="container">
        <h1>404</h1>
        <p className="error">{error}</p>
      </div>
    );
  }
  if (!doc) {
    return <div className="container">Loading…</div>;
  }

  return (
    <div className="editor-shell">
      <div className="toolbar">
        <strong style={{ flex: 1 }}>{doc.title || "Untitled"}</strong>
        <span className="badge">{doc.contentType}</span>
        {user ? (
          <button
            className="btn"
            onClick={() => router.push(`/editor/${doc.id}`)}
            title="Edit this document"
          >
            Edit
          </button>
        ) : (
          <span className="badge">Read-only</span>
        )}
        <button
          className="btn secondary"
          onClick={async () => {
            const { exportToPdf } = await import("@/lib/exportPdf");
            exportToPdf({
              title: doc.title || "document",
              content: doc.content,
              contentType: doc.contentType,
            });
          }}
          title="Export to PDF (via browser print)"
        >
          Export PDF
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: "white" }}>
        <Preview content={doc.content} contentType={doc.contentType} />
      </div>
    </div>
  );
}
