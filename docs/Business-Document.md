# Business Documentation: 9Drive

## 1. System Overview

**9Drive** is a self-hosted storage gateway that unifies multiple cloud storage accounts — Google Drive **and** S3-compatible object storage (AWS S3, Cloudflare R2, MinIO, Wasabi, Backblaze B2, or any custom S3 endpoint) — into a single virtual storage dashboard for one user.

Rather than replacing Google Drive or S3, 9Drive sits in front of them: it streams uploads directly through its own backend into the connected storage accounts (never touching local disk), keeps a MySQL index of every file/folder for fast listing and search, and adds capabilities neither Google Drive nor a raw S3 bucket offers out of the box — a routing policy that automatically balances new uploads across multiple connected accounts, virtual folders that are independent of the underlying provider's folder structure, shareable links, and per-user API keys for programmatic uploads.

**Key features:**
- Unified dashboard across an arbitrary number of connected Google Drive and/or S3-compatible accounts.
- Direct server-side upload streaming (no temp files on the backend host) to either provider.
- Configurable upload routing: `most_available` (send to the account with the most free space), `round_robin`, or `priority` (explicit ordered list of accounts).
- Virtual, nested, database-only folders — independent of how files are actually organized inside Google Drive/S3.
- File preview, download, rename, move, delete, and shareable public links.
- Workspace invites: share a specific file or folder with another 9Drive user as `viewer` or `editor`.
- One-way sync (`POST /files/sync-google`) that reconciles MySQL's record of the Google Drive `9drive` folder with what's actually in Drive.
- External upload API (`POST /api/v1/uploads`) authenticated by user-issued, revocable API keys — lets other systems push files into a user's 9Drive programmatically.
- Email/password auth plus "Sign in with Google," which automatically connects the signing-in Google account as the user's first storage account.
- Self-service in-app system update (pulls latest code and restarts, intended for a single-tenant VPS deployment under PM2).

**Target users:** individuals or small teams who have storage spread across several free/cheap Google Drive and object-storage accounts and want one login, one file browser, and automatic load-balanced uploads across all of them — e.g. self-hosters stitching together several free-tier Drive/S3 accounts into one larger pool.

**Success metrics (inferred — not tracked in-app; see Open Questions):** successful upload rate, upload routing balance across connected accounts, Google/S3 quota-sync freshness, and system-update success rate.

## 2. Technical Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│  frontend/ (React+Vite) │  HTTPS │  backend/ (Express+TS)        │
│  - Dashboard UI          │◄──────►│  - REST API (/auth, /files,   │
│  - apiFetch + token      │        │    /uploads, /folders, ...)   │
│    refresh (lib/api.ts)  │        │  - Bearer JWT / API-key auth  │
└─────────────────────────┘        └───────────┬───────────────────┘
                                                 │ Prisma ORM
                    ┌────────────────────────────┼───────────────────────┐
                    │                             │                       │
              ┌─────▼─────┐              ┌────────▼────────┐    ┌────────▼────────┐
              │  MySQL 8   │              │ Google Drive API │    │ S3-compatible    │
              │ (file/user │              │ (googleapis)     │    │ storage          │
              │  index,    │              │ - OAuth2         │    │ (@aws-sdk/       │
              │  sessions, │              │ - Drive v3 files │    │  client-s3)      │
              │  quotas)   │              │ - streamed via   │    │ - streamed via   │
              └───────────┘              │   undici         │    │   lib-storage    │
                                          └──────────────────┘    └──────────────────┘
