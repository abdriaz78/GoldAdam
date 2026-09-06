"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_STYLE = {
  success: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", label: "OK" },
  failed: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50", label: "Failed" },
  skipped: { dot: "bg-stone-400", text: "text-stone-500", bg: "bg-stone-50", label: "Skipped" },
  started: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", label: "Running" },
};

const TYPE_LABEL = {
  daily_run: "Daily run",
  bookings_scrape: "Bookings scrape",
  writeback: "Write-back",
  sales_scrape: "Sales scrape",
  sms_confirmations: "SMS — confirmations",
  sms_reminders: "SMS — agent reminders",
};

function timeOf(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Groups the flat SyncLog list into one card per runId (bookings/sales daily
// runs) plus a catch-all card for events that don't belong to a run (SMS
// jobs, a customer's SMS reply) — those aren't triggered by the extension's
// runId scheme, they're their own independent Vercel Cron / webhook events.
function groupLogs(logs) {
  const byRun = new Map();
  const loose = [];
  for (const l of logs) {
    if (l.runId) {
      if (!byRun.has(l.runId)) byRun.set(l.runId, []);
      byRun.get(l.runId).push(l);
    } else {
      loose.push(l);
    }
  }
  const runs = [...byRun.entries()]
    .map(([runId, steps]) => {
      const sorted = [...steps].sort((a, b) => new Date(a.at) - new Date(b.at));
      const hasFailed = sorted.some((s) => s.status === "failed");
      const finished = sorted.some((s) => s.type === "daily_run" && s.status === "success");
      const status = hasFailed ? "failed" : finished ? "success" : "started";
      return { runId, steps: sorted, status, startedAt: sorted[0]?.at };
    })
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return { runs, loose: loose.sort((a, b) => new Date(b.at) - new Date(a.at)) };
}

export default function LogsPage() {
  const [date, setDate] = useState(todayISO());
  const [logs, setLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openRun, setOpenRun] = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await api("/api/sync-log", { params: { date: d } });
      setLogs(res.logs);
    } catch (err) {
      toast.error(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const { runs, loose } = useMemo(() => groupLogs(logs || []), [logs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Daily Automation Log</h1>
          <p className="text-sm text-stone-500">
            Har din ka run — kaunsa step ho gaya, kaunsa fail hua aur kyun.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => load(date)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-stone-400">Loading…</div>
      ) : runs.length === 0 && loose.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400">
          Is din ke liye koi log nahi mila.
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunCard key={run.runId} run={run} open={openRun === run.runId} onToggle={() => setOpenRun(openRun === run.runId ? null : run.runId)} />
          ))}

          {loose.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-stone-900">Doosre events</h3>
                <p className="text-xs text-stone-500">SMS jobs aur customer replies — ye kisi run ka hissa nahi, apne aap chalte hain.</p>
              </div>
              <ul className="divide-y divide-stone-100">
                {loose.map((l) => (
                  <StepRow key={l._id} log={l} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunCard({ run, open, onToggle }) {
  const s = STATUS_STYLE[run.status];
  const okCount = run.steps.filter((x) => x.status === "success").length;
  const failCount = run.steps.filter((x) => x.status === "failed").length;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <div className="flex items-center gap-3">
          <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
          <div>
            <div className="text-sm font-semibold text-stone-900">
              Run — {timeOf(run.startedAt)}
              <span className="ml-2 font-mono text-xs font-normal text-stone-400">{run.runId}</span>
            </div>
            <div className="text-xs text-stone-500">
              {okCount} step{okCount === 1 ? "" : "s"} ok{failCount > 0 ? `, ${failCount} failed` : ""} · {run.steps.length} total
            </div>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", s.bg, s.text)}>{s.label}</span>
      </button>
      {open && (
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {run.steps.map((l) => (
            <StepRow key={l._id} log={l} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StepRow({ log }) {
  const s = STATUS_STYLE[log.status] || STATUS_STYLE.success;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-stone-900">{TYPE_LABEL[log.type] || log.type}</span>
          {log.routeCode && <span className="font-mono text-xs text-stone-400">{log.routeCode}</span>}
          <span className={cn("text-xs font-medium", s.text)}>{s.label}</span>
          <span className="text-xs text-stone-400">{timeOf(log.at)}</span>
        </div>
        {log.detail && <p className="mt-0.5 text-sm text-stone-600">{log.detail}</p>}
      </div>
    </li>
  );
}
