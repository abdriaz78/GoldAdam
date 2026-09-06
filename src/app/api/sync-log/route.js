import { connectDB } from "@/lib/db";
import SyncLog from "@/lib/models/SyncLog";
import { requireUser, requireAdmin } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

/**
 * POST /api/sync-log
 * body: { runId?, type, status?, routeCode?, count?, detail? }
 * Lets the extension (or a server route) record one step of an automated
 * run — a route scrape, a write-back attempt, a sales page, a daily run's
 * own start/finish marker — without needing direct database access.
 */
export const POST = handler(async (req) => {
  await requireUser(req);
  await connectDB();

  const body = await req.json().catch(() => ({}));
  if (!body?.type) return fail("type is required");

  const log = await SyncLog.create({
    runId: body.runId || "",
    type: body.type,
    status: body.status || "success",
    routeCode: body.routeCode || "",
    count: body.count || 0,
    detail: body.detail || "",
  });

  return ok({ id: log._id });
});

/**
 * GET /api/sync-log?date=YYYY-MM-DD&runId=...&limit=200
 * Admin-only. Without `date`/`runId`, returns the most recent logs. With
 * `date`, returns that day's logs (by `at`) grouped by `runId` client-side.
 * Used by the "Daily Automation Log" dashboard section.
 */
export const GET = handler(async (req) => {
  await requireAdmin(req);
  await connectDB();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const runId = searchParams.get("runId");
  const limit = Math.min(Number(searchParams.get("limit")) || 300, 1000);

  const filter = {};
  if (runId) filter.runId = runId;
  if (date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    filter.at = { $gte: start, $lte: end };
  }

  const logs = await SyncLog.find(filter).sort({ at: -1 }).limit(limit).lean();
  return ok({ logs });
});
