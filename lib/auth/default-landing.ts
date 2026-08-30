import "server-only";

// BUGFIX (segnalato da Fabrizio, 30/08, con screenshot: "come mai ho degli
// screen da parte di Maria che mi sembra sia entrata nella versione
// legacy?") — Maria si è registrata tramite un link di invito Beta
// (?beta=TRAMABETA26, vedi app/actions/beta-invites.ts) proprio per avere
// accesso a TRAMA ONE (NextGen), ma sia la conferma email (app/auth/callback/
// route.ts) sia ogni login successivo (LoginForm.tsx) atterravano comunque
// su "/" (Legacy Home) quando non veniva richiesta esplicitamente un'altra
// destinazione (?next=...). Prima del 27/08 questo non era un problema
// bloccante: VersionToggle.tsx era visibile a chiunque, quindi c'era comunque
// un modo per passare a NextGen con un tocco. Da quando quel pulsante è stato
// ristretto alle sole utenze di test personali di Fabrizio (richiesta
// esplicita, vedi VersionToggle.tsx#isVersionToggleTestAccount), un beta
// tester esterno atterrato su Legacy non ha più NESSUN modo per raggiungere
// NextGen — l'intero punto dell'invito Beta andava perso.
//
// Questa funzione centralizza la destinazione di default per un GENITORE
// dopo login/conferma email: se è un membro della Controlled Beta Cohort
// (stesso flag/meccanismo già usato per Onboarding Carousel/Spotlight,
// TRAMA_ONE_ENABLED risolto true), atterra su NextGen — altrimenti Legacy
// come sempre. Nessun impatto su Partner/Admin: il controllo sul ruolo
// profilo ritorna "/" per qualunque ruolo diverso da "parent".
//
// Server-only per costruzione: usa resolveFeatureFlag() (già server-only,
// service_role) e una query su profiles con il client passato dal chiamante
// (mai un nuovo client autonomo qui, per riusare la sessione già stabilita).

import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { Role } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";

// Tipo dedotto dal client server già in uso ovunque (createClient()), invece
// di un SupabaseClient<...> generico: evita mismatch di generics col resto
// del progetto (nessuno schema Database tipizzato qui).
type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveDefaultLandingPath(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<"/" | "/nextgen"> {
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  const role = (profile?.role as Role) ?? "parent";
  if (role !== "parent") return "/";

  const enabled = await resolveFeatureFlag({
    flagName: "TRAMA_ONE_ENABLED",
    userId,
    role,
    tenant: "family",
    correlationId: generateCorrelationId(),
  });

  return enabled ? "/nextgen" : "/";
}
