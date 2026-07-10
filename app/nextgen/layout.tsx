import { redirect } from "next/navigation";
import PhoneShell from "@/components/PhoneShell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// SPRINT 0 (NEXTGEN — V2 in parallelo a LEGACY): guscio minimo dell'area
// genitore NEXTGEN. Stesso guard di autenticazione di app/(main)/layout.tsx
// (LEGACY, non toccato), ma componente NUOVO e separato: le prossime sprint
// potranno restyilizzare questo layout senza alcun impatto su LEGACY.
// Riuso: PhoneShell (unico componente visivo LEGACY riutilizzato in questo
// sprint) + stesso client Supabase/autenticazione/DB.
export default async function NextgenLayout({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login?next=/nextgen");
  }

  return (
    <PhoneShell>
      <div className="flex h-full min-h-0 flex-col">
        <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
      </div>
    </PhoneShell>
  );
}
