import "server-only";

// TRAMA — CONSENSI E INFORMATIVE AL PILOT (16/10/2026). Fabrizio: "perché
// global? non posso lasciarlo solo fino al pilot?". La pagina di
// registrazione non conosce l'utente, ma chi arriva da un link d'invito beta
// (?beta=CODICE) porta con sé la coorte in cui entrerà: la leggiamo dal codice
// (solo se attivo, non scaduto e non esaurito) e la usiamo per decidere se
// mostrare le caselle di Termini e Privacy. Mai il codice nella risposta:
// restituisce solo la chiave della coorte.

import { createServiceClient } from "@/lib/supabase/service";

export async function cohortForBetaInviteCode(rawCode: string | null | undefined): Promise<string | null> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code || code.length > 64) return null;
  const service = createServiceClient();
  if (!service) return null;
  try {
    const { data } = await service
      .from("beta_invite_codes")
      .select("cohort_key, active, expires_at, max_redemptions, redeemed_count")
      .eq("code", code)
      .maybeSingle();
    if (!data || !data.active) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
    if (data.max_redemptions !== null && (data.redeemed_count as number) >= (data.max_redemptions as number)) return null;
    return (data.cohort_key as string) || null;
  } catch {
    return null;
  }
}
