import fs from "fs";
import path from "path";
import { normalizeDateISO, bookingDedupeKey } from "../src/lib/utils.js";

// Usage: node scripts/csv_to_supabase_sql.js [path-to-csv] [out-sql-file]
const csvPath = process.argv[2] || path.join(process.cwd(), "..", "goldadam-bookings.csv");
const outPath = process.argv[3] || path.join(process.cwd(), "..", "supabase_bookings_import.sql");

if (!fs.existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

function sqlEscape(s) {
  if (s == null) return "";
  return String(s).replace(/'/g, "''");
}

const text = fs.readFileSync(csvPath, "utf8");
const rows = parseCSV(text);
if (rows.length === 0) {
  console.error("No rows in CSV");
  process.exit(1);
}

const header = rows.shift().map((h) => h.trim().toLowerCase());
const idx = (name) => header.indexOf(name);

const lines = [];
lines.push("-- Generated supabase import SQL for bookings");
lines.push("BEGIN;\n");

lines.push(`CREATE TABLE IF NOT EXISTS bookings (
  id bigserial PRIMARY KEY,
  dedupe_key text UNIQUE,
  route_code text,
  date_human text,
  date_iso date,
  stop_name text,
  address text,
  city text,
  zip text,
  time_window text,
  customer_name text,
  email text,
  phone text,
  source_status text,
  status text DEFAULT 'pending',
  scraped_at timestamptz
);\n");

for (const r of rows) {
  const rec = {
    route: r[idx('route')] || "",
    date: r[idx('date')] || "",
    timeWindow: r[idx('time window')] || "",
    customer: r[idx('customer')] || "",
    status: (r[idx('status')] || "").toLowerCase(),
    email: r[idx('email')] || "",
    phone: r[idx('phone')] || "",
    stop: r[idx('stop')] || "",
    address: r[idx('address')] || "",
    city: r[idx('city')] || "",
    zip: r[idx('zip')] || "",
  };

  const dateISO = normalizeDateISO(rec.date);
  const dedupe = bookingDedupeKey({
    routeCode: rec.route,
    date: rec.date,
    customerName: rec.customer,
    timeWindow: rec.timeWindow,
    email: rec.email,
  });

  const vals = [
    dedupe,
    rec.route,
    rec.date,
    dateISO || null,
    rec.stop,
    rec.address,
    rec.city,
    rec.zip,
    rec.timeWindow,
    rec.customer,
    rec.email,
    rec.phone,
    rec.status,
    new Date().toISOString(),
  ].map((v) => (v === null ? 'NULL' : `'${sqlEscape(v)}'`));

  const insert = `INSERT INTO bookings (dedupe_key, route_code, date_human, date_iso, stop_name, address, city, zip, time_window, customer_name, email, phone, source_status, scraped_at) VALUES (${vals.join(", ")}) ON CONFLICT (dedupe_key) DO UPDATE SET route_code = EXCLUDED.route_code, date_human = EXCLUDED.date_human, date_iso = EXCLUDED.date_iso, stop_name = EXCLUDED.stop_name, address = EXCLUDED.address, city = EXCLUDED.city, zip = EXCLUDED.zip, time_window = EXCLUDED.time_window, customer_name = EXCLUDED.customer_name, email = EXCLUDED.email, phone = EXCLUDED.phone, source_status = EXCLUDED.source_status, scraped_at = EXCLUDED.scraped_at;`;
  lines.push(insert);
}

lines.push("\nCOMMIT;\n");
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote SQL to ${outPath}`);
