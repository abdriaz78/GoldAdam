import twilioSdk from "twilio";
import { connectDB } from "@/lib/db";
import Booking from "@/lib/models/Booking";
import WritebackCommand from "@/lib/models/WritebackCommand";
import { last10Digits, classifyYesNo } from "@/lib/twilio";

const { validateRequest, twiml } = twilioSdk;

function twimlReply(message) {
  const response = new twiml.MessagingResponse();
  if (message) response.message(message);
  return new Response(response.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * POST /api/twilio/inbound
 * Twilio webhook for "A MESSAGE COMES IN" on the numbers used to text
 * customers. A customer's YES/NO reply is matched to the most recent
 * booking we sent them a confirmation request for, and the booking's
 * status is updated. This is the read half of the two-way flow started
 * by /api/notifications/send-confirmations.
 */
export async function POST(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());

  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") || "";
    // Behind a reverse proxy (tunnel, load balancer) req.url reflects the
    // internal address (e.g. http://localhost:3001/...), not the public URL
    // Twilio actually signed against — rebuild it from the forwarded headers
    // it sent instead, or the signature never validates.
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const publicUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}${new URL(req.url).pathname}${new URL(req.url).search}`
      : req.url;
    const valid = validateRequest(authToken, signature, publicUrl, params);
    if (!valid) {
      if (process.env.NODE_ENV === "production") {
        return new Response("Invalid signature", { status: 403 });
      }
      console.warn("[twilio/inbound] signature validation failed (non-production, continuing)");
    }
  } else {
    console.warn("[twilio/inbound] TWILIO_AUTH_TOKEN not set — skipping signature validation");
  }

  const from = params.From;
  const bodyText = (params.Body || "").trim();
  if (!from || !bodyText) return twimlReply("");

  await connectDB();

  const fromDigits = last10Digits(from);
  const candidates = await Booking.find({
    status: "pending",
    confirmationRequestedAt: { $ne: null },
    confirmationReplyAt: null,
  })
    .sort({ confirmationRequestedAt: -1 })
    .lean();

  const booking = candidates.find((b) => last10Digits(b.phone) === fromDigits && fromDigits);
  if (!booking) {
    return twimlReply("We couldn't find a pending appointment for this number. Please call us if you need help.");
  }

  const answer = classifyYesNo(bodyText);
  if (!answer) {
    return twimlReply("Sorry, we didn't catch that. Please reply YES to confirm or NO to cancel your appointment.");
  }

  const now = new Date();
  if (answer === "yes") {
    const timeSlot = booking.timeWindow || booking.timeSlot || "";
    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          status: "confirmed",
          timeSlot,
          confirmationReplyAt: now,
          confirmationReplyRaw: bodyText,
        },
      }
    );
    await WritebackCommand.create({
      bookingId: booking._id,
      routeCode: booking.routeCode,
      action: "confirm",
      note: `Customer confirmed via SMS reply: "${bodyText}"`,
      timeSlot,
      dryRun: true,
      status: "queued",
    });
    return twimlReply("Thanks! Your appointment is confirmed.");
  }

  await Booking.updateOne(
    { _id: booking._id },
    {
      $set: {
        status: "cancelled",
        note: `Customer declined via SMS reply: "${bodyText}"`,
        confirmationReplyAt: now,
        confirmationReplyRaw: bodyText,
      },
    }
  );
  await WritebackCommand.create({
    bookingId: booking._id,
    routeCode: booking.routeCode,
    action: "cancel",
    note: `Customer declined via SMS reply: "${bodyText}"`,
    dryRun: true,
    status: "queued",
  });
  return twimlReply("Got it, we've cancelled your appointment. Reply to this number if you'd like to reschedule.");
}
