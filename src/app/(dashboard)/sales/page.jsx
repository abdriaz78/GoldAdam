"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { api } from "@/lib/client";
import { PageHeader, Content, TileGrid, StatTile, Btn, Input, Select, TABLE_WRAP, THEAD, TH, TD, TR_HOVER, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

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
      { label: "Purchases", value: total },
      { label: "Total Payout", value: money(summary.totalPayout), gold: true },
      { label: "Est. Profit", value: money(summary.totalProfit), gold: true },
      { label: "Gold", value: grams(summary.totalGoldGrams) },
      { label: "Silver", value: grams(summary.totalSilverGrams) },
      { label: "Avg Margin", value: summary.avgMargin != null ? `${summary.avgMargin.toFixed(1)}%` : "—" },
    ];
  }, [summary, total]);

  return (
    <>
      <PageHeader title="Purchases" subtitle="One row per buy from the sponsored / purchase list">
        <Btn variant="outline" onClick={exportXlsx}>
          Export Excel
        </Btn>
      </PageHeader>
      <Content>
        <TileGrid>
          {tiles.map((t) => (
            <StatTile key={t.label} label={t.label} value={t.value} gold={t.gold} />
          ))}
        </TileGrid>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-panel p-3 md:grid-cols-6">
          <Select value={filters.route} onChange={(e) => setFilters((f) => ({ ...f, route: e.target.value }))}>
            <option value="">All routes</option>
            {routes.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.region}
              </option>
            ))}
          </Select>

          {isAdmin && (
            <Select value={filters.agentId} onChange={(e) => setFilters((f) => ({ ...f, agentId: e.target.value }))}>
              <option value="">All agents</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}

          <Input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <Input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          <Input
            type="text"
            placeholder="Search customer / package #…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="col-span-2 md:col-span-1"
          />
          <label className="flex items-center gap-2 px-2 text-[12.5px] text-muted">
            <input
              type="checkbox"
              checked={filters.includeTest === "1"}
              onChange={(e) => setFilters((f) => ({ ...f, includeTest: e.target.checked ? "1" : "" }))}
              className="accent-gold"
            />
            Include test purchases
          </label>
        </div>

        <div className={TABLE_WRAP}>
          <table className="w-full">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Package</th>
                <th className={TH}>Date</th>
                <th className={TH}>Customer</th>
                <th className={TH}>Route</th>
                {isAdmin && <th className={TH}>Agent</th>}
                <th className={cn(TH, "text-right")}>Gold</th>
                <th className={cn(TH, "text-right")}>Silver</th>
                <th className={cn(TH, "text-right")}>Margin</th>
                <th className={cn(TH, "text-right")}>Profit</th>
                <th className={cn(TH, "text-right")}>Payout</th>
                <th className={TH}>Flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState>Loading…</EmptyState>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={11}>
                    <EmptyState>No sales yet. Run the sales scraper to pull data from goldadam.</EmptyState>
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s._id} className={TR_HOVER}>
                    <td className={TD + " font-mono text-xs"}>{s.packageNumber}</td>
                    <td className={TD}>{s.dateISO || s.date}</td>
                    <td className={TD + " font-medium"}>{s.customerName}</td>
                    <td className={TD + " font-mono text-xs text-muted"}>{s.routeCode}</td>
                    {isAdmin && <td className={TD + " text-muted"}>{s.agentId?.name || "—"}</td>}
                    <td className={cn(TD, "text-right text-gold")}>{grams(s.goldGrams)}</td>
                    <td className={cn(TD, "text-right text-muted")}>{grams(s.silverGrams)}</td>
                    <td className={cn(TD, "text-right")}>{s.marginPercent != null ? `${s.marginPercent}%` : "—"}</td>
                    <td className={cn(TD, "text-right")}>{money(s.estProfit)}</td>
                    <td className={cn(TD, "text-right")}>
                      <div className="font-medium">{money(s.payout)}</div>
                      <div className={cn("text-[10px]", s.paid ? "text-green" : "text-amber")}>{s.paid ? "Paid" : "Pending"}</div>
                    </td>
                    <td className={TD}>
                      {s.testPurchase && (
                        <span className="mr-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber ring-1 ring-inset ring-amber-dim">
                          TEST
                        </span>
                      )}
                      {s.controlled && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-green ring-1 ring-inset ring-green-dim">
                          Ctrl
                        </span>
                      )}
                      {!s.testPurchase && !s.controlled && <span className="text-xs text-muted-dim">Clean</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[11.5px] text-muted-dim">
          Showing {sales.length} of {total} purchases
        </div>
      </Content>
    </>
  );
}
