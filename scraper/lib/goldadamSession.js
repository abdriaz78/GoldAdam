/*
 * Playwright-side knowledge of the goldadam site — ported from
 * extension/adapter.js so both the in-browser extension and this headless
 * scraper agree on how pages are detected and driven. Read-only navigation
 * only; write-back (Confirm/Cancel/Complete) stays in the extension.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const STORAGE_STATE_PATH = path.join(__dirname, "..", ".auth", "storageState.json");

export const GOLDADAM_URL = process.env.GOLDADAM_URL || "https://agent.goldadam.us";
const ROUTE_START_URL = `${GOLDADAM_URL.replace(/\/$/, "")}/start/route`;

const BOOKINGS_MARKER = /Total Bookings|Stops/i;
const ROUTE_SELECT_MARKER = /Select Your Route/i;
const VEHICLE_MARKER = /Select Your Vehicle|Skip for now|Search or add plate/i;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const jitter = (minMs, maxMs) => sleep(minMs + Math.random() * (maxMs - minMs));

// Force the full chrome.exe binary even in headless mode. Playwright's
// default headless mode launches a separate chrome-headless-shell.exe —
// if the machine's VPN only split-tunnels the regular Chrome executable
// (goldadam requires a US VPN), that second binary silently bypasses the
// tunnel and gets geo-blocked. Pinning executablePath keeps both headed
// and headless runs on the one binary that's already allowed through.
const CHROMIUM_EXECUTABLE_PATH = chromium.executablePath();

export async function launchHeadedContext() {
  const browser = await chromium.launch({ headless: false, executablePath: CHROMIUM_EXECUTABLE_PATH });
  const context = await browser.newContext();
  const page = await context.newPage();
  return { browser, context, page };
}

export async function launchAuthedContext() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_EXECUTABLE_PATH });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  const page = await context.newPage();
  return { browser, context, page };
}

async function bodyText(page) {
  return page.evaluate(() => document.body?.innerText || "").catch(() => "");
}

export async function isLoggedIn(page) {
  await page.goto(ROUTE_START_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(1500);
  const url = page.url();
  if (/accounts\.google\.com/i.test(url)) return false;
  const text = await bodyText(page);
  if (ROUTE_SELECT_MARKER.test(text) || VEHICLE_MARKER.test(text) || BOOKINGS_MARKER.test(text)) return true;
  // Ambiguous state (e.g. VPN checkpoint page) — treat as not logged in so the
  // caller alerts rather than silently scraping nothing.
  return false;
}

export async function onBookingsPage(page) {
  if (!/bookings/i.test(new URL(page.url()).pathname)) return false;
  const text = await bodyText(page);
  return BOOKINGS_MARKER.test(text);
}

async function isVehicleStep(page) {
  const text = await bodyText(page);
  return /vehicle/i.test(new URL(page.url()).pathname) || VEHICLE_MARKER.test(text);
}

async function isRouteStep(page) {
  const text = await bodyText(page);
  const vehicle = await isVehicleStep(page);
  return ROUTE_SELECT_MARKER.test(text) || (/start\/route/i.test(page.url()) && !vehicle);
}

async function clickByText(page, text) {
  const want = text.toLowerCase();
  const candidates = page.locator('button, a, [role="button"], input[type="submit"]');
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    const label = ((await el.innerText().catch(() => "")) || (await el.getAttribute("value").catch(() => "")) || "")
      .trim()
      .toLowerCase();
    if (label === want || label.includes(want)) {
      if (await el.isEnabled().catch(() => false)) {
        await el.click().catch(() => {});
        return true;
      }
    }
  }
  return false;
}

async function waitFor(cond, timeout = 20000, step = 400) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await cond().catch(() => false)) return true;
    await sleep(step);
  }
  return false;
}

/**
 * Drive the site from the route selector to a given route's bookings page,
 * skipping the vehicle sub-step if present. Returns true on success.
 */
export async function selectRoute(page, routeCode) {
  await page.goto(ROUTE_START_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(800);

  if (await isVehicleStep(page)) {
    await sleep(500);
    if (!(await clickByText(page, "Skip for now"))) await clickByText(page, "Select a vehicle");
    await sleep(800);
  }

  if (!(await isRouteStep(page))) return false;

  const found = await waitFor(async () => {
    const loc = page.getByText(routeCode, { exact: false });
    return (await loc.count()) > 0;
  }, 20000);
  if (!found) return false;

  await page.getByText(routeCode, { exact: false }).first().click().catch(() => {});
  await sleep(900);
  await clickByText(page, "Continue");

  const loaded = await waitFor(() => onBookingsPage(page), 20000);
  return loaded;
}

/**
 * Stops with a booking aren't always pre-expanded in the DOM (observed
 * 2026-09-02 — depends on load path, not just "has a booking"), so their
 * customer details (email/phone/status) can be missing from innerText
 * unless the stop's own button is clicked first. Click every stop whose
 * button text contains "booking" before capturing.
 */
async function expandAllBookingStops(page) {
  await sleep(300); // let the stop list finish hydrating before probing it
  const count = await page
    .evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      // Only stop-header buttons whose own text (not descendants outside it)
      // mentions "booking" are togglable stop cards. Skip ones whose
      // container already shows a mailto: link — already expanded, and
      // clicking again would toggle it back closed.
      const targets = btns.filter((b) => {
        if (!/\bbooking\b/i.test(b.textContent)) return false;
        const container = b.parentElement || b;
        return !container.querySelector('a[href^="mailto:"]');
      });
      for (const b of targets) b.click();
      return targets.length;
    })
    .catch(() => 0);
  if (count > 0) await sleep(500);
}

/** Capture the raw innerText of the currently-open bookings page, with every booking stop expanded. */
export async function captureBookingsText(page) {
  await expandAllBookingStops(page);
  return bodyText(page);
}
