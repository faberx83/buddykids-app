import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PhoneShell from "@/components/PhoneShell";
import PageLoadIndicator from "@/components/PageLoadIndicator";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
// CONSENSI AL PRIMO ACCESSO (20/11/2026): stessa schermata dell'app NextGen.
import FirstAccessConsentScreen from "@/components/legal/FirstAccessConsentScreen";
import { getFirstAccessConsentPayload } from "@/lib/legal/gate";

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

    // CONSENSI AL PRIMO ACCESSO (20/11/2026): famiglie senza Termini accettati
    // o Informativa letta vedono solo la schermata "Prima di continuare".
    const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
    const consentPayload = await getFirstAccessConsentPayload(supabase, user.id, (profile?.role as string | undefined) ?? "parent");
    if (consentPayload) {
      const firstName = ((profile?.full_name as string | null) ?? "").trim().split(" ")[0] || null;
      return (
        <PhoneShell>
          <FirstAccessConsentScreen {...consentPayload} firstName={firstName} />
        </PhoneShell>
      );
    }
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
