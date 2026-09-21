@AGENTS.md

## Hierarchical guidance

This repo uses scoped `CLAUDE.md` files. When working inside a directory, read the most specific one first — it overrides/extends the root guidance above, which itself overrides/extends `AGENTS.md`.

- [backend/CLAUDE.md](backend/CLAUDE.md) — Express/TypeScript/Prisma API
  - [backend/src/CLAUDE.md](backend/src/CLAUDE.md) — layer layout (config/middleware/modules/scripts/utils)
    - [backend/src/modules/CLAUDE.md](backend/src/modules/CLAUDE.md) — feature-module pattern and module index
      - [backend/src/modules/files/CLAUDE.md](backend/src/modules/files/CLAUDE.md) — file records, sharing, preview/download streaming
      - [backend/src/modules/uploads/CLAUDE.md](backend/src/modules/uploads/CLAUDE.md) — multipart upload routing/streaming
  - [backend/prisma/CLAUDE.md](backend/prisma/CLAUDE.md) — MySQL schema conventions and migration workflow
- [frontend/CLAUDE.md](frontend/CLAUDE.md) — Vite/React/TypeScript dashboard
  - [frontend/src/CLAUDE.md](frontend/src/CLAUDE.md) — source layout (pages/components/lib/context/layouts)
    - [frontend/src/pages/CLAUDE.md](frontend/src/pages/CLAUDE.md) — route-level pages
    - [frontend/src/components/CLAUDE.md](frontend/src/components/CLAUDE.md) — component tiers (ui/drive/auth)
      - [frontend/src/components/drive/CLAUDE.md](frontend/src/components/drive/CLAUDE.md) — drive-specific UI (file/folder grids, context menus)

Do not duplicate `AGENTS.md` content into these files — extend it with directory-local detail only.
