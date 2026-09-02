/*
 * Gold Adam site adapter — all knowledge of the goldadam DOM lives here so UI
 * changes only require editing this one file (versioned).
 *
 * Provides:
 *   GA_ADAPTER.scrape.*    — read the bookings page (proven logic from the userscript)
 *   GA_ADAPTER.writeback.* — drive Confirm / Cancel / Complete + notes (GATED)
 *
 * NOTE: the write-back executor is a SAFE STUB. We have not yet mapped goldadam's
 * action UI (the flows behind "Start Purchase", "No Sell", "No Show", "Add Note",
 * and status changes). Until those are captured, executeCommand only performs a
 * dry-run: it locates the booking row and LOGS the intended steps without clicking
 * anything that mutates data. Fill in the TODO selectors after capture to go live.
 */
(function () {
  const ADAPTER_VERSION = "2026-08-07";

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

  function clickByText(text) {
    const want = text.toLowerCase();
    const els = document.querySelectorAll('button, a, [role="button"], input[type="submit"]');
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

  // ---- write-back (GATED, dry-run only until goldadam action UI is mapped) ----

  // Find the DOM node for a specific customer's booking row.
  function findBookingRow(booking) {
    if (!booking) return null;
    const needle = (booking.customerName || booking.email || "").toLowerCase();
    if (!needle) return null;
    const all = document.querySelectorAll("body *");
    for (const el of all) {
      if (el.children.length === 0 && norm(el.textContent).toLowerCase().includes(needle)) {
        // climb to a reasonably sized container that likely holds the action buttons
        let node = el;
        for (let k = 0; k < 6 && node?.parentElement; k++) node = node.parentElement;
        return node;
      }
    }
    return null;
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
        confirm: `Would open ${booking.customerName}'s row → set Confirmed → enter time slot "${timeSlot}" → save`,
        cancel: `Would open ${booking.customerName}'s row → Cancel → add note "${note}" → save`,
        complete: `Would open ${booking.customerName}'s row → Start Purchase / mark Completed → save`,
      };
      return { success: true, dryRun: true, detail: `DRY-RUN: ${steps[action] || action}` };
    }

    // === LIVE: TODO — fill these in after capturing goldadam's action UI ===
    // Example shape (adjust selectors/labels to the real flows):
    //   row.querySelector('[data-action="confirm"]').click();
    //   await waitFor(() => document.querySelector('#confirm-modal'));
    //   setSlot(timeSlot); addNote(note); clickByText('Save');
    return {
      success: false,
      dryRun: false,
      detail:
        "LIVE write-back not implemented yet — capture goldadam's Confirm/Cancel/Complete UI first.",
    };
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
    writeback: { findBookingRow, executeCommand },
  };
})();
