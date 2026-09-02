"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/client";

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", twilioNumber: "", goldadamName: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api("/api/agents");
      setAgents(data.agents);
    } catch (err) {
      toast.error(err.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Agents</h1>

      <form
        onSubmit={add}
        className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-1 md:grid-cols-5 gap-2"
      >
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Twilio number"
          value={form.twilioNumber}
          onChange={(e) => setForm((f) => ({ ...f, twilioNumber: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Goldadam name (Sponsored tab)"
          value={form.goldadamName}
          onChange={(e) => setForm((f) => ({ ...f, goldadamName: e.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          disabled={saving}
          className="rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          Add agent
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Goldadam name</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a._id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2 text-slate-600">{a.email || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{a.phone || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{a.twilioNumber || "—"}</td>
                <td className="px-3 py-2 text-slate-600">{a.goldadamName || "—"}</td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No agents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
