import { getFamilyForUser } from "@/lib/data/family";
import { getFamilyInvitePreviewAction } from "@/app/actions/family";
import FamigliaClient from "./FamigliaClient";
import AcceptFamilyInviteV2 from "@/components/nextgen/AcceptFamilyInviteV2";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

// 20/10/2026 — con il Profilo V2 (PROFILE_V2_ENABLED) il link d'invito apre
// la pagina d'invito V2; dopo "Accetta" si arriva in La tua famiglia.
// Senza flag, o senza ?accept=, tutto come prima (FamigliaClient).
async function profileV2On(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  return resolveFeatureFlag({
    flagName: "PROFILE_V2_ENABLED",
    userId: user.id,
    role: "parent",
    tenant: "family",
    correlationId: generateCorrelationId(),
  }).catch(() => false);
}

// SPRINT 5.5 (NEXTGEN) — Profilo Famiglia multi-genitore: pagina per creare
// una famiglia, invitare un secondo genitore (codice), vedere i membri, o
// entrare/uscire. Raggiungibile dal Planner (Organizzazione) — vedi
// PlannerClient.tsx, stesso trattamento del link "Indirizzi di famiglia".
//
// INVITO VIA EMAIL (segnalato da Fabrizio: "il solo codice non è
// sufficiente") — il link nell'email porta qui con ?accept=TOKEN (via
// /auth/login?next=..., già gestito da LoginForm.tsx per loggati e non).
// L'anteprima è letta lato server (get_family_invite_preview, pubblica) così
// il prompt "Sei stato invitato da X" appare subito, senza flash client-side.
export default async function FamigliaPage({
  searchParams,
}: {
  searchParams: Promise<{ accept?: string }>;
}) {
  const { accept } = await searchParams;
  const [family, invitePreview] = await Promise.all([
    getFamilyForUser(),
    accept ? getFamilyInvitePreviewAction(accept) : Promise.resolve(null),
  ]);
  if (accept && (await profileV2On())) {
    return <AcceptFamilyInviteV2 token={accept} preview={invitePreview} />;
  }
  return <FamigliaClient initialFamily={family} acceptToken={accept || null} invitePreview={invitePreview} />;
}
