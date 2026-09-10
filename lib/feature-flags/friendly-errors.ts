// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Estratta da app/actions/feature-flag-overrides.ts: un file con "use
// server" in cima tratta OGNI export come una Server Action e la build
// (Turbopack) rifiuta un export sincrono ("Server Actions must be async
// functions") — friendlyError() è pura, sincrona, e ora riusata anche da
// app/actions/releases.ts (Promotion Engine), quindi va tenuta fuori da un
// file "use server". Stesso principio già seguito altrove nel repository
// per separare logica pura da moduli con vincoli di runtime particolari
// (lib/feature-flags/evaluate.ts vs resolve.ts, lib/telemetry/known-events.ts
// vs events.ts).

export function friendlyError(error: { code?: string; message: string } | null): string | undefined {
  if (!error) return undefined;
  if (error.code === "42501" || error.message.includes("policy")) {
    return "Non hai i permessi di Admin piattaforma per gestire i feature flag.";
  }
  if (error.message.includes("feature_flag_scope_value_consistency")) {
    return "Scope 'global' non ammette un valore; ogni altro scope richiede un valore non vuoto.";
  }
  if (error.message.includes("idx_feature_flag_overrides_unique")) {
    return "Esiste già un override per questo flag+scope+valore — modifica quello esistente invece di crearne uno nuovo.";
  }
  return error.message;
}
