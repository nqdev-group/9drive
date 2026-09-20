# frontend/src/pages/ — route pages

Scope: `frontend/src/pages/`. One component per route registered in `App.tsx`.

## Pages

| Page | Notes |
|---|---|
| `AllFilesPage.tsx` | largest page in the repo — core file/folder UI: uploads, list/grid view, context menus, preview, share/invite modals |
| `SettingsPage.tsx` | second-largest — Google account connections, provider config, user settings |
| `QuotaTrackerPage.tsx` | connected-account quota view + manual quota sync |
| `SharedPage.tsx` | shared links + invites received/sent |
| `PublicFilePage.tsx` | public (unauthenticated) shared-file viewer/embed — do not wrap in `ProtectedRoute`/`DriveLayout` |
| `GoogleAuthPage.tsx` / `GoogleConnectedPage.tsx` | Google OAuth handoff/callback landing pages |
| `LoginPage.tsx` / `RegisterPage.tsx` | public auth pages |
| `ActivityLogPage.tsx` | audit log viewer |
| `ApiManagementPage.tsx` | API key management for `public-api` |
| `RecentPage.tsx`, `StarredPage.tsx`, `ArchivedPage.tsx`, `TrashPage.tsx` | filtered file views, thin wrappers over the same file-list components `AllFilesPage` uses |

## Conventions specific to this directory

- Filtered list pages (`RecentPage`, `StarredPage`, `ArchivedPage`, `TrashPage`) should reuse the file/folder list components from `components/drive/`, not duplicate `AllFilesPage`'s rendering logic — if a new filtered view needs `AllFilesPage`-only behavior, that behavior likely belongs in a shared component instead.
- Anything reading/writing `folderId` or search `q` must go through the URL query string (see `frontend/CLAUDE.md`), so pages stay linkable and back/forward-safe.
- Public pages (`LoginPage`, `RegisterPage`, `PublicFilePage`, Google handoff pages) must not assume an authenticated session is present.
