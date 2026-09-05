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
  let cooling = 0;
  let BUSY = false;
  let lastPath = location.pathname;

  // ---- storage helpers ----
  const getRun = () =>
    new Promise((res) =>
      chrome.storage.local.get(RUN_KEY, (o) => res(o[RUN_KEY] || { active: false, queue: [], current: null }))
    );
  const setRun = (v) => new Promise((res) => chrome.storage.local.set({ [RUN_KEY]: v }, res));

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
    const queue = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!queue.length) return log("Enter at least one route code.");
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
  });

  function boot() {
    if (!document.documentElement) return setTimeout(boot, 300);
    buildPanel();
    log("Loaded on " + location.pathname + " · adapter " + A.version);
    setTimeout(tick, 1200);
    setInterval(() => {
      if (!document.getElementById("gaext-panel")) buildPanel();
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        setTimeout(tick, 1000);
      } else if (Date.now() > cooling) {
        getRun().then((r) => {
          if (r.active) tick();
        });
      }
    }, 1200);
  }

  boot();
})();