```

- **Monorepo:** Yarn 4 workspaces + Turborepo (`package.json`, `turbo.json`, `yarn.lock` at repo root). `backend` and `frontend` are the two workspaces; `yarn dev` / `yarn build` run both through Turbo.
- **Backend:** Express 5, TypeScript, Prisma 6 ORM over MySQL 8, Zod validation, JWT bearer auth (access + refresh tokens), Argon2 password hashing, Busboy for streaming multipart uploads, `googleapis` for Drive/OAuth, `@aws-sdk/client-s3` + `@aws-sdk/lib-storage` for S3-compatible storage, Undici for streaming Google file reads back to clients.
- **Frontend:** React 19, Vite 8, TypeScript, React Router 7, Tailwind CSS 4, lucide-react icons.
- **Persistence:** MySQL is the single source of truth for users, sessions, connected accounts, quota snapshots, file/folder metadata, shares, invites, API keys, and audit logs. Google Drive / S3 hold the actual file bytes.
- **Deployment:** Docker Compose (MySQL + backend + nginx-served frontend) for self-hosting, or a bare-metal/VPS + PM2 setup that supports in-app self-update (`/system/update`, see §7).

## 3. Domain Model

Core Prisma models (`backend/prisma/schema.prisma`), all owned by a `User` unless noted:

| Model | Purpose |
|---|---|
| `User` | Account record; email/password (Argon2) or Google-only (random password placeholder). |
| `UserSession` | One row per refresh token issued (hashed), tracks user agent/IP, revocation. |
| `AuthHandoff` | One-time, short-lived token used to hand a freshly-created session from the Google OAuth redirect back to the SPA without ever putting access/refresh tokens in a URL. |
| `ProviderConfig` | Encrypted global (or per-user) Google OAuth client ID/secret/redirect URI/scopes. |
| `OauthState` | CSRF state for an in-flight Google OAuth flow (`login` or account-connect), single-use. |
| `ConnectedAccount` | A connected storage account — `provider` is `google_drive` or `s3`; holds encrypted tokens (Drive) or a placeholder (S3, since S3 credentials live in `S3StorageConfig`). |
| `S3StorageConfig` | Per-connected-account S3 credentials (encrypted access/secret key), endpoint, bucket, prefix, region, quota. |
| `StorageAccount` | Cached quota snapshot (`totalBytes`/`usedBytes`/`availableBytes`) per connected account, refreshed by quota-sync. |
| `UploadRoutingPolicy` | One per user: `mode` (`most_available` / `round_robin` / `priority`) + `priorityAccountIds` + round-robin cursor. |
| `UploadSession` | Tracks an in-progress/resumable upload (folder target, size, status). |
| `File` | A file record: owner, connected account, provider file ID, folder, mime type, size, status (`active`/deleted), share fields. |
| `FileShare` | A public share link for a file (token hash, enabled flag). |
| `FilePreviewToken` | Short-lived token for the unauthenticated inline preview endpoint. |
| `Folder` | Virtual, nested folder (self-referencing `parentId`), soft-deleted via `deletedAt`. |
| `WorkspaceInvite` | Invite of another user (by email) to a specific file/folder as `viewer`/`editor`; unique per (inviter, invitee, target). |
| `ApiKey` | User-issued key for the external upload API — stores only a hash + prefix, one-time secret shown at creation. |
| `AuditLog` | Append-only activity record per user. |

**Indexing convention:** every user-owned table has `@@index([userId])`; composite indexes are added to match actual query filters (e.g. `File` has `@@index([userId, status, folderId, createdAt])` for the file-list endpoint). See `backend/prisma/CLAUDE.md` for the full convention.

## 4. Actors & Permissions

There is a **single user role** — 9Drive has no admin/member distinction. Every authenticated user:

- Fully owns and manages their own connected accounts, files, folders, routing policy, and API keys.
- Can invite another *existing or not-yet-registered* user (by email) to a specific file or folder as `viewer` or `editor` (`WorkspaceInvite`); invites for a not-yet-registered email stay `pending` until that email registers, at which point they resolve to `accepted` automatically the next time `GET /invites` runs.
- Can create a public, unauthenticated share link for any file they own (`FileShare` + `FilePreviewToken`), independent of the invite system.

**No role check gates the `/system/*` endpoints** (self-update, DB backup/download, DB restore/upload) beyond `requireAuth` — see Open Questions (§9) for why this matters in a multi-user deployment.

## 5. Business Workflows

### 5.1 Registration / Login
- Email/password: `POST /auth/register` (optional reCAPTCHA if `RECAPTCHA_SECRET_KEY` is set) → Argon2-hashes the password → issues a session (access JWT + opaque refresh token, refresh token stored only as a hash in `UserSession`).
- `POST /auth/login` verifies the password and issues a new session the same way.
- **Google sign-in** (`GET /auth/google/url` → Google consent → `GET /auth/google/callback`): finds-or-creates the `User` by email, upserts a `ConnectedAccount` (`provider: google_drive`) for the signing-in Google account, kicks off a best-effort quota sync, then redirects the browser to the frontend with a one-time `AuthHandoff` token in the query string — **never** an access/refresh token. The frontend calls `POST /auth/google/exchange` with that token to get real session tokens. This means a first-time Google sign-in *is* a registration **and** automatically connects that Google Drive account in one step.

### 5.2 Connecting additional storage accounts
- Additional Google Drive accounts: same OAuth dance as above but scoped to `connected-accounts/google/connect*`, attaching to the already-logged-in user instead of creating a session.
- S3-compatible accounts: user submits endpoint/bucket/region/credentials/prefix directly (no OAuth) via `connected-accounts`; credentials are encrypted at rest in `S3StorageConfig`. `testS3Connection` (a `HeadBucketCommand`) can validate credentials before saving.

### 5.3 Quota tracking
- `POST /connected-accounts/:id/sync-quota` refreshes one account's `StorageAccount` row — for Google Drive via the Drive `about.get` quota API, for S3 by paginating `ListObjectsV2` and summing object sizes (there is no native "quota" concept in S3, so *used* bytes is computed by listing the whole bucket — see Open Questions on cost at scale).
- `GET /storage/summary` sums `StorageAccount` rows across all of a user's connected accounts into one combined total/used/available figure shown on the dashboard.

### 5.4 Upload routing and streaming
1. Client sends `multipart/form-data` to `POST /uploads` (or `POST /api/v1/uploads` with an API key): a `filesMeta` JSON field describing each file, followed by the matching file parts.
2. For each file, `selectAccount(...)` (`backend/src/modules/uploads/upload.routes.ts`) picks a connected account per the user's `UploadRoutingPolicy`:
   - `most_available` — account with the largest free space (accounting for bytes already reserved by other files in the same request).
   - `round_robin` — cycles through eligible accounts using a persisted cursor.
   - `priority` — first account in the user's explicit ordered list that has enough space.
   An explicit `targetAccountId` in the request can override routing entirely.
3. The file is streamed straight from the incoming HTTP request to the destination provider (`uploadS3Object` / Google Drive `files.create` with a stream) — it is never buffered to local disk or fully loaded into memory.
4. A `File` row is created pointing at the provider's file ID; the file appears under whatever virtual `folderId` was requested (folders are database-only and never mirrored to the provider).

### 5.5 Virtual folders
- `Folder` is a self-referencing, soft-deleted tree stored entirely in MySQL — moving a file between folders never touches Google Drive/S3, since actual provider files all physically live at the storage root (Google Drive: the `9drive` folder).

### 5.6 Preview, download, and sharing
- `GET /files/:id/download`, `GET /files/:id/view-url`, `GET /files/preview/:token` stream bytes back through the backend (`stream-google-file.ts` for Drive with HTTP range support; `streamS3File` for S3, also range-aware).
- `POST /files/:id/share` creates a `FileShare` (public link) and/or `POST /files/:id/preview-token` a short-lived `FilePreviewToken`; both are looked up by **token hash**, never the raw token, and the public routes (`/public/files/:token*`) intentionally bypass `requireAuth`.

### 5.7 Sync from Google Drive
- `POST /files/sync-google` treats the Google Drive `9drive` folder as source of truth for physical files on that account: creates MySQL rows for files that exist in Drive but not in the DB, updates metadata that drifted, and marks DB rows deleted for files no longer present in Drive. It never writes back to Drive.

### 5.8 Sharing via invites
- `POST /invites` invites a user (by email) to a file or folder they own, as `viewer` or `editor`. If the invitee is already registered the invite is immediately `accepted`; otherwise it stays `pending` and is resolved the next time the invitee (once registered) or inviter loads `GET /invites`.

### 5.9 External upload API
- A user creates an `ApiKey` (`POST /api-keys`) scoped to `files:upload`; the raw secret (`9d_live_...`) is shown exactly once. External systems then call `POST /api/v1/uploads` with `Authorization: Bearer <secret>`, which reuses the exact same `handleUpload` handler and routing logic as the authenticated UI upload path.

### 5.10 Self-service system update
- From Settings, an authenticated user can trigger `POST /system/update`, which `spawn`s `update.sh` at the project root (git pull + rebuild, detached from the request) intended for a PM2-managed VPS deployment; `GET /system/update-log` tails the resulting log file. In the Dockerized deployment (no `git`/`update.sh` inside the container) this correctly short-circuits with instructions to update via `docker compose` on the host instead.

## 6. API & Integrations

See `AGENTS.md` → "API Notes" for the full, current endpoint list (kept there as the single source of truth so this document doesn't drift from it). Notable integration points:

- **Google Drive API** (`googleapis`) — OAuth2 + Drive v3 (`files.create`, `files.get` streamed via `undici`, `about.get` for quota).
- **S3-compatible object storage** (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`) — works against AWS S3 or any S3-compatible endpoint (MinIO, R2, Wasabi, B2) via `forcePathStyle`/custom `endpoint`.
- **Google reCAPTCHA** (optional) — server-side `siteverify` call gated by `RECAPTCHA_SECRET_KEY`; only active on email/password registration.
- **External upload API** (`/api/v1/uploads`) — 9Drive itself is the integration surface here, for other systems that want to push files in.

## 7. Configuration & Deployment

- **Environment variables:** see `AGENTS.md` → Backend "Environment" and Frontend "Environment" sections.
- **Local dev:** `yarn install` once at the repo root, then `yarn dev` (Turborepo runs both `backend` and `frontend` dev servers). MySQL must be running separately (or via `docker compose up mysql`).
- **Docker:** `docker-compose.yml` runs MySQL 8.4, the backend (port 4000), and the frontend built + served by nginx (host port 5173, with `VITE_API_URL`/`VITE_RECAPTCHA_SITE_KEY` baked in at image build time — changing either requires a rebuild).
- **VPS/PM2 deployment:** implied by the `/system/update` + `update.sh` self-update mechanism, which assumes the app runs from a git checkout with `git` available on the host, managed by PM2 (referenced in code comments/README) rather than containers.
- **Database migrations:** Prisma migrations only (`yarn workspace backend prisma:migrate`), see `backend/prisma/CLAUDE.md`.
- **Monitoring/logging:** none observed beyond `console.error`/`console.warn` calls and the `AuditLog` table; no external log aggregation or metrics/tracing integration found in the codebase.

## 8. Testing Strategy

- **No automated test suite exists** for either `backend/` or `frontend/` (no `*.test.*`/`*.spec.*` files in either workspace). This should be stated plainly rather than implied — see Open Questions.
- `backend/src/scripts/test-s3-connection.ts` and `test-api-upload.ts` are manual, developer-run verification scripts (via `yarn workspace backend test:s3` / `test:api-upload`), not part of any CI pipeline.
- The only documented verification process is the manual smoke-test checklist in `AGENTS.md` (register/login, connect Drive, sync quota, nested folders, search, upload, list/grid toggle, context-menu actions, shared page, public link) plus `npm run build` (TypeScript typecheck) for both workspaces before considering a change done.
- No load/performance testing artifacts were found.

## 9. Appendix

### Glossary
- **Connected account** — a Google Drive or S3-compatible storage account linked to a 9Drive user.
- **Routing policy** — the rule (`most_available` / `round_robin` / `priority`) used to pick which connected account receives a new upload.
- **Virtual folder** — a database-only folder; has no corresponding folder in the underlying storage provider.
- **Handoff token** — a one-time token used to move a freshly-created session from the Google OAuth redirect to the SPA without exposing real tokens in a URL.
- **9drive folder** — the fixed root folder name 9Drive creates inside a connected Google Drive account to hold all uploaded files.

### Open Questions (honest gaps found during analysis)
1. **`/system/backup` and `/system/restore` assume a SQLite file** (`getDatabaseFilePath()` strips `sqlite:`/`file:` prefixes and does `fs.renameSync` on a local `.db` file), but the actual datasource is MySQL (`schema.prisma` → `provider = "mysql"`, and `docker-compose.yml` runs a real MySQL container). As written, these two endpoints do not back up or restore the real database in the current architecture — needs a decision on whether to reimplement them against MySQL (`mysqldump`/`mysql` restore) or remove them.
2. **No authorization tier above "authenticated user"** — `/system/update`, `/system/backup`, `/system/restore`, and the global Google OAuth config endpoints (`/system/google-config`) are gated only by `requireAuth`, not any admin/owner check. In a single-tenant deployment this may be intentional (the one user *is* the admin), but if 9Drive is ever run multi-tenant this is a privilege-escalation risk worth flagging explicitly.
3. **No automated tests.** Confirmed by search — worth a decision on whether to invest in a test suite before further feature growth, especially around the upload-routing selection logic and the Google Drive sync reconciliation logic, both of which have several edge cases (concurrent uploads reserving the same account's space, partial Drive sync failures).
4. **S3 "quota" is computed by listing the entire bucket** (`syncS3Quota` pages through `ListObjectsV2` for every object) rather than a cheap metadata call — this could get slow/costly on large buckets; no caching/backoff strategy was found beyond the manual "sync quota" button.
5. **No queue/background-job system** exists in this codebase (checked backend/frontend/root `package.json` for `amqplib`, `kafka`, `bull`/`bullmq`, `celery`, `sqs`, `pubsub`, `redis` job-queue clients — none found). All work (including uploads and Drive sync) happens synchronously within the HTTP request lifecycle. Phase 4.5 queue detection result: **none detected**.
6. Success metrics/KPIs in §1 are inferred from what the product does, not from any in-app analytics — no telemetry/analytics library was found in either workspace.

### Analyzed Files (key files reviewed for this document)
- `AGENTS.md`, `README.md`, `docker-compose.yml`, root `package.json`/`turbo.json`
- `backend/prisma/schema.prisma` (all 16 models)
- `backend/src/app.ts`, `backend/src/modules/auth/auth.routes.ts`, `backend/src/modules/uploads/upload.routes.ts`, `backend/src/modules/files/*`, `backend/src/modules/storage/storage.routes.ts`, `backend/src/modules/s3/s3.service.ts`, `backend/src/modules/invites/invite.routes.ts`, `backend/src/modules/api-keys/api-key.routes.ts`, `backend/src/modules/system/system.routes.ts`, `backend/src/middleware/api-key.middleware.ts`
- `frontend/src/pages/*`, `frontend/src/components/drive/*`, `frontend/src/lib/*`

### Document Metadata
- **Generated:** 2026-09-21, via `/nqdev-codebase-analyst` (Phases 1–3, 4.5 auto-detection; Phase 4 specs not requested).
- **Reviewer:** unreviewed — generated directly from source analysis, cross-checked against `AGENTS.md`/`CLAUDE.md` where they existed.
