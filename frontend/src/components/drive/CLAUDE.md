# frontend/src/components/drive/ — drive-domain UI

Scope: `frontend/src/components/drive/`. The largest component folder in the repo; shared by `AllFilesPage` and the filtered list pages (`RecentPage`, `StarredPage`, `ArchivedPage`, `TrashPage`).

## Components

| Component | Purpose |
|---|---|
| `FileTable.tsx` | largest file — list-view file rows (sort, select, inline actions) |
| `FileGrid.tsx` / `FolderGrid.tsx` | grid-view tiles for files/folders |
| `FileContextMenu.tsx` / `FolderContextMenu.tsx` / `EmptyAreaContextMenu.tsx` | right-click menus — preview/download/rename/move/share/invite/delete actions live here |
| `FileDetailsDrawer.tsx` | side-drawer with file metadata/sharing details |
| `FolderVisual.tsx` | folder icon/color rendering |
| `FileIcon.tsx` | file-type icon resolution |
| `AvatarStack.tsx` | overlapping avatar group (shared-with indicators) |
| `MetricCard.tsx` / `PageHeader.tsx` | small layout primitives specific to drive pages |
| `BrandLogo.tsx` | app logo used in sidebar/header |
| `DummyModal.tsx` | placeholder/example modal — check before reusing whether it's still a stub |

## Conventions specific to this directory

- File-type icon and preview-type decisions should call into `frontend/src/lib/preview.ts` rather than re-deriving MIME/extension logic locally.
- Context menu actions call the same `apiFetch`-based helpers used by `AllFilesPage` — a new destructive action (delete/move) needs a confirmation step consistent with the existing menus, not a new pattern.
- Grid and table views must stay behaviorally in sync (same set of available actions) since users can toggle between them on the same page.
