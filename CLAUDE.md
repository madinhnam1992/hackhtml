# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A HackMD-style web app for storing and editing HTML and Markdown documents, with live preview,
public share links, and accounts (email/password + Google/GitHub OAuth2). Two services: a Spring
Boot 4 / Java 21 backend and a Next.js 15 (App Router) frontend, backed by MongoDB (metadata) and
MinIO (content blobs).

## Commands

Full stack (from repo root):

```bash
cp .env.example .env        # first time only
docker compose up --build   # MongoDB + MinIO + minio-init + backend + frontend
```

Backend (`backend/`, needs Java 21 + Maven, plus running MongoDB + MinIO):

```bash
mvn spring-boot:run         # run on :8080
mvn test                    # all tests
mvn test -Dtest=JwtServiceTest                       # one test class
mvn test -Dtest=JwtServiceTest#methodName            # one test method
mvn package                 # build jar
```

Frontend (`frontend/`):

```bash
npm install
npm run dev                 # dev server on :3000
npm run build               # production build (also the best type-check)
npm run lint                # next lint
```

There is no frontend test suite. Ports: app `:3000`, API `:8080`, MinIO S3 `:9000` / console `:9001`,
MongoDB `:27017`.

## Architecture: metadata/content split

This is the central design decision and it shapes everything. A document's **metadata** (title,
owner, visibility, share slug, content type, version counter, excerpt) lives in MongoDB as a
`Document`. The actual **content** lives in MinIO under versioned keys: `documents/{id}/v{n}.{ext}`.

- Every content write goes through `DocumentService.updateContent(...)`, which bumps the version,
  writes a *new* MinIO object, and updates `currentVersionKey` on the Mongo doc. Old versions are
  left in place (groundwork for version history); they are deleted only when the whole document is.
- `StorageService` is the single choke point for all MinIO reads/writes (`putText`/`getText`/`delete`).
  Keep it that way — a future real-time/collab layer is meant to reuse this contract.
- List views (`Summary`) read only Mongo (including the precomputed `excerpt`) and never touch MinIO,
  so the dashboard is cheap. Detail views (`Detail`) read the blob via `readContent`.

## Backend layout (`com.hackhtml`)

Package-by-feature. Each feature folder holds its entity, repository, service, controller:
`document/`, `user/`, `security/`, `storage/`, `config/`, `dto/`, `common/`.

- **Auth is stateless JWT.** `JwtAuthFilter` reads the `Bearer` token and sets the **userId string**
  as the Spring Security principal. Controllers receive it via `@AuthenticationPrincipal String userId`
  (may be null → call `requireAuth`). There is no `UserDetails` object in the security context.
- **Permission logic lives in `DocumentService`** (`canView`/`canEdit`), not in annotations. Rules:
  non-private docs are viewable by anyone (incl. anonymous, read-only); any authenticated user can
  edit a non-private doc; private docs are owner/collaborator only. The `collaborators` list and
  `Collaborator.Role` exist but are not yet wired into a sharing UI.
- **Public, unauthenticated access** goes through `PublicController` (`/api/public/**`) by share
  slug, separate from the authenticated `DocumentController` (`/api/documents/**`).
- **Security whitelist** (`SecurityConfig`): `/api/auth/**`, `/api/public/**`, `/actuator/**`,
  `/oauth2/**`, `/login/**` are open; everything else needs auth. CORS allows only `FRONTEND_URL`.
- **OAuth2 is conditionally enabled** — `oauth2Login` is only registered if Google or GitHub client
  credentials are configured. `OAuth2SuccessHandler` mints a JWT and redirects to the frontend.
- Config is bound via `AppProperties` (`@ConfigurationProperties`) from `application.yml`, which is
  driven by env vars (see `.env.example` / `docker-compose.yml`).

## Frontend layout (`frontend/src`)

Next.js App Router. Routes in `app/`: `dashboard/`, `editor/[id]/`, `s/[slug]/` (public viewer),
`login/`, `register/`, `oauth2/callback/`.

- **All API access goes through `lib/api.ts`** — a single typed `request()` helper that injects the
  `Bearer` token from `localStorage` (`hackhtml_token`) and the `api` object of endpoint methods.
  Don't call `fetch` directly elsewhere.
- **Auth state** is a React context in `lib/auth.tsx` (`AuthProvider` / `useAuth`). The OAuth2
  callback page receives a token in the URL and calls `loginWithToken`.
- **Editor** (`components/Editor.tsx`) is CodeMirror 6 with Editor / Split / Preview view modes.
  `Preview.tsx` renders HTML in a sandboxed iframe and Markdown via react-markdown (GFM,
  `rehype-sanitize`). Content auto-saves debounced through `api.saveContent`.
- **Design mode** (`components/GrapesEditor.tsx`, HTML only) is a GrapesJS visual editor. It works on
  a `{ html, css }` pair, while storage uses a single complete HTML document string. `lib/htmlDoc.ts`
  does the round-trip: `splitHtmlDoc` (stored string → parts), `combineHtmlDoc` (parts → stored
  string), `formatHtml` (js-beautify pretty-print before storing). Switching through Design therefore
  normalizes HTML formatting — expected, not a bug.
- **Export to PDF** (`lib/exportPdf.ts`): the frontend builds the print-ready HTML (`buildPrintDocument`,
  so Markdown renders exactly like `Preview.tsx`) and POSTs it to the backend, which uses headless
  Chromium (Playwright) to produce a PDF with a page-number footer — `POST /api/documents/{id}/pdf`
  (auth) or `POST /api/public/{slug}/pdf` (gated by a real share). The backend choke point is
  `document/PdfService.java` (pooled renderers cap concurrency; private-IP requests are blocked as an
  SSRF guard); config under `app.pdf.*`; the backend Docker image installs Chromium. If the server
  render fails, `exportToPdf` falls back to the old hidden-iframe `window.print()` path.
  - Two print gotchas the pipeline handles: `buildPrintDocument` injects print-only CSS that disables
    `backdrop-filter` (headless Chromium paints it as a black box with backgrounds on); and because the
    preview iframe is opaque-origin (no `allow-same-origin`), a postMessage bridge appended to its
    `srcDoc` in `Preview.tsx` lets the PDF path capture runtime root classes/lang (e.g. a language
    toggle that only sets a `<body>` class) so the PDF matches what's on screen.
- **Export menu** (`components/ExportMenu.tsx`, used by the editor and the public viewer) gathers all
  the ways out: download raw source (`.html`/`.md`), download rendered HTML (Markdown only, via
  `buildPrintDocument`), and Export PDF. Plain file downloads are client-only — `lib/download.ts`
  (`downloadBlob`/`downloadText`/`sourceFile`) builds a Blob from the already-loaded content; no
  backend round-trip.

## Conventions worth matching

- Content type is `HTML` or `MARKDOWN` (enum, uppercase) end to end; file extension derives from it
  (`html` / `md`).
- Visibility is `PRIVATE` / `UNLISTED` / `PUBLIC`. Setting non-private generates a unique `shareSlug`;
  setting `PRIVATE` clears it.
- Backend errors are thrown as `ApiException` (with static factories like `notFound`/`forbidden`) and
  rendered to JSON `{ message, ... }` by `GlobalExceptionHandler`; the frontend surfaces `data.message`.
