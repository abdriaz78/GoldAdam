import mongoose from "mongoose";

const AgentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "" },
    twilioNumber: { type: String, default: "" },
    goldadamName: { type: String, default: "" }, // name as it appears in the Sponsored tab
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Agent || mongoose.model("Agent", AgentSchema);
