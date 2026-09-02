/*
 * Daily unattended job: log into the CRM, log into goldadam using the saved
 * session, scrape every row of the /sales table (list level only — see
 * SITE_NOTES.md, never opens the per-row modal with bank/ID details), and
 * push it all into the CRM via /api/sales/ingest.
 *
 * Session-expiry / failure handling mirrors dailyRun.js: one alert SMS, no
 * retry loop within a run.
 *
 * Usage: npm run scraper:sales-run
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import * as crm from "./lib/crmClient.js";
import { sendAlert } from "./lib/alert.js";
import { launchAuthedContext, isLoggedIn } from "./lib/goldadamSession.js";
import { scrapeAllSales } from "./lib/salesScraping.js";

export async function salesRun() {
  const startedAt = new Date();
  console.log(`[scraper] sales run starting ${startedAt.toISOString()}`);

  await crm.login();

  const { browser, page } = await launchAuthedContext();
  try {
    if (!(await isLoggedIn(page))) {
      const msg = "goldadam session expired — run `npm run scraper:auth-setup` to re-authenticate.";
      await sendAlert(msg);
      await crm.logSync({ type: "auth_failed", detail: msg });
      console.error(`[scraper] ${msg}`);
      return;
    }

    const dateRangeLabel = process.env.SALES_DATE_RANGE || "All Time";
    const rows = await scrapeAllSales(page, { dateRangeLabel });
    console.log(`[scraper] scraped ${rows.length} sales rows (range: ${dateRangeLabel})`);

    if (rows.length > 0) {
      const res = await crm.ingestSales(rows);
      console.log(`[scraper] ingested sales — inserted=${res.inserted} modified=${res.modified}`);
      await crm.logSync({
        type: "sales_scraper_run",
        count: rows.length,
        detail: `inserted=${res.inserted} modified=${res.modified}`,
      });
    } else {
      console.warn("[scraper] no sales rows captured this run");
    }
  } catch (e) {
    const msg = `Unexpected sales scraper failure: ${e?.message || e}`;
    console.error(`[scraper] ${msg}`);
    await sendAlert(msg);
    await crm.logSync({ type: "sales_scraper_error", detail: msg });
  } finally {
    await browser.close();
  }

  console.log(`[scraper] sales run finished ${new Date().toISOString()}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  salesRun()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error("[scraper] fatal:", e);
      process.exit(1);
    });
}
