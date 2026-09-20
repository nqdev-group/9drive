# backend/src/modules/uploads/ — upload intake and routing

Scope: `backend/src/modules/uploads/`. Second-largest route file in the repo; this is the only module that accepts `multipart/form-data`.

## Files

- `upload.routes.ts` — `uploadRouter`, mounted at `/uploads`. Exports `handleUpload(req, res, next)` in addition to the router for direct reuse (see `src/scripts/test-api-upload.ts`).

## Request shape (see `AGENTS.md` → API Notes → Uploads for the wire format)

- Metadata arrives first as a `filesMeta` JSON field (array of `{ fieldName, fileName, mimeType, sizeBytes, folderId? }|`), then file parts whose field names match `filesMeta[*].fieldName` (`file-0`, `file-1`, ...).
- Parsing is streaming (`busboy`), not buffered — a file's bytes must never be fully read into memory or written to local disk before being forwarded.

## Conventions specific to this module

- Before streaming a file, the handler picks a connected Google Drive account with enough free space from `connected-accounts`/`storage` quota data — this account-selection logic stays in this module (or its own service if it grows), not duplicated elsewhere.
- Enforce `MAX_UPLOAD_BYTES` (env) and per-account free-space checks *before* opening the upstream stream to Google, not after — rejecting mid-stream wastes the partial upload.
- All uploaded bytes go straight through to the Google Drive `9drive` root folder; virtual/app folders (`folders` module) are metadata-only and never touched by the actual upload stream.
- If a request declares more files in `filesMeta` than are actually attached (or vice versa), reject with a validation error rather than silently processing a partial set.
