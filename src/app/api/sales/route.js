import { connectDB } from "@/lib/db";
import SalesTransaction from "@/lib/models/SalesTransaction";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

/**
 * GET /api/sales?route=&agentId=&from=&to=&q=&includeTest=&page=&limit=
 * Agents only see sales tied to their own agentId. Test purchases are
 * excluded by default (pass includeTest=1 to include them).
 */
export const GET = handler(async (req) => {
  const user = await requireUser(req);
  await connectDB();

  const { searchParams } = new URL(req.url);
  const route = searchParams.get("route");
  const agentId = searchParams.get("agentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q");
  const includeTest = searchParams.get("includeTest") === "1";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)));

  const filter = {};

  if (user.role === "agent") {
    filter.agentId = user.agentId || null;
  } else if (agentId) {
    filter.agentId = agentId;
  }

  if (route) filter.routeCode = route;
  if (!includeTest) filter.testPurchase = false;
  if (from || to) {
    filter.dateISO = {};
    if (from) filter.dateISO.$gte = from;
    if (to) filter.dateISO.$lte = to;
  }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ customerName: rx }, { packageNumber: rx }];
  }

  const total = await SalesTransaction.countDocuments(filter);
  const sales = await SalesTransaction.find(filter)
    .populate("agentId", "name")
    .sort({ dateISO: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const summaryAgg = await SalesTransaction.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalPayout: { $sum: "$payout" },
        totalProfit: { $sum: "$estProfit" },
        totalGoldGrams: { $sum: "$goldGrams" },
        totalSilverGrams: { $sum: "$silverGrams" },
        avgMargin: { $avg: "$marginPercent" },
        paidCount: { $sum: { $cond: ["$paid", 1, 0] } },
      },
    },
  ]);

  const summary = summaryAgg[0] || {
    totalPayout: 0,
    totalProfit: 0,
    totalGoldGrams: 0,
    totalSilverGrams: 0,
    avgMargin: 0,
    paidCount: 0,
  };

  return ok({ sales, total, page, limit, summary });
});
