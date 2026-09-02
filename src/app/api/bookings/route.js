import { connectDB } from "@/lib/db";
import Booking from "@/lib/models/Booking";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

/**
 * GET /api/bookings?route=&status=&agentId=&from=&to=&q=&page=&limit=
 * Agents only see bookings tied to their own agentId.
 */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  await connectDB();

  const { searchParams } = new URL(req.url);
  const route = searchParams.get("route");
  const status = searchParams.get("status");
  const agentId = searchParams.get("agentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

  const filter = {};

  // Per-agent scoping.
  if (user.role === "agent") {
    filter.agentId = user.agentId || null;
  } else if (agentId) {
    filter.agentId = agentId;
  }

  if (route) filter.routeCode = route;
  if (status) filter.status = status;
  if (from || to) {
    filter.dateISO = {};
    if (from) filter.dateISO.$gte = from;
    if (to) filter.dateISO.$lte = to;
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { customerName: rx },
      { email: rx },
      { phone: rx },
      { stopName: rx },
      { address: rx },
    ];
  }

  const total = await Booking.countDocuments(filter);
  const bookings = await Booking.find(filter)
    .populate("agentId", "name")
    .sort({ dateISO: -1, timeWindow: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return ok({ bookings, total, page, limit });
});
