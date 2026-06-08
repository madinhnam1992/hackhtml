export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const TOKEN_KEY = "hackhtml_token";

export type ContentType = "HTML" | "MARKDOWN";
export type Visibility = "PRIVATE" | "UNLISTED" | "PUBLIC";

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  contentType: ContentType;
  visibility: Visibility;
  shareSlug: string | null;
  excerpt: string;
  version: number;
  updatedAt: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  contentType: ContentType;
  visibility: Visibility;
  shareSlug: string | null;
  content: string;
  version: number;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message || res.statusText || "Request failed";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/** Like request(), but for endpoints that return a binary body (e.g. application/pdf). */
async function requestBlob(path: string, body: unknown): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = res.statusText || "Request failed";
    try {
      message = (text ? JSON.parse(text)?.message : null) || message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.blob();
}

export const api = {
  register: (email: string, password: string, displayName: string) =>
    request<{ token: string; user: UserResponse }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: UserResponse }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<UserResponse>("/api/auth/me"),

  listDocuments: () => request<DocumentSummary[]>("/api/documents"),

  createDocument: (title: string, contentType: ContentType) =>
    request<DocumentDetail>("/api/documents", {
      method: "POST",
      body: JSON.stringify({ title, contentType }),
    }),

  getDocument: (id: string) => request<DocumentDetail>(`/api/documents/${id}`),

  saveContent: (id: string, content: string) =>
    request<DocumentDetail>(`/api/documents/${id}/content`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  updateMetadata: (id: string, title?: string, visibility?: Visibility) =>
    request<DocumentDetail>(`/api/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify({ title, visibility }),
    }),

  share: (id: string, visibility: Visibility) =>
    request<DocumentDetail>(`/api/documents/${id}/share`, {
      method: "POST",
      body: JSON.stringify({ visibility }),
    }),

  deleteDocument: (id: string) =>
    request<void>(`/api/documents/${id}`, { method: "DELETE" }),

  getPublic: (slug: string) =>
    request<DocumentDetail>(`/api/public/${slug}`),

  generateDocumentPdf: (id: string, html: string, title: string) =>
    requestBlob(`/api/documents/${id}/pdf`, { html, title }),

  generatePublicPdf: (slug: string, html: string, title: string) =>
    requestBlob(`/api/public/${slug}/pdf`, { html, title }),
};

export { ApiError };
