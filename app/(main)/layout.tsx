import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PhoneShell from "@/components/PhoneShell";
import PageLoadIndicator from "@/components/PageLoadIndicator";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Con Supabase collegato, questa parte dell'app (Home, Cerca, Gruppi,
  // Calendario, Profilo) richiede un utente autenticato. Senza chiavi
  // Supabase configurate, restiamo nella modalità demo/anteprima.
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");
  }

  return (
    <PhoneShell>
      <PageLoadIndicator color="#4DAFEF" />
      <div className="flex h-full min-h-0 flex-col">
        <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
        <BottomNav />
      </div>
    </PhoneShell>
  );
}
