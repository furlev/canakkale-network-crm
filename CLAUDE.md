# CLAUDE.md

This file guides Claude Code when working in this repository.

## What this is

Production CRM of the Turkish media agency **Çanakkale Network** (live at `https://panel.canakkale.network`).
Next.js 16 App Router + React 19 + TypeScript + Prisma 5 + PostgreSQL. All UI text, comments, and commit
messages are in Turkish — keep that convention. **Pushing to `main` auto-deploys production** (DigitalOcean
App Platform); do feature work on a branch.

## Commands

- `npm run dev` — dev server on :3000 (`.claude/launch.json` has `crm-dev` / `crm-prod` configs). `npm run build` / `start` / `lint`. No test suite.
- `postinstall` runs `prisma generate`. Schema changes: `npx prisma migrate dev --name <name>` locally, commit the migration — prod runs `npx prisma migrate deploy` during the DO build.
- `node scripts/create-admin.mjs <email> <şifre> [isim]` — create/upsert an admin login.
- `node scripts/seed-dev.mjs` — local A/B/C test users + sample data.
- `node scripts/seed-news-sources.mjs` — seed AI news sources locally; in prod use `POST /api/admin/seed-sources` (Bearer `CRON_SECRET` or admin session, idempotent).
- `node scripts/test-vertex.mjs` — live Vertex smoke test (text + grounding + Imagen).
- `node scripts/prep-do-vertex.mjs` — packages local ADC into gitignored `do-vertex-credentials.json` for pasting into the DO env (`GOOGLE_VERTEX_CREDENTIALS_JSON`).

## Architecture

### Auth (custom JWT — not NextAuth)
`src/lib/auth.ts`: `jose` HS256 JWT signed with `AUTH_SECRET`, stored in `crm_session` httpOnly cookie, 7-day
expiry. Passwords are bcryptjs hashes on `User.password` (null = cannot log in).

### Request gating
`src/proxy.ts` intercepts everything: no session → 401 (API) or redirect to `/login`. `PUBLIC_PREFIXES` lists
routes that skip the session check (`/api/webhooks/`, `/api/cron/`, `/api/ai/generate-drafts`,
`/api/admin/seed-sources`, ...) — those routes MUST self-authenticate with a Bearer secret (compare via
`safeEqual` from `src/lib/secure.ts`). Add any new cron/webhook route to that list AND protect it yourself.

### RBAC (A/B/C)
`src/lib/permissions.ts`. `User.role` is source of truth: `admin`=A (Baş Yönetici, everything),
`editor`=B (Ekip Lideri/Muhasebe, everything except `/settings`), anything else=C (member, page allowlist
`C_ALLOWED`). `/editor-performance` is A/B only. Proxy enforces pages via `canAccessPath`; API routes enforce
themselves with `hasLevel` / `isAdmin` / `isLeaderOrAdmin`. Teams: `User.managerId` self-relation.

### Data model
`prisma/schema.prisma`, ~33 models — CRM core (Client/Project/Task/Invoice/Estimate/Expense/Lead...), media
ops (News, Tip, Subscriber, Advertiser, Newsletter, AdCampaign), RBAC-era (Warn, Budget, PaymentRequest) and
the AI engine (NewsSource, FeedItem, AiDraft). `Setting` is a key→JSON-value store: WordPress connection
(key `wordpress`) and fallback Gemini API key (key `ai`) live in the DB, edited on `/settings` — not in env.

### AI (Vertex / Gemini) — `src/lib/ai.ts`
Uses `@google/genai`. Text model `gemini-3.5-flash` (`AI_MODEL`); images `GOOGLE_IMAGE_MODEL` (default
`imagen-3.0-generate-002`). Client selection: if `GOOGLE_VERTEX_PROJECT` is set → Vertex mode
(`GOOGLE_CLOUD_LOCATION`, default `global`); credentials from `GOOGLE_VERTEX_CREDENTIALS_JSON` env-JSON
(prod, filesystem-less) or default ADC (`GOOGLE_APPLICATION_CREDENTIALS` file, local dev). Otherwise falls
back to `GEMINI_API_KEY` / Settings key `ai` (AI Studio). Changing the `ai` setting must call
`clearAiKeyCache()` (settings PUT does).

