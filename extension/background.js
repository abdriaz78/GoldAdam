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
