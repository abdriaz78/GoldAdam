/*
 * Gold Adam site adapter — all knowledge of the goldadam DOM lives here so UI
 * changes only require editing this one file (versioned).
 *
 * Provides:
 *   GA_ADAPTER.scrape.*    — read the bookings page (proven logic from the userscript)
 *   GA_ADAPTER.writeback.* — drive write-back commands into goldadam (GATED)
 *
 * NOTE: only the "cancel" action (→ clicks "No Sell") has a live path, and it
 * has only been verified via DOM inspection, never an actual click — see the
 * comment on executeCommand's "cancel" branch. "complete" (Start Purchase)
 * has no live path at all, intentionally: it fires a real transaction and
 * must always be a human's own click. Everything else stays dry-run.
 */
(function () {
  const ADAPTER_VERSION = "2026-08-07";

  // Actions the unattended daily run is allowed to execute on its own.
  // "complete" (Start Purchase) fires a real transaction and must never
  // appear here — it always stays queued for a human to run by hand via
  // the on-page "Run write-backs" button. See SITE_NOTES.md.
  const AUTO_SAFE_ACTIONS = ["cancel"];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const bodyText = () => (document.body && document.body.innerText) || "";

  const ROUTE_RE = /\b([A-Z]{2,6}\d{3}|WestTX\d{3}|US\d+-[A-Z]+)\b/;

  function pageRouteCode() {
    const m = bodyText().match(ROUTE_RE);
    return m ? m[1] : null;
  }
  function onBookingsPath() {
    return /bookings/i.test(location.pathname);
  }
  function isVehicleStep() {
    return (
      /vehicle/i.test(location.pathname) ||
      /Select Your Vehicle|Skip for now|Search or add plate/i.test(bodyText())
    );
  }
  function isRouteStep() {
    return (
      /Select Your Route/i.test(bodyText()) ||
      (/start\/route/i.test(location.pathname) && !isVehicleStep())
    );
  }

  async function waitFor(cond, timeout = 20000, step = 400) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        if (cond()) return true;
      } catch (e) {}
      await sleep(step);
    }
    return false;
  }

  function findRouteClickable(code) {
    const re = new RegExp("(^|\\s)" + code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|\\s)");
    const all = document.querySelectorAll("body *");
    let leaf = null;
    for (const el of all) {
      if (el.children.length === 0 && re.test(norm(el.textContent))) {
        leaf = el;
        break;
      }
    }
    if (!leaf) return null;
    let node = leaf;
    for (let k = 0; k < 7 && node; k++) {
      const tag = node.tagName;
      if (
        tag === "A" ||
        tag === "BUTTON" ||
        node.getAttribute?.("role") === "button" ||
        node.onclick ||
        (node.getBoundingClientRect &&
          node.getBoundingClientRect().height > 40 &&
          getComputedStyle(node).cursor === "pointer")
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return leaf;
  }

  function clickByText(text, root = document) {
    const want = text.toLowerCase();
    const els = root.querySelectorAll('button, a, [role="button"], input[type="submit"]');
    for (const el of els) {
      const t = norm(el.textContent || el.value).toLowerCase();
      if (t === want || t.includes(want)) {
        if (!el.disabled) {
          el.click();
          return true;
        }
      }
    }
    return false;
  }

  // ---- write-back ----
  // goldadam's real Pending-booking action UI (captured 2026-09-05 via live
  // DOM inspection, no clicks — see SITE_NOTES.md): three sibling <button>s
  // with exact accessible names "Start Purchase →", "No Sell", "No Show",
  // alongside an "Add Note"/"Edit Note" button, all inside one container per
  // booking. "Start Purchase" is a real transaction and is intentionally
  // never driven from here.
  const ACTION_LABELS = ["Start Purchase", "No Sell", "No Show", "Add Note", "Edit Note"];

  function containerHasOwnActions(el) {
    return ACTION_LABELS.some((label) => {
      const want = label.toLowerCase();
      return Array.from(el.querySelectorAll("button")).some((b) => norm(b.textContent).toLowerCase().includes(want));
    });
  }

  // Find the DOM node scoped to one specific customer's booking — climbs from
  // the matched text leaf only until it reaches an ancestor that itself
  // contains that booking's own action buttons, then stops. Stopping as soon
  // as those buttons are found (rather than a fixed hop count) matters
  // because a multi-booking stop (e.g. 6 bookings under one Walmart stop)
  // nests several bookings' rows under one shared container — climbing past
  // the first row would make clickByText() hit a DIFFERENT customer's button.
  function findBookingRow(booking) {
    if (!booking) return null;
    const needle = (booking.customerName || booking.email || "").toLowerCase();
    if (!needle) return null;
    const all = document.querySelectorAll("body *");
    let leaf = null;
    for (const el of all) {
      if (el.children.length === 0 && norm(el.textContent).toLowerCase().includes(needle)) {
        leaf = el;
        break;
      }
    }
    if (!leaf) return null;

    let node = leaf;
    for (let k = 0; k < 8 && node?.parentElement; k++) {
      node = node.parentElement;
      if (containerHasOwnActions(node)) return node;
    }
    return node; // fallback: climbed to the top of the search without finding actions
  }

  /**
   * Execute one write-back command. In dry-run it never mutates goldadam.
   * Returns { success, dryRun, detail }.
   */
  async function executeCommand(command) {
    const { action, booking, note, timeSlot, dryRun } = command;

    if (!onBookingsPath()) {
      return { success: false, dryRun, detail: "Not on a bookings page" };
    }
    const row = findBookingRow(booking);
    if (!row) {
      return { success: false, dryRun, detail: "Could not locate booking row on page" };
    }

    // === DRY-RUN: describe intended steps, do not click anything mutating ===
    if (dryRun) {
      const steps = {
        cancel: `Would click "No Sell" on ${booking.customerName}'s row${note ? ` (note: "${note}")` : ""}`,
        complete: `Would click "Start Purchase →" for ${booking.customerName} — NEVER done automatically`,
      };
      return { success: true, dryRun: true, detail: `DRY-RUN: ${steps[action] || action}` };
    }

    // === LIVE ===
    // "complete" (Start Purchase) intentionally has no live path here, ever —
    // content.js's AUTO_SAFE_ACTIONS allowlist already keeps the unattended
    // daily run from calling this for it, but this stub is the hard backstop:
    // there is no code path in this file that can click "Start Purchase →".
    if (action === "cancel") {
      const clicked = clickByText("No Sell", row);
      if (!clicked) {
        return { success: false, dryRun: false, detail: "Could not find 'No Sell' button in booking row" };
      }
      // Unverified: whether goldadam shows a confirmation dialog after this
      // click, or a place to attach `note`, has not been tested live (that
      // would mean actually mutating a real booking to find out). If a
      // dialog/modal appears, a human running this via "Run write-backs"
      // will see it in the tab; this executor does not yet try to handle one.
      return { success: true, dryRun: false, detail: `Clicked "No Sell" for ${booking.customerName}` };
    }

    return {
      success: false,
      dryRun: false,
      detail: `LIVE write-back not implemented for action "${action}" — only "cancel" (No Sell) is wired up.`,
    };
  }

  // ---- sales scraping ----
  // Ports scraper/lib/salesScraping.js's DOM logic (captured in SITE_NOTES.md,
  // 2026-09-02) into a content script — the headless version can never reach
  // goldadam at all (same bot-protection block as bookings), so this is the
  // only place this can actually run. List-level only, by design: never
  // opens a row's detail modal, so it never touches bank/routing or ID
  // document numbers that live there.
  function onSalesPath() {
    return /\/sales(\/|$)/i.test(location.pathname);
  }

  function extractSalesRows() {
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

        const customerText = norm(cells[2].textContent);
        const routeMatch = customerText.match(/Route:\s*(\S+)/);
        const routeCode = routeMatch ? routeMatch[1] : "";
        const customerName = customerText.replace(/Route:\s*\S+/, "").trim();

        const goldText = norm(cells[3].textContent);
        const silverText = norm(cells[4].textContent);
        const margin = cells[5].textContent.trim();
        const profitText = norm(cells[6].textContent);
        const payoutText = norm(cells[7].textContent);
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

  function openSalesDateMenu() {
    const labelNode = Array.from(document.querySelectorAll("div,span")).find(
      (el) => el.children.length === 0 && norm(el.textContent) === "Dates"
    );
    const container = labelNode?.closest("div")?.parentElement || labelNode?.parentElement;
    const trigger = container?.querySelector("button");
    if (trigger) {
      trigger.click();
      return true;
    }
    return false;
  }

  async function setSalesDateRange(label) {
    if (!openSalesDateMenu()) return false;
    await sleep(300);
    return clickByText(label);
  }

  function clickNextSalesPage() {
    const btns = document.querySelectorAll("button");
    for (const b of btns) {
      if (norm(b.textContent) === "Next") {
        if (b.disabled) return false;
        b.click();
        return true;
      }
    }
    return false;
  }

  globalThis.GA_ADAPTER = {
    version: ADAPTER_VERSION,
    util: { sleep, norm, bodyText, waitFor },
    scrape: {
      pageRouteCode,
      onBookingsPath,
      isVehicleStep,
      isRouteStep,
      findRouteClickable,
      clickByText,
    },
    writeback: { findBookingRow, executeCommand, AUTO_SAFE_ACTIONS },
    sales: { onSalesPath, extractSalesRows, setSalesDateRange, clickNextSalesPage },
  };
})();