### AI news pipeline (draft queue — never auto-publishes)
`POST /api/ai/generate-drafts` (Bearer `CRON_SECRET` or B/A session, `maxDuration 300`):
1. `ingestAllSources()` (`src/lib/newsfeed.ts`) — hand-rolled RSS/Google News fetcher+parser, no AI; dedups by `guidHash`, `normalizeLink` strips tracking params; some sources need a browser UA (`needsUA`).
2. `recentUnusedItems` → `discoverTopics` (one AI call) → per topic: `factCheckTopic` (Google Search grounding; skipped below `minConfidence`, default 0.55) → `writeArticleFromTopic` → `analyzeArticle` (SEO/tags/social) → `generateArticleImage` (Imagen, returns **base64 data-URI** stored in `AiDraft.imageUrl` — large rows).
3. Draft lands as `AiDraft` status `pending` in the approval queue UI at `/ai-news`. Approve/reject stamps `reviewerId/reviewerName`; `POST /api/ai/drafts/[id]/publish` pushes to WordPress and sets `published`.

### WordPress bridge
`src/lib/wordpress.ts` calls the custom **cn-crm-connector** plugin REST API (default base
`/wp-json/cn-crm/v1`) with URL/apiKey from Setting `wordpress`. Plugin source lives in
`wordpress-plugin/canakkale-crm-connector/` (Version 1.1.1) — edit there, then re-zip/install on the WP site.
Inbound events: `POST /api/webhooks/wordpress?secret=<WEBHOOK_SECRET>`.

### Scheduled jobs (GitHub Actions, not in-app)
- `.github/workflows/cron.yml` — every 15 min → `/api/cron/check-tips` (IMAP tip mailbox) + `/api/cron/wp-sync` (respects the auto-fetch toggle in Settings).
- `.github/workflows/ai-news.yml` — 3x/day (05,10,16 UTC = 08,13,19 TR) → `generate-drafts`; manual `workflow_dispatch` with `count` input.
- Both need repo Actions secret `CRON_SECRET` (same value as app env) and variable `CRM_URL` (no trailing slash).

## Deploy & environments

- **Production**: DigitalOcean App Platform, spec in `.do/app.yaml` (region fra, repo `furlev/canakkale-network-crm`, `deploy_on_push: true` on `main`). Build: `npx prisma migrate deploy && npm run build`; health check `/login`.
- Env var NAMES (values live in DO console / local `.env`): `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `WEBHOOK_SECRET`, `GOOGLE_VERTEX_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_VERTEX_CREDENTIALS_JSON`, `GOOGLE_IMAGE_MODEL`, `GEMINI_API_KEY` (fallback), `IMAP_PASSWORD`, `SMTP_PASSWORD`; local-only: `GOOGLE_APPLICATION_CREDENTIALS` (ADC file path, in `.env.local`).
- `render.yaml` is an older Render blueprint — DigitalOcean is the active target.
- Local config: `.env` + `.env.local` (both gitignored). Unmerged local branches exist (`feature/crm-backend`, `feature/wp-ai`, `feature/connect-remaining-modules`, `backup-pre-rbac-main`); only `main` deploys.

## Gotchas

- Repo root contains gitignored secret files: `.env`, `.env.local`, `gcp-vertex-key.json`, `do-vertex-credentials.json`. Never commit, print, or paste their contents; keep them in `.gitignore`.
- The GCP org policy blocks service-account keys — prod Vertex auth is an `authorized_user` ADC JSON passed through `GOOGLE_VERTEX_CREDENTIALS_JSON` (see `scripts/prep-do-vertex.mjs`), not a SA key file.
- WordPress/AI runtime config is in the DB (`Setting`), so a fresh DB needs `/settings` filled in before WP sync or Settings-key AI works.
- API routes are NOT protected by page RBAC — every new route handler must check the session/level itself (see existing routes for the `getSession` + `isLeaderOrAdmin`/`isAdmin` pattern, `handleApiError` from `src/lib/api.ts`, zod schemas in `src/lib/schemas.ts`).
- `next-env.d.ts` and `tsconfig.tsbuildinfo` are gitignored build artifacts; `.claude/` is gitignored too.
