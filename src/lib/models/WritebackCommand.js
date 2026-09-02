import mongoose from "mongoose";

export const WRITEBACK_ACTIONS = ["confirm", "cancel", "complete"];
export const WRITEBACK_STATUSES = ["queued", "in_progress", "done", "failed"];

// A queued instruction for the browser extension to reflect a status change
// back into goldadam by driving its UI.
const WritebackCommandSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    routeCode: { type: String, required: true, index: true },
    action: { type: String, enum: WRITEBACK_ACTIONS, required: true },
    note: { type: String, default: "" },
    timeSlot: { type: String, default: "" },

    status: { type: String, enum: WRITEBACK_STATUSES, default: "queued", index: true },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: "" },
    dryRun: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    executedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.WritebackCommand ||
  mongoose.model("WritebackCommand", WritebackCommandSchema);
