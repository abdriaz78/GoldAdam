"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState([]);
  const [agents, setAgents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState({ agentId: "", routeCode: "", date: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [as, ag, rt] = await Promise.all([
        api("/api/assignments"),
        api("/api/agents"),
        api("/api/routes"),
      ]);
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
    if (!form.agentId || !form.routeCode || !form.date)
      return toast.error("Agent, route and date are required");
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Route Assignments</h1>
      <p className="text-sm text-slate-500">
        Assign which agent runs a route on a given day. Bookings for that route+date are linked to
        the agent so they appear under that agent&apos;s filter and login.
      </p>

      <form
        onSubmit={add}
        className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-4 gap-2"
      >
        <select
          value={form.agentId}
          onChange={(e) => setForm((f) => ({ ...f, agentId: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select agent</option>
          {agents.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={form.routeCode}
          onChange={(e) => setForm((f) => ({ ...f, routeCode: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select route</option>
          {routes.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code} — {r.region}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          Assign
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Agent</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a._id} className="border-b border-slate-100">
                <td className="px-3 py-2">{a.date}</td>
                <td className="px-3 py-2 font-mono text-xs">{a.routeCode}</td>
                <td className="px-3 py-2">{a.agentId?.name || "—"}</td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                  No assignments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
