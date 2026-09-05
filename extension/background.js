/*
 * Background service worker: the only place that talks to the CRM API.
 * Holds the CRM base URL + JWT in chrome.storage.local and proxies fetches so
 * content scripts (on goldadam's origin) aren't blocked by CORS.
 */

async function getConfig() {
  return new Promise((res) =>
    chrome.storage.local.get(["crmUrl", "token"], (o) =>
      res({ crmUrl: o.crmUrl || "", token: o.token || "" })
    )
  );
}

async function crmFetch(path, method = "GET", body) {
  const { crmUrl, token } = await getConfig();
  if (!crmUrl) return { ok: false, error: "CRM URL not configured (open the popup)" };

  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(crmUrl.replace(/\/$/, "") + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---- scheduled unattended run ----
// Drives the same tab a human would normally open by hand, just on a timer.
// Requires a real, already-running Chrome (this extension's own process) —
// see SITE_NOTES.md on why a script-launched browser can't reach goldadam
// at all. The daily run only ever triggers scraping + the AUTO_SAFE_ACTIONS
// allowlist (see adapter.js) — "Start Purchase" is never part of it.

const DAILY_ALARM = "ga_daily_run";
const GOLDADAM_ORIGIN = "https://agent.goldadam.us";
const RUN_HOUR_UTC = 12; // ~7am Central — adjust to taste
const RUN_MINUTE_UTC = 0;

function nextRunTime() {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    RUN_HOUR_UTC, RUN_MINUTE_UTC, 0
  ));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime();
}

async function ensureDailyAlarm() {
  const existing = await chrome.alarms.get(DAILY_ALARM);
  if (existing) return;
  chrome.alarms.create(DAILY_ALARM, { when: nextRunTime(), periodInMinutes: 24 * 60 });
}

chrome.runtime.onInstalled.addListener(ensureDailyAlarm);
chrome.runtime.onStartup.addListener(ensureDailyAlarm);

async function findOrOpenGoldadamTab() {
  const tabs = await chrome.tabs.query({ url: `${GOLDADAM_ORIGIN}/*` });
  if (tabs.length) return tabs[0];
  return new Promise((resolve) => {
    chrome.tabs.create({ url: `${GOLDADAM_ORIGIN}/start/route`, active: false }, resolve);
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") return resolve();
      const listener = (id, info) => {
        if (id === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

async function runDailyAutoSync() {
  const routesRes = await crmFetch("/api/routes");
  if (!routesRes.ok) {
    console.warn("[GA-EXT] daily run: couldn't fetch routes from CRM —", routesRes.error);
    return;
  }
  const routeCodes = (routesRes.data.routes || []).map((r) => r.code).filter(Boolean);
  if (!routeCodes.length) {
    console.warn("[GA-EXT] daily run: no routes returned by CRM, nothing to sync");
    return;
  }

  const tab = await findOrOpenGoldadamTab();
  await waitForTabComplete(tab.id);
  // The tab may already have been on goldadam and idle — nudge it to the
  // route picker so the content script's state machine has a known start.
  await chrome.tabs.update(tab.id, { url: `${GOLDADAM_ORIGIN}/start/route` });
  await waitForTabComplete(tab.id);

  chrome.tabs.sendMessage(tab.id, { type: "AUTO_RUN", routes: routeCodes }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[GA-EXT] daily run: content script didn't respond —", chrome.runtime.lastError.message);
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === DAILY_ALARM) {
    runDailyAutoSync().catch((e) => console.error("[GA-EXT] daily run failed:", e));
  }
});

// Exposed on self so it's callable from the service worker's DevTools
// console for manual testing (this file is an ES module, so top-level
// function declarations aren't visible as console globals otherwise).
self.runDailyAutoSync = runDailyAutoSync;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === "CRM_FETCH") {
      sendResponse(await crmFetch(msg.path, msg.method, msg.body));
      return;
    }
    if (msg?.type === "LOGIN") {
      const { crmUrl, email, password } = msg;
      await chrome.storage.local.set({ crmUrl });
      const res = await crmFetch("/api/auth/login", "POST", { email, password });
      if (res.ok && res.data.token) {
        await chrome.storage.local.set({ token: res.data.token });
        sendResponse({ ok: true, user: res.data.user });
      } else {
        sendResponse({ ok: false, error: res.error || "Login failed" });
      }
      return;
    }
    if (msg?.type === "GET_STATE") {
      const cfg = await getConfig();
      sendResponse({ ok: true, crmUrl: cfg.crmUrl, hasToken: !!cfg.token });
      return;
    }
    if (msg?.type === "LOGOUT") {
      await chrome.storage.local.remove("token");
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false, error: "Unknown message" });
  })();
  return true; // async response
});
