import mongoose from "mongoose";

// List-level fields only (goldadam's /sales table). Deliberately excludes
// bank account/routing numbers and ID document numbers, which only appear
// in the per-row detail modal — see SITE_NOTES.md "Deliberate scope decision".
const SalesTransactionSchema = new mongoose.Schema(
  {
    packageNumber: { type: String, required: true, unique: true, index: true },
    date: { type: String, default: "" }, // raw "Aug 24, 2026, 01:49 AM" from goldadam
    dateISO: { type: String, default: "", index: true },

    customerName: { type: String, default: "" },
    routeCode: { type: String, default: "", index: true },

    goldGrams: { type: Number, default: null },
    silverGrams: { type: Number, default: null },
    marginPercent: { type: Number, default: null },
    estProfit: { type: Number, default: null },
    payout: { type: Number, default: null },

    paid: { type: Boolean, default: false },
    controlled: { type: Boolean, default: false },
    testPurchase: { type: Boolean, default: false },

    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", default: null, index: true },

    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.SalesTransaction ||
  mongoose.model("SalesTransaction", SalesTransactionSchema);
