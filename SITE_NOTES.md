# agent.goldadam.us — site notes (recon 2026-09-02)

Recon done live via Playwright MCP against Paul Sandhu's account, VPN on.
Auth is Google OAuth via **Supabase** (`*.supabase.co/auth/v1/callback`) — not
a custom backend. Nav bar (all authenticated pages): **Bookings, Sales,
Sponsored, Parcels, Reports, CRM**.

## Bookings (`/bookings`) — unchanged from what the extension/userscript assume

- Shows **one route per day** (whatever was "started" that day via
  `/start/route`), not a route picker. Date nav via prev/next-day buttons;
  heading shows `"Weekday, Month D, YYYY"`.
- Route header: `"<CODE> (<index>)"` — the number is the route's **position in
  the /start/route list**, not a booking count. Then `"N Stops"` /
  `"M Total Bookings (P% · x/y handled)"`.
- Each **stop** is a card: name, time window, address, drive-time/distance to
  next stop, a Google Maps link (has lat/lng in the URL query string — cheap
  geocoding for free), and a `"N booking"` badge if it has any bookings.
  Clicking the stop expands it in place — no navigation.
- Each **booking** inside a stop shows: customer name, time window, status
  badge (`Pending`, `Cancelled`, ...), `mailto:` link (email), `tel:` link
  (phone), and free-text notes (e.g. `"left vm 09/01 SLH"`).
- **Pending** bookings show three action buttons: **"Start Purchase →"**,
  **"No Sell"**, **"No Show"** — NOT a "Confirm"/"Cancel" pair. goldadam's own
  UI has no customer-confirmation concept; that's entirely our own
  CRM+Twilio layer. `"Start Purchase"` begins a real transaction — confirmed
  dangerous for write-back, matches prior caution in memory.
- Handled bookings (cancelled/completed) instead show the outcome, an
  "Edit Note"/"Add Note" button, and no purchase actions.
- `/start/route` flow is exactly what `extension/adapter.js` /
  `goldadam-scraper.user.js` assumed: **"Select Your Route"** grid of route
  buttons → **Continue** → **"Select Your Vehicle"** page (**"Skip for
  now"** button, `"Search or add plate"` placeholder) → redirects to
  `/bookings` for that route.
- **Route list has grown since the CSV/seed was captured**: in addition to
  the 45 seeded routes, `/start/route` now also lists **`LOVE`** (Lovejoy
  Highschool), **`ROCK`** (Rockwall Highschool, "Rockwall/Heath/Rowlett"),
  alongside the already-seeded `US1-ATX` (Austin Walmart Tour). The scraper
  should read routes live from this page (or keep `Route` collection synced)
  rather than trust a frozen list.

## Sales (`/sales`) — new, not scraped anywhere yet

List view, filters: **Dates** (Today / All Time / Last Week / Last Month /
Year to Date / Custom Range), **Route** dropdown (only routes with sales
show), **Customer** search box, **"Test purchases"** checkbox (on by
default — test/dry-run sales are included unless unchecked). **Excel**
export button, **Refresh** button.

Summary tiles above the table (all pre-aggregated by goldadam, useful for a
cheap top-line dashboard without recomputation): Sales Value (Est. + subtitle
"Controlled: $X" + "Est. Profit: $Y" + "Payouts: $Z · Avg Margin: P%"),
Packages (count + "Shipped: n/total" + "N bookings · M days on the road"),
Gold (pure, Est.) grams (+ Controlled % + Payouts $), Silver (pure, Est.)
grams (+ Controlled % + Payouts $).

Table columns (**list level — what the scraper reads**):
`Package #` (e.g. `US-65608116`; a "Controlled" badge and/or "TEST" badge can
appear next to it; "Report completed" sub-label), `Date` (e.g.
`"Aug 24, 2026, 01:49 AM"`), `Customer` (name + `"Route: <CODE>"` on second
line), `Gold (pure)` grams (sometimes with a `"Ctrl +N%"` delta badge),
`Silver (pure)` grams, `Margin` %, `Est. Profit` $ (sometimes with a
`"Ctrl $Y"` controlled-profit variant), `Payout` $ + a `Paid`/pending badge.

**Pagination**: 50 rows/page, `"Showing 1–N of TOTAL"` + First/Previous/
Page X of Y/Next/Last buttons — must page through, not just read page 1.

**Row click opens a detail modal** with 4 tabs — **Customer**, **Package**,
**Payment**, **More**:
- *Customer*: email, phone, mailing address, **ID Document** (type + number
  — e.g. Driver License).
- *Package*: itemized list (metal type GOLD/SILVER, purity e.g. `925
  (92.5%)`, price, weight, price/gram), plus a Summary (Total Weight, Gold
  Weight, Total $).
- *Payment*: status, amount, timeline (Initiated/Completed timestamps), and
  **full bank details — routing number + account number + account type**.
- *More*: customer review rating, stop name/address, **GPS coordinates +
  accuracy + captured timestamp**, Purchase Type (e.g. "reservation"),
  Marketing Channel (e.g. "Facebook"), Gold/Silver spot price per gram at
  time of sale.

**Deliberate scope decision**: the sales scraper reads the **list table
only** — it does not open the per-row modal, so it never touches bank
account/routing numbers or driver-license numbers. Those live only in
goldadam; nothing in our reporting needs them, and storing them would be a
real liability. If per-item gold/silver breakdown or the spot price ever
becomes necessary, that's an explicit follow-up, not a default.

## Sponsored (`/sponsored`) — team/downline leaderboard, out of scope for now

`"N agents sponsored by you"` — a leaderboard of agents Paul sponsors, **not**
Paul's own sales. Team summary tiles (Team score, Conversion %, Gold margin
%, Est. profit + payout). Filters: Date Range (default Last Month),
"Include subagents" checkbox. Table: Agent (name + tag like "Low margin"/
"Low conversion"/"0 sales" + sale count), Score (+ Fair/Good/Needs work
label), Conv. %, Gold margin %, Est. Profit, Payout. Clicking a row expands
that sponsored agent's own paginated sales list (same shape as `/sales`).
**Not scraped** — this is downline performance data, not Paul's own
appointments/sales, and wasn't part of what was asked for this round.

