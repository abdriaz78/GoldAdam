/*
 * Playwright-side scraping of goldadam's /sales table. See SITE_NOTES.md for
 * the DOM shapes this was captured against (2026-09-02). List-level only —
 * deliberately never opens a row's detail modal, so it never touches the
 * bank account/routing numbers or ID document numbers that live there.
 */
import { GOLDADAM_URL, sleep, jitter } from "./goldadamSession.js";

const SALES_URL = `${GOLDADAM_URL.replace(/\/$/, "")}/sales`;

// Runs inside the page. No stable data-testid/class hooks exist on this
// site (utility classes only), so extraction is positional by column order,
// which matches the table's own <th> headers (Package #, Date, Customer,
// Gold (pure), Silver (pure), Margin, Est. Profit, Payout).
function extractRowsInPage() {
  const table = document.querySelector("table");
  if (!table) return [];
  return Array.from(table.querySelectorAll("tbody tr"))
    .map((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length < 8) return null;

      const pkgCell = cells[0];
      const packageNumber = (pkgCell.querySelector("span.font-mono")?.textContent || "").trim();
      if (!packageNumber) return null;
      const controlled = !!pkgCell.querySelector('svg[aria-label="Controlled"]');
      const testPurchase = /\bTEST\b/.test(pkgCell.textContent);

      const date = cells[1].textContent.trim();

      const customerText = cells[2].textContent.replace(/\s+/g, " ").trim();
      const routeMatch = customerText.match(/Route:\s*(\S+)/);
      const routeCode = routeMatch ? routeMatch[1] : "";
      const customerName = customerText.replace(/Route:\s*\S+/, "").trim();

      const goldText = cells[3].textContent.replace(/\s+/g, " ").trim();
      const silverText = cells[4].textContent.replace(/\s+/g, " ").trim();
      const margin = cells[5].textContent.trim();
      const profitText = cells[6].textContent.replace(/\s+/g, " ").trim();
      const payoutText = cells[7].textContent.replace(/\s+/g, " ").trim();
      const paid = /Paid/.test(payoutText);

      return {
        packageNumber,
        controlled,
        testPurchase,
        date,
        customerName,
        routeCode,
        goldText,
        silverText,
        margin,
        profitText,
        payoutText,
        paid,
      };
    })
    .filter(Boolean);
}

async function setDateRange(page, label) {
  // The trigger button's visible text is always the currently-active range
  // (e.g. "Today" by default) — click it to open the menu, then click the
  // option with the wanted label.
  const opened = await page
    .evaluate(() => {
      const labelNode = Array.from(document.querySelectorAll("div,span")).find(
        (el) => el.children.length === 0 && el.textContent.trim() === "Dates"
      );
      const container = labelNode?.closest("div")?.parentElement || labelNode?.parentElement;
      const trigger = container?.querySelector("button");
      if (trigger) {
        trigger.click();
        return true;
      }
      return false;
    })
    .catch(() => false);
  if (!opened) return false;

  await sleep(300);
  return page
    .evaluate((wanted) => {
      const btns = Array.from(document.querySelectorAll("button"));
      const b = btns.find((el) => el.textContent.trim() === wanted);
      if (b) {
        b.click();
        return true;
      }
      return false;
    }, label)
    .catch(() => false);
}

async function clickNextPage(page) {
  return page
    .evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      const next = btns.find((el) => el.textContent.trim() === "Next");
      if (!next || next.disabled) return false;
      next.click();
      return true;
    })
    .catch(() => false);
}

/**
 * Scrape every row of /sales for the given date-range label (default
 * "All Time" — safest for catching status changes on older packages, e.g.
 * Pending -> Paid. Set SALES_DATE_RANGE env to "Last Month" etc. once the
 * dataset is large enough that a narrower window makes more sense).
 */
export async function scrapeAllSales(page, { dateRangeLabel = "All Time" } = {}) {
  await page.goto(SALES_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
  await sleep(1000);

  if (dateRangeLabel !== "Today") {
    await setDateRange(page, dateRangeLabel);
    await sleep(1200); // table reloads after changing the filter
  }

  const rows = [];
  let pageNum = 1;
  const maxPages = 200; // sanity cap so a DOM regression can't loop forever
  while (pageNum <= maxPages) {
    const pageRows = await page.evaluate(extractRowsInPage).catch(() => []);
    rows.push(...pageRows);

    const advanced = await clickNextPage(page);
    if (!advanced) break;
    await jitter(2000, 3500);
    pageNum += 1;
  }

  return rows;
}
