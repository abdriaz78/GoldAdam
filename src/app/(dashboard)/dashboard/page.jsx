"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import StatusChip from "@/components/StatusBadge";
import {
  PageHeader,
  Content,
  SectionHead,
  Card,
  StatTile,
  TileGrid,
  FlagBadge,
  TABLE_WRAP,
  THEAD,
  TH,
  TD,
  TR_HOVER,
  EmptyState,
} from "@/components/ui";

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
        title: "Close rate falling",
        name: worstClose.name,
        rule: "Rule: close rate 10+ pts below team average",
        detail: `${pct(worstClose.closeRate)} · ${(teamAvgClose - worstClose.closeRate).toFixed(0)} pts below team avg (${pct(teamAvgClose)})`,
      });
    }

    const worstNoShow = [...active].sort((a, b) => b.noShowRate - a.noShowRate)[0];
    if (worstNoShow && worstNoShow.noShowRate > 15 && worstNoShow.name !== worstClose?.name) {
      out.push({
        title: "No-show rate high",
        name: worstNoShow.name,
        rule: "Rule: no-show rate above 15%",
        detail: `No-show rate ${pct(worstNoShow.noShowRate)} this month`,
      });
    }

    const noSales = active.find((a) => a.salesCount === 0);
    if (noSales && out.length < 3) {
      out.push({
        title: "No purchases this month",
        name: noSales.name,
        rule: "Rule: zero purchases with 3+ bookings",
        detail: `${noSales.bookingsTotal} bookings, 0 purchases`,
      });
    }

    return out.slice(0, 3);
  }, [teamAvgClose, mtd]);

  if (loading || !today || !mtd) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-dim">Loading…</div>
    );
  }

  return (
    <>
      <PageHeader
        title={isAdmin ? "Dashboard" : `Good morning, ${(me?.name || "").split(" ")[0] || "there"}`}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      />
      <Content>
        <div>
          <Card className="!p-0">
            <div className="px-6 pb-1 pt-5">
              <SectionHead title="Today" subtitle="Live" />
            </div>
            <TileGrid className="grid-cols-2 gap-0 px-4 pb-5 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Bookings" value={today.bookings.total} />
              <StatTile label="Confirmed" value={today.bookings.byStatus.confirmed} />
              <StatTile label="No-shows" value={today.bookings.byStatus.no_show} />
              <StatTile label="Purchases" value={today.sales.count} />
              <StatTile label="Payout" value={money(today.sales.totalPayout)} gold />
              <StatTile label="Est. profit" value={money(today.sales.totalProfit)} gold />
            </TileGrid>
          </Card>
        </div>

        <div>
          <SectionHead title="Month to date" />
          <TileGrid>
            <StatTile label="Booked" value={mtd.bookings.total} />
            <StatTile label="Confirmed" value={mtd.bookings.byStatus.confirmed} />
            <StatTile label="Purchases" value={mtd.sales.count} />
            <StatTile label="Payout" value={money(mtd.sales.totalPayout)} gold />
            <StatTile label="Est. profit" value={money(mtd.sales.totalProfit)} gold />
            <StatTile label="Avg margin" value={pct(mtd.sales.avgMargin)} />
          </TileGrid>
        </div>

        {isAdmin && alerts.length > 0 && (
          <div>
            <SectionHead title="Needs attention" subtitle="Auto-flagged from Field Agents rules" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((a, i) => (
                <Link
                  key={i}
                  href="/agents"
                  className="rounded-xl border border-[#5C332C] bg-red-dim p-4 transition-colors hover:brightness-110"
                >
                  <h4 className="text-[13px] font-semibold text-[#F4D3CD]">
                    {a.title} — {a.name}
                  </h4>
                  <p className="mt-1 text-[11.5px] text-[#E8B3AC]">{a.rule}</p>
                  <p className="mt-2 text-[11px] text-[#E8B3AC]">{a.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isAdmin && pendingPurchases.length > 0 && (
          <div>
            <SectionHead title="Needs your action on goldadam" />
            <div className={TABLE_WRAP}>
              <table className="w-full">
                <tbody>
                  {pendingPurchases.map((cmd) => (
                    <tr key={cmd.id} className={TR_HOVER}>
                      <td className={TD + " font-medium"}>{cmd.booking?.customerName || "Unknown customer"}</td>
                      <td className={TD + " text-muted"}>{cmd.routeCode}</td>
                      <td className={TD + " text-muted"}>{cmd.note || "Start Purchase"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-dim">
              These are never automated — Start Purchase always needs your click in goldadam (via the
              extension&apos;s &ldquo;Run write-backs&rdquo; button or directly on the site).
            </p>
          </div>
        )}

        {isAdmin ? (
          <div>
            <SectionHead title="Agent leaderboard" subtitle="Month to date" />
            <div className={TABLE_WRAP}>
              <table className="w-full">
                <thead className={THEAD}>
                  <tr>
                    <th className={TH}>Agent</th>
                    <th className={TH}>Sales</th>
                    <th className={TH}>Close rate</th>
                    <th className={TH}>Avg margin</th>
                    <th className={TH}>Payout</th>
                    <th className={TH}>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {mtd.byAgent.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState>No agent activity yet this month.</EmptyState>
                      </td>
                    </tr>
                  ) : (
                    mtd.byAgent.map((a) => (
                      <tr key={a.agentId} className={TR_HOVER}>
                        <td className={TD + " font-medium"}>{a.name}</td>
                        <td className={TD}>{a.salesCount}</td>
                        <td className={TD}>{pct(a.closeRate)}</td>
                        <td className={TD}>{pct(a.avgMargin)}</td>
                        <td className={TD}>{money(a.payout)}</td>
                        <td className={TD}>
                          <FlagRow agent={a} teamAvgClose={teamAvgClose} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <SectionHead title="Today's schedule" />
            <div className={TABLE_WRAP}>
              {todaysBookings.length === 0 ? (
                <EmptyState>No bookings today.</EmptyState>
              ) : (
                <table className="w-full">
                  <tbody>
                    {todaysBookings.map((b) => (
                      <tr key={b._id} className={TR_HOVER}>
                        <td className={TD + " text-muted"}>{b.timeWindow}</td>
                        <td className={TD + " font-medium"}>{b.customerName}</td>
                        <td className={TD + " text-muted"}>{b.stopName}</td>
                        <td className={TD}>
                          <StatusChip status={b.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Link href="/bookings" className="mt-3 inline-block text-sm font-medium text-gold hover:underline">
              View all bookings →
            </Link>
          </div>
        )}
      </Content>
    </>
  );
}

function FlagRow({ agent, teamAvgClose }) {
  if (agent.bookingsTotal === 0) return <FlagBadge tone="neutral">No activity</FlagBadge>;
  if (typeof teamAvgClose === "number" && agent.closeRate < teamAvgClose - 10)
    return <FlagBadge tone="risk">Low close rate</FlagBadge>;
  if (agent.noShowRate > 15) return <FlagBadge tone="watch">High no-shows</FlagBadge>;
  return <FlagBadge tone="ok">On track</FlagBadge>;
}
