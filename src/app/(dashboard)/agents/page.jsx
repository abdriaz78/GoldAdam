"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import {
  PageHeader,
  Content,
  SectionHead,
  Card,
  Btn,
  Input,
  FlagBadge,
  TABLE_WRAP,
  THEAD,
  TH,
  TD,
  TR_HOVER,
  EmptyState,
} from "@/components/ui";

const pct = (n) => `${Number(n || 0).toFixed(1)}%`;
const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [mtd, setMtd] = useState(null);
  const [loadingMtd, setLoadingMtd] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", phone: "", twilioNumber: "", goldadamName: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/agents");
      setAgents(data.agents);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      setLoadingMtd(true);
      try {
        const m = await api("/api/reports/summary", { params: { from: monthStartISO(), to: todayISO() } });
        setMtd(m);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoadingMtd(false);
      }
    })();
  }, [load]);

  async function add(e) {
    e.preventDefault();
    if (!form.name) return toast.error("Name required");
    setSaving(true);
    try {
      await api("/api/agents", { method: "POST", body: form });
      toast.success("Agent added");
      setForm({ name: "", email: "", phone: "", twilioNumber: "", goldadamName: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const teamAvgClose = useMemo(() => {
    if (!mtd?.byAgent?.length) return null;
    const active = mtd.byAgent.filter((a) => a.bookingsTotal >= 3);
    if (!active.length) return null;
    return active.reduce((s, a) => s + a.closeRate, 0) / active.length;
  }, [mtd]);

  return (
    <>
      <PageHeader title="Field Agents" subtitle="Performance leaderboard, month to date, plus the agent roster" />
      <Content>
        <div>
          <SectionHead
            title="Leaderboard"
            subtitle={teamAvgClose != null ? `Team avg close rate: ${pct(teamAvgClose)}` : undefined}
          />
          <div className={TABLE_WRAP}>
            <table className="w-full">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Agent</th>
                  <th className={TH}>Bookings</th>
                  <th className={TH}>Purchases</th>
                  <th className={TH}>Close rate</th>
                  <th className={TH}>Avg margin</th>
                  <th className={TH}>No-show rate</th>
                  <th className={TH}>Payout</th>
                  <th className={TH}>Flag</th>
                </tr>
              </thead>
              <tbody>
                {loadingMtd ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState>Loading…</EmptyState>
                    </td>
                  </tr>
                ) : !mtd?.byAgent?.length ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState>No agent activity yet this month.</EmptyState>
                    </td>
                  </tr>
                ) : (
                  mtd.byAgent.map((a) => (
                    <tr key={a.agentId} className={TR_HOVER}>
                      <td className={TD + " font-medium"}>{a.name}</td>
                      <td className={TD}>{a.bookingsTotal}</td>
                      <td className={TD}>{a.salesCount}</td>
                      <td className={TD}>{pct(a.closeRate)}</td>
                      <td className={TD}>{pct(a.avgMargin)}</td>
                      <td className={TD}>{pct(a.noShowRate)}</td>
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

        <div>
          <SectionHead title="Add agent" />
          <Card>
            <form onSubmit={add} className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <Input
                placeholder="Twilio number"
                value={form.twilioNumber}
                onChange={(e) => setForm((f) => ({ ...f, twilioNumber: e.target.value }))}
              />
              <Input
                placeholder="Goldadam name (Sponsored tab)"
                value={form.goldadamName}
                onChange={(e) => setForm((f) => ({ ...f, goldadamName: e.target.value }))}
              />
              <Btn variant="gold" disabled={saving} className="md:col-span-5">
                {saving ? "Adding…" : "Add agent"}
              </Btn>
            </form>
          </Card>
        </div>

        <div>
          <SectionHead title="Roster" />
          <div className={TABLE_WRAP}>
            <table className="w-full">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Name</th>
                  <th className={TH}>Email</th>
                  <th className={TH}>Phone</th>
                  <th className={TH}>Twilio</th>
                  <th className={TH}>Goldadam name</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a._id} className={TR_HOVER}>
                    <td className={TD + " font-medium"}>{a.name}</td>
                    <td className={TD + " text-muted"}>{a.email || "—"}</td>
                    <td className={TD + " text-muted"}>{a.phone || "—"}</td>
                    <td className={TD + " text-muted"}>{a.twilioNumber || "—"}</td>
                    <td className={TD + " text-muted"}>{a.goldadamName || "—"}</td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState>No agents yet.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Content>
    </>
  );
}

function FlagRow({ agent, teamAvgClose }) {
  if (agent.bookingsTotal === 0) return <FlagBadge tone="neutral">No activity</FlagBadge>;
  if (typeof teamAvgClose === "number" && agent.closeRate < teamAvgClose - 10)
    return <FlagBadge tone="risk">Low close rate</FlagBadge>;
  if (agent.noShowRate > 15) return <FlagBadge tone="watch">High no-shows</FlagBadge>;
  if (typeof teamAvgClose === "number" && agent.closeRate > teamAvgClose + 10)
    return <FlagBadge tone="top">Top performer</FlagBadge>;
  return <FlagBadge tone="ok">On track</FlagBadge>;
}
