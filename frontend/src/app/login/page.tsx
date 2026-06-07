"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap card">
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div style={{ margin: "16px 0", textAlign: "center", color: "var(--muted)" }}>or</div>
      <div style={{ display: "flex", gap: 10 }}>
        <a className="btn secondary" style={{ flex: 1, textAlign: "center" }}
           href={`${API_BASE}/oauth2/authorization/google`}>
          Google
        </a>
        <a className="btn secondary" style={{ flex: 1, textAlign: "center" }}
           href={`${API_BASE}/oauth2/authorization/github`}>
          GitHub
        </a>
      </div>

      <p style={{ marginTop: 18, textAlign: "center" }}>
        No account? <Link href="/register">Create one</Link>
      </p>
    </div>
  );
}
