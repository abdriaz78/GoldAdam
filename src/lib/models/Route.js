import mongoose from "mongoose";

const RouteSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true }, // e.g. DFW001
    region: { type: String, default: "" }, // e.g. North Dallas
    metro: { type: String, default: "" }, // e.g. Dallas-Fort Worth
  },
  { timestamps: true }
);

export default mongoose.models.Route || mongoose.model("Route", RouteSchema);
