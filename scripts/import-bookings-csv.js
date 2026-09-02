import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Booking from "../src/lib/models/Booking.js";
import { bookingDedupeKey, normalizeDateISO } from "../src/lib/utils.js";

/**
 * Import a bookings CSV (the P0 export) into MongoDB.
 * Usage: node scripts/import-bookings-csv.js [path-to-csv]
 * Default: ../goldadam-bookings.csv (the file in the PAUL folder).
 * Expected columns: Route,Date,Time Window,Customer,Status,Email,Phone,Stop,Address,City,Zip
 */

// Minimal RFC-4180-ish CSV parser (handles quoted fields with commas + "" escapes).
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

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");

  const csvPath = process.argv[2] || path.join(process.cwd(), "..", "goldadam-bookings.csv");
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);
  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  await mongoose.connect(uri);
  console.log("Connected to MongoDB. Importing", rows.length, "rows from", csvPath);

  const ops = rows.map((r) => {
    const rec = {
      routeCode: r[idx("route")] || "",
      date: r[idx("date")] || "",
      timeWindow: r[idx("time window")] || "",
      customerName: r[idx("customer")] || "",
      sourceStatus: (r[idx("status")] || "").toLowerCase(),
      email: r[idx("email")] || "",
      phone: r[idx("phone")] || "",
      stopName: r[idx("stop")] || "",
      address: r[idx("address")] || "",
      city: r[idx("city")] || "",
      zip: r[idx("zip")] || "",
    };
    const dedupeKey = bookingDedupeKey(rec);
    return {
      updateOne: {
        filter: { dedupeKey },
        update: {
          $set: { ...rec, dateISO: normalizeDateISO(rec.date), scrapedAt: new Date() },
          $setOnInsert: { dedupeKey, status: "pending" },
        },
        upsert: true,
      },
    };
  });

  const res = await Booking.bulkWrite(ops, { ordered: false });
  console.log(`Imported: ${res.upsertedCount || 0} new, ${res.modifiedCount || 0} updated`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
