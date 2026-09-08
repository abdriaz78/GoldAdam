"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Card, StatusChip, NoteBox, Btn } from "@/components/ui";

// Only these statuses map to a goldadam write-back action (per MVP scope).
const ACTIONS = [
  { status: "confirmed", label: "Confirm", needsSlot: true },
  { status: "cancelled", label: "Cancel", needsReason: true },
  { status: "completed", label: "Completed (Purchase)" },
];

// Inline booking detail / update panel — sits in the right column of the
// Appointments two-col layout, not a modal overlay.
export default function BookingDetailPanel({ booking, onClose, onSaved }) {
  const [status, setStatus] = useState("confirmed");
  const [note, setNote] = useState(booking.note || "");
  const [timeSlot, setTimeSlot] = useState(booking.timeSlot || "");
  const [dryRun, setDryRun] = useState(true);
  const [saving, setSaving] = useState(false);

  const current = ACTIONS.find((a) => a.status === status);

  async function save() {
    if (current?.needsSlot && !timeSlot) return toast.error("Enter the confirmed time slot");
    if (current?.needsReason && !note) return toast.error("Enter a cancellation reason");
    setSaving(true);
    try {
      await api(`/api/bookings/${booking._id}/status`, {
        method: "PATCH",
        body: { status, note, timeSlot, dryRun },
      });
      toast.success(dryRun ? "Saved in CRM · write-back queued as DRY-RUN" : "Saved · write-back queued for goldadam");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="text-[13px] font-semibold text-text">Booking detail — {booking.customerName}</div>
      <div className="mt-1 text-[12.5px] text-muted">
        {booking.routeCode} · {booking.timeWindow} · {booking.stopName || booking.address}
      </div>
      <div className="mt-2.5">
        <StatusChip status={booking.status} />
      </div>

      <div className="mb-1 mt-4 text-[11.5px] text-muted">Outcome</div>
      <div className="flex gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.status}
            onClick={() => setStatus(a.status)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
              status === a.status ? "border-gold bg-gold-dim/40 text-[#F0DBA8]" : "border-border text-muted hover:bg-panel-raised"
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {current?.needsSlot && (
        <div className="mt-3.5">
          <div className="mb-1 text-[11.5px] text-muted">Confirmed time slot</div>
          <input
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            placeholder="e.g. 2:10 PM - 3:10 PM"
            className="w-full rounded-lg border border-border bg-[#161C25] px-3 py-2 text-[13px] text-text placeholder:text-muted-dim focus:outline-none focus:ring-1 focus:ring-gold-dim"
          />
        </div>
      )}

      <div className="mt-3.5">
        <div className="mb-1 text-[11.5px] text-muted">
          Note {current?.needsReason ? <span className="text-red">* required</span> : "(optional)"}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="e.g. Confirmed by phone, client will be home by 9. Syncs back to Gold Adam."
          className="w-full resize-none rounded-lg border border-border bg-[#161C25] px-3 py-2 text-[12.5px] text-text placeholder:text-muted-dim focus:outline-none focus:ring-1 focus:ring-gold-dim"
        />
        <div className="mt-1 text-right text-[10.5px] text-muted-dim">{note.length} / 500 · Saves to Goldroute and Gold Adam</div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-[12.5px] text-muted">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="accent-gold" />
        Dry-run (queue write-back but don&apos;t change goldadam yet)
      </label>

      <div className="mt-4 flex gap-2">
        <Btn variant="gold" onClick={save} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Save & queue"}
        </Btn>
        <Btn variant="outline" onClick={onClose}>
          Close
        </Btn>
      </div>

      <div className="mt-4 flex justify-between border-t border-border pt-3 text-[11px] text-muted-dim">
        <span>{booking.lastSyncedAt ? `Last synced: ${new Date(booking.lastSyncedAt).toLocaleTimeString()}` : "Not yet synced"}</span>
        <span>ID: {String(booking._id).slice(-8)}</span>
      </div>
    </Card>
  );
}
