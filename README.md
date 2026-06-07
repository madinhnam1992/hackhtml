# hack-html

A HackMD-style web app for storing and editing **HTML** and **Markdown** documents, with a live
preview, public share links, and accounts (email/password + Google/GitHub OAuth2).

## Stack

| Layer        | Tech |
|--------------|------|
| Frontend     | Next.js (App Router, TypeScript), CodeMirror 6, react-markdown |
| Backend      | Spring Boot 4.x (Spring Framework 7, Java 21) |
| Metadata DB  | MongoDB |
| Content blobs| MinIO (S3-compatible object storage) |
| Auth         | JWT (email/password) + OAuth2 (Google / GitHub) |

Document **metadata** (title, owner, visibility, share slug, version) lives in MongoDB, while the
actual document **content** is stored in MinIO under versioned keys (`documents/{id}/v{n}.{ext}`).
This separation keeps large content out of the DB and lays the groundwork for version history and
future real-time collaboration.

## Quick start (Docker Compose)

```bash
cp .env.example .env       # adjust secrets if you like
docker compose up --build
```

Then open:

- App: http://localhost:3000
- Backend health: http://localhost:8080/actuator/health
- MinIO console: http://localhost:9001 (default `minioadmin` / `minioadmin`)

The `minio-init` container creates the `documents` bucket automatically on first run.

## Features

- **Editor + live preview** — CodeMirror editor with **Editor / Split / Preview** view modes; the
  split view has a draggable divider. HTML renders in a sandboxed `<iframe>`; Markdown renders via
  react-markdown (GFM, sanitized with `rehype-sanitize`).
- **Design mode (HTML only)** — a visual editor powered by GrapesJS: edit text inline (double-click),
  drag elements either to reorder within the flow (**Flow**) or to position them freely (**Absolute**),
  and drop in basic blocks. Edits round-trip with the code editor and save as a complete HTML file.
  Note: switching through Design normalizes the HTML formatting.
- **Auto-save** — content saves automatically (debounced) and via an explicit Save button.
- **Export to PDF** — the **Export PDF** button (in the editor and the public viewer) renders the
  document into a hidden iframe and opens the browser's print dialog ("Save as PDF"). Full fidelity
  with selectable text and no extra dependencies; works for both HTML and Markdown.
- **Create dialog** — "New document" opens a modal to set the name, format (HTML default / Markdown),
  and visibility (Private / Public).
- **Rename inline** — click a document's name on the dashboard card or in the editor title bar to
  edit it (auto-saves); there's no separate rename button.
- **Public share links** — set a document to *Unlisted* or *Public* to get a `/s/{slug}` link.
  Anonymous visitors can **view** it read-only; **signed-in** users can also **edit** it (the share
  page shows an Edit button when you're logged in).
- **Accounts** — register with email/password, or sign in with Google/GitHub.

## OAuth2 setup (optional)

OAuth2 is disabled until you provide credentials. Add them to `.env`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

Configure the provider redirect URI as:

```
http://localhost:8080/login/oauth2/code/google
http://localhost:8080/login/oauth2/code/github
```

> Note: GitHub's default scope may not expose a public email. If a user's email is private the
> OAuth login is rejected with `?error=no_email`; widening the scope / calling the emails API is a
> future enhancement.

## Project layout

```
backend/    Spring Boot 4 API (auth, documents, MinIO storage)
frontend/   Next.js app (dashboard, editor, public viewer)
docker-compose.yml
```

## Future: real-time collaboration

The design is collaboration-ready: documents carry a `collaborators` list with roles, all content
writes funnel through `DocumentService.updateContent(...)` / `StorageService`, and MinIO versioned
keys act as periodic snapshots. A WebSocket/Yjs (CRDT) layer can be layered on top later without
changing the storage model.

## Local development without Docker

- Backend: `cd backend && mvn spring-boot:run` (needs Java 21 + Maven, plus running MongoDB + MinIO).
- Frontend: `cd frontend && npm install && npm run dev`.

Set the env vars from `.env.example` accordingly.
```
