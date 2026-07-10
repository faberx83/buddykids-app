import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";

// SPRINT 0 (NEXTGEN) — guscio minimo dell'area Admin NEXTGEN. Stesso
// controllo ruolo di app/admin/layout.tsx (LEGACY, non toccato).
export default async function NextgenAdminLayout({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login?next=/nextgen/admin");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile?.role as Role) ?? "parent";
    if (role !== "platform_admin") redirect("/nextgen");
  }

  return <div className="min-h-screen bg-bg">{children}</div>;
}
