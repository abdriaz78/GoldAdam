/*
 * One-time setup: create the dedicated admin-role CRM login the headless
 * scraper authenticates as (SCRAPER_CRM_EMAIL / SCRAPER_CRM_PASSWORD in
 * .env). Needs admin because it calls /api/sales/ingest, /api/ingest,
 * /api/notifications/send-confirmations and /api/assignments, all
 * admin-only. Kept separate from your personal login so it can be revoked
 * independently.
 *
 * Usage: node scripts/setup-scraper-user.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../src/lib/models/User.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const email = (process.env.SCRAPER_CRM_EMAIL || "scraper@goldadam.local").toLowerCase();
  const password = process.env.SCRAPER_CRM_PASSWORD;
  if (!password || password === "change-me-scraper-password") {
    throw new Error("Set a real SCRAPER_CRM_PASSWORD in .env before running this.");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Scraper user already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash, name: "Scraper", role: "admin" });
    console.log(`Scraper login created: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
