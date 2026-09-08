"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { api } from "@/lib/client";
import StatusChip from "@/components/StatusBadge";
import BookingDetailPanel from "@/components/StatusModal";
import { PageHeader, Content, Btn, Input, Select, TABLE_WRAP, THEAD, TH, TD, TR_HOVER, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["", "pending", "confirmed", "cancelled", "completed", "no_show", "no_sale"];

export default function BookingsPage() {
  const [me, setMe] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [agents, setAgents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

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
    <>
      <PageHeader
        title="Appointments"
        subtitle={`${total} total · showing ${bookings.length}${
          Object.keys(summary).length > 0
            ? " · " + Object.entries(summary).map(([k, v]) => `${v} ${k}`).join(", ")
            : ""
        }`}
      >
        <Btn variant="outline" onClick={exportXlsx}>
          Export Excel
        </Btn>
      </PageHeader>
      <Content>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-panel p-3 md:grid-cols-6">
          <Select value={filters.route} onChange={(e) => setFilters((f) => ({ ...f, route: e.target.value }))}>
            <option value="">All routes</option>
            {routes.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.region}
              </option>
            ))}
          </Select>

          <Select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s ? s : "All statuses"}
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
            placeholder="Search name / email / phone…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="col-span-2 md:col-span-1"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className={TABLE_WRAP}>
            <table className="w-full">
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Route</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Time</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Contact</th>
                  <th className={TH}>Stop</th>
                  {isAdmin && <th className={TH}>Agent</th>}
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState>Loading…</EmptyState>
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState>No bookings. Sync from the extension or import the CSV.</EmptyState>
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr
                      key={b._id}
                      onClick={() => setSelected(b)}
                      className={cn(TR_HOVER, "cursor-pointer", selected?._id === b._id && "bg-panel-raised")}
                    >
                      <td className={TD + " font-mono text-xs text-muted"}>{b.routeCode}</td>
                      <td className={TD}>{b.dateISO || b.date}</td>
                      <td className={TD}>{b.timeWindow}</td>
                      <td className={TD + " font-medium"}>{b.customerName}</td>
                      <td className={TD + " text-muted"}>
                        <div>{b.phone}</div>
                        <div className="text-xs text-muted-dim">{b.email}</div>
                      </td>
                      <td className={TD + " text-muted"}>
                        <div>{b.stopName}</div>
                        <div className="text-xs text-muted-dim">{b.address}</div>
                      </td>
                      {isAdmin && <td className={TD + " text-muted"}>{b.agentId?.name || "—"}</td>}
                      <td className={TD}>
                        <StatusChip status={b.status} />
                        {b.lastSyncedAt && <div className="mt-0.5 text-[10px] text-green">synced ✓</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div>
            {selected ? (
              <BookingDetailPanel
                booking={selected}
                onClose={() => setSelected(null)}
                onSaved={() => {
                  setSelected(null);
                  load();
                }}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-[12.5px] text-muted-dim">
                Select a booking to view details and update its status.
              </div>
            )}
          </div>
        </div>
      </Content>
    </>
  );
}
