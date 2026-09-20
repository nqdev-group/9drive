# frontend/src/ — source layout

Scope: everything under `frontend/src/`.

```
src/
  main.tsx        React entrypoint
  App.tsx         route registration (only place routes are declared)
  style.css       Tailwind import + globals
  layouts/        DriveLayout (protected app shell)
  pages/          one file per route, see pages/CLAUDE.md
  components/     auth/ drive/ ui/ tiers, see components/CLAUDE.md
  context/        React context providers
  lib/            api client, auth/session storage, formatting helpers
  data/           static/reference data
  assets/         static assets bundled by Vite
```

## Adding a new route

1. Create the page component in `pages/`.
2. Register the route in `App.tsx` — this is the single source of truth for the route table, do not scatter `<Route>` declarations elsewhere.
3. Wrap it in `ProtectedRoute` + `DriveLayout` unless it's a public page (login/register/public share view).

## `lib/` responsibilities (don't reimplement these elsewhere)

- `api.ts` — `apiFetch` wrapper, automatic access-token refresh retry, response/byte formatting utilities.
- `auth.ts` — local storage of the auth session (access/refresh token, user).
- `preview.ts` — file preview URL/type resolution used by drive components and pages.
- `plyr.ts` — lazy-loads the video player library for media preview.
- `utils.ts` — `cn(...)` class-name merge helper (clsx + tailwind-merge).
