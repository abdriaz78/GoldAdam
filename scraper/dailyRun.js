/*
 * Daily unattended job: log into the CRM, log into goldadam using the saved
 * session, walk every route's bookings page, push everything into the CRM
 * via /api/ingest, then trigger tomorrow's confirmation texts.
 *
 * If the saved goldadam session has expired, this sends ONE alert SMS and
 * exits — it never retries or loops within a run (per the "don't hammer
 * their servers, don't fail silently" requirement).
 *
 * Usage: npm run scraper:run   (one-shot, for manual testing / cron target)
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import * as crm from "./lib/crmClient.js";
import { sendAlert } from "./lib/alert.js";
import {
  launchAuthedContext,
  isLoggedIn,
  selectRoute,
  captureBookingsText,
  jitter,
} from "./lib/goldadamSession.js";

export async function dailyRun() {
  const startedAt = new Date();
  console.log(`[scraper] daily run starting ${startedAt.toISOString()}`);

  await crm.login();
  const routes = await crm.getRoutes();
  if (routes.length === 0) {
    console.warn("[scraper] no routes returned by /api/routes — has `npm run seed` been run?");
  }

  const { browser, page } = await launchAuthedContext();
  try {
    if (!(await isLoggedIn(page))) {
      const msg = "goldadam session expired — run `npm run scraper:auth-setup` to re-authenticate.";
      await sendAlert(msg);
      await crm.logSync({ type: "auth_failed", detail: msg });
      console.error(`[scraper] ${msg}`);
      return;
    }

    const pages = [];
    for (const route of routes) {
      const code = route.code;
      console.log(`[scraper] scraping ${code}...`);
      const ok = await selectRoute(page, code);
      if (!ok) {
        console.warn(`[scraper] could not open bookings for ${code} — skipping`);
        continue;
      }
      const text = await captureBookingsText(page);
      pages.push({ routeCode: code, text });
      await jitter(3000, 5500); // stay gentle on their servers between routes
    }

    if (pages.length > 0) {
      const res = await crm.ingest(pages);
      console.log(
        `[scraper] ingested ${pages.length} route pages — inserted=${res.inserted} modified=${res.modified}`
      );
      await crm.logSync({
        type: "scraper_run",
        count: pages.length,
        detail: `routes=${pages.length} inserted=${res.inserted} modified=${res.modified}`,
      });

      // Deliberately no auto-assignment here: this scrape pulls every
      // company route, not just the account holder's own, so which agent
      // actually ran each route+date is unknown to us. Route -> agent
      // mapping only comes from a human assigning it on the Assignments
      // page. (An earlier version defaulted every scraped route to
      // whoever ran the scraper — wrong, since one person's goldadam login
      // can see every route without personally running them all.)
    } else {
      console.warn("[scraper] no route pages captured this run");
    }

    const confirmRes = await crm.sendConfirmations();
    console.log(`[scraper] send-confirmations: ${confirmRes.sentCount ?? 0} sent for ${confirmRes.date}`);
  } catch (e) {
    const msg = `Unexpected scraper failure: ${e?.message || e}`;
    console.error(`[scraper] ${msg}`);
    await sendAlert(msg);
    await crm.logSync({ type: "scraper_error", detail: msg });
  } finally {
    await browser.close();
  }

  console.log(`[scraper] daily run finished ${new Date().toISOString()}`);
}

// Run directly (as opposed to being imported by the scheduler).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  dailyRun()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[scraper] fatal:", e);
      process.exit(1);
    });
}
