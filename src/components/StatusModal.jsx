"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";

// Only these statuses map to a goldadam write-back action (per MVP scope).
const ACTIONS = [
  { status: "confirmed", label: "Confirm", needsSlot: true },
  { status: "cancelled", label: "Cancel", needsReason: true },
  { status: "completed", label: "Completed (Purchase)" },
];

export default function StatusModal({ booking, onClose, onSaved }) {
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
      toast.success(
        dryRun
          ? "Saved in CRM · write-back queued as DRY-RUN"
          : "Saved · write-back queued for goldadam"
      );
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Update booking</h2>
          <p className="text-sm text-slate-500">
            {booking.customerName} · {booking.routeCode} · {booking.timeWindow}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Outcome</label>
          <div className="flex gap-2">
            {ACTIONS.map((a) => (
              <button
                key={a.status}
                onClick={() => setStatus(a.status)}
                className={`flex-1 rounded-lg border px-2 py-2 text-sm ${
                  status === a.status
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {current?.needsSlot && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Confirmed time slot</label>
            <input
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              placeholder="e.g. 2:10 PM - 3:10 PM"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Note {current?.needsReason ? "(reason — required)" : "(optional)"}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry-run (queue write-back but don&apos;t change goldadam yet)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & queue"}
          </button>
        </div>
      </div>
    </div>
  );
}
