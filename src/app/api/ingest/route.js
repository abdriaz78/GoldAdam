import { connectDB } from "@/lib/db";
import Booking from "@/lib/models/Booking";
import RouteAssignment from "@/lib/models/RouteAssignment";
import SyncLog from "@/lib/models/SyncLog";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { bookingDedupeKey, parseBookingsText, normalizeDateISO } from "@/lib/utils";

/**
 * Ingest bookings from the browser extension.
 * Body may include:
 *   pages:    [{ routeCode, text }]   raw goldadam bookings innerText per route
 *   bookings: [ {structured booking} ] already-parsed rows (optional)
 * Upserts by dedupeKey (idempotent) and resolves agentId via RouteAssignment.
 */
export const POST = handler(async (req) => {
  await requireUser(req); // any authenticated user (agent or admin) can push data
  await connectDB();

  const body = await req.json();
  const pages = Array.isArray(body?.pages) ? body.pages : [];
  const structured = Array.isArray(body?.bookings) ? body.bookings : [];
  const runId = body?.runId || "";

  // Flatten raw pages into structured rows.
  let rows = [...structured];
  for (const page of pages) {
    if (!page?.routeCode || !page?.text) continue;
    rows = rows.concat(parseBookingsText(page.routeCode, page.text));
  }

  if (rows.length === 0) {
    const routeCode = pages[0]?.routeCode || "";
    await SyncLog.create({
      runId,
      type: "bookings_scrape",
      status: "failed",
      routeCode,
      detail: "Page loaded but no bookings text was found — the route may have no stops today, or the page didn't finish rendering.",
    });
    return ok({ upserted: 0, message: "No bookings found in payload" });
  }

  // Cache route+date -> agentId lookups.
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
  for (const r of rows) {
    const dateISO = normalizeDateISO(r.date);
    const dedupeKey = bookingDedupeKey(r);
    const agentId = await resolveAgent(r.routeCode, dateISO);

    ops.push({
      updateOne: {
        filter: { dedupeKey },
        update: {
          $set: {
            routeCode: r.routeCode,
            date: r.date || "",
            dateISO,
            stopName: r.stopName || "",
            address: r.address || "",
            city: r.city || "",
            zip: r.zip || "",
            timeWindow: r.timeWindow || "",
            customerName: r.customerName || "",
            email: r.email || "",
            phone: r.phone || "",
            sourceStatus: r.sourceStatus || "",
            scrapedAt: new Date(),
            ...(agentId ? { agentId } : {}),
          },
          $setOnInsert: {
            dedupeKey,
            // Initial CRM status derived from goldadam's shown status.
            status: /confirm/i.test(r.sourceStatus)
              ? "confirmed"
              : /cancel/i.test(r.sourceStatus)
                ? "cancelled"
                : "pending",
          },
        },
        upsert: true,
      },
    });
  }

  const res = await Booking.bulkWrite(ops, { ordered: false });
  const upserted = (res.upsertedCount || 0) + (res.modifiedCount || 0);

  const routeCodes = [...new Set(rows.map((r) => r.routeCode))];
  await SyncLog.create({
    runId,
    type: "bookings_scrape",
    status: "success",
    routeCode: routeCodes.join(","),
    count: rows.length,
    detail: `Scraped ${rows.length} booking(s) — ${res.upsertedCount || 0} new, ${res.modifiedCount || 0} updated.`,
  });

  return ok({
    received: rows.length,
    inserted: res.upsertedCount || 0,
    modified: res.modifiedCount || 0,
    upserted,
    routes: routeCodes,
  });
});
