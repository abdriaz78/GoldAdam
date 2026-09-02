import { connectDB } from "@/lib/db";
import Booking from "@/lib/models/Booking";
import WritebackCommand, { WRITEBACK_ACTIONS } from "@/lib/models/WritebackCommand";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

// Map a target CRM status to the goldadam write-back action.
const STATUS_TO_ACTION = {
  confirmed: "confirm",
  cancelled: "cancel",
  completed: "complete",
};

/**
 * PATCH /api/bookings/:id/status
 * body: { status, note, timeSlot, dryRun }
 * Updates CRM status immediately and queues a write-back command for the
 * extension to reflect the change into goldadam.
 */
export const PATCH = handler(async (req, ctx) => {
  const user = await requireUser(req);
  await connectDB();

  const { id } = await ctx.params;
  const { status, note = "", timeSlot = "", dryRun = true } = await req.json();

  const booking = await Booking.findById(id);
  if (!booking) return fail("Booking not found", 404);

  // Agents may only touch their own bookings.
  if (user.role === "agent" && String(booking.agentId || "") !== String(user.agentId || "")) {
    return fail("Forbidden", 403);
  }

  const action = STATUS_TO_ACTION[status];
  if (!action || !WRITEBACK_ACTIONS.includes(action)) {
    return fail(`Unsupported status change: ${status}`);
  }

  // Confirm requires a chosen slot; cancel requires a reason note.
  if (status === "confirmed" && !timeSlot) return fail("A confirmation time slot is required");
  if (status === "cancelled" && !note) return fail("A cancellation reason note is required");

  booking.status = status;
  booking.note = note;
  if (timeSlot) booking.timeSlot = timeSlot;
  await booking.save();

  const command = await WritebackCommand.create({
    bookingId: booking._id,
    routeCode: booking.routeCode,
    action,
    note,
    timeSlot,
    dryRun: !!dryRun,
    createdBy: user._id,
    status: "queued",
  });

  return ok({ booking, command });
});
