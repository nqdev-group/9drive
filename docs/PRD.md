# Product Requirements Document: 9Drive

## 1. Executive Summary

9Drive is a self-hosted web app that consolidates multiple Google Drive and S3-compatible storage accounts into one dashboard, with the backend transparently routing and streaming uploads across whichever connected account has room. It is a working, deployed product (Docker Compose + VPS/PM2 deployment paths both exist in the codebase) rather than a concept — this PRD documents the product **as built**, reverse-engineered from the codebase, not a forward-looking proposal. Stakeholder/team/budget/timeline sections are marked "not applicable / not found in repo" rather than invented.

## 2. Problem Statement

- Free-tier cloud storage (Google Drive, and S3-compatible services with free tiers like R2/B2) is capped per account, and juggling several separate accounts/logins to get more effective storage is manual and error-prone: the user has to remember which account has space and re-authenticate into a different provider UI to upload there.
- Google Drive's own folder/sharing model doesn't compose well across *multiple* Drive accounts as one namespace — there's no native "combined quota" or single browsing surface.
- Programmatic upload into personal cloud storage from another system (a script, a backup job, another app) typically means embedding that provider's full OAuth/SDK credentials into the calling system — a broader blast radius than necessary for "just let this system upload files."

## 3. Solution Overview

- One authenticated dashboard in front of N connected Google Drive/S3 accounts, with the routing decision (which account gets the next upload) automated by policy instead of manual.
- A database-backed virtual folder layer decoupled from what each provider actually supports, so organization is consistent regardless of which account a file physically lives in.
- A scoped, revocable API key system so external tools can upload without ever holding Google/S3 credentials — they hold a 9Drive-issued key instead.

## 4. Target Audience

- **Primary:** technically comfortable individuals self-hosting 9Drive who already have (or are willing to create) multiple free/cheap Google Drive and/or S3-compatible storage accounts and want them to behave like one pool.
- **Secondary:** the same user's other systems/scripts that need to push files in programmatically via the external upload API.
- No multi-tenant/team pricing or org-account concepts exist in the schema (`User` has no `organizationId`/`teamId`); this is a single-user-per-deployment product today, with lightweight file/folder sharing to *other* 9Drive users bolted on via `WorkspaceInvite`.

## 5. Core Features

| Feature | User value | Business impact |
|---|---|---|
| Multi-provider connected accounts (Google Drive + S3) | One login, one UI, for storage spread across providers | Differentiator vs. using each provider's native app directly |
| Upload routing policies | Uploads "just work" without the user manually picking a target account | Removes the main daily-use friction of a multi-account setup |
| Virtual folders | Organize independent of provider limitations | Consistent UX regardless of backing provider |
| Direct streaming uploads/downloads | No server-side storage cost, no double-copy latency | Keeps hosting cheap; backend is a thin pipe, not a storage tier |
| Sharing (public links + invites) | Send a file to anyone, or grant another 9Drive user ongoing access | Basic collaboration without needing the target to have the same cloud provider account |
| External upload API + API keys | Automate uploads from other systems safely | Enables backup jobs / integrations without sharing real provider credentials |
| Self-service system update | Non-technical update path for a self-hosted deployment | Lowers the maintenance bar for a self-hoster running this on a VPS |

## 6. MVP Definition

Inferred from what is fully implemented and wired end-to-end today (this is describing the *current* shipped scope, not a future MVP proposal):

**In scope (shipped):**
- Auth (email/password + Google sign-in), Google Drive connect flow, S3-compatible connect flow.
- Upload with routing policy selection and direct streaming to the chosen provider.
- Virtual folders, file list/grid views, search, rename/move/delete.
- Preview/download streaming (with HTTP range support) for both providers.
- Public share links + preview tokens; workspace invites (viewer/editor) to other 9Drive users.
- Combined quota summary + per-account quota sync (Drive `about.get`, S3 bucket listing).
- API keys + external upload endpoint.
- Docker Compose deployment; VPS/PM2 self-update path.

**Out of scope (not found in the codebase):**
- Any admin/multi-tenant role model.
- Automated tests / CI pipeline.
- Background job/queue processing (everything is synchronous per-request).
- Real-time collaboration, file versioning, or trash/recycle-bin retention policy beyond soft-delete flags already in the schema.
- Usage-based billing or any payment integration.

## 7. Post-MVP Features

Not documented anywhere in the repo (no roadmap file, no `TODO`/`FIXME` inventory taken as part of this pass). Recorded here as **not found** rather than invented — see Open Questions in `Business-Document.md`.

## 8. Success Metrics & KPIs

Not instrumented in-app (no analytics/telemetry library present). If this product needs KPIs going forward, the natural ones given the domain are: upload success rate per provider, routing-policy distribution balance across connected accounts, quota-sync freshness (time since last successful sync per account), and system-update success rate — but these are recommendations based on the domain, **not** currently tracked metrics.

## 9. User Stories & Acceptance Criteria

1. **As a new user, I sign in with Google and immediately have working storage.**
   - AC: First-time Google sign-in creates a `User`, connects that Google account as a `ConnectedAccount`, and lands me in the dashboard with a nonzero quota shown after the background quota sync completes.
2. **As a user with two connected Drive accounts, I upload a file and don't have to think about which account it lands in.**
   - AC: With routing mode `most_available`, the file lands on whichever connected account currently has more free space; if neither has enough space for the file, the upload is rejected before any bytes are streamed.
