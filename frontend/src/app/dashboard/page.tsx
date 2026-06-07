"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api, DocumentSummary } from "@/lib/api";
import NewDocumentModal, { NewDocumentValues } from "@/components/NewDocumentModal";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Inline title editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const refresh = useCallback(async () => {
    setLoadingDocs(true);
    try {
      setDocs(await api.listDocuments());
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  async function handleCreate(values: NewDocumentValues) {
    setCreating(true);
    try {
      const doc = await api.createDocument(values.name, values.type);
      if (values.visibility !== "PRIVATE") {
        await api.share(doc.id, values.visibility);
      }
      router.push(`/editor/${doc.id}`);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(d: DocumentSummary) {
    setEditingId(d.id);
    setEditingValue(d.title || "");
  }

  async function commitEdit(id: string) {
    const name = editingValue.trim();
    const current = docs.find((d) => d.id === id)?.title || "";
    setEditingId(null);
    if (name && name !== current) {
      await api.updateMetadata(id, name);
      refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document?")) return;
    await api.deleteDocument(id);
    refresh();
  }

  if (loading || !user) {
    return <div className="container">Loading…</div>;
  }

  return (
    <>
      <nav className="navbar">
        <strong>hack-html</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "var(--muted)" }}>{user.displayName}</span>
          <button className="btn secondary" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="container">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <h1 style={{ margin: 0, flex: 1 }}>My documents</h1>
          <button className="btn" onClick={() => setShowModal(true)}>
            New document
          </button>
        </div>

        {loadingDocs ? (
          <p style={{ color: "var(--muted)" }}>Loading documents…</p>
        ) : docs.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            No documents yet. Create your first one!
          </p>
        ) : (
          <div className="grid">
            {docs.map((d) => (
              <div className="card" key={d.id}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span className="badge">{d.contentType}</span>
                  <span className="badge">{d.visibility}</span>
                </div>

                {editingId === d.id ? (
                  <input
                    className="input"
                    autoFocus
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => commitEdit(d.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(d.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    style={{ margin: "4px 0", fontSize: "1.1rem", fontWeight: 600 }}
                  />
                ) : (
                  <h3
                    style={{ margin: "4px 0", cursor: "text" }}
                    title="Click to rename"
                    onClick={() => startEdit(d)}
                  >
                    {d.title || "Untitled"}
                  </h3>
                )}

                <p style={{ color: "var(--muted)", fontSize: "0.85rem", minHeight: 40 }}>
                  {d.excerpt || "Empty document"}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <Link className="btn secondary" href={`/editor/${d.id}`}>
                    Open
                  </Link>
                  {d.shareSlug && (
                    <a className="btn secondary" href={`/s/${d.shareSlug}`} target="_blank">
                      View
                    </a>
                  )}
                  <button className="btn danger" onClick={() => remove(d.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <NewDocumentModal
          busy={creating}
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </>
  );
}
