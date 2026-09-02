import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function DashboardLayout({ children }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const safeUser = {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav user={safeUser} />
      <main className="max-w-[1400px] mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
