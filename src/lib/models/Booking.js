import mongoose from "mongoose";

// CRM-side status lifecycle. `sourceStatus` records what goldadam showed.
export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "no_sale",
];

const BookingSchema = new mongoose.Schema(
  {
    dedupeKey: { type: String, required: true, unique: true, index: true },
    routeCode: { type: String, required: true, index: true },
    date: { type: String, default: "" }, // human date string from goldadam
    dateISO: { type: String, default: "", index: true }, // YYYY-MM-DD for filtering

    stopName: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    zip: { type: String, default: "" },
    timeWindow: { type: String, default: "" },

    customerName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },

    sourceStatus: { type: String, default: "" }, // as seen in goldadam
    status: { type: String, enum: BOOKING_STATUSES, default: "pending", index: true },
    note: { type: String, default: "" },
    timeSlot: { type: String, default: "" }, // chosen confirmation slot
    outcome: { type: String, default: "" }, // purchase/no-sale/no-show detail

    agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", default: null, index: true },

    // Two-way SMS confirmation (customer-facing): set when we text the
    // customer asking them to reply YES/NO, cleared once they answer.
    confirmationRequestedAt: { type: Date, default: null },
    confirmationReplyAt: { type: Date, default: null },
    confirmationReplyRaw: { type: String, default: "" },

    scrapedAt: { type: Date, default: Date.now },
    lastSyncedAt: { type: Date, default: null }, // last successful write-back to goldadam
  },
  { timestamps: true }
);

export default mongoose.models.Booking || mongoose.model("Booking", BookingSchema);
