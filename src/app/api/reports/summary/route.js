import { connectDB } from "@/lib/db";
import Booking, { BOOKING_STATUSES } from "@/lib/models/Booking";
import SalesTransaction from "@/lib/models/SalesTransaction";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

/**
 * GET /api/reports/summary?agentId=&from=&to=
 * Aggregate dashboard numbers: booking status breakdown, sales totals, top
 * routes by payout, and a daily payout trend for the last 14 days. Scoped
 * to the requesting agent's own data unless the caller is an admin.
 */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  await connectDB();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const agentIdParam = searchParams.get("agentId");

  const scopeAgentId = user.role === "agent" ? user.agentId || null : agentIdParam || null;

  const bookingFilter = {};
  const salesFilter = { testPurchase: false };
  if (scopeAgentId) {
    bookingFilter.agentId = scopeAgentId;
    salesFilter.agentId = scopeAgentId;
  }
  if (from || to) {
    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    bookingFilter.dateISO = range;
    salesFilter.dateISO = range;
  }

  const [bookingCounts, salesTotalsAgg, byRoute, byDay] = await Promise.all([
    Booking.aggregate([{ $match: bookingFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    SalesTransaction.aggregate([
      { $match: salesFilter },
      {
        $group: {
          _id: null,
          totalPayout: { $sum: "$payout" },
          totalProfit: { $sum: "$estProfit" },
          totalGoldGrams: { $sum: "$goldGrams" },
          totalSilverGrams: { $sum: "$silverGrams" },
          avgMargin: { $avg: "$marginPercent" },
          count: { $sum: 1 },
        },
      },
    ]),
    SalesTransaction.aggregate([
      { $match: salesFilter },
      { $group: { _id: "$routeCode", count: { $sum: 1 }, payout: { $sum: "$payout" } } },
      { $sort: { payout: -1 } },
      { $limit: 10 },
    ]),
    SalesTransaction.aggregate([
      { $match: salesFilter },
      { $group: { _id: "$dateISO", payout: { $sum: "$payout" }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 14 },
    ]),
  ]);

  const bookingsByStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0]));
  let bookingsTotal = 0;
  for (const row of bookingCounts) {
    if (row._id in bookingsByStatus) bookingsByStatus[row._id] = row.count;
    bookingsTotal += row.count;
  }

  const salesTotals = salesTotalsAgg[0] || {
    totalPayout: 0,
    totalProfit: 0,
    totalGoldGrams: 0,
    totalSilverGrams: 0,
    avgMargin: 0,
    count: 0,
  };

  return ok({
    bookings: { total: bookingsTotal, byStatus: bookingsByStatus },
    sales: salesTotals,
    topRoutes: byRoute.map((r) => ({ routeCode: r._id || "(unknown)", count: r.count, payout: r.payout })),
    dailyPayout: byDay
      .map((d) => ({ date: d._id || "(unknown)", payout: d.payout, count: d.count }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  });
});
