import { sendSms } from "../../src/lib/twilio.js";

/**
 * Fire-and-forget alert to the human operator. Never throws — a failed alert
 * must not crash the caller's own error-handling path. Called at most once
 * per problem (session expired, unexpected run failure) — no retry loop.
 */
export async function sendAlert(message) {
  console.error("[scraper][ALERT]", message);

  const to = process.env.ALERT_PHONE_NUMBER;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!to || !from) {
    console.warn("[scraper][alert] ALERT_PHONE_NUMBER or TWILIO_FROM_NUMBER not set — alert logged to console only");
    return;
  }

  try {
    await sendSms({ from, to, body: `[Goldroute scraper] ${message}` });
  } catch (e) {
    console.error("[scraper][alert] failed to send alert SMS:", e?.message || e);
  }
}
