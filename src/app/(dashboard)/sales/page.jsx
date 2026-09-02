"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { api } from "@/lib/client";

const money = (n) => (n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const grams = (n) => (n == null ? "—" : `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}g`);

export default function SalesPage() {
  const [me, setMe] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    route: "",
    agentId: "",
    from: "",
    to: "",
    q: "",
    includeTest: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/sales", { params: { ...filters, limit: 500 } });
      setSales(data.sales);
      setTotal(data.total);
      setSummary(data.summary);
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
        const [r, a] = await Promise.all([
          api("/api/routes"),
          meRes.user.role === "admin" ? api("/api/agents") : Promise.resolve({ agents: [] }),
        ]);
        setRoutes(r.routes);
        setAgents(a.agents);
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = me?.role === "admin";

  function exportXlsx() {
    const rows = sales.map((s) => ({
      Package: s.packageNumber,
      Date: s.dateISO || s.date,
      Customer: s.customerName,
      Route: s.routeCode,
      "Gold (g)": s.goldGrams,
      "Silver (g)": s.silverGrams,
      "Margin %": s.marginPercent,
      "Est. Profit": s.estProfit,
      Payout: s.payout,
      Paid: s.paid ? "Yes" : "No",
      Controlled: s.controlled ? "Yes" : "No",
      Test: s.testPurchase ? "Yes" : "No",
      Agent: s.agentId?.name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    XLSX.writeFile(wb, "goldadam-sales.xlsx");
  }

  const tiles = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Total Payout", value: money(summary.totalPayout) },
      { label: "Est. Profit", value: money(summary.totalProfit) },
      { label: "Gold", value: grams(summary.totalGoldGrams) },
      { label: "Silver", value: grams(summary.totalSilverGrams) },
      { label: "Avg Margin", value: summary.avgMargin != null ? `${summary.avgMargin.toFixed(1)}%` : "—" },
      { label: "Paid", value: `${summary.paidCount}/${total}` },
    ];
  }, [summary, total]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-500">{total} total</p>
        </div>
        <button
          onClick={exportXlsx}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          Export Excel
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-xs text-slate-500">{t.label}</div>
            <div className="text-lg font-semibold text-slate-900">{t.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-2 md:grid-cols-6 gap-2">
        <select
          value={filters.route}
          onChange={(e) => setFilters((f) => ({ ...f, route: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          <option value="">All routes</option>
          {routes.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code} — {r.region}
            </option>
          ))}
        </select>

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

        <input
          type="text"
          placeholder="Search customer / package #…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-1 col-span-2"
        />

        <label className="flex items-center gap-2 text-sm text-slate-600 px-2">
          <input
            type="checkbox"
            checked={filters.includeTest === "1"}
            onChange={(e) => setFilters((f) => ({ ...f, includeTest: e.target.checked ? "1" : "" }))}
          />
          Include test purchases
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-3 py-2 font-medium">Package</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Route</th>
              {isAdmin && <th className="px-3 py-2 font-medium">Agent</th>}
              <th className="px-3 py-2 font-medium text-right">Gold</th>
              <th className="px-3 py-2 font-medium text-right">Silver</th>
              <th className="px-3 py-2 font-medium text-right">Margin</th>
              <th className="px-3 py-2 font-medium text-right">Profit</th>
              <th className="px-3 py-2 font-medium text-right">Payout</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  No sales yet. Run the sales scraper to pull data from goldadam.
                </td>
              </tr>
            ) : (
              sales.map((s) => (
                <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.packageNumber}
                    {s.testPurchase && (
                      <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">TEST</span>
                    )}
                    {s.controlled && (
                      <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">Ctrl</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{s.dateISO || s.date}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{s.customerName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.routeCode}</td>
                  {isAdmin && <td className="px-3 py-2 text-slate-600">{s.agentId?.name || "—"}</td>}
                  <td className="px-3 py-2 text-right text-amber-700">{grams(s.goldGrams)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{grams(s.silverGrams)}</td>
                  <td className="px-3 py-2 text-right">{s.marginPercent != null ? `${s.marginPercent}%` : "—"}</td>
                  <td className="px-3 py-2 text-right">{money(s.estProfit)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="font-medium">{money(s.payout)}</div>
                    <div className={`text-[10px] ${s.paid ? "text-emerald-600" : "text-amber-600"}`}>
                      {s.paid ? "Paid" : "Pending"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
