"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const grams = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}g`;

const STATUS_COLORS = {
  pending: "bg-slate-400",
  confirmed: "bg-blue-500",
  cancelled: "bg-rose-400",
  completed: "bg-emerald-500",
  no_show: "bg-amber-500",
  no_sale: "bg-slate-300",
};

export default function ReportsPage() {
  const [me, setMe] = useState(null);
  const [agents, setAgents] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ agentId: "", from: "", to: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/api/reports/summary", { params: filters });
      setData(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await api("/api/auth/me");
        setMe(meRes.user);
        if (meRes.user.role === "admin") {
          const a = await api("/api/agents");
          setAgents(a.agents);
        }
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = me?.role === "admin";
  const maxDaily = data ? Math.max(1, ...data.dailyPayout.map((d) => d.payout)) : 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">
          {isAdmin ? "Company-wide totals" : "Your totals"} — bookings status, sales revenue, top routes.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        {isAdmin && (
          <select
            value={filters.agentId}
            onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
      </div>

      {loading || !data ? (
        <div className="text-center text-slate-400 py-12">Loading…</div>
      ) : (
        <>
          {/* Sales totals */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <Tile label="Total Payout" value={money(data.sales.totalPayout)} />
            <Tile label="Est. Profit" value={money(data.sales.totalProfit)} />
            <Tile label="Gold" value={grams(data.sales.totalGoldGrams)} />
            <Tile label="Silver" value={grams(data.sales.totalSilverGrams)} />
            <Tile label="Avg Margin" value={`${(data.sales.avgMargin || 0).toFixed(1)}%`} />
            <Tile label="Sales Count" value={data.sales.count} />
          </div>

          {/* Bookings status breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-slate-900">Bookings — {data.bookings.total} total</h2>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden bg-slate-100 flex">
              {Object.entries(data.bookings.byStatus).map(([status, count]) =>
                count > 0 ? (
                  <div
                    key={status}
                    className={cn(STATUS_COLORS[status] || "bg-slate-300")}
                    style={{ width: `${(count / Math.max(1, data.bookings.total)) * 100}%` }}
                    title={`${status}: ${count}`}
                  />
                ) : null
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
              {Object.entries(data.bookings.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status] || "bg-slate-300")} />
                  {status}: <span className="font-medium text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top routes */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="font-medium text-slate-900 mb-3">Top Routes by Payout</h2>
              {data.topRoutes.length === 0 ? (
                <p className="text-sm text-slate-400">No sales data yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.topRoutes.map((r) => (
                    <div key={r.routeCode} className="flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-slate-600">
                        {r.routeCode} <span className="text-slate-400">({r.count})</span>
                      </span>
                      <span className="font-medium">{money(r.payout)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily payout trend */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h2 className="font-medium text-slate-900 mb-3">Payout — Last 14 Days</h2>
              {data.dailyPayout.length === 0 ? (
                <p className="text-sm text-slate-400">No sales data yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.dailyPayout.map((d) => (
                    <div key={d.date} className="flex items-center gap-2 text-xs">
                      <span className="w-20 text-slate-500 shrink-0">{d.date}</span>
                      <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${(d.payout / maxDaily) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-medium text-slate-700 shrink-0">
                        {money(d.payout)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
