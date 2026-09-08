"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { PageHeader, Content, SectionHead, Card, Btn, Input, EmptyState } from "@/components/ui";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_STYLE = {
  success: { dot: "bg-green", ring: "ring-green-dim", text: "text-[#9CD9B4]", bg: "bg-green-dim", label: "OK" },
  failed: { dot: "bg-red", ring: "ring-red-dim", text: "text-[#F0AAA1]", bg: "bg-red-dim", label: "Failed" },
  skipped: { dot: "bg-muted-dim", ring: "ring-border", text: "text-muted", bg: "bg-panel-raised", label: "Skipped" },
  started: { dot: "bg-amber", ring: "ring-amber-dim", text: "text-[#F0C088]", bg: "bg-amber-dim", label: "Running" },
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

// Health cards: latest entry per job type, so the top of the page reads like
// a service status board rather than a raw log.
function latestByType(logs) {
  const byType = new Map();
  for (const l of [...logs].sort((a, b) => new Date(a.at) - new Date(b.at))) {
    byType.set(l.type, l);
  }
  return [...byType.values()].sort((a, b) => new Date(b.at) - new Date(a.at));
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
  const health = useMemo(() => latestByType(logs || []), [logs]);

  return (
    <>
      <PageHeader title="Scraper Health" subtitle="Playwright worker status — every job that touches goldadam">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Btn variant="outline" onClick={() => load(date)}>
          ↻ Refresh
        </Btn>
      </PageHeader>

      <Content>
        {loading ? (
          <EmptyState>Loading…</EmptyState>
        ) : (
          <>
            {health.length > 0 && (
              <div>
                <SectionHead title="Latest by job" />
                <div className="grid gap-4 md:grid-cols-2">
                  {health.map((l) => {
                    const s = STATUS_STYLE[l.status] || STATUS_STYLE.success;
                    return (
                      <Card key={l.type}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-text">{TYPE_LABEL[l.type] || l.type}</span>
                          <span className={cn("h-2.5 w-2.5 rounded-full ring-4", s.dot, s.ring)} />
                        </div>
                        <div className="mt-2 flex justify-between text-[12.5px] text-muted">
                          <span>Last run</span>
                          <b className="text-text">{timeOf(l.at)}</b>
                        </div>
                        <div className="mt-1 flex justify-between text-[12.5px] text-muted">
                          <span>Status</span>
                          <b className={s.text}>{s.label}</b>
                        </div>
                        {l.detail && (
                          <div className="mt-1 flex justify-between gap-3 text-[12.5px] text-muted">
                            <span>Detail</span>
                            <b className="text-right text-text">{l.detail}</b>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {runs.length === 0 && loose.length === 0 ? (
              <EmptyState>No logs found for this date.</EmptyState>
            ) : (
              <div>
                <SectionHead title="Run log" />
                <div className="space-y-4">
                  {runs.map((run) => (
                    <RunCard
                      key={run.runId}
                      run={run}
                      open={openRun === run.runId}
                      onToggle={() => setOpenRun(openRun === run.runId ? null : run.runId)}
                    />
                  ))}

                  {loose.length > 0 && (
                    <Card className="!p-0">
                      <div className="border-b border-border px-4 py-3">
                        <h3 className="text-sm font-semibold text-text">Other events</h3>
                        <p className="text-xs text-muted-dim">SMS jobs and customer replies — not part of a scrape run.</p>
                      </div>
                      <ul className="divide-y divide-border">
                        {loose.map((l) => (
                          <StepRow key={l._id} log={l} />
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Content>
    </>
  );
}

function RunCard({ run, open, onToggle }) {
  const s = STATUS_STYLE[run.status];
  const okCount = run.steps.filter((x) => x.status === "success").length;
  const failCount = run.steps.filter((x) => x.status === "failed").length;

  return (
    <Card className="!p-0 overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <div className="flex items-center gap-3">
          <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
          <div>
            <div className="text-sm font-semibold text-text">
              Run — {timeOf(run.startedAt)}
              <span className="ml-2 font-mono text-xs font-normal text-muted-dim">{run.runId}</span>
            </div>
            <div className="text-xs text-muted">
              {okCount} step{okCount === 1 ? "" : "s"} ok{failCount > 0 ? `, ${failCount} failed` : ""} · {run.steps.length} total
            </div>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", s.bg, s.text)}>{s.label}</span>
      </button>
      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {run.steps.map((l) => (
            <StepRow key={l._id} log={l} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function StepRow({ log }) {
  const s = STATUS_STYLE[log.status] || STATUS_STYLE.success;
  return (
    <li className="flex items-start gap-3 px-4 py-3 font-mono text-[11.5px]">
      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", s.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-sans text-sm font-medium text-text">{TYPE_LABEL[log.type] || log.type}</span>
          {log.routeCode && <span className="text-muted-dim">{log.routeCode}</span>}
          <span className={cn("font-sans text-xs font-medium", s.text)}>{s.label}</span>
          <span className="text-muted-dim">{timeOf(log.at)}</span>
        </div>
        {log.detail && <p className="mt-0.5 font-sans text-sm text-muted">{log.detail}</p>}
      </div>
    </li>
  );
}
