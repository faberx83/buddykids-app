import "server-only";

// TRAMA — Wave 1 "Pilot Observability" (vedi
// docs/trama-one/analysis/TRAMA_PILOT_OBSERVABILITY_COORDINATION_IMPLEMENTATION.md
// e l'audit sorgente TRAMA_PILOT_ARCHITECTURE_REVIEW.md, sez.8: "Admin —
// nuovi utenti e pilot monitoring"). Nessuna nuova tabella: uno stato
// sintetico per-utente derivato SOLO da dati operativi già esistenti,
// riusando il motore Walkthrough già in produzione
// (lib/walkthrough/data.ts#getWalkthroughProgress, stesso usato dal carousel
// Beta in app/nextgen/layout.tsx) e lo stesso principio di lettura Admin già
// stabilito in lib/data/command-center.ts (nessuna query nuova pesante,
// riaggregazione di dati già letti altrove nel progetto).
//
// "Pilota" oggi coincide con la Controlled Beta Cohort (stessa cohort/flag
// TRAMA_ONE_ENABLED che governa l'accesso a NextGen, vedi migration_08 e
// migration_30): questa pagina mostra solo profili con almeno una riga in
// beta_cohort_memberships.
//
// CHI LEGGE COSA (e perché):
//  - profiles, beta_cohort_memberships, tutorial_progress, bookings, kids:
//    la RLS di ciascuna ha già un bypass "is_platform_admin()" (verificato in
//    supabase/schema.sql) — lette con il client di sessione ordinario
//    (createClient()), MAI il service client, stesso principio già seguito
//    da lib/data/admin-bookings.ts/lib/data/admin-favorites.ts.
//  - group_members: la sua RLS ha SOLO "is_group_member()" (nessun bypass
//    admin) — per includere "gruppo creato/joined" fra i segnali di prima
//    attività significativa serve il service client, limitato a questa
//    singola lettura aggregata in sola lettura (mai una scrittura).
//  - auth.users.last_sign_in_at: vive nello schema `auth`, irraggiungibile
//    dal client di sessione per qualunque ruolo — richiede
//    supabase.auth.admin.listUsers() col service client (stesso helper già
//    usato da app/internal/beta-pipeline/route.ts: nessuna nuova dipendenza
//    infrastrutturale).

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { computePilotStatus, PilotOnboardingStatus, PilotStatus } from "@/lib/pilot/status";

// NOTA: non passa da lib/walkthrough/data.ts#getWalkthroughProgress (che
// pure calcola esattamente questo stato) perché quella funzione legge una
// riga alla volta con un round-trip per utente — qui, per un elenco di N
// utenti, un'unica query batched (.in("user_id", userIds)) sullo stesso
// identico tutorial_key/tabella è più efficiente e resta la stessa fonte
// dati; la regola di derivazione (unico step "carousel") è la stessa.

export type { PilotOnboardingStatus, PilotStatus };

export interface PilotUserRow {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  role: string;
  cohortKeys: string[];
  cohortActive: boolean;
  onboardingStatus: PilotOnboardingStatus;
  /** Prima azione persistita indicativa di uso reale — vedi PILOT_ACTION_LABEL. */
  firstMeaningfulActionAt: string | null;
  firstMeaningfulActionLabel: string | null;
  // Segnalato da Fabrizio (01/09/2026): "Ultimo accesso" (auth, si aggiorna
  // solo al login) sembra "non aggiornato" perché non riflette l'uso reale
  // del prodotto — un genitore può prenotare/aggiungere un bambino restando
  // loggato per giorni senza rifare login. lastActivityAt è il MASSIMO delle
  // stesse 3 fonti già usate per firstMeaningfulActionAt (kid/booking/group),
  // nessuna query nuova: stesso identico dato, letto due volte (min e max)
  // invece di una sola.
  lastActivityAt: string | null;
  lastActivityLabel: string | null;
  lastSignInAt: string | null;
  status: PilotStatus;
}

export interface PilotTimelineEvent {
  at: string;
  label: string;
}

export interface PilotUserDetail {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  role: string;
  cohortKeys: string[];
  cohortActive: boolean;
  onboardingStatus: PilotOnboardingStatus;
  lastSignInAt: string | null;
  status: PilotStatus;
  /** Tutte le azioni (non solo la prima/ultima), più recente prima. */
  timeline: PilotTimelineEvent[];
}

