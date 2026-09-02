import crypto from "crypto";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a human date like "Wednesday, August 5, 2026" to ISO "2026-08-05".
 * Returns "" if it can't be parsed.
 */
export function normalizeDateISO(human) {
  if (!human) return "";
  const cleaned = human.replace(/^\w+day,\s*/i, ""); // drop leading weekday
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Stable dedupe key for a booking so repeated scrapes upsert instead of duplicate.
 */
export function bookingDedupeKey({ routeCode, date, customerName, timeWindow, email }) {
  const raw = [routeCode, date, customerName, timeWindow, email]
    .map((s) => (s || "").toString().trim().toLowerCase())
    .join("|");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

/**
 * Parse the raw innerText of a goldadam bookings page into structured bookings.
 * Mirrors the logic in the browser extension so server-side CSV/text import matches.
 * Anchors on customer email lines; associates each to the nearest preceding stop.
 */
export function parseBookingsText(routeCode, text) {
  const lines = (text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const date = (text.match(/\b\w+day,\s+\w+\s+\d{1,2},\s+\d{4}\b/) || [""])[0];
  const isEmail = (l) => /@/.test(l) && /\.[a-z]{2,}$/i.test(l);
  const isPhone = (l) => /^\+?\d[\d\s\-().]{6,}$/.test(l);
  const isAddress = (l) => /\b\d{5}\b/.test(l) && l.includes(",");

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isEmail(lines[i])) continue;
    const email = lines[i];
    const phone = lines[i + 1] && isPhone(lines[i + 1]) ? lines[i + 1] : "";
    const status = lines[i - 1] || "";
    const timeWindow = lines[i - 2] || "";
    const customerName = lines[i - 3] || "";

    let address = "";
    let stopName = "";
    for (let j = i; j >= 0; j--) {
      if (isAddress(lines[j])) {
        address = lines[j];
        stopName = lines[j - 2] || "";
        break;
      }
    }

    // Try to split "street, zip, city" or "street, city, ST zip, ..."
    let city = "";
    let zip = "";
    const zipMatch = address.match(/\b(\d{5})\b/);
    if (zipMatch) zip = zipMatch[1];
    const parts = address.split(",").map((s) => s.trim());
    if (parts.length >= 3) city = parts[parts.length - 1] || "";

    out.push({
      routeCode,
      date,
      stopName,
      address,
      city,
      zip,
      timeWindow,
      customerName,
      email,
      phone,
      sourceStatus: (status || "").toLowerCase(), // as seen in goldadam (e.g. "pending")
    });
  }
  return out;
}

const firstNumber = (s) => {
  const m = String(s || "").match(/-?[\d,]+\.?\d*/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
};

/**
 * Normalize one raw row scraped from goldadam's /sales table (see
 * scraper/lib/salesScraping.js for the DOM extraction) into a structured
 * record matching the SalesTransaction schema. List-level fields only.
 */
export function parseSalesRow(raw) {
  return {
    packageNumber: (raw.packageNumber || "").trim(),
    date: (raw.date || "").trim(),
    dateISO: normalizeDateISO(raw.date),
    customerName: (raw.customerName || "").trim(),
    routeCode: (raw.routeCode || "").trim(),
    goldGrams: firstNumber(raw.goldText),
    silverGrams: firstNumber(raw.silverText),
    marginPercent: firstNumber(raw.margin),
    estProfit: firstNumber(raw.profitText),
    payout: firstNumber(raw.payoutText),
    paid: !!raw.paid,
    controlled: !!raw.controlled,
    testPurchase: !!raw.testPurchase,
  };
}
