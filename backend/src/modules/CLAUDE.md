# backend/src/modules/ — feature modules

Scope: everything under `backend/src/modules/`. Each subfolder is one feature, mounted once in `backend/src/app.ts`.

## Pattern

- `<feature>.routes.ts` — Express router: Zod validation + handlers, exported and mounted in `app.ts`.
- `<feature>.service.ts` — present when the module talks to an external provider (Google, S3) or has logic reused by more than one route; absent for simple CRUD modules.
- A new feature always means a new folder here + one new `app.use('/<prefix>', xRouter)` line in `app.ts` — routers are never merged into an existing unrelated module.

## Module index

| Module | Mount | Purpose |
|---|---|---|
| `auth/` | `/auth` | register/login, JWT issue/refresh, Google sign-in handoff |
| `provider-configs/` | `/provider-configs` | encrypted global Google OAuth client config |
| `connected-accounts/` | `/connected-accounts` | per-user connected Google Drive accounts, quota sync |
| `storage/` | `/storage` | combined quota summary/breakdown across connected accounts |
| `uploads/` | `/uploads` | multipart upload intake, routes to an account with free space — see [uploads/CLAUDE.md](uploads/CLAUDE.md) |
| `files/` | `/files` | file records, share links, preview/download streaming, Google sync — see [files/CLAUDE.md](files/CLAUDE.md) |
| `folders/` | `/folders` | virtual (DB-only) folder tree |
| `invites/` | `/invites` | inviting other users to files/folders |
| `api-keys/` | `/api-keys` | user-issued API keys for `public-api/` |
| `public-api/` | `/api` | external API surface authenticated by API key, not JWT |
| `public/` | `/public` | unauthenticated shared-file endpoints (token-verified, not `requireAuth`) |
| `audit-logs/` | `/audit-logs` | activity log read endpoints |
| `system/` | `/system` | admin/system-level endpoints |
| `s3/`, `google/` | — | provider service modules only, no routes/mount of their own |

## Local conventions

- Public-token routes (`public/`, preview links) never use `requireAuth`; they instead verify a token hash + status + expiry inside the handler — do not add auth middleware to these.
- Keep new Google-specific behavior inside `google/google.service.ts` or the owning module's service file, not scattered across route files.
