# CONTESTX

One calendar for **LeetCode, Codeforces and CodeChef** contests, with reminders that schedule themselves.

A background worker collects contest schedules from all three platforms every ~20 minutes, keeps them up to date (new rounds, moved start times, cancellations), and sends each user reminders at the times they chose (24 h, 1 h, 30 m, 15 m, 5 m before) by **email**, **browser push** and **in-app** notification. Nothing depends on a browser tab being open.

This is a contest discovery and notification product, not a judge.

---

## Contents

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Contest sources](#contest-sources)
- [How reminders work](#how-reminders-work)
- [Notification providers](#notification-providers)
- [Deployment](#deployment)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Status and known limits](#status-and-known-limits)

---

## Quick start

Requirements: Node 22+, PostgreSQL 14+.

```bash
npm install                      # also runs `prisma generate`
cp .env.example .env             # then fill in SESSION_SECRET (and optionally email/push keys)
npx prisma migrate deploy        # create tables
npm run dev                      # web app on http://localhost:3000
npm run worker                   # in a second terminal: sync + reminder worker
```

Check that live fetching works from your network:

```bash
npm run sync:once
# LEETCODE    SUCCESS  fetched=4 new=4 ...
# CODEFORCES  SUCCESS  fetched=37 new=37 ...
# CODECHEF    SUCCESS  fetched=9 new=9 ...
```

Make yourself an admin by putting your email in `ADMIN_EMAILS` before registering, or run `npm run db:seed` afterwards.

**Sample data (development only).** `npm run db:seed:sample` inserts a handful of contests named "Sample …". They are stored with `isSample = true`, carry a *Sample data* badge everywhere in the UI, are excluded from calendar feeds and analytics, and the script refuses to run when `NODE_ENV=production`. Remove them with `npm run db:seed:sample -- --remove`.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js web app |
| `npm run worker` | Long-running worker: contest sync + reminder delivery |
| `npm run sync:once` | Fetch all three platforms once and print the result |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | Browser tests (Playwright) against a running server |
| `npm run vapid:generate` | Create Web Push keys |
| `npm run db:migrate` | `prisma migrate deploy` |

---

## Architecture

```
               ┌──────────────── Next.js (App Router) ─────────────────┐
 browser ────▶ │ pages: / /dashboard /contests /calendar /analytics    │
               │        /reminders /settings /login /register /admin   │
               │ API:   auth, bookmarks, preferences, push, ics feed,  │
               │        health, cron/tick, admin/sync                  │
               └───────────────────────────┬───────────────────────────┘
                                           │ Prisma (pg adapter, UTC)
                                     ┌─────▼─────┐
                                     │ PostgreSQL│  all state lives here
                                     └─────▲─────┘
                                           │
               ┌───────────────────────────┴───────────────────────────┐
               │ worker (npm run worker)  — or POST /api/cron/tick     │
               │  every 30 s: reconcile reminders → dispatch due ones  │
               │  every 20 min: sync providers (lease-protected)       │
               └──┬──────────────┬──────────────┬─────────────┬────────┘
                  │              │              │             │
            Codeforces API   CodeChef list   LeetCode GQL   Resend / Web Push
```

- **Next.js 16 (App Router) + TypeScript**, Tailwind CSS v4, Radix primitives styled in the shadcn pattern, Motion for UI animation, React Three Fiber + Drei for the landing scene, Recharts for analytics, Zod for every input.
- **PostgreSQL + Prisma 7** (driver adapter, no Rust query engine at runtime). Every connection is forced to `timezone=UTC`; timestamps are stored in UTC and converted only for display.
- **Auth**: email + password (scrypt), random 256-bit session tokens in an `HttpOnly; SameSite=Lax` cookie, only the token's SHA-256 is stored. State-changing API calls also reject cross-origin `Origin` headers. Login and registration are rate limited.
- **No secrets reach the client.** The only public key is the VAPID *public* key, which is designed to be public.

### Data model (prisma/schema.prisma)

| Model | Purpose | Key constraints |
|---|---|---|
| `User`, `Session` | accounts, sessions | unique email, unique calendar token |
| `Contest` | normalized contest | **unique (platform, providerContestId)**; `scheduleVersion` bumps when the start time moves |
| `ContestBookmark` | saved contests | PK (user, contest) |
| `ReminderPreference` | defaults: on/off, scope, offsets, platforms, channels | unique user |
| `UserContestPreference` | per-contest exclude / custom offsets | PK (user, contest) |
| `ScheduledReminder` | one row per user × contest × offset × channel × schedule version | **unique on all five** (idempotency) |
| `NotificationDelivery` | every delivery attempt and its result; in-app inbox | **unique (reminder, attempt)** |
| `ProviderSyncLog` | each sync: status, counts, attempts, error | |
| `PushSubscription` | browser push endpoints | unique endpoint |
| `WorkerHeartbeat` | worker liveness + job leases | |

The initial migration is `prisma/migrations/0001_init/migration.sql`.

---

## Contest sources

Each platform has its own adapter in `lib/providers/`, all producing the same normalized shape (provider ID, platform, name, UTC start, duration in seconds, URL, division/kind, source). Providers run independently: one failing never blocks the others.

| Platform | Source | Notes |
|---|---|---|
| Codeforces | `GET https://codeforces.com/api/contest.list?gym=false` | Official, documented API. Codeforces asks for at most one call per 2 s; we make one call per sync. |
| CodeChef | `GET https://www.codechef.com/api/list/contests/all?...` | No documented public API. This is the public, unauthenticated JSON that codechef.com/contests itself loads. |
| LeetCode | `POST https://leetcode.com/graphql` with the `upcomingContests` query | No documented public API. This is the public, unauthenticated GraphQL query the LeetCode site uses. |

We send a descriptive `User-Agent` (add your contact via `PROVIDER_CONTACT`), poll at most every 10 minutes (default 20), never log in, never bypass rate limits or access controls. **CodeChef's and LeetCode's endpoints are not official APIs and can change or be restricted without notice; review each site's terms before deploying publicly.** If either breaks, the adapter fails loudly, keeps the last good data and shows it as stale. An aggregator such as clist.by (API key required) could be added as another adapter.

Sync rules (`lib/sync/sync-provider.ts`):

- **Deduplicate** by (platform, provider contest ID); when a platform gives no ID, a deterministic `name-slug@date` key is used.
- **Changed start time** → `previousStartTime`, `scheduleChangedAt`, `scheduleVersion + 1`. The UI shows "Moved from …"; pending reminders are recalculated.
- **Removed contests**: an upcoming contest is marked cancelled only after it is missing from **two consecutive successful** syncs.
- **Failures** (network, 429, 5xx) retry with exponential backoff and jitter; 4xx and malformed responses fail immediately. A failed fetch is logged as `FAILED` and **never** treated as an empty schedule. An empty answer while upcoming contests are known is logged as `PARTIAL` and removes nothing.
- A database **lease** stops two workers syncing the same platform at once.
- Finished contests older than `PAST_CONTEST_RETENTION_DAYS` are pruned.

Freshness is shown on every contest page and in `/admin`; a platform is stale after three missed sync intervals.

---

## How reminders work

1. **Reconcile** (`lib/reminders/reconcile.ts`), every tick and whenever a user changes something: for every upcoming, non-cancelled contest that matches the user's platforms, scope (all contests or saved only) and exclusions, ensure one `ScheduledReminder` per offset × enabled channel exists. Channels the server can't deliver (no Resend key, no VAPID keys, no subscribed browser) are not scheduled. Offsets that have already passed when a contest is announced are skipped rather than sent late. Stale pending rows are cancelled; previously cancelled rows are revived.
2. **Claim** (`lib/reminders/dispatch.ts`): one SQL statement moves due rows to `PROCESSING` using `FOR UPDATE SKIP LOCKED`, so concurrent workers never take the same reminder. Rows stuck in `PROCESSING` for 5 minutes (crashed worker) are reclaimed.
3. **Check before sending**: contest not cancelled, schedule version unchanged, contest not started, user's preferences still allow it, and no successful delivery already recorded for this reminder.
4. **Send** through the channel, then **record** a `NotificationDelivery` row per attempt.
5. **Retry** transient failures (network, 429, 5xx) up to 5 attempts with backoff, never past the contest start; permanent failures are marked `FAILED` and shown in `/reminders` and `/admin`.

Why this survives the hard cases:

- **Restarts / redeploys**: all state is in Postgres; the worker loop only decides when to look. A reminder that came due during downtime is sent on the next tick, or recorded as skipped if the contest already started.
- **Duplicate workers**: `SKIP LOCKED` claiming, a unique key on reminders, a unique key on (reminder, attempt), lock-owner checks on every state change, and an `Idempotency-Key: reminder-<id>` header on Resend requests.
- **Rescheduled contests**: reminders are keyed on `scheduleVersion`; old pending rows are cancelled and new ones created.
- **DST**: offsets are subtracted from UTC instants; local wall time is only computed for display (see the DST tests).

Honest limits: if the worker crashes after a push service accepted a message but before the result was recorded, that one push can be sent again after the lock expires (email is protected by the Resend idempotency key). "Accepted by provider" is not the same as "read by the user": inbox placement and device delivery are outside our control, so the UI says *accepted* or *sent to push service*, not *delivered*.

Calendar: each user has a private, rotatable **iCal feed** (`/api/calendar/feed/<token>.ics`) with alarms at their reminder times. It works with Google Calendar ("From URL"), Apple Calendar and Outlook, and every contest has an "Add to Google Calendar" link and an `.ics` download. Two-way Google Calendar sync via OAuth is not implemented.

---

## Notification providers

### Email (Resend)

1. Create an account at resend.com and verify a sending domain (DNS records).
2. Create an API key with sending access.
3. Set `RESEND_API_KEY` and `EMAIL_FROM` (e.g. `ContestX <reminders@yourdomain.com>`; the domain must be verified).
4. Restart web and worker, then use **Settings → Send test email**. The result is logged on the Reminders page.

Without these the email channel shows "not configured" and no email reminders are scheduled.

### Browser push (Web Push / VAPID)

1. `npm run vapid:generate`
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (`mailto:you@domain`). Rebuild the web app; the public key is inlined at build time.
3. In **Settings**, click **Allow notifications in this browser**, then **Send test notification**.

Push needs HTTPS in production (localhost is allowed for development). On iOS it only works after adding the site to the home screen (iOS 16.4+). Expired subscriptions (404/410) are removed automatically.

---

## Deployment

You need three things: the **web app**, a **PostgreSQL** database, and a **persistent worker**.

### Docker Compose (single host)

```bash
cp .env.example .env   # set SESSION_SECRET, APP_URL, email/push keys
docker compose up --build -d
```

Runs Postgres, `web` (runs migrations, then `next start`) and `worker` from the same image.

### Platform-as-a-service (Railway, Render, Fly.io, …)

- **Web service**: build `npm ci && npm run build`, start `npx prisma migrate deploy && npm start`.
- **Background worker** (same repo, same env): start `npm run worker`. Run at least one; more are safe.
- **Postgres**: managed instance; set `DATABASE_URL`.

### Serverless web (e.g. Vercel) without a long-running process

Deploy the web app, then call the tick endpoint every minute from any scheduler (Vercel Cron, GitHub Actions, cron-job.org, a cloud scheduler):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/tick
```

The endpoint does one sync-if-due + reconcile + dispatch and is safe to call alongside a worker. A per-minute schedule means reminders can arrive up to a minute late.

### Health

`GET /api/health` returns 200 when the database is reachable and reports worker heartbeat age and provider freshness (`status: "degraded"` when the worker is down or a provider is stale). Point an uptime monitor at it. Logs are structured JSON (pino) on stdout.

---

## Testing

```bash
npm run typecheck
npm test                     # unit + integration (needs TEST_DATABASE_URL, a DB it may TRUNCATE)
npm run build && npm run test:e2e
```

- **Unit** (`tests/unit`): provider parsers against recorded response shapes (`tests/fixtures`, never loaded by the app), retry/backoff, timezone and DST handling, filters, calendar math, streaks, iCal output.
- **Integration** (`tests/integration`, real Postgres): sync create/update/reschedule/cancel/failure/empty-response/lease; reminder reconcile, idempotency, overrides, exclusions; dispatch exactly-once under three concurrent workers, retry with backoff, permanent failure, skip after start, crash recovery without resend, reschedule during send.
- **E2E** (`tests/e2e`, Playwright): landing, navigation, explorer filters/search, guest gating, register → settings → scheduled reminders → exclude → bookmark, calendar views and detail panel, Ctrl+K search, health, and no horizontal overflow on phones. Set `PW_CHROMIUM_PATH` to use a specific Chromium build.

---

## Project layout

```
app/                     pages and API routes
components/
  layout/                navbar, search dialog, footer, logo
  hero/                  3D orbital scene (lazy, WebGL fallback) and landing hero
  dashboard/             stats, featured next contest, upcoming list, next reminders
  contests/              card/row, filters, explorer, reminder and calendar actions
  calendar/              month / week / agenda views and detail panel
  analytics/             Recharts dashboards
  reminders/, settings/, auth/, admin/, ui/
lib/
  providers/             codeforces.ts, codechef.ts, leetcode.ts, http.ts (retry)
  sync/                  sync engine
  reminders/             reconcile.ts, dispatch.ts
  notify/                email (Resend), push (web-push), templates
  jobs/tick.ts           one unit of background work (worker + cron endpoint)
  auth/, time.ts, calendar.ts, ics.ts, streaks.ts, participation.ts
prisma/                  schema, migration, seeds
worker/                  index.ts (long-running), sync-once.ts
types/contest.ts         client-safe shared types
tests/                   unit, integration, e2e, fixtures
```

---

## Status and known limits

All seven phases are implemented. What was and wasn't verified in the build environment:

- ✅ Typecheck, production build, 47 unit/integration tests and 15 Playwright tests pass.
- ✅ End-to-end reminder delivery verified with the real worker: a contest starting in ~6 minutes produced a 5-minute in-app reminder, sent exactly once.
- ⚠️ **Live platform fetching could not be exercised in the build environment** (no outbound access to the three sites). The adapters are tested against recorded response shapes; run `npm run sync:once` to confirm against the live sites on your network.
- ⚠️ The migration SQL was written by hand (Prisma's migration engine couldn't be downloaded there) and verified by the integration tests. Run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code` once (CI does this) to confirm there is no drift.
- Email and push were exercised up to the provider boundary (configuration checks, error paths, retries); sending real mail needs your Resend key and verified domain.
- CodeChef participation history has no usable public source, so analytics cover Codeforces and LeetCode only. Weekly activity uses Codeforces submissions.
- "Registration status" isn't shown: platforms don't expose it without your login, so cards link to the registration page instead.
- Two-way Google Calendar sync (OAuth) is not built; the subscribable iCal feed covers the same need read-only.
- Login rate limiting is per process; put a shared limiter in front if you run several web instances.
