import mongoose from "mongoose";

const SyncLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. "ingest", "writeback"
    routeCode: { type: String, default: "" },
    count: { type: Number, default: 0 },
    detail: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.SyncLog || mongoose.model("SyncLog", SyncLogSchema);
