import { connectDB } from "@/lib/db";
import Agent from "@/lib/models/Agent";
import Booking from "@/lib/models/Booking";
import RouteAssignment from "@/lib/models/RouteAssignment";
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

async function sendReminders({ date }) {
  await connectDB();

  try {
    return await runSendReminders({ date });
  } catch (error) {
    await SyncLog.create({
      type: "sms_reminders",
      status: "failed",
      detail: `Run for ${date} crashed: ${error?.message || "unknown error"}`,
    });
    throw error;
  }
}

async function runSendReminders({ date }) {
  const assignments = await RouteAssignment.find({ date }).populate("agentId").lean();
  if (assignments.length === 0) {
    await SyncLog.create({
      type: "sms_reminders",
      status: "skipped",
      detail: `No route assignments for ${date}.`,
    });
    return { message: "No route assignments for this date", date, sent: 0 };
  }

  const agentGroups = new Map();
  const results = [];

  for (const assignment of assignments) {
    const agent = assignment.agentId;
    if (!agent) {
      results.push({ routeCode: assignment.routeCode, skipped: true, reason: "no assigned agent" });
      continue;
    }
    if (!agentGroups.has(String(agent._id))) {
      agentGroups.set(String(agent._id), {
        agent,
        routeCodes: [],
      });
    }
    agentGroups.get(String(agent._id)).routeCodes.push(assignment.routeCode);
  }

  let sentCount = 0;
  for (const group of agentGroups.values()) {
    const { agent, routeCodes } = group;
    if (!agent.phone) {
      results.push({ agentId: agent._id, skipped: true, reason: "missing agent phone" });
      continue;
    }
    if (!agent.twilioNumber) {
      results.push({ agentId: agent._id, skipped: true, reason: "missing agent Twilio number" });
      continue;
    }

    const bookings = await Booking.find({ routeCode: { $in: routeCodes }, dateISO: date }).sort({ timeWindow: 1 }).lean();
    const totalBookings = bookings.length;
    const routeSummaries = routeCodes.map((routeCode) => {
      const count = bookings.filter((b) => b.routeCode === routeCode).length;
      return `${routeCode} (${count})`;
    });
    const uniqueWindows = Array.from(new Set(bookings.map((b) => b.timeWindow).filter(Boolean))).slice(0, 3);
    const timeSummary = uniqueWindows.length ? ` First booking times: ${uniqueWindows.join(", ")}.` : "";

    const message = `Hi ${agent.name}, you are assigned ${routeCodes.length === 1 ? "route" : "routes"} ${routeCodes.join(", ")} on ${date}. ` +
      `There ${totalBookings === 1 ? "is" : "are"} ${totalBookings} booking${totalBookings === 1 ? "" : "s"}.${timeSummary} Please confirm in the portal.`;

    try {
      await sendSms({ from: agent.twilioNumber, to: agent.phone, body: message });
      results.push({ agentId: agent._id, sent: true, routeCodes, totalBookings });
      sentCount += 1;
    } catch (error) {
      results.push({ agentId: agent._id, sent: false, routeCodes, error: error?.message || "Twilio send failed" });
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
    type: "sms_reminders",
    status: failedCount > 0 && sentCount === 0 ? "failed" : "success",
    count: sentCount,
    detail:
      `Sent ${sentCount}/${agentGroups.size} agent reminder(s) for ${date}` +
      (skippedCount ? `, skipped ${skippedCount}` : "") +
      (failedCount ? `, ${failedCount} Twilio send(s) failed` : "") +
      (uniqueReasons.length ? ` — ${uniqueReasons.join("; ")}` : "") +
      ".",
  });

  return { date, assignedAgents: agentGroups.size, sentCount, results };
}

/**
 * POST /api/notifications/send-reminders
 * body: { date? }
 * Admin-triggered manual run.
 */
export const POST = handler(async (req) => {
  await requireAdmin(req);
  const body = await req.json().catch(() => ({}));
  const date = body?.date || tomorrowISO();
  return ok(await sendReminders({ date }));
});

/**
 * GET /api/notifications/send-reminders
 * Vercel Cron entry point — auth is a shared CRON_SECRET, not a user session.
 */
export const GET = handler(async (req) => {
  await requireCronOrAdmin(req);
  return ok(await sendReminders({ date: tomorrowISO() }));
});
