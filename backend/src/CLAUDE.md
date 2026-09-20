# backend/src/ — layer layout

Scope: everything under `backend/src/`.

```
src/
  server.ts       entrypoint — starts HTTP listener
  app.ts          express app — middleware + router mounting
  config/         env validation, Prisma client singleton
  middleware/     auth, error formatting
  modules/        feature code (routes + services), see modules/CLAUDE.md
  scripts/        standalone tsx scripts, not part of the HTTP request path
  utils/          pure helpers shared across modules
```

## Request lifecycle

1. `cors` + `express.json({ limit: '1mb' })` run first in `app.ts`.
2. Router for the matching path prefix runs (`/auth`, `/files`, `/uploads`, ...).
3. Inside a protected router, `requireAuth` middleware validates the bearer JWT and attaches `req.user`.
4. Handler validates input with Zod, talks to Prisma (`config/prisma.ts`) and/or a provider service (Google, S3), and returns JSON.
5. Any thrown/passed error reaches `error.middleware.ts` last — this is the only place responses get their `{ code, message }` shape.

## Adding a helper

- Cross-module pure logic → `utils/`.
- Anything Google/S3/provider-account specific → keep it in the owning module's `.service.ts`, not `utils/` — provider logic is intentionally kept co-located with its module per `AGENTS.md`.
