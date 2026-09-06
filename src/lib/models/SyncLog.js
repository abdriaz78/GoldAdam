import mongoose from "mongoose";

export const SYNC_LOG_STATUSES = ["started", "success", "failed", "skipped"];

// One row per step of an automated run (a route scrape, a write-back
// attempt, a sales page, an SMS batch, or the run's own start/finish
// marker). `runId` groups every step of one daily run together so the
// dashboard can show "today's run: 8/10 routes ok, sales ok, 2 failed"
// and let you open any row to see exactly what happened and why.
const SyncLogSchema = new mongoose.Schema(
  {
    runId: { type: String, default: "", index: true },
    type: { type: String, required: true, index: true }, // "daily_run" | "bookings_scrape" | "writeback" | "sales_scrape" | "sales_ingest" | "ingest" | "sms_confirmations" | "sms_reminders"
    status: { type: String, enum: SYNC_LOG_STATUSES, default: "success", index: true },
    routeCode: { type: String, default: "" },
    count: { type: Number, default: 0 },
    detail: { type: String, default: "" }, // human-readable: what it did, or why it failed
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

export default mongoose.models.SyncLog || mongoose.model("SyncLog", SyncLogSchema);
