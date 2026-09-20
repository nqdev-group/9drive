# backend/src/modules/files/ — file records, sharing, streaming

Scope: `backend/src/modules/files/`. The largest and most cross-cutting backend module (largest route file in the repo). See `AGENTS.md` for the full `/files` route list.

## Files

- `file.routes.ts` — `fileRouter`, mounted at `/files`. CRUD, batch patch/delete, share link create/revoke, preview-token issue, Google sync trigger, view-url/download.
- `stream-file.ts` — small helper for piping a readable stream to the HTTP response.
- `stream-google-file.ts` — Google Drive-specific preview/download streaming (range requests, content-type passthrough) via `undici`.

## Conventions specific to this module

- `POST /files/sync-google` treats the Google Drive `9drive` folder as the source of truth: it creates missing MySQL rows, updates changed metadata, and marks DB rows deleted when the Drive file is gone. Do not add a code path that writes back to Drive from this sync — it is one-directional (Drive → DB).
- `GET /files/preview/:token` and the `/public/files/:token*` routes (in the `public` module) are unauthenticated by design — they verify the share/preview token's hash, status, and expiry instead of `requireAuth`. Never add `requireAuth` to these.
- Downloads/previews stream directly from Google Drive through the backend (`stream-google-file.ts`); files are never buffered fully into memory or written to local disk.
- `sizeBytes` and other `bigint` Prisma fields must be converted to strings before any `res.json(...)` in this module.
- Batch endpoints (`PATCH /files/batch`, `DELETE /files/batch`) operate on an array of IDs scoped to `req.user.id` — always re-filter by owner inside the query, never trust client-supplied IDs alone.
