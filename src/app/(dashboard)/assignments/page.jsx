"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";
import { PageHeader, Content, Card, Btn, Select, Input, TABLE_WRAP, THEAD, TH, TD, TR_HOVER, EmptyState } from "@/components/ui";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [agents, setAgents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState({ agentId: "", routeCode: "", date: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [as, ag, rt] = await Promise.all([api("/api/assignments"), api("/api/agents"), api("/api/routes")]);
      setAssignments(as.assignments);
      setAgents(ag.agents);
      setRoutes(rt.routes);
    } catch (err) {
      toast.error(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.agentId || !form.routeCode || !form.date) return toast.error("Agent, route and date are required");
    setSaving(true);
    try {
      const res = await api("/api/assignments", { method: "POST", body: form });
      toast.success(`Assigned · ${res.bookingsUpdated} bookings linked`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle="Assign which agent runs a route on a given day — bookings for that route+date link to the agent"
      />
      <Content>
        <Card>
          <form onSubmit={add} className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Select value={form.agentId} onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}>
              <option value="">Select agent</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select value={form.routeCode} onChange={(e) => setForm((f) => ({ ...f, routeCode: e.target.value }))}>
              <option value="">Select route</option>
              {routes.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code} — {r.region}
                </option>
              ))}
            </Select>
            <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            <Btn variant="gold" disabled={saving}>
              {saving ? "Assigning…" : "Assign"}
            </Btn>
          </form>
        </Card>

        <div className={TABLE_WRAP}>
          <table className="w-full">
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Date</th>
                <th className={TH}>Route</th>
                <th className={TH}>Agent</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a._id} className={TR_HOVER}>
                  <td className={TD}>{a.date}</td>
                  <td className={TD + " font-mono text-xs text-muted"}>{a.routeCode}</td>
                  <td className={TD + " font-medium"}>{a.agentId?.name || "—"}</td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState>No assignments yet.</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Content>
    </>
  );
}