// Onboarding Beta: un solo tutorial, un solo step (lib/walkthrough/registry.ts
// "parent_beta_onboarding" -> step "carousel") — lo stato del carousel È lo
// stato di onboarding, nessuna aggregazione multi-step necessaria qui.
const ONBOARDING_TUTORIAL_KEY = "parent_beta_onboarding";

export const PILOT_ACTION_LABEL: Record<"kid" | "booking" | "group", string> = {
  kid: "Bambino aggiunto",
  booking: "Prenotazione creata",
  group: "Gruppo creato/aderito",
};

// PRE-DEPLOY SECURITY CHECK (31/08/2026) — la protezione ereditata da
// AdminLayout/DashboardLayout è SOLO client-side (DashboardLayout è "use
// client": decide se mostrare AccessGate o {children} nel browser). Ma
// questa pagina è un Server Component passato come {children} a un
// componente client — in Next.js App Router quell'albero server viene
// comunque RESO ed EMESSO NEL PAYLOAD RSC prima che il client decida se
// mostrarlo, quindi un Parent/Partner autenticato che apre /admin/one/pilot
// riceverebbe comunque nel payload di rete i dati del pilota (email,
// ultimo accesso...), anche se la UI visibile mostra "Accesso non
// autorizzato" — il gate visivo da solo non basta. Per questo
// l'autorizzazione vive QUI, nel data access layer, non solo nel layout:
// nessuna query (nemmeno quella col client di sessione ordinario) parte
// prima di aver verificato server-side che l'utente corrente sia
// autenticato E realmente platform_admin. Fail-closed silenzioso (nessun
// utente/riga restituita), stesso principio "mai un errore bloccante" già
// in uso altrove in questo file — chi chiama vede solo l'empty state, mai
// uno stack trace.
async function isCurrentUserPlatformAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false; // 1) nessuna sessione autenticata

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "platform_admin"; // 2) ruolo reale, verificato ora, non ereditato dalla UI
}

