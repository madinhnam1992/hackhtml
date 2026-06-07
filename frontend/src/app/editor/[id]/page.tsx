"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth";
import { api, DocumentDetail } from "@/lib/api";

// CodeMirror touches the DOM, so load the editor only on the client.
const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

export default function EditorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .getDocument(id)
      .then(setDoc)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [user, id]);

  if (loading || (!doc && !error)) {
    return <div className="container">Loading…</div>;
  }
  if (error) {
    return (
      <div className="container">
        <p className="error">{error}</p>
        <a href="/dashboard">← Back to dashboard</a>
      </div>
    );
  }

  return <Editor initial={doc!} />;
}
