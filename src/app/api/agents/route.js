import { connectDB } from "@/lib/db";
import Agent from "@/lib/models/Agent";
import { requireUser, requireAdmin } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const GET = handler(async (req) => {
  await requireUser(req);
  await connectDB();
  const agents = await Agent.find({}).sort({ name: 1 }).lean();
  return ok({ agents });
});

export const POST = handler(async (req) => {
  await requireAdmin(req);
  await connectDB();
  const { name, email = "", phone = "", twilioNumber = "", goldadamName = "" } = await req.json();
  if (!name) return fail("Name is required");
  const agent = await Agent.create({ name, email, phone, twilioNumber, goldadamName });
  return ok({ agent });
});
