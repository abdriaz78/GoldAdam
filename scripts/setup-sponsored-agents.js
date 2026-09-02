/*
 * One-time setup: create Agent records for Paul's sponsored downline agents
 * (as seen on goldadam's /sponsored tab), matched by goldadamName so their
 * sales scrape can link to a real agentId directly instead of guessing via
 * RouteAssignment (which doesn't apply to other agents' own accounts).
 *
 * Usage: node scripts/setup-sponsored-agents.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import Agent from "../src/lib/models/Agent.js";

const NAMES = [
  "Zachary Arnold",
  "Leland Speed",
  "Curtis Bell",
  "Sean Bourg",
  "Kenneth Walker",
  "Thomas Hicks",
  "Aaron Bechtel",
  "Robert Chaney",
  "Marco Lozano",
  "Napoleon Onyeje",
  "Dewey Johnston",
  "Esgar Delgado",
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const idByName = {};
  for (const name of NAMES) {
    const agent = await Agent.findOneAndUpdate(
      { goldadamName: name },
      { $setOnInsert: { name, goldadamName: name } },
      { upsert: true, new: true }
    );
    idByName[name] = String(agent._id);
    console.log(`${name} -> ${agent._id}`);
  }

  console.log("\n" + JSON.stringify(idByName, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
