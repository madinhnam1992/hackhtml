"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

function CallbackInner() {
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    const errParam = params.get("error");
    if (errParam) {
      setError("OAuth login failed: " + errParam);
      return;
    }
    if (!token) {
      setError("Missing token");
      return;
    }
    loginWithToken(token)
      .then(() => router.replace("/dashboard"))
      .catch(() => setError("Could not complete sign-in"));
  }, [params, loginWithToken, router]);

  return (
    <div className="container">
      {error ? (
        <p className="error">
          {error}. <a href="/login">Back to login</a>
        </p>
      ) : (
        <p style={{ color: "var(--muted)" }}>Completing sign-in…</p>
      )}
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="container">Loading…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
