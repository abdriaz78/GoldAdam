# Gold Adam CRM (MVP)

Bookings viewer + two-way sync for Gold Adam routes.

- **Web app** (Next.js + MongoDB): view bookings filtered by agent / route / date /
  status; mark a booking **Confirm / Cancel / Completed** (with notes) which queues a
  write-back.
- **Chrome extension** (`/extension`): runs inside the agent's logged-in
  `agent.goldadam.us` session, scrapes bookings into the CRM, and executes queued
  write-backs back into goldadam.

> Write-back currently runs in **dry-run** (logs intended clicks, changes nothing in
> goldadam) until goldadam's Confirm/Cancel/Complete UI is captured and the selectors
> in `extension/adapter.js` are filled in.

## Prerequisites
- Node 18+ and a MongoDB database (local `mongod` or MongoDB Atlas).

## Setup
```bash
cd goldadam-crm
npm install
cp .env.example .env        # then edit values
npm run seed                # creates the 45 routes + an admin user
npm run dev                 # http://localhost:3000
```
Log in with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

Optional — import the P0 CSV directly (without the extension):
```bash
npm run import:csv          # reads ../goldadam-bookings.csv
```

## Chrome extension (manual)
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
   select the `goldadam-crm/extension` folder.
2. Click the extension icon → enter **CRM URL** (`http://localhost:3000`) + your CRM
   login → **Sign in**.
3. Open `agent.goldadam.us` (VPN on, past the checkpoint). Use the on-page
   **Gold Adam CRM Sync** panel: enter route codes → **Sync routes** (scrapes each
   route's bookings into the CRM). **Run write-backs** executes queued status changes
   for the current route (dry-run until adapter is completed).

Useful as a fallback / for driving write-backs, but it requires a human to have
the site open and click "Sync". For unattended daily scraping, use the
headless scraper below instead.

## Headless scraper (unattended, `scraper/`)
Logs into goldadam with a saved browser session (no daily human interaction),
walks every route's bookings page, and pushes them into the CRM via the same
`/api/ingest` the extension uses — then triggers tomorrow's customer
confirmation texts. Session cookies live in `scraper/.auth/` (gitignored).

1. `npx playwright install chromium` (one-time, downloads the browser binary).
2. Create a dedicated CRM login for the scraper (don't reuse your personal
   admin account) — e.g. add a user via the admin UI, or seed one — and set
   `SCRAPER_CRM_EMAIL` / `SCRAPER_CRM_PASSWORD` in `.env`.
3. `npm run scraper:auth-setup` — opens a **visible** browser. With your VPN
   on, log into `agent.goldadam.us` with your Gmail account and approve the
   mobile push prompt. Once it detects you're logged in, it saves the session
   and exits. **Google's 2FA push can't be automated — this manual step is
   required the first time and again whenever the session eventually
   expires.**
4. `npm run scraper:run` — one-shot headless run, for testing.
5. `npm run scraper:start` — long-running process that fires the same run
   once a day on `DAILY_RUN_CRON` (default 7am). Run this under a process
   manager (Windows Task Scheduler, `pm2`, or a systemd unit once deployed to
   a VPS) so it survives reboots.

If the saved session has expired, a run sends **one** SMS to
`ALERT_PHONE_NUMBER` and stops — it does not retry or loop. Re-run
`scraper:auth-setup` to restore it.

Live write-back to goldadam (actually clicking Confirm/Cancel in their UI)
is not part of the headless scraper — that stays in the Chrome extension's
dry-run stub until goldadam's action UI is captured (see "What's next" below).

## Environment (`.env`)
| var | purpose |
|-----|---------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | token signing secret |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seeded admin login |

## Data model
`User, Agent, Route, RouteAssignment, Booking, WritebackCommand, SyncLog`
(see `src/lib/models`).

## Roles
- **admin** — sees all bookings; manages agents + route assignments.
- **agent** — sees only bookings for routes assigned to them.

Agents are linked to bookings via **Route Assignments** (agent → route → date),
because agents change routes day to day.

## What's next (post-MVP)
- Capture goldadam's action UI → implement live write-back in `extension/adapter.js`.
- Sponsored-tab stats (close rate, margin, delta/fake-gold %, profit) + dashboards.
- GoHighLevel SMS/call integration for the confirmation workflow.
- Per-agent CRM logins at scale + workflow builder.
