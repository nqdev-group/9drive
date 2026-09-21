# backend/prisma/ — schema and migrations

Scope: `backend/prisma/`. This is the only place the MySQL schema is defined; see `AGENTS.md` → Database rules for the top-level do's/don'ts.

## Files

- `schema.prisma` — single schema file, 16 models (`User`, `File`, `Folder`, `ConnectedAccount`, `FileShare`, `FilePreviewToken`, `UploadSession`, `WorkspaceInvite`, `AuditLog`, `ApiKey`, `ProviderConfig`, `OauthState`, `S3StorageConfig`, `StorageAccount`, `UploadRoutingPolicy`, `UserSession`).
- `migrations/` — one timestamped folder per migration (`<YYYYMMDDHHMMSS>_<name>/migration.sql`), applied in order. Treat every existing folder as immutable history.

## Naming conventions used throughout this schema (follow them for new models/fields)

- Model names: `PascalCase` singular (`ConnectedAccount`, not `ConnectedAccounts`).
- Every model maps to a `snake_case` plural table via `@@map("...")` (e.g. `ConnectedAccount` → `connected_accounts`).
- Fields are `camelCase` in Prisma and mapped to `snake_case` columns only where they diverge (see `@map("password_hash")` on `User.passwordHash`); fields that are already single words don't need an explicit `@map`.
- Foreign-key-style fields end in `Id` (`userId`, `folderId`, `connectedAccountId`).

## Indexing conventions (see `AGENTS.md` — "Add indexes for new common filters before relying on them in hot paths")

- Every model with a `userId` gets at minimum `@@index([userId])` — this schema does it on every user-owned table.
- Composite indexes are added to match actual query filters/sort order, not added speculatively — e.g. `File` has `@@index([userId, status, folderId, createdAt])` because the file-list endpoint filters by owner+status+folder and sorts by date.
- Uniqueness that spans multiple columns uses `@@unique([...])` with an explicit `map:` name once the field list gets long (see `WorkspaceInvite`'s `workspace_invites_target_unique`) so the generated constraint name stays readable in MySQL error messages.

## Workflow for a schema change

1. Edit `schema.prisma` only — never hand-edit a generated migration or the Prisma client output.
2. `cd backend && npm run prisma:migrate` (wraps `prisma migrate dev`) to generate + apply a new timestamped migration folder and regenerate the client.
3. `cd backend && npm run build` to typecheck against the regenerated client.
4. Do not edit or delete a migration folder that has already been merged/applied elsewhere — add a new migration instead, even to fix a mistake in a previous one.
