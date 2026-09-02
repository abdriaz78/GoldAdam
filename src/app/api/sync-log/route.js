import { connectDB } from "@/lib/db";
import SyncLog from "@/lib/models/SyncLog";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

/**
 * POST /api/sync-log
 * body: { type, routeCode?, count?, detail? }
 * Lets the headless scraper (or the extension) record run/auth events
 * (e.g. "scraper_run", "auth_failed", "scraper_error") without needing
 * direct database access.
 */
export const POST = handler(async (req) => {
  await requireUser(req);
  await connectDB();

  const body = await req.json().catch(() => ({}));
  if (!body?.type) return fail("type is required");

  const log = await SyncLog.create({
    type: body.type,
    routeCode: body.routeCode || "",
    count: body.count || 0,
    detail: body.detail || "",
  });

  return ok({ id: log._id });
});
