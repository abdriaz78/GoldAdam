import { connectDB } from "@/lib/db";
import WritebackCommand from "@/lib/models/WritebackCommand";
import Booking from "@/lib/models/Booking";
import SyncLog from "@/lib/models/SyncLog";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

/**
 * POST /api/commands/:id/result
 * body: { success, error, dryRun }
 * The extension reports the outcome of executing a write-back inside goldadam.
 */
export const POST = handler(async (req, ctx) => {
  await requireUser(req);
  await connectDB();

  const { id } = await ctx.params;
  const { success, error = "", dryRun = false, runId = "" } = await req.json();

  const command = await WritebackCommand.findById(id);
  if (!command) return fail("Command not found", 404);

  command.attempts += 1;
  command.executedAt = new Date();

  if (success) {
    command.status = "done";
    command.error = "";
    // On a real (non-dry-run) success, mark the booking as synced to goldadam.
    if (!dryRun) {
      await Booking.findByIdAndUpdate(command.bookingId, { lastSyncedAt: new Date() });
    }
  } else {
    command.status = "failed";
    command.error = error || "Unknown error";
  }
  await command.save();

  await SyncLog.create({
    runId,
    type: "writeback",
    status: success ? "success" : "failed",
    routeCode: command.routeCode,
    count: 1,
    detail: `${command.action}${dryRun ? " (dry-run)" : ""}${success ? " — done" : " — failed: " + error}`.trim(),
  });

  return ok({ command });
});
