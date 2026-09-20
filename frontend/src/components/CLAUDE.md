# frontend/src/components/ — component tiers

Scope: `frontend/src/components/`. Three tiers, in order of preference when building a new UI piece:

1. `ui/` — generic, app-agnostic primitives (`Button`, `Card`, `Input`, ...). Reach here first.
2. `drive/` — drive-domain components (file/folder grids, context menus, drawers). See [drive/CLAUDE.md](drive/CLAUDE.md). Reach here when the UI is drive-specific but reused across more than one page.
3. `auth/` — auth-flow-specific components (e.g. `GoogleLogo.tsx`).

## Conventions

- Don't add a new `ui/` primitive if an existing one plus `cn(...)` composition (`frontend/src/lib/utils.ts`) covers the case.
- A component used by exactly one page can live inline in that page file; promote it to `drive/` only once a second page needs it.
- Keep Tailwind utility classes as the styling mechanism — no new CSS files or CSS-in-JS unless the task explicitly calls for a style-system change.
