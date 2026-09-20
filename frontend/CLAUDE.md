# frontend/ — Vite/React dashboard

Scope: everything under `frontend/`. See root `AGENTS.md` for the full stack list, env vars, and API route index this UI consumes — this file only adds frontend-local detail not already there.

## Build/run

- `npm run dev` — Vite dev server with HMR.
- `npm run build` — typecheck + production build; **required check before considering a frontend task done** (see AGENTS.md Verification).
- `npm run preview` — serve the production build locally.
- `VITE_API_URL` / `VITE_RECAPTCHA_SITE_KEY` are embedded **at build time** — changing either requires a rebuild, not just a restart (this matters for the Docker image too).

## Directories

- `src/main.tsx` — React entrypoint.
- `src/App.tsx` — all route registration; see [src/CLAUDE.md](src/CLAUDE.md).
- `src/layouts/` — `DriveLayout.tsx` is the protected app shell (sidebar, header search, storage stats).
- `src/pages/` — one file per route; see [src/pages/CLAUDE.md](src/pages/CLAUDE.md).
- `src/components/` — `auth/`, `drive/`, `ui/` tiers; see [src/components/CLAUDE.md](src/components/CLAUDE.md).
- `src/lib/` — `api.ts` (fetch wrapper + token refresh), `auth.ts` (session storage), `plyr.ts`, `preview.ts`, `gravatar.ts`, `utils.ts` (`cn` helper).
- `src/context/` — React context providers.

## Local conventions

- Use the `@/*` path alias for anything under `frontend/src` instead of relative `../../..` chains.
- Use `apiFetch` (`src/lib/api.ts`) for normal JSON calls; drop to raw `fetch`/`XMLHttpRequest` only when you need streaming, blob responses, or upload progress events.
- Token refresh/session logic is centralized in `src/lib/api.ts` + `src/lib/auth.ts` — do not add a second place that reads/writes the access or refresh token.
- Reuse `Button`, `Card`, `Input` from `src/components/ui/` before adding a new primitive.
- Keep protected pages inside `ProtectedRoute` + `DriveLayout`; don't render dashboard pages outside that shell.
- Navigation state that affects what's on screen (`folderId`, search `q`) belongs in the URL query string, not local-only state, so back/forward and shared links work.