## Reports (`/reports`) — package verification status, not a report builder

Despite the name, this is a **per-package assay/verification** list:
Package, Customer, Date, Weight, Report Weight, Price, Status
(`Completed`/`Not Started`), and a "View" action. Useful later for
reconciling scale-weight vs. reported-weight discrepancies; not needed for
the current bookings/sales scrape.

## CRM (`/crm`) — company-wide customer directory, explicitly NOT scraped

**"9663 customers total"** — this is a shared, company-wide customer
database (name, phone, email, total sales, gold margin, visits, last visit),
not scoped to Paul's own routes/sales. Scraping this would mean pulling
~9,663 other people's PII/contact + purchase history at scale, which is well
outside "my own bookings and sales" and wasn't authorized. **Deliberately
excluded** from all scraper code. Flag to the user if this is ever wanted —
it needs an explicit decision, not a default.

## Parcels (`/parcels`) — not explored this pass

Nav link exists; not opened. Out of scope for the current bookings+sales
work; revisit only if asked.

## Automation-blocking findings (2026-09-02, important)

- **Bot protection blocks any Playwright-launched browser, headless or
  headed.** Navigating with `chromium.launch()` (even with a real, valid
  session cookie loaded) hits a **"Vercel Security Checkpoint"** that
  resolves to `Failed to verify your browser — Code 99` within ~10s, every
  time, regardless of headless/headed. Only a genuinely human-launched
  Chrome, driven via the Playwright MCP Bridge **extension** (which attaches
  to an already-running normal Chrome via `chrome.debugger`, not via
  automation-flagged process launch), passes. **This means a standalone
  unattended cron/node-cron scraper cannot reach goldadam at all** — this
  isn't a bug to fix, it's the site's own anti-bot design working as
  intended. No stealth/evasion was attempted (out of scope — see chat).
  Practical implication: real automation has to run through a real browser
  a human (or an active Claude session via the MCP bridge) is driving —
  i.e. the existing `extension/` Chrome extension, or MCP-assisted runs.
- **VPN note (resolved)**: separately, `mongodb+srv://` DNS SRV lookups fail
  on this machine (`querySrv ECONNREFUSED`) — use the non-SRV host-list
  form. And a non-split-tunneled VPN blocks MongoDB Atlas + Twilio traffic;
  fixed here via ProtonVPN "Include mode" split tunneling scoped to the
  Chrome/Chromium executables only.
- **Rate limiting is real and was hit today.** Scraping all 45+ routes'
  bookings plus a full "All Time" sales history for 12 sponsored agents
  (~1600+ rows) in one session tripped the Vercel checkpoint into a
  sustained `429`. That volume was a one-off historical backfill, not
  representative of daily operation — the daily job only needs today's
  bookings + a narrow recent sales window (`SALES_DATE_RANGE=Last Week` by
  default now, not `All Time`), and the sponsored-agents pull is a manual
  one-off, not part of the daily schedule. Route-to-route delays were
  widened (3–5.5s bookings, 2–3.5s sales pagination) accordingly. If a
  checkpoint is hit again, stop and let it cool down — re-navigating
  immediately appears to keep it active rather than clear it faster.
- **Booking stops are not always pre-expanded.** A stop's `"N booking"`
  badge doesn't guarantee its customer card (email/phone/status) is already
  in `document.body.innerText` — whether it's expanded on load appears to
  depend on load path, not just having a booking. Click the stop's own
  button first (skip ones that already show a `mailto:` link, since
  clicking an expanded card collapses it again) before capturing text — see
  `scraper/lib/goldadamSession.js`'s `expandAllBookingStops`.
