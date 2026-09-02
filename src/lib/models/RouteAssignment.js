import mongoose from "mongoose";

// Which agent runs which route on a given day. Agents change routes per day,
// so bookings resolve to an agent via routeCode + date.
const RouteAssignmentSchema = new mongoose.Schema(
  {
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
    routeCode: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // ISO date string YYYY-MM-DD
  },
  { timestamps: true }
);

RouteAssignmentSchema.index({ routeCode: 1, date: 1 }, { unique: true });

export default mongoose.models.RouteAssignment ||
  mongoose.model("RouteAssignment", RouteAssignmentSchema);
