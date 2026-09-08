"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  MapPin,
  BarChart3,
  ShoppingBag,
  ListChecks,
  Workflow,
  Truck,
  Activity,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  bookings: CalendarCheck,
  agents: Users,
  assignments: MapPin,
  reports: BarChart3,
  sales: ShoppingBag,
  leads: ListChecks,
  workflows: Workflow,
  fleet: Truck,
  logs: Activity,
};

function navItems(isAdmin) {
  if (!isAdmin) {
    return [
      { href: "/dashboard", key: "dashboard", label: "My Dashboard" },
      { href: "/bookings", key: "bookings", label: "My Appointments" },
      { href: "/leads", key: "leads", label: "My Leads (VCR)" },
      { href: "/reports", key: "reports", label: "My Stats" },
    ];
  }
  return [
    { href: "/dashboard", key: "dashboard", label: "Dashboard" },
    { href: "/bookings", key: "bookings", label: "Appointments" },
    { href: "/agents", key: "agents", label: "Field Agents" },
    { href: "/assignments", key: "assignments", label: "Assignments" },
    { href: "/reports", key: "reports", label: "Stats & Reports" },
    { href: "/sales", key: "sales", label: "Purchases" },
    { href: "/leads", key: "leads", label: "Leads (VCR)" },
    { href: "/workflows", key: "workflows", label: "Workflows" },
    { href: "/fleet", key: "fleet", label: "Fleet" },
    { href: "/logs", key: "logs", label: "Scraper Health" },
  ];
}

export default function Nav({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const items = navItems(isAdmin);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const NavLinks = ({ onNavigate }) => (
    <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              active ? "bg-panel-raised text-text" : "text-muted hover:bg-panel hover:text-text"
            )}
          >
            <Icon size={16} strokeWidth={2} className={active ? "text-gold" : ""} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarBody = ({ onNavigate }) => (
    <>
      <div className="border-b border-border px-5 pb-[22px]">
        <div className="font-serif text-[20px] font-semibold text-gold">Goldroute</div>
        <div className="mt-0.5 text-[11px] text-muted-dim">
          {isAdmin ? "Admin · Goldroute" : "Agent view"}
        </div>
      </div>
      <div className="mt-3">
        <NavLinks onNavigate={onNavigate} />
      </div>
      <div className="mt-auto space-y-1 border-t border-border px-2.5 pt-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-muted hover:bg-panel hover:text-text"
        >
          <LogOut size={16} strokeWidth={2} />
          Sign out
        </button>
        <div className="px-3 py-1.5 text-[11px] text-muted-dim">
          <div className="font-medium text-muted">{user.name || user.email}</div>
          <div className="capitalize">{user.role}</div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[222px] shrink-0 flex-col border-r border-border bg-[#0C0F14] py-5 md:flex">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-ink px-4 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-text"
        >
          <Menu size={18} />
        </button>
        <div className="font-serif text-[17px] font-semibold text-gold">Goldroute</div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[250px] flex-col bg-[#0C0F14] py-5 shadow-2xl">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel"
            >
              <X size={18} />
            </button>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
