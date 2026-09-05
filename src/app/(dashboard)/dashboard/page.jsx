"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import StatusBadge from "@/components/StatusBadge";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function DashboardPage() {
  const [me, setMe] = useState(null);
  const [today, setToday] = useState(null);
  const [mtd, setMtd] = useState(null);
  const [todaysBookings, setTodaysBookings] = useState([]);
  const [pendingPurchases, setPendingPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (user) => {
    setLoading(true);
    try {
      const iso = todayISO();
      const [t, m] = await Promise.all([
        api("/api/reports/summary", { params: { from: iso, to: iso } }),
        api("/api/reports/summary", { params: { from: monthStartISO(), to: iso } }),
      ]);
      setToday(t);
      setMtd(m);
      if (user.role === "agent") {
        const b = await api("/api/bookings", { params: { from: iso, to: iso, limit: 50 } });
        setTodaysBookings(b.bookings);
      }
      if (user.role === "admin") {
        // "complete" (Start Purchase) is never auto-executed by the extension's
        // daily run — it's the one action that always needs a human click, so
        // surface whatever's still waiting.
        const c = await api("/api/commands");
        setPendingPurchases(c.commands.filter((cmd) => cmd.action === "complete"));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api("/api/auth/me");
        setMe(res.user);
        await load(res.user);
      } catch (err) {
        toast.error(err.message);
      }
    })();
  }, [load]);

  const isAdmin = me?.role === "admin";

  const teamAvgClose = useMemo(() => {
    if (!isAdmin || !mtd?.byAgent?.length) return null;
    const active = mtd.byAgent.filter((a) => a.bookingsTotal >= 3);
    if (!active.length) return null;
    return active.reduce((s, a) => s + a.closeRate, 0) / active.length;
  }, [isAdmin, mtd]);

  const alerts = useMemo(() => {
    if (teamAvgClose == null || !mtd?.byAgent) return [];
    const active = mtd.byAgent.filter((a) => a.bookingsTotal >= 3);
    const out = [];

    const worstClose = [...active].sort((a, b) => a.closeRate - b.closeRate)[0];
    if (worstClose && worstClose.closeRate < teamAvgClose - 10) {
      out.push({
        title: worstClose.name,
        detail: `Close rate ${pct(worstClose.closeRate)} · ${(teamAvgClose - worstClose.closeRate).toFixed(
          0
        )} pts below team avg`,
      });
    }

    const worstNoShow = [...active].sort((a, b) => b.noShowRate - a.noShowRate)[0];
    if (worstNoShow && worstNoShow.noShowRate > 15 && worstNoShow.name !== worstClose?.name) {
      out.push({ title: worstNoShow.name, detail: `No-show rate ${pct(worstNoShow.noShowRate)} this month` });
    }

    const noSales = active.find((a) => a.salesCount === 0);
    if (noSales && out.length < 3) {
      out.push({ title: noSales.name, detail: "No purchases yet this month" });
    }

    return out.slice(0, 3);
  }, [teamAvgClose, mtd]);

  if (loading || !today || !mtd) {
    return <div className="py-12 text-center text-stone-400">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">
          {isAdmin ? "Dashboard" : `Good morning, ${(me?.name || "").split(" ")[0] || "there"}`}
        </h1>
        <p className="text-sm text-stone-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <Section label="Today">
        <TileGrid>
          <Tile label="Bookings" value={today.bookings.total} />
          <Tile label="Confirmed" value={today.bookings.byStatus.confirmed} />
          <Tile label="No-shows" value={today.bookings.byStatus.no_show} />
          <Tile label="Purchases" value={today.sales.count} />
          <Tile label="Payout" value={money(today.sales.totalPayout)} />
          <Tile label="Est. profit" value={money(today.sales.totalProfit)} />
        </TileGrid>
      </Section>

      <Section label="Month to date">
        <TileGrid>
          <Tile label="Booked" value={mtd.bookings.total} />
          <Tile label="Confirmed" value={mtd.bookings.byStatus.confirmed} />
          <Tile label="Purchases" value={mtd.sales.count} />
          <Tile label="Payout" value={money(mtd.sales.totalPayout)} />
          <Tile label="Est. profit" value={money(mtd.sales.totalProfit)} />
          <Tile label="Avg margin" value={pct(mtd.sales.avgMargin)} />
        </TileGrid>
      </Section>

      {isAdmin && alerts.length > 0 && (
        <Section label="Needs attention">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((a, i) => (
              <Link
                key={i}
                href="/agents"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100"
              >
                <h4 className="text-sm font-semibold text-stone-900">{a.title}</h4>
                <p className="mt-1 text-sm text-rose-700">{a.detail}</p>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {isAdmin && pendingPurchases.length > 0 && (
        <Section label="Needs your action on goldadam">
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {pendingPurchases.map((cmd) => (
                  <tr key={cmd.id} className="border-b border-amber-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-stone-900">
                      {cmd.booking?.customerName || "Unknown customer"}
                    </td>
                    <td className="px-4 py-2.5 text-stone-500">{cmd.routeCode}</td>
                    <td className="px-4 py-2.5 text-stone-500">{cmd.note || "Start Purchase"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            These are never automated — Start Purchase always needs your click in goldadam
            (via the extension's "Run write-backs" button or directly on the site).
          </p>
        </Section>
      )}

      {isAdmin ? (
        <Section label="Agent leaderboard — month to date">
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                  <th className="px-4 py-2.5">Agent</th>
                  <th className="px-4 py-2.5">Sales</th>
                  <th className="px-4 py-2.5">Close rate</th>
                  <th className="px-4 py-2.5">Avg margin</th>
                  <th className="px-4 py-2.5">Payout</th>
                  <th className="px-4 py-2.5">Flag</th>
                </tr>
              </thead>
              <tbody>
                {mtd.byAgent.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-stone-400">
                      No agent activity yet this month.
                    </td>
                  </tr>
                ) : (
                  mtd.byAgent.map((a) => (
                    <tr key={a.agentId} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-stone-900">{a.name}</td>
                      <td className="px-4 py-2.5">{a.salesCount}</td>
                      <td className="px-4 py-2.5">{pct(a.closeRate)}</td>
                      <td className="px-4 py-2.5">{pct(a.avgMargin)}</td>
                      <td className="px-4 py-2.5">{money(a.payout)}</td>
                      <td className="px-4 py-2.5">
                        <FlagBadge agent={a} teamAvgClose={teamAvgClose} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        <Section label="Today's schedule">
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            {todaysBookings.length === 0 ? (
              <p className="p-4 text-sm text-stone-400">No bookings today.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {todaysBookings.map((b) => (
                    <tr key={b._id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 text-stone-500">{b.timeWindow}</td>
                      <td className="px-4 py-2.5 font-medium text-stone-900">{b.customerName}</td>
                      <td className="px-4 py-2.5 text-stone-500">{b.stopName}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Link href="/bookings" className="mt-3 inline-block text-sm font-medium text-amber-700 hover:underline">
            View all bookings →
          </Link>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        <span className="h-2 w-2 rounded-full bg-amber-600" />
        {label}
      </div>
      {children}
    </div>
  );
}

function TileGrid({ children }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-stone-900">{value}</div>
    </div>
  );
}

function FlagBadge({ agent, teamAvgClose }) {
  if (agent.bookingsTotal === 0) {
    return (
      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
        No activity
      </span>
    );
  }
  if (typeof teamAvgClose === "number" && agent.closeRate < teamAvgClose - 10) {
    return (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
        Low close rate
      </span>
    );
  }
  if (agent.noShowRate > 15) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        High no-shows
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      On track
    </span>
  );
}
