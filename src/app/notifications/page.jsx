"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [date, setDate] = useState("");

  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);
  const [confirmDate, setConfirmDate] = useState("");
  const [resend, setResend] = useState(false);

  async function send() {
    setLoading(true);
    try {
      const body = date ? { date } : {};
      const res = await api("/api/notifications/send-reminders", { method: "POST", body });
      setResult(res);
      toast.success(`Reminders processed: ${res.sentCount || 0}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function sendConfirmations() {
    setConfirmLoading(true);
    try {
      const body = { ...(confirmDate ? { date: confirmDate } : {}), resend };
      const res = await api("/api/notifications/send-confirmations", { method: "POST", body });
      setConfirmResult(res);
      toast.success(`Confirmation texts sent: ${res.sentCount || 0}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">
            Send booking reminders to agents, or two-way confirmation texts to customers.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">Leave blank to send reminders for tomorrow.</p>
        </div>

        <div className="flex items-end">
          <button
            disabled={loading}
            onClick={send}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reminders"}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-sm text-slate-600">Sent reminders for {result.date}.</div>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950/5 p-3 text-xs text-slate-700">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Date</label>
          <input
            type="date"
            value={confirmDate}
            onChange={(e) => setConfirmDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-2 text-xs text-slate-500">
            Texts each pending booking's customer asking them to reply YES/NO. Their reply
            updates the booking status automatically. Leave date blank for tomorrow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="resend"
            type="checkbox"
            checked={resend}
            onChange={(e) => setResend(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label htmlFor="resend" className="text-sm text-slate-700">
            Resend to already-texted bookings
          </label>
        </div>

        <div className="flex items-end">
          <button
            disabled={confirmLoading}
            onClick={sendConfirmations}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {confirmLoading ? "Sending…" : "Send confirmation texts"}
          </button>
        </div>
      </div>

      {confirmResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-sm text-slate-600">Sent confirmation texts for {confirmResult.date}.</div>
          <pre className="mt-3 overflow-auto rounded-lg bg-slate-950/5 p-3 text-xs text-slate-700">
            {JSON.stringify(confirmResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
