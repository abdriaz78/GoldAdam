import { connectDB } from "@/lib/db";
import Booking from "@/lib/models/Booking";
import SyncLog from "@/lib/models/SyncLog";
import { requireAdmin } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { sendSms } from "@/lib/twilio";
import { requireCronOrAdmin } from "@/lib/cron";

function tomorrowISO(base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Texts every pending booking's customer for the given date (default
 * tomorrow) asking them to reply YES/NO to confirm their appointment.
 * Skips bookings already asked unless `resend` is true. The inbound
 * webhook at /api/twilio/inbound reads their reply and updates status.
 */
async function sendConfirmations({ date, resend }) {
  await connectDB();

  try {
    return await runSendConfirmations({ date, resend });
  } catch (error) {
    await SyncLog.create({
      type: "sms_confirmations",
      status: "failed",
      detail: `Run for ${date} crashed: ${error?.message || "unknown error"}`,
    });
    throw error;
  }
}

async function runSendConfirmations({ date, resend }) {
  const filter = { dateISO: date, status: "pending" };
  if (!resend) filter.confirmationRequestedAt = null;

  const bookings = await Booking.find(filter).populate("agentId").lean();
  if (bookings.length === 0) {
    await SyncLog.create({
      type: "sms_confirmations",
      status: "skipped",
      detail: `No pending bookings to confirm for ${date}.`,
    });
    return { message: "No pending bookings to confirm for this date", date, sent: 0 };
  }

  const defaultFrom = process.env.TWILIO_FROM_NUMBER || "";
  const results = [];
  let sentCount = 0;

  for (const booking of bookings) {
    if (!booking.phone) {
      results.push({ bookingId: booking._id, skipped: true, reason: "missing customer phone" });
      continue;
    }
    const from = booking.agentId?.twilioNumber || defaultFrom;
    if (!from) {
      results.push({ bookingId: booking._id, skipped: true, reason: "no Twilio from number available" });
      continue;
    }

    const when = [booking.date, booking.timeWindow].filter(Boolean).join(" ");
    const where = booking.stopName ? ` at ${booking.stopName}` : "";
    const message =
      `Hi ${booking.customerName || "there"}, this confirms your appointment${where}` +
      `${when ? ` on ${when}` : ""}. Reply YES to confirm or NO to cancel.`;

    try {
      await sendSms({ from, to: booking.phone, body: message });
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { confirmationRequestedAt: new Date(), confirmationReplyAt: null, confirmationReplyRaw: "" } }
      );
      results.push({ bookingId: booking._id, sent: true });
      sentCount += 1;
    } catch (error) {
      results.push({ bookingId: booking._id, sent: false, error: error?.message || "Twilio send failed" });
    }
  }

  const skippedCount = results.filter((r) => r.skipped).length;
  const failedCount = results.filter((r) => r.sent === false).length;
  const reasons = results
    .filter((r) => r.skipped || r.sent === false)
    .map((r) => r.reason || r.error)
    .filter(Boolean);
  const uniqueReasons = [...new Set(reasons)];

  await SyncLog.create({
    type: "sms_confirmations",
    status: failedCount > 0 && sentCount === 0 ? "failed" : "success",
    count: sentCount,
    detail:
      `Sent ${sentCount}/${bookings.length} confirmation text(s) for ${date}` +
      (skippedCount ? `, skipped ${skippedCount}` : "") +
      (failedCount ? `, ${failedCount} Twilio send(s) failed` : "") +
      (uniqueReasons.length ? ` — ${uniqueReasons.join("; ")}` : "") +
      ".",
  });

  return { date, sentCount, results };
}

/**
 * POST /api/notifications/send-confirmations
 * body: { date?, resend? }
 * Admin-triggered manual run.
 */
export const POST = handler(async (req) => {
  await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const date = body?.date || tomorrowISO();
  const resend = !!body?.resend;
  return ok(await sendConfirmations({ date, resend }));
});

/**
 * GET /api/notifications/send-confirmations
 * Vercel Cron entry point — auth is a shared CRON_SECRET, not a user session.
 */
export const GET = handler(async (req) => {
  await requireCronOrAdmin(req);
  return ok(await sendConfirmations({ date: tomorrowISO(), resend: false }));
});
