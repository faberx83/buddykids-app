import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId, logTelemetryEvent } from "@/lib/telemetry/correlation";

// TRAMA ONE — route shell Parent (Build Sprint 0).
//
// Shell minimale, nessuna funzionalità di business simulata: solo gate di
// feature flag + fallback AS-IS. proxy.ts NON è stato modificato — questo
// layout eredita già da proxy.ts il gate tenant/auth per il dominio
// famiglie (login richiesto su qualunque path non escluso, "/one" incluso),
// quindi il controllo auth qui sotto è ridondante per costruzione ma
// replicato per coerenza con lo stesso pattern difensivo già usato in
// app/(main)/layout.tsx, app/center/layout.tsx e app/admin/layout.tsx.
//
// Fallback a flag disattivato: redirect("/") — Home Parent Legacy, sempre
// esistente e priva di prefisso di rewrite sul dominio famiglie, quindi
// senza alcun rischio di loop con proxy.ts.
export default async function OneParentLayout({ children }: { children: React.ReactNode }) {
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
    tenant: "family",
    role,
    detail: "app/one",
  });

  const enabled = await resolveFeatureFlag({
    flagName: "TRAMA_ONE_ENABLED",
    userId,
    role,
    tenant: "family",
    correlationId,
  });

  if (!enabled) {
    logTelemetryEvent({
      event: "one_route_fallback",
      correlationId,
      tenant: "family",
      role,
      detail: "TRAMA_ONE_ENABLED=false",
    });
    redirect("/");
  }

  return <div data-trama-one-portal="parent">{children}</div>;
}
