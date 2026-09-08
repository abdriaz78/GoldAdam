"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";
import { PageHeader, Content, SectionHead, Card, TileGrid, StatTile, Select, Input, EmptyState } from "@/components/ui";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const grams = (n) => `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}g`;

const STATUS_COLORS = {
  pending: "bg-muted-dim",
  confirmed: "bg-blue",
  cancelled: "bg-red",
  completed: "bg-green",
  no_show: "bg-amber",
  no_sale: "bg-panel-raised",
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
    <>
      <PageHeader
        title="Stats & Reports"
        subtitle={`${isAdmin ? "Company-wide totals" : "Your totals"} — bookings status, sales revenue, top routes`}
      >
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
      </PageHeader>

      <Content>
        {loading || !data ? (
          <EmptyState>Loading…</EmptyState>
        ) : (
          <>
            <TileGrid className="lg:grid-cols-6">
              <StatTile label="Purchases" value={data.sales.count} />
              <StatTile label="Total payout" value={money(data.sales.totalPayout)} gold />
              <StatTile label="Est. profit" value={money(data.sales.totalProfit)} gold />
              <StatTile label="Gold" value={grams(data.sales.totalGoldGrams)} />
              <StatTile label="Silver" value={grams(data.sales.totalSilverGrams)} />
              <StatTile label="Avg margin" value={`${(data.sales.avgMargin || 0).toFixed(1)}%`} />
            </TileGrid>

            <div>
              <SectionHead title="Bookings" subtitle={`${data.bookings.total} total`} />
              <Card>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-panel-raised">
                  {Object.entries(data.bookings.byStatus).map(([status, count]) =>
                    count > 0 ? (
                      <div
                        key={status}
                        className={STATUS_COLORS[status] || "bg-muted-dim"}
                        style={{ width: `${(count / Math.max(1, data.bookings.total)) * 100}%` }}
                        title={`${status}: ${count}`}
                      />
                    ) : null
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                  {Object.entries(data.bookings.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status] || "bg-muted-dim")} />
                      {status.replace("_", " ")}: <span className="font-medium text-text">{count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <SectionHead title="Top routes by payout" />
                <Card>
                  {data.topRoutes.length === 0 ? (
                    <p className="text-sm text-muted-dim">No sales data yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {data.topRoutes.map((r) => (
                        <div key={r.routeCode} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs text-muted">
                            {r.routeCode} <span className="text-muted-dim">({r.count})</span>
                          </span>
                          <span className="font-medium text-gold">{money(r.payout)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div>
                <SectionHead title="Payout — last 14 days" />
                <Card>
                  {data.dailyPayout.length === 0 ? (
                    <p className="text-sm text-muted-dim">No sales data yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.dailyPayout.map((d) => (
                        <div key={d.date} className="flex items-center gap-2 text-xs">
                          <span className="w-20 shrink-0 text-muted">{d.date}</span>
                          <div className="h-4 flex-1 overflow-hidden rounded bg-panel-raised">
                            <div className="h-full bg-gold" style={{ width: `${(d.payout / maxDaily) * 100}%` }} />
                          </div>
                          <span className="w-20 shrink-0 text-right font-medium text-text">{money(d.payout)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </Content>
    </>
  );
}
