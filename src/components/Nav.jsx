"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export default function Nav({ user }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = user.role === "admin";

  const links = [
    { href: "/bookings", label: "Bookings" },
    { href: "/sales", label: "Sales" },
    { href: "/reports", label: "Reports" },
    ...(isAdmin
      ? [
          { href: "/agents", label: "Agents" },
          { href: "/assignments", label: "Assignments" },
          { href: "/notifications", label: "Notifications" },
        ]
      : []),
  ];

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-slate-900">Gold Adam CRM</span>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm",
                  pathname === l.href
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">
            {user.name || user.email}{" "}
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {user.role}
            </span>
          </span>
          <button onClick={logout} className="text-slate-600 hover:text-slate-900">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
