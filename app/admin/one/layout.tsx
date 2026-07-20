import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId, logTelemetryEvent } from "@/lib/telemetry/correlation";

// Forza il rendering dinamico per-richiesta — vedi lo stesso commento in
// app/one/layout.tsx per la motivazione completa.
export const dynamic = "force-dynamic";

// TRAMA ONE — route shell Admin (Build Sprint 0).
//
// proxy.ts NON è stato modificato: sul dominio admin.* la regola generica di
// rewrite già esistente riscrive qualunque path non ancora prefissato verso
// "/admin" — "/one" su quel dominio arriva già a app/admin/one/* senza
// alcuna modifica a proxy.ts, e passa già dal gate di ruolo esistente
// (richiede profiles.role = platform_admin) prima di raggiungere questo
// layout.
//
// Fallback a flag disattivato: redirect("/admin") — Dashboard Admin
// esistente. "/admin" ha già il prefisso atteso da proxy.ts, quindi NON
// viene riscritto una seconda volta: nessun rischio di loop.
export default async function OneAdminLayout({ children }: { children: React.ReactNode }) {
  const correlationId = generateCorrelationId();

  let userId: string | null = null;
  let role: string | null = null;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");
    userId = user.id;

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = (profile?.role as string) ?? "parent";
  }

  logTelemetryEvent({
    event: "one_route_access",
    correlationId,
    tenant: "admin",
    role,
    detail: "app/admin/one",
  });

  const enabled = await resolveFeatureFlag({
    flagName: "TRAMA_ONE_ENABLED",
    userId,
    role,
    tenant: "admin",
    correlationId,
  });

  if (!enabled) {
    logTelemetryEvent({
      event: "one_route_fallback",
      correlationId,
      tenant: "admin",
      role,
      detail: "TRAMA_ONE_ENABLED=false",
    });
    redirect("/admin");
  }

  return <div data-trama-one-portal="admin">{children}</div>;
}
