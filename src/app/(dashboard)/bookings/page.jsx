"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { api } from "@/lib/client";
import StatusBadge from "@/components/StatusBadge";
import StatusModal from "@/components/StatusModal";

const STATUS_OPTIONS = ["", "pending", "confirmed", "cancelled", "completed", "no_show", "no_sale"];

export default function BookingsPage() {
  const [me, setMe] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const [filters, setFilters] = useState({
    route: "",
    status: "",
    agentId: "",
    from: "",
    to: "",
    q: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/bookings", { params: { ...filters, limit: 500 } });
      setBookings(data.bookings);
      setTotal(data.total);
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
    const rows = bookings.map((b) => ({
      Route: b.routeCode,
      Date: b.date,
      "Time Window": b.timeWindow,
      Customer: b.customerName,
      Status: b.status,
      Email: b.email,
      Phone: b.phone,
      Stop: b.stopName,
      Address: b.address,
      Agent: b.agentId?.name || "",
      Note: b.note,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
    XLSX.writeFile(wb, "goldadam-bookings.xlsx");
  }

  const summary = useMemo(() => {
    const c = {};
    for (const b of bookings) c[b.status] = (c[b.status] || 0) + 1;
    return c;
  }, [bookings]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bookings</h1>
          <p className="text-sm text-slate-500">
            {total} total · showing {bookings.length}
            {Object.keys(summary).length > 0 && (
              <>
                {" · "}
                {Object.entries(summary)
                  .map(([k, v]) => `${v} ${k}`)
                  .join(", ")}
              </>
            )}
          </p>
        </div>
        <button
          onClick={exportXlsx}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
        >
          Export Excel
        </button>
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

        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s ? s : "All statuses"}
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
          placeholder="Search name / email / phone…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-1 col-span-2"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Stop</th>
              {isAdmin && <th className="px-3 py-2 font-medium">Agent</th>}
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  No bookings. Sync from the extension or import the CSV.
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr key={b._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{b.routeCode}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{b.dateISO || b.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{b.timeWindow}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{b.customerName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    <div>{b.phone}</div>
                    <div className="text-xs text-slate-400">{b.email}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <div>{b.stopName}</div>
                    <div className="text-xs text-slate-400">{b.address}</div>
                  </td>
                  {isAdmin && <td className="px-3 py-2 text-slate-600">{b.agentId?.name || "—"}</td>}
                  <td className="px-3 py-2">
                    <StatusBadge status={b.status} />
                    {b.lastSyncedAt && (
                      <div className="text-[10px] text-green-600 mt-0.5">synced ✓</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditing(b)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <StatusModal
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
