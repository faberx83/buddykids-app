import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Role } from "@/lib/types";

// SPRINT 0 (NEXTGEN) — guscio minimo dell'area Gestore NEXTGEN. Stesso
// controllo ruolo di app/center/layout.tsx (LEGACY, non toccato) ma nessun
// riuso del componente DashboardLayout: la Sprint 4 (evoluzione portale
// Gestore) potrà disegnare una shell completamente nuova senza vincoli
// ereditati da LEGACY.
export default async function NextgenCenterLayout({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login?next=/nextgen/center");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile?.role as Role) ?? "parent";
    if (role !== "center_admin" && role !== "platform_admin") redirect("/nextgen");
  }

  return <div className="min-h-screen bg-bg">{children}</div>;
}