3. **As a user, I organize files into folders that don't exist to my rename them.**
   - AC: Creating/renaming/moving a `Folder` never calls the Google Drive or S3 API — it is a MySQL-only operation, confirmed instant regardless of provider latency.
4. **As a user, I share a file publicly without giving away my storage credentials.**
   - AC: `POST /files/:id/share` returns a link that streams the file to an anonymous visitor via a hashed, revocable token — never the underlying Drive/S3 object URL or credentials.
5. **As a user, I invite a colleague who hasn't signed up yet.**
   - AC: The invite is created `pending`; once that email registers, the invite auto-resolves to `accepted` the next time `GET /invites` is called by either party (no separate "accept" action exists).
6. **As an external system, I upload a file into a user's 9Drive without OAuth.**
   - AC: `POST /api/v1/uploads` with `Authorization: Bearer <api key>` succeeds using the same routing/streaming path as the UI, and fails with `403` if the key lacks the `files:upload` scope or is revoked/expired.

**Edge cases confirmed handled in code:** upload rejected if `filesMeta` count doesn't match attached file parts is *not* explicitly verified — flagged in Open Questions in `Business-Document.md` as worth re-checking; concurrent uploads in one request reserve space per-account (`reservedBytesByAccount`) so two large files in the same request don't both get routed to an account that only has room for one.

## 10. Technical Requirements

- **Technology choices:** see `Business-Document.md` §2 and `AGENTS.md` for the authoritative, current stack list — not duplicated here to avoid drift.
- **Performance:** no explicit SLA/targets defined in the repo. Uploads/downloads are streamed (not buffered), which bounds backend memory use per request but means backend throughput is coupled 1:1 to upstream provider throughput.
- **Security requirements actually implemented:** Argon2 password hashing; JWT access tokens + hashed refresh tokens; encrypted-at-rest OAuth/S3 credentials (`TOKEN_ENCRYPTION_KEY`); hashed API keys/share/preview tokens; CORS restricted to `FRONTEND_URL`; one-time auth-handoff tokens instead of tokens-in-URLs for the Google redirect.
- **Scalability targets:** none defined. The synchronous, no-queue upload path (Business-Document §9, item 5) is the main structural scalability constraint if usage grows.
- **Integration requirements:** Google Drive API (OAuth2 + Drive v3), any S3-compatible API, optional Google reCAPTCHA.

## 11. Constraints & Dependencies

- **Technical constraints:** MySQL 8+ required; Google Cloud project + OAuth client required for Drive features; `TOKEN_ENCRYPTION_KEY`/`JWT_ACCESS_SECRET` must be ≥32 chars (enforced by Zod env schema) or the backend refuses to boot.
- **Business constraints:** none documented (no pricing/licensing constraints beyond the Apache-2.0 project license itself).
- **Resource constraints:** none documented — no team/roles file exists (see §12).
- **External dependencies:** Google Drive API availability/quotas; the S3-compatible provider's availability; `RECAPTCHA_SECRET_KEY` service if captcha is enabled.
- **Risk factors:** see `Business-Document.md` §9 Open Questions (SQLite-vs-MySQL backup/restore mismatch, no admin role tier, no automated tests, unbounded S3 quota-sync bucket listing cost).

## 12. Team & Roles

**Not found in the repository.** There is no `CODEOWNERS`, `CONTRIBUTORS`, or team-roster file. `git log`/`AGENTS.md` show a single primary author/maintainer pattern; this section is left as "not applicable" rather than guessed.

## 13. Timeline & Milestones

**Not found in the repository.** No roadmap, milestone tracker, or dated release plan exists in-repo. Migration timestamps in `backend/prisma/migrations/` (earliest `20260604...`, latest `20260630...`) show the schema evolved over roughly one month, which is the only timeline signal available from the codebase itself.

## 14. Budget Considerations

**Not applicable / not found.** This is a self-hosted open-source project (Apache License 2.0); no cost/ROI model exists in-repo. Real-world operating cost would be dominated by the MySQL/VPS host and any paid S3-compatible storage tier the user connects — no such cost model is tracked by the app itself.

## 15. Risks & Mitigation Strategies

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `/system/backup`/`/system/restore` silently no-op or corrupt state against MySQL (built for SQLite) | High (as-is, will not work against the current MySQL datasource) | High — false sense of having a working backup path | Reimplement against MySQL (`mysqldump`) or remove the endpoints until they do |
| No admin/authorization tier on system-level endpoints | Medium (only matters if ever run multi-tenant) | High if it occurs | Add an explicit admin check before `/system/*` if multi-tenant use is ever planned |
| No automated tests | High (already true) | Medium-High as feature surface grows | Prioritize tests around upload routing and Drive-sync reconciliation first — the two areas with the most edge-case logic |
| S3 quota sync lists entire bucket | Medium (grows with bucket size) | Medium (slow syncs, possible provider request-rate costs) | Cache per-prefix size or use provider-native usage APIs where available |
| Synchronous, non-queued upload/sync path | Low today, grows with usage | Medium (request timeouts under load) | Introduce a background job system if usage outgrows synchronous processing |

**Assumptions made while writing this PRD:** that the codebase at the time of analysis (2026-09-21, `AGENTS.md`/`CLAUDE.md` hierarchy already documenting a Yarn 4 + Turborepo monorepo) reflects the current intended architecture, and that undocumented gaps (team, timeline, budget, KPIs) are genuinely absent rather than tracked elsewhere outside this repository.

## 16. Glossary

See `Business-Document.md` §9 Glossary — kept in one place to avoid the two documents drifting apart.
