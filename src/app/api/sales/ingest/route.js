import { connectDB } from "@/lib/db";
import SalesTransaction from "@/lib/models/SalesTransaction";
import RouteAssignment from "@/lib/models/RouteAssignment";
import SyncLog from "@/lib/models/SyncLog";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";
import { parseSalesRow } from "@/lib/utils";

/**
 * Ingest sales rows scraped from goldadam's /sales table.
 * body: { rows: [ {raw row fields, see scraper/lib/salesScraping.js} ], agentId? }
 * Upserts by packageNumber (idempotent). If `agentId` is given (e.g. sales
 * pulled from one sponsored agent's own tab on /sponsored, where whose
 * sales they are is already certain), every row is attributed to it
 * directly. Otherwise falls back to best-effort resolution via
 * RouteAssignment (routeCode + date), same as /api/ingest does for bookings
 * — used for the caller's own sales, where route is the only signal.
 */
export const POST = handler(async (req) => {
  await requireUser(req);
  await connectDB();

  const body = await req.json();
  const raw = Array.isArray(body?.rows) ? body.rows : [];
  const forcedAgentId = body?.agentId || null;
  if (raw.length === 0) return ok({ received: 0, message: "No sales rows in payload" });

  const parsed = raw.map(parseSalesRow).filter((r) => r.packageNumber);

  const assignmentCache = new Map();
  async function resolveAgent(routeCode, dateISO) {
    if (!routeCode || !dateISO) return null;
    const key = `${routeCode}|${dateISO}`;
    if (assignmentCache.has(key)) return assignmentCache.get(key);
    const a = await RouteAssignment.findOne({ routeCode, date: dateISO }).lean();
    const agentId = a?.agentId || null;
    assignmentCache.set(key, agentId);
    return agentId;
  }

  const ops = [];
  for (const r of parsed) {
    const agentId = forcedAgentId || (await resolveAgent(r.routeCode, r.dateISO));
    ops.push({
      updateOne: {
        filter: { packageNumber: r.packageNumber },
        update: {
          $set: {
            ...r,
            scrapedAt: new Date(),
            ...(agentId ? { agentId } : {}),
          },
        },
        upsert: true,
      },
    });
  }

  const res = await SalesTransaction.bulkWrite(ops, { ordered: false });

  await SyncLog.create({
    type: "sales_ingest",
    count: parsed.length,
    detail: `inserted=${res.upsertedCount || 0} modified=${res.modifiedCount || 0}`,
  });

  return ok({
    received: parsed.length,
    inserted: res.upsertedCount || 0,
    modified: res.modifiedCount || 0,
  });
});
