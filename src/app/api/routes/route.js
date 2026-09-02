import { connectDB } from "@/lib/db";
import Route from "@/lib/models/Route";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const GET = handler(async (req) => {
  await requireUser(req);
  await connectDB();
  const routes = await Route.find({}).sort({ code: 1 }).lean();
  return ok({ routes });
});
