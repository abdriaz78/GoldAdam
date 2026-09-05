"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  DollarSign,
  Users,
  MapPin,
  Bell,
  BarChart3,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  bookings: CalendarCheck,
  sales: DollarSign,
  agents: Users,
  assignments: MapPin,
  notifications: Bell,
  reports: BarChart3,
};

function navItems(isAdmin) {
  const items = [
    { href: "/dashboard", key: "dashboard", label: "Dashboard" },
    { href: "/bookings", key: "bookings", label: "Bookings" },
    { href: "/sales", key: "sales", label: "Sales" },
    { href: "/reports", key: "reports", label: "Reports" },
  ];
  if (isAdmin) {
    items.push(
      { href: "/agents", key: "agents", label: "Agents" },
      { href: "/assignments", key: "assignments", label: "Assignments" },
      { href: "/notifications", key: "notifications", label: "Notifications" }
    );
  }
  return items;
}

// Bottom tab bar only has room for a handful of items — same set for both
// roles, the rest live in the drawer behind "More".
const BOTTOM_KEYS = ["dashboard", "bookings", "sales", "reports"];

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
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-stone-300 transition-colors",
              active
                ? "bg-stone-800 text-white shadow-[inset_3px_0_0_0_theme(colors.amber.600)]"
                : "hover:bg-stone-800/70 hover:text-white"
            )}
          >
            <Icon size={17} strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarBody = ({ onNavigate }) => (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-5 pt-1 text-white">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-600 text-sm font-bold">
          G
        </div>
        <span className="font-semibold">Gold Adam CRM</span>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto space-y-1 border-t border-stone-800 pt-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-stone-300 hover:bg-stone-800/70 hover:text-white"
        >
          <LogOut size={17} strokeWidth={2} />
          Sign out
        </button>
        <div className="px-3 py-1.5 text-xs text-stone-500">
          <div className="font-medium text-stone-300">{user.name || user.email}</div>
          <div className="capitalize">{user.role}</div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-stone-900 px-3 py-4 md:flex">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-14 items-center gap-3 border-b border-stone-200 bg-white px-4 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 font-semibold text-stone-900">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-amber-600 text-xs font-bold text-white">
            G
          </div>
          Gold Adam CRM
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-stone-900/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-stone-900 px-3 py-4">
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-stone-800"
            >
              <X size={18} />
            </button>
            <SidebarBody onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {items
          .filter((i) => BOTTOM_KEYS.includes(i.key))
          .map((item) => {
            const Icon = ICONS[item.key];
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-1 px-2 py-2 text-[10px]",
                  active ? "font-semibold text-amber-700" : "text-stone-500"
                )}
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex min-w-16 flex-col items-center gap-1 px-2 py-2 text-[10px] text-stone-500"
        >
          <Menu size={18} strokeWidth={2} />
          More
        </button>
      </nav>
    </>
  );
}
