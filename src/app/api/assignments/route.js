import { connectDB } from "@/lib/db";
import RouteAssignment from "@/lib/models/RouteAssignment";
import Booking from "@/lib/models/Booking";
import { requireUser, requireAdmin } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const GET = handler(async (req) => {
  await requireUser(req);
  await connectDB();
  const assignments = await RouteAssignment.find({})
    .populate("agentId", "name")
    .sort({ date: -1, routeCode: 1 })
    .lean();
  return ok({ assignments });
});

/**
 * POST assign agent -> route on date. Also back-fills agentId on any bookings
 * already scraped for that route+date so the assignment takes effect immediately.
 *
 * `ifAbsent: true` only fills a gap (no existing assignment for that
 * route+date) and never overwrites one a human already made — used by the
 * scraper's default "assign today's scraped routes to me" behavior.
 */
export const POST = handler(async (req) => {
  await requireAdmin(req);
  await connectDB();

  const { agentId, routeCode, date, ifAbsent } = await req.json();
  if (!agentId || !routeCode || !date) return fail("agentId, routeCode and date are required");

  const assignment = ifAbsent
    ? await RouteAssignment.findOneAndUpdate(
        { routeCode, date },
        { $setOnInsert: { agentId, routeCode, date } },
        { upsert: true, new: true }
      )
    : await RouteAssignment.findOneAndUpdate(
        { routeCode, date },
        { agentId, routeCode, date },
        { upsert: true, new: true }
      );

  const bookingFilter = ifAbsent ? { routeCode, dateISO: date, agentId: null } : { routeCode, dateISO: date };
  const res = await Booking.updateMany(bookingFilter, { $set: { agentId: assignment.agentId } });

  return ok({ assignment, bookingsUpdated: res.modifiedCount || 0 });
});
