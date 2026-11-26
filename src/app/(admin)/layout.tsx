import { redirect } from "next/navigation";
import { AdminShell } from "@/components/dashboard/admin-shell";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";

export const instant = false;

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AdminShell userEmail={user.email ?? ""}>{children}</AdminShell>;
}
