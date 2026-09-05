/*
 * Content script: runs on agent.goldadam.us. Orchestrates scraping across routes
 * and executes write-back commands, talking to the CRM via the background worker.
 */
(function () {
  const A = globalThis.GA_ADAPTER;
  if (!A) {
    console.error("[GA-EXT] adapter missing");
    return;
  }
  const { sleep, bodyText, waitFor } = A.util;

  const RUN_KEY = "ga_ext_run"; // { active, queue:[], current }
  const SALES_RUN_KEY = "ga_ext_sales_run"; // { active, dateRangeLabel }
  let cooling = 0;
  let BUSY = false;
  let salesBusy = false;
  let lastPath = location.pathname;

  // ---- storage helpers ----
  const getRun = () =>
    new Promise((res) =>
      chrome.storage.local.get(RUN_KEY, (o) => res(o[RUN_KEY] || { active: false, queue: [], current: null }))
    );
  const setRun = (v) => new Promise((res) => chrome.storage.local.set({ [RUN_KEY]: v }, res));

  const getSalesRun = () =>
    new Promise((res) =>
      chrome.storage.local.get(SALES_RUN_KEY, (o) =>
        res(o[SALES_RUN_KEY] || { active: false, dateRangeLabel: "Last Week" })
      )
    );
  const setSalesRun = (v) => new Promise((res) => chrome.storage.local.set({ [SALES_RUN_KEY]: v }, res));

  // ---- CRM calls via background ----
  function cf(path, method = "GET", body) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: "CRM_FETCH", path, method, body }, (resp) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!resp || resp.ok === false) return reject(new Error(resp?.error || "CRM request failed"));
        resolve(resp.data);
      });
    });
  }

  // ---- logging / panel ----
  function log(msg) {
    console.log("[GA-EXT]", msg);
    const box = document.getElementById("gaext-log");
    if (box) box.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + box.textContent;
  }

  function buildPanel() {
    if (document.getElementById("gaext-panel")) return;
    const p = document.createElement("div");
    p.id = "gaext-panel";
    p.style.cssText =
      "position:fixed;top:12px;right:12px;z-index:2147483647;width:300px;background:#0b1220;color:#e5e7eb;font:12px/1.4 system-ui,sans-serif;border:1px solid #334155;border-radius:10px;padding:10px;box-shadow:0 6px 24px rgba(0,0,0,.5)";
    p.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <b style="font-size:13px">Gold Adam CRM Sync</b>
        <span id="gaext-min" style="cursor:pointer;opacity:.7">–</span>
      </div>
      <div id="gaext-body">
        <div id="gaext-conn" style="margin-bottom:6px;opacity:.8">Checking connection…</div>
        <div style="margin-bottom:6px">Routes to sync (comma/space/newline):</div>
        <textarea id="gaext-routes" rows="3" style="width:100%;box-sizing:border-box;background:#000;color:#eee;border:1px solid #334155;border-radius:6px;padding:6px"></textarea>
        <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap">
          <button id="gaext-sync" style="flex:1;cursor:pointer;background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px">Sync routes</button>
          <button id="gaext-stop" style="cursor:pointer;background:#374151;color:#fff;border:0;border-radius:6px;padding:6px">Stop</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          <button id="gaext-wb" style="flex:1;cursor:pointer;background:#16a34a;color:#fff;border:0;border-radius:6px;padding:6px">Run write-backs (this route)</button>
        </div>
        <div style="margin-bottom:6px">Sync sales:</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          <button id="gaext-sales-week" style="flex:1;cursor:pointer;background:#9333ea;color:#fff;border:0;border-radius:6px;padding:6px">Last Week</button>
          <button id="gaext-sales-month" style="flex:1;cursor:pointer;background:#9333ea;color:#fff;border:0;border-radius:6px;padding:6px">Last Month</button>
          <button id="gaext-sales-all" style="flex:1;cursor:pointer;background:#7e22ce;color:#fff;border:0;border-radius:6px;padding:6px" title="One-off backfill — slower, don't run this daily">All Time</button>
        </div>
        <pre id="gaext-log" style="max-height:120px;overflow:auto;background:#000;border:1px solid #1f2937;border-radius:6px;padding:6px;white-space:pre-wrap;margin:0"></pre>
      </div>`;
    (document.documentElement || document.body).appendChild(p);

    chrome.storage.local.get("ga_routes", (o) => {
      const ta = document.getElementById("gaext-routes");
      ta.value = o.ga_routes || "";
      ta.addEventListener("input", () => chrome.storage.local.set({ ga_routes: ta.value }));
    });

    document.getElementById("gaext-sync").onclick = startSync;
    document.getElementById("gaext-stop").onclick = stopSync;
    document.getElementById("gaext-wb").onclick = runWritebacks;
    document.getElementById("gaext-sales-week").onclick = () => startSalesSync("Last Week");
    document.getElementById("gaext-sales-month").onclick = () => startSalesSync("Last Month");
    document.getElementById("gaext-sales-all").onclick = () => startSalesSync("All Time");
    document.getElementById("gaext-min").onclick = () => {
      const b = document.getElementById("gaext-body");
      b.style.display = b.style.display === "none" ? "block" : "none";
    };

    // connection check
    cf("/api/auth/me")
      .then((d) => {
        document.getElementById("gaext-conn").textContent = `Connected as ${d.user.email} (${d.user.role})`;
        document.getElementById("gaext-conn").style.color = "#7CFC00";
      })
      .catch(() => {
        document.getElementById("gaext-conn").textContent = "Not connected — open the extension popup to sign in.";
        document.getElementById("gaext-conn").style.color = "#f59e0b";
      });
  }

  const cool = (ms) => (cooling = Date.now() + ms);

  async function startSync() {
    const raw = document.getElementById("gaext-routes").value;
    let queue = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

    if (!queue.length) {
      log("No routes typed — fetching the full route list from the CRM…");
      try {
        const { routes } = await cf("/api/routes");
        queue = (routes || []).map((r) => r.code).filter(Boolean);
      } catch (e) {
        return log("Couldn't fetch routes from CRM: " + e.message);
      }
      if (!queue.length) return log("CRM has no routes on file.");
    }

    await setRun({ active: true, queue, current: null, auto: false });
    log("▶ Sync started: " + queue.join(", "));
    tick();
  }
  async function stopSync() {
    await setRun({ active: false, queue: [], current: null });
    log("⏹ Sync stopped");
  }

  // Kicked off by background.js's daily chrome.alarms trigger — same state
  // machine as a manual "Sync routes" click, plus auto-executing only the
  // AUTO_SAFE_ACTIONS-allowlisted write-backs per route as it goes (never
  // Start Purchase — see adapter.js).
  async function startAutoSync(routes) {
    if (!routes || !routes.length) return log("Auto-run: no routes provided by CRM.");
    await setRun({ active: true, queue: routes, current: null, auto: true });
    log("▶ Auto-run started: " + routes.join(", "));
    tick();
  }

  async function ingestCurrent(code) {
    const text = bodyText();
    if (!/Total Bookings|Stops/i.test(text)) return false;
    const res = await cf("/api/ingest", "POST", { pages: [{ routeCode: code, text }] });
    log(`✔ Ingested ${code}: received ${res.received}, inserted ${res.inserted}, modified ${res.modified}`);
    return true;
  }

  // autoOnly restricts execution to adapter.js's AUTO_SAFE_ACTIONS allowlist
  // (used by the unattended daily run); the manual "Run write-backs" button
  // runs everything queued, including the human-only Start Purchase action.
  async function executeWritebacksForRoute(code, { autoOnly = false } = {}) {
    try {
      const { commands } = await cf(`/api/commands?routes=${encodeURIComponent(code)}`);
      if (!commands.length) return log(`No queued write-backs for ${code}.`);

      const toRun = autoOnly
        ? commands.filter((c) => A.writeback.AUTO_SAFE_ACTIONS.includes(c.action))
        : commands;
      const skipped = commands.length - toRun.length;
      if (skipped > 0) {
        log(`⏸ ${skipped} write-back(s) for ${code} need a human (Start Purchase) — left queued.`);
      }
      if (!toRun.length) return;

      log(`Executing ${toRun.length} write-back(s) for ${code}…`);
      for (const cmd of toRun) {
        const result = await A.writeback.executeCommand(cmd);
        await cf(`/api/commands/${cmd.id}/result`, "POST", {
          success: result.success,
          error: result.detail,
          dryRun: result.dryRun,
        });
        log(`${result.success ? "✔" : "✖"} ${cmd.action} ${cmd.booking?.customerName || ""} — ${result.detail}`);
      }
    } catch (e) {
      log("Write-back error: " + e.message);
    }
  }

  async function runWritebacks() {
    const code = A.scrape.pageRouteCode();
    if (!A.scrape.onBookingsPath() || !code) return log("Open a route's bookings page first.");
    await executeWritebacksForRoute(code, { autoOnly: false });
  }

  // ---- sales sync ----
  // Navigating to /sales is a full page load (like /start/route), so progress
  // is tracked in storage (SALES_RUN_KEY) rather than a local variable, the
  // same pattern as the bookings RUN_KEY — salesTick() picks up where it left
  // off after boot() re-runs on the new page.
  async function startSalesSync(dateRangeLabel = "Last Week") {
    await setSalesRun({ active: true, dateRangeLabel });
    log(`▶ Sales sync started (${dateRangeLabel})`);
    if (A.sales.onSalesPath()) {
      salesTick();
    } else {
      location.href = "https://agent.goldadam.us/sales";
    }
  }

  async function salesTick() {
    if (salesBusy) return;
    const run = await getSalesRun();
    if (!run.active || !A.sales.onSalesPath()) return;
    salesBusy = true;
    try {
      const gotTable = await waitFor(() => !!document.querySelector("table"), 20000);
      if (!gotTable) {
        log("Sales sync: no table found on /sales — stopping.");
        await setSalesRun({ active: false, dateRangeLabel: run.dateRangeLabel });
        return;
      }
      await sleep(500);

      if (run.dateRangeLabel && run.dateRangeLabel !== "Today") {
        log(`Sales sync: setting date range to "${run.dateRangeLabel}"…`);
        await A.sales.setSalesDateRange(run.dateRangeLabel);
        await sleep(1200);
      }

      const rows = [];
      let pageNum = 1;
      const maxPages = 200; // sanity cap so a DOM regression can't loop forever
      while (pageNum <= maxPages) {
        rows.push(...A.sales.extractSalesRows());
        const advanced = A.sales.clickNextSalesPage();
        if (!advanced) break;
        await sleep(2000 + Math.random() * 1500);
        pageNum += 1;
      }

      log(`Sales sync: scraped ${rows.length} row(s) across ${pageNum} page(s). Ingesting…`);
      if (rows.length) {
        const res = await cf("/api/sales/ingest", "POST", { rows });
        log(`✔ Sales ingested: received ${res.received}, inserted ${res.inserted}, modified ${res.modified}`);
      }
      log("🎉 Sales sync complete");
    } catch (e) {
      log("Sales sync error: " + e.message);
    } finally {
      await setSalesRun({ active: false, dateRangeLabel: run.dateRangeLabel });
      salesBusy = false;
    }
  }

  async function tick() {
    if (BUSY) return;
    BUSY = true;
    try {
      const run = await getRun();

      if (A.scrape.onBookingsPath()) {
        await waitFor(() => /Total Bookings|Stops/i.test(bodyText()), 20000);
        const code = run.current || A.scrape.pageRouteCode();
        if (code) await ingestCurrent(code).catch((e) => log("Ingest error: " + e.message));
        if (code && run.auto) {
          await executeWritebacksForRoute(code, { autoOnly: true }).catch((e) =>
            log("Auto write-back error: " + e.message)
          );
        }

        if (run.active && code) {
          run.queue = run.queue.filter((c) => c !== code && c !== run.current);
          run.current = null;
          await setRun(run);
          if (run.queue.length === 0) {
            log("🎉 Sync complete");
            await setRun({ active: false, queue: [], current: null });
          } else {
            cool(4000);
            await sleep(800);
            location.href = "https://agent.goldadam.us/start/route";
          }
        }
        return;
      }

      if (!run.active) return;

      if (A.scrape.isVehicleStep()) {
        log("Vehicle step — skipping");
        cool(4000);
        await sleep(500);
        A.scrape.clickByText("Skip for now") || A.scrape.clickByText("Select a vehicle");
        return;
      }

      if (A.scrape.isRouteStep()) {
        if (run.queue.length === 0) {
          await setRun({ active: false, queue: [], current: null });
          return;
        }
        const next = run.queue[0];
        run.current = next;
        await setRun(run);
        log(`Selecting route ${next}…`);
        const found = await waitFor(() => A.scrape.findRouteClickable(next) !== null, 20000);
        if (!found) {
          log(`❌ Route ${next} not found — stopping.`);
          await setRun({ active: false, queue: [], current: null });
          return;
        }
        cool(4000);
        A.scrape.findRouteClickable(next).click();
        await sleep(900);
        A.scrape.clickByText("Continue");
        return;
      }
    } finally {
      BUSY = false;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "AUTO_RUN") {
      startAutoSync(msg.routes || []);
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "AUTO_RUN_SALES") {
      startSalesSync(msg.dateRangeLabel || "Last Week");
      sendResponse({ ok: true });
      return true;
    }
  });

  function boot() {
    if (!document.documentElement) return setTimeout(boot, 300);
    buildPanel();
    log("Loaded on " + location.pathname + " · adapter " + A.version);
    setTimeout(tick, 1200);
    setTimeout(salesTick, 1200);
    setInterval(() => {
      if (!document.getElementById("gaext-panel")) buildPanel();
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        setTimeout(tick, 1000);
        setTimeout(salesTick, 1000);
      } else if (Date.now() > cooling) {
        getRun().then((r) => {
          if (r.active) tick();
        });
        getSalesRun().then((r) => {
          if (r.active) salesTick();
        });
      }
    }, 1200);
  }

  boot();
})();