export async function getPilotUsers(): Promise<PilotUserRow[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  if (!(await isCurrentUserPlatformAdmin(supabase))) return [];

  const { data: memberships } = await supabase
    .from("beta_cohort_memberships")
    .select("user_id, cohort_key, active")
    .order("user_id");
  if (!memberships || memberships.length === 0) return [];

  const userIds = Array.from(new Set(memberships.map((m) => m.user_id as string)));

  const [{ data: profiles }, { data: tutorialRows }, { data: bookingRows }, { data: kidRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, created_at").in("id", userIds),
    // Solo l'unico step del tutorial Beta — evita di leggere righe di altri
    // tutorial (welcome_parent, discover_book_parent...) che non riguardano
    // questa pagina.
    supabase.from("tutorial_progress").select("user_id, status").eq("tutorial_key", ONBOARDING_TUTORIAL_KEY).in("user_id", userIds),
    supabase.from("bookings").select("parent_id, created_at").in("parent_id", userIds),
    supabase.from("kids").select("parent_id, created_at").in("parent_id", userIds),
  ]);

  // group_members: nessun bypass admin nella RLS (solo is_group_member()) —
  // serve il service client, in sola lettura, solo per questo aggregato.
  let groupJoinRows: { parent_id: string; joined_at: string | null }[] = [];
  const lastSignInById = new Map<string, string | null>();
  const serviceClient = createServiceClient();
  if (serviceClient) {
    const { data } = await serviceClient
      .from("group_members")
      .select("parent_id, joined_at")
      .in("parent_id", userIds);
    groupJoinRows = data ?? [];

    // auth.admin.listUsers() pagina di default 50 alla volta — un pilot di
    // questa scala (decine di utenti) rientra tipicamente in 1-2 pagine;
    // iteriamo finché una pagina torna vuota o non troviamo più id mancanti.
    const remaining = new Set(userIds);
    let page = 1;
    while (remaining.size > 0) {
      const { data: pageData, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
      if (error || !pageData || pageData.users.length === 0) break;
      for (const u of pageData.users) {
        if (remaining.has(u.id)) {
          lastSignInById.set(u.id, u.last_sign_in_at ?? null);
          remaining.delete(u.id);
        }
      }
      if (pageData.users.length < 200) break; // ultima pagina
      page += 1;
    }
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const onboardingByUser = new Map((tutorialRows ?? []).map((r) => [r.user_id as string, r.status as PilotOnboardingStatus]));
  const bookingMinByUser = new Map<string, string>();
  // BUG TROVATO+CORRETTO (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 —
  // segnalazione di Fabrizio: "ho fatto qualche azione ma non è loggata"):
  // "Ultima attività" (lastActivityAt) riusava questo stesso Map, che tiene
  // solo il MINIMO (la primissima prenotazione/bambino/gruppo) per utente —
  // corretto per "prima azione significativa", ma per "ultima attività"
  // qualunque prenotazione/gruppo SUCCESSIVO al primo restava invisibile
  // (verificato: faberx83+testparent@gmail.com aveva una prenotazione/un
  // gruppo di oggi, mai riflessi in tabella perché non erano il PRIMO).
  // Ora si tiene anche il MASSIMO per categoria, usato solo per lastAction.
  const bookingMaxByUser = new Map<string, string>();
  for (const b of bookingRows ?? []) {
    const parentId = b.parent_id as string;
    const at = b.created_at as string;
    const curMin = bookingMinByUser.get(parentId);
    if (!curMin || new Date(at) < new Date(curMin)) bookingMinByUser.set(parentId, at);
    const curMax = bookingMaxByUser.get(parentId);
    if (!curMax || new Date(at) > new Date(curMax)) bookingMaxByUser.set(parentId, at);
  }
  const kidMinByUser = new Map<string, string>();
  const kidMaxByUser = new Map<string, string>();
  for (const k of kidRows ?? []) {
    const parentId = k.parent_id as string;
    const at = k.created_at as string;
    const curMin = kidMinByUser.get(parentId);
    if (!curMin || new Date(at) < new Date(curMin)) kidMinByUser.set(parentId, at);
    const curMax = kidMaxByUser.get(parentId);
    if (!curMax || new Date(at) > new Date(curMax)) kidMaxByUser.set(parentId, at);
  }
  const groupMinByUser = new Map<string, string>();
  const groupMaxByUser = new Map<string, string>();
  for (const g of groupJoinRows) {
    if (!g.joined_at) continue;
    const parentId = g.parent_id as string;
    const curMin = groupMinByUser.get(parentId);
    if (!curMin || new Date(g.joined_at) < new Date(curMin)) groupMinByUser.set(parentId, g.joined_at);
    const curMax = groupMaxByUser.get(parentId);
    if (!curMax || new Date(g.joined_at) > new Date(curMax)) groupMaxByUser.set(parentId, g.joined_at);
  }

  const membershipsByUser = new Map<string, { cohortKeys: string[]; active: boolean }>();
  for (const m of memberships) {
    const entry = membershipsByUser.get(m.user_id as string) ?? { cohortKeys: [], active: false };
    entry.cohortKeys.push(m.cohort_key as string);
    entry.active = entry.active || Boolean(m.active);
    membershipsByUser.set(m.user_id as string, entry);
  }

  const rows: PilotUserRow[] = userIds
    .map((id): PilotUserRow | null => {
      const profile = profileById.get(id);
      if (!profile) return null; // profilo cancellato/inesistente — riga scartata, non un errore

      const onboardingStatus = onboardingByUser.get(id) ?? "not_started";

      const firstCandidates: { at: string | null; label: string }[] = [
        { at: kidMinByUser.get(id) ?? null, label: PILOT_ACTION_LABEL.kid },
        { at: bookingMinByUser.get(id) ?? null, label: PILOT_ACTION_LABEL.booking },
        { at: groupMinByUser.get(id) ?? null, label: PILOT_ACTION_LABEL.group },
      ].filter((c) => c.at !== null);
      firstCandidates.sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());
      const firstAction = firstCandidates[0] ?? null;

      // Ultima attività: MASSIMO per categoria (non lo stesso array di
      // firstCandidates, che tiene solo il minimo — vedi commento sopra
      // bookingMaxByUser per il bug che questo corregge).
      const lastCandidates: { at: string | null; label: string }[] = [
        { at: kidMaxByUser.get(id) ?? null, label: PILOT_ACTION_LABEL.kid },
        { at: bookingMaxByUser.get(id) ?? null, label: PILOT_ACTION_LABEL.booking },
        { at: groupMaxByUser.get(id) ?? null, label: PILOT_ACTION_LABEL.group },
      ].filter((c) => c.at !== null);
      lastCandidates.sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());
      const lastAction = lastCandidates.length > 0 ? lastCandidates[lastCandidates.length - 1] : null;

      const lastSignInAt = lastSignInById.get(id) ?? null;
      const membership = membershipsByUser.get(id) ?? { cohortKeys: [], active: false };

      return {
        id,
        email: (profile.email as string) ?? null,
        fullName: (profile.full_name as string) ?? null,
        createdAt: profile.created_at as string,
        role: (profile.role as string) ?? "parent",
        cohortKeys: membership.cohortKeys,
        cohortActive: membership.active,
        onboardingStatus,
        firstMeaningfulActionAt: firstAction?.at ?? null,
        firstMeaningfulActionLabel: firstAction?.label ?? null,
        lastActivityAt: lastAction?.at ?? null,
        lastActivityLabel: lastAction?.label ?? null,
        lastSignInAt,
        status: computePilotStatus(onboardingStatus, firstAction?.at ?? null, lastSignInAt),
      };
    })
    .filter((r): r is PilotUserRow => r !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return rows;
}

/**
 * Vera SOLO come promemoria per il chiamante (Admin UI): quando il service
 * client non è configurato (SUPABASE_SERVICE_ROLE_KEY assente), la pagina
 * funziona comunque ma senza "Ultimo accesso" e senza il segnale "gruppo" fra
 * le attività significative — mai un errore bloccante, stesso principio
 * "best effort" già stabilito in lib/telemetry/events.ts.
 */
export function isPilotLastSignInAvailable(): boolean {
  return createServiceClient() !== null;
}

// Drill-down per utente (01/09/2026, richiesto da Fabrizio dopo aver notato
// che "Ultimo accesso" in tabella sembrava poco aggiornato): stesse 3 fonti
// dati di getPilotUsers() sopra (kids/bookings/group_members), ma qui lette
// per UN SOLO utente (query .eq invece di .in su tutta la cohort) e SENZA
// prendere solo il minimo/massimo — ogni riga diventa un evento nella
// timeline, così l'admin vede "quante volte" e "quando", non solo "la
// prima/ultima". Stessa disciplina no-PII del resto del file: solo
// PILOT_ACTION_LABEL generici + timestamp, mai nomi di bambini/attività/
// gruppi (anche se is_platform_admin() li renderebbe leggibili via RLS).
export async function getPilotUserDetail(userId: string): Promise<PilotUserDetail | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  if (!(await isCurrentUserPlatformAdmin(supabase))) return null;

  // Stesso perimetro "solo pilota" della lista: se l'utente non ha nessuna
  // riga in beta_cohort_memberships, non è mai stato nella cohort — 404,
  // non un errore.
  const { data: membership } = await supabase
    .from("beta_cohort_memberships")
    .select("cohort_key, active")
    .eq("user_id", userId);
  if (!membership || membership.length === 0) return null;

  const [{ data: profile }, { data: tutorialRow }, { data: bookingRows }, { data: kidRows }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, created_at").eq("id", userId).maybeSingle(),
    supabase
      .from("tutorial_progress")
      .select("status")
      .eq("tutorial_key", ONBOARDING_TUTORIAL_KEY)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("bookings").select("created_at").eq("parent_id", userId),
    supabase.from("kids").select("created_at").eq("parent_id", userId),
  ]);
  if (!profile) return null;

  let groupJoinRows: { joined_at: string | null }[] = [];
  let lastSignInAt: string | null = null;
  const serviceClient = createServiceClient();
  if (serviceClient) {
    const { data } = await serviceClient.from("group_members").select("joined_at").eq("parent_id", userId);
    groupJoinRows = data ?? [];
    const { data: authUserData } = await serviceClient.auth.admin.getUserById(userId);
    lastSignInAt = authUserData?.user?.last_sign_in_at ?? null;
  }

  const timeline: PilotTimelineEvent[] = [
    ...(kidRows ?? []).map((k) => ({ at: k.created_at as string, label: PILOT_ACTION_LABEL.kid })),
    ...(bookingRows ?? []).map((b) => ({ at: b.created_at as string, label: PILOT_ACTION_LABEL.booking })),
    ...groupJoinRows
      .filter((g): g is { joined_at: string } => Boolean(g.joined_at))
      .map((g) => ({ at: g.joined_at, label: PILOT_ACTION_LABEL.group })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const onboardingStatus = (tutorialRow?.status as PilotOnboardingStatus) ?? "not_started";
  const firstMeaningfulActionAt = timeline.length > 0 ? timeline[timeline.length - 1].at : null;

  return {
    id: userId,
    email: (profile.email as string) ?? null,
    fullName: (profile.full_name as string) ?? null,
    createdAt: profile.created_at as string,
    role: (profile.role as string) ?? "parent",
    cohortKeys: membership.map((m) => m.cohort_key as string),
    cohortActive: membership.some((m) => Boolean(m.active)),
    onboardingStatus,
    lastSignInAt,
    status: computePilotStatus(onboardingStatus, firstMeaningfulActionAt, lastSignInAt),
    timeline,
  };
}
