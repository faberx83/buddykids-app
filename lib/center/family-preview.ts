// TRAMA PARTNER — LIVE MOBILE BUGFIX (01/10/2026): "Vedi come ti vedono le
// famiglie" (Il mio centro, app/center/profile/page.tsx).
//
// Logica PURA (nessun import server/Supabase) così da essere testabile in
// tests/one/partner-family-preview.spec.ts senza browser.
//
// Modello: REUSE della route pubblica già esistente /activity/[slug] (la
// stessa che vede una famiglia, nessuna seconda scheda centro). Il centro
// ci arriva nella STESSA scheda con ?anteprima=partner: la pagina, solo se
// l'utente loggato è il gestore di QUEL centro, aggiunge una barra
// "Anteprima famiglia" con il ritorno a "Il mio centro" e rende inattive le
// azioni che scriverebbero dati (Prenota, Preferiti, Contatta il gestore).
// Per chiunque altro il parametro viene ignorato: la pagina resta quella
// pubblica di sempre, che è già leggibile da tutti (RLS "lettura pubblica"
// su activities/centers) — l'anteprima non espone nulla di nuovo.

export const FAMILY_PREVIEW_PARAM = "anteprima";
export const FAMILY_PREVIEW_VALUE = "partner";

// Ritorno dall'anteprima: la pagina da cui parte la CTA ("Il mio centro").
export const FAMILY_PREVIEW_RETURN_HREF = "/center/profile";

export function buildFamilyPreviewHref(activitySlug: string): string {
  return `/activity/${encodeURIComponent(activitySlug)}?${FAMILY_PREVIEW_PARAM}=${FAMILY_PREVIEW_VALUE}`;
}

// Prima attività del centro (ordine created_at asc, come restituito da
// getActivitiesForCenter) con uno slug utilizzabile. null = nessuna
// superficie pubblica reale da mostrare → CTA disattivata con stato esplicito.
//
// Criterio "visibile alle famiglie" (PRE-APPLY REVIEW 01/10/2026): oggi il
// modello dati NON ha bozze né stati di pubblicazione per le attività — la
// tabella activities non ha colonne status/published/visibility/archived, la
// RLS "Activities: lettura pubblica" è `true`, e la superficie famiglie
// (getActivities() per Home/Scopri/Planner e getActivityBySlug() per
// /activity/[id]) non applica alcun filtro. Quindi OGNI attività del centro è
// esattamente ciò che una famiglia vede: nessun filtro aggiuntivo da
// replicare qui. Se in futuro getActivities() introdurrà un filtro di
// pubblicazione, va applicato anche qui (test PFP-21 lo segnala).
export function pickFamilyPreviewSlug(activities: { id: string | null | undefined }[]): string | null {
  const first = activities.find((a) => typeof a.id === "string" && a.id.trim() !== "");
  return first?.id ?? null;
}

export function isFamilyPreviewRequested(
  value: string | string[] | undefined | null
): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  return v === FAMILY_PREVIEW_VALUE;
}

// Il gestore può vedere la barra di anteprima SOLO per un'attività del
// proprio centro. Confronto sull'uuid reale (profiles.center_id vs
// activities.center_id); lo slug serve solo in modalità demo senza
// Supabase, dove non esiste un uuid.
export function canUseFamilyPreview(input: {
  requested: boolean;
  viewerCenterDbId: string | null;
  viewerCenterSlug: string | null;
  activityCenterDbId: string | null | undefined;
  activityCenterSlug: string | null | undefined;
  supabaseConfigured: boolean;
}): boolean {
  if (!input.requested) return false;
  if (input.supabaseConfigured) {
    return Boolean(
      input.viewerCenterDbId &&
        input.activityCenterDbId &&
        input.viewerCenterDbId === input.activityCenterDbId
    );
  }
  return Boolean(
    input.viewerCenterSlug &&
      input.activityCenterSlug &&
      input.viewerCenterSlug === input.activityCenterSlug
  );
}

// PRE-APPLY REVIEW (01/10/2026) — risoluzione NON-throwing usata da
// app/activity/[id]/page.tsx. Il loader del viewer (in produzione
// getCenterContext(), lib/data/center-admin.ts) non fa redirect né lancia per
// genitori/anonimi — verificato: per l'anonimo auth.getUser() restituisce
// user=null e la funzione ritorna centerDbId=null; per il genitore la
// propria riga profiles (RLS "il proprio profilo") ha center_id=null — ma è
// una chiamata di rete: qui ogni eccezione/rejection viene assorbita e
// l'anteprima resta semplicemente SPENTA, così la pagina pubblica non può
// mai rompersi per colpa di questo controllo. Il loader non viene nemmeno
// chiamato se il parametro non c'è (nessun costo per le famiglie).
export interface FamilyPreviewViewer {
  centerDbId: string | null;
  centerSlug: string | null;
}

export async function resolveFamilyPreview(input: {
  requestedParam: string | string[] | undefined | null;
  activityCenterDbId: string | null | undefined;
  activityCenterSlug: string | null | undefined;
  supabaseConfigured: boolean;
  loadViewer: () => Promise<FamilyPreviewViewer>;
  onError?: (error: unknown) => void;
}): Promise<boolean> {
  const requested = isFamilyPreviewRequested(input.requestedParam);
  if (!requested) return false;
  let viewer: FamilyPreviewViewer;
  try {
    viewer = await input.loadViewer();
  } catch (error) {
    input.onError?.(error);
    return false;
  }
  return canUseFamilyPreview({
    requested,
    viewerCenterDbId: viewer?.centerDbId ?? null,
    viewerCenterSlug: viewer?.centerSlug ?? null,
    activityCenterDbId: input.activityCenterDbId,
    activityCenterSlug: input.activityCenterSlug,
    supabaseConfigured: input.supabaseConfigured,
  });
}
