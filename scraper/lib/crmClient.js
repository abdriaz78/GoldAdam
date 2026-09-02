/*
 * Thin client for the CRM's own HTTP API. The scraper never touches MongoDB
 * directly — it logs into the CRM like the browser extension does and reuses
 * the existing /api/ingest, /api/notifications/send-confirmations,
 * /api/routes and /api/sync-log routes so parsing/dedupe/SMS logic lives in
 * exactly one place.
 */

const BASE_URL = (process.env.CRM_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

let cachedToken = null;

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth) {
    if (!cachedToken) throw new Error("crmClient: not logged in — call login() first");
    headers["Authorization"] = `Bearer ${cachedToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `CRM request ${method} ${path} failed: HTTP ${res.status}`);
  }
  return data;
}

export async function login() {
  const email = process.env.SCRAPER_CRM_EMAIL;
  const password = process.env.SCRAPER_CRM_PASSWORD;
  if (!email || !password) {
    throw new Error("SCRAPER_CRM_EMAIL / SCRAPER_CRM_PASSWORD not set in .env");
  }
  const data = await request("/api/auth/login", { method: "POST", body: { email, password }, auth: false });
  cachedToken = data.token;
  return data.user;
}

export async function getRoutes() {
  const data = await request("/api/routes");
  return data.routes || [];
}

export async function ingest(pages) {
  return request("/api/ingest", { method: "POST", body: { pages } });
}

export async function ingestSales(rows) {
  return request("/api/sales/ingest", { method: "POST", body: { rows } });
}

export async function sendConfirmations(date) {
  return request("/api/notifications/send-confirmations", { method: "POST", body: date ? { date } : {} });
}

// Assigns a route+date to an agent only if nothing is assigned yet — never
// overwrites an assignment a human made via the Assignments page.
export async function assignRouteIfAbsent(agentId, routeCode, date) {
  return request("/api/assignments", { method: "POST", body: { agentId, routeCode, date, ifAbsent: true } });
}

export async function logSync({ type, routeCode = "", count = 0, detail = "" }) {
  try {
    await request("/api/sync-log", { method: "POST", body: { type, routeCode, count, detail } });
  } catch (e) {
    // Logging failure shouldn't crash the run — just surface it.
    console.error("[scraper][crmClient] logSync failed:", e?.message || e);
  }
}
