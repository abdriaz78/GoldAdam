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
    <div className="flex min-h-screen flex-col bg-ink text-text md:flex-row">
      <Nav user={safeUser} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
