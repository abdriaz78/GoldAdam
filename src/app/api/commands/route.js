import { connectDB } from "@/lib/db";
import WritebackCommand from "@/lib/models/WritebackCommand";
import Booking from "@/lib/models/Booking";
import { requireUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

/**
 * GET /api/commands?routes=DFW001,DFW002
 * The extension polls this for queued write-backs. Returns each command with
 * the booking fields it needs to locate + act on the row inside goldadam.
 */
export const GET = handler(async (req) => {
  await requireUser(req);
  await connectDB();

  const { searchParams } = new URL(req.url);
  const routesParam = searchParams.get("routes");
  const routes = routesParam ? routesParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

  const filter = { status: "queued" };
  if (routes && routes.length) filter.routeCode = { $in: routes };

  const commands = await WritebackCommand.find(filter).sort({ createdAt: 1 }).limit(50).lean();

  const bookingIds = commands.map((c) => c.bookingId);
  const bookings = await Booking.find({ _id: { $in: bookingIds } }).lean();
  const byId = new Map(bookings.map((b) => [String(b._id), b]));

  const enriched = commands.map((c) => ({
    id: c._id,
    action: c.action,
    note: c.note,
    timeSlot: c.timeSlot,
    dryRun: c.dryRun,
    routeCode: c.routeCode,
    booking: byId.get(String(c.bookingId)) || null,
  }));

  return ok({ commands: enriched });
});
