import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Route from "../src/lib/models/Route.js";
import User from "../src/lib/models/User.js";

// All 45 routes (from the goldadam route selector). Metro derived from prefix.
const ROUTES = [
  ["DFW001", "North Dallas"],
  ["DFW002", "Mid-Cities"],
  ["DFW003", "East Dallas"],
  ["DFW004", "NW Dallas"],
  ["DFW005", "South Dallas"],
  ["DFW006", "Central Dallas"],
  ["DFW007", "North FW"],
  ["TXR002", "SFW Rural/Cleburne"],
  ["DFW009", "Central Dallas"],
  ["DFW010", "North/NE Dallas"],
  ["TXR003", "North DFW Rural (McKinney)"],
  ["TXR001", "Southeast Rural (Kauffman)"],
  ["DFW013", "North/NE Dallas"],
  ["DFW014", "Mid-Cities/FW"],
  ["DFW015", "Fort Worth"],
  ["DFW016", "Greater Dallas Metro"],
  ["HOU001", "North Houston"],
  ["HOU002", "Northwest Houston"],
  ["HOU003", "West Houston"],
  ["HOU004", "West Houston"],
  ["HOU005", "South Houston"],
  ["HOU006", "Southeast Houston"],
  ["HOU007", "Southeast Houston"],
  ["HOU008", "Northeast/East Houston"],
  ["HOU009", "Northeast/East Houston"],
  ["HOU010", "South Houston"],
  ["HOU011", "East Houston"],
  ["HOU012", "East Houston"],
  ["HOU013", "Northwest/North Houston"],
  ["HOU014", "Houston"],
  ["SAA001", "Northeast San Antonio"],
  ["SAA002", "San Antonio"],
  ["SAA003", "San Antonio"],
  ["AUS001", "North Austin"],
  ["AUS002", "Austin"],
  ["AUS003", "South Austin"],
  ["HOUTXR001", "Rural HTX"],
  ["SAATXR001", "San Antonio Rural"],
  ["AUSTXR001", "Austin Rural"],
  ["WestTX001", "West Texas"],
  ["WestTX002", "West Texas"],
  ["HOUTXR002", "Rural Houston"],
  ["SAATXR002", "Laredo/McAllen"],
  ["WestTX003", "El Paso"],
  ["US1-ATX", "Austin Walmart Tour"],
];

function metroFor(code) {
  if (/^DFW|^TXR/.test(code)) return "Dallas-Fort Worth";
  if (/^HOU/.test(code)) return "Houston";
  if (/^SAA/.test(code)) return "San Antonio";
  if (/^AUS|^US1-ATX/.test(code)) return "Austin";
  if (/^WestTX/.test(code)) return "West Texas";
  return "";
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Routes
  const ops = ROUTES.map(([code, region]) => ({
    updateOne: {
      filter: { code },
      update: { $set: { code, region, metro: metroFor(code) } },
      upsert: true,
    },
  }));
  const res = await Route.bulkWrite(ops);
  console.log(`Routes seeded: ${res.upsertedCount || 0} new, ${res.modifiedCount || 0} updated (of ${ROUTES.length})`);

  // Admin user
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@goldadam.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash, name: "Admin", role: "admin" });
    console.log(`Admin created: ${email} / ${password}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
