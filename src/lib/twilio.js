import Twilio from "twilio";

export function createTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables.");
  }
  return Twilio(sid, token);
}

export async function sendSms({ from, to, body }) {
  if (!from) throw new Error("Missing Twilio from number");
  if (!to) throw new Error("Missing destination phone number");
  if (!body) throw new Error("Missing SMS body");

  const client = createTwilioClient();
  return client.messages.create({ from, to, body });
}

// Compare phone numbers by their last 10 digits so formatting differences
// (+1, dashes, spaces, parens) don't break matching.
export function last10Digits(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

// Best-effort YES/NO classification of a customer's SMS reply.
export function classifyYesNo(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (/^(y|yes|yeah|yep|confirm|confirmed|ok|okay|sure|1)\b/.test(normalized)) return "yes";
  if (/^(n|no|nope|cancel|cancelled|stop|2)\b/.test(normalized)) return "no";
  return null;
}
