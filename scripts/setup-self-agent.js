/*
 * One-time setup: create an Agent record + an agent-role CRM login for the
 * person actually running the goldadam account being scraped (matches the
 * "Paul Sandhu" name shown in goldadam's own UI). This lets you log into
 * the CRM as an agent and see only-your-own bookings/sales, alongside the
 * generic admin account that sees everything.
 *
 * Usage: node scripts/setup-self-agent.js
 * Reads SELF_AGENT_NAME / SELF_AGENT_EMAIL / SELF_AGENT_PASSWORD from .env
 * (falls back to sensible defaults matching goldadam's displayed name).
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Agent from "../src/lib/models/Agent.js";
import User from "../src/lib/models/User.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const name = process.env.SELF_AGENT_NAME || "Paul Sandhu";
  const goldadamName = process.env.SELF_AGENT_GOLDADAM_NAME || "Paul Sandhu";
  const email = (process.env.SELF_AGENT_EMAIL || "paul@goldadam-crm.local").toLowerCase();
  const password = process.env.SELF_AGENT_PASSWORD || "changeme123";

  const agent = await Agent.findOneAndUpdate(
    { goldadamName },
    { $setOnInsert: { name, goldadamName } },
    { upsert: true, new: true }
  );
  console.log(`Agent ready: ${agent.name} (${agent._id})`);

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (!existingUser.agentId) {
      existingUser.agentId = agent._id;
      existingUser.role = "agent";
      await existingUser.save();
      console.log(`Linked existing user ${email} to agent ${agent.name}`);
    } else {
      console.log(`User already exists: ${email}`);
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash, name, role: "agent", agentId: agent._id });
    console.log(`Agent login created: ${email} / ${password}`);
  }

  console.log(`\nSELF_AGENT_ID=${agent._id}`);
  console.log("Add this to .env so the daily scraper can auto-assign today's scraped routes to this agent.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
