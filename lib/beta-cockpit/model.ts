// TRAMA — ADMIN BETA COCKPIT. Dal dato grezzo (lib/data/beta-cockpit.ts) al
// modello che le pagine mostrano: una riga per FAMIGLIA, stati, funnel,
// time-to-value, utilizzo per area, frizioni, alert e sintesi. Logica pura e
// deterministica: nessuna AI, nessuna causalità inventata.

import {
  ACTION_DEF,
  AREA_LABEL,
  AREA_ORDER,
  COMMITMENT_KINDS,
  COORDINATION_KINDS,
  FUNNEL_DEF,
  STATUS_DEF,
  countOf,
  type ActionKind,
  type CockpitThresholds,
  type FamilyStatus,
  type FunnelStep,
  type UsageArea,
} from "./definitions";
import { addDays, diffDays, inPeriod, previousPeriod, romeDay } from "./dates";

// ── Input grezzo ──────────────────────────────────────────────────────────

export type OnboardingState = "not_started" | "in_progress" | "completed" | "skipped";

export interface RawMember {
  userId: string;
  /** profiles.created_at */
  registeredAt: string;
  onboarding: OnboardingState;
  onboardingAt: string | null;
  /** Dispositivi con notifiche push attive. */
  pushDevices: number;
}

export interface RawFamily {
  /** id di families, oppure "u:<userId>" (genitore senza famiglia), oppure "w:<id lista>" (invitata non registrata). */
  key: string;
  /** Etichetta senza dati dei figli: quella data dal founder all'invito, il nome della famiglia o le iniziali. */
  label: string;
  invitedAt: string | null;
  members: RawMember[];
  kids: number;
  kidsWithSchool: number;
  /** Comuni della scuola dei figli (zona). */
  zones: string[];
  /** Inviti all'altro genitore ancora senza risposta (data di invio). */
  pendingPartnerInvites: string[];
  /** Richieste ai centri ancora senza risposta (data di invio). */
  openCenterRequests: string[];
  /** Salvati mai finiti nel Planner o in una richiesta. */
  savedNotPlaced: number;
  /** Prossima chiusura della scuola entro 14 giorni non organizzata (null = nessuna o non misurabile). */
  unorganizedClosure: { from: string; to: string } | null;
}

export interface RawAction {
  familyKey: string;
  userId: string;
  at: string;
  kind: ActionKind;
  /** false = impegno poi cancellato o prenotazione annullata: azione sì, impegno reale no. */
  active?: boolean;
}

export interface RawOpenDay {
  familyKey: string;
  day: string;
}

export interface CockpitRaw {
  families: RawFamily[];
  actions: RawAction[];
  /** null = migration 46 non applicata: niente "app aperta". */
  openDays: RawOpenDay[] | null;
  /** Errori tecnici aggregati (product_events, senza famiglia). */
  technicalErrors: string[];
}

// ── Riga famiglia ─────────────────────────────────────────────────────────

export interface FamilyRow {
  key: string;
  label: string;
  invitedAt: string | null;
  registeredAt: string | null;
  adults: number;
  onboardingDone: boolean;
  kids: number;
  school: boolean;
  commitments: number;
  secondAdult: boolean;
  coordinationUsed: boolean;
  activeDays7: number;
  activeDays14: number;
  /** Giorni con app aperta negli ultimi 7 (null = non misurabile). */
  openDays7: number | null;
  lastActionAt: string | null;
  lastActionLabel: string | null;
  saved: number;
  fromDiscovery: number;
  centerRequests: number;
  sharesWeek: number;
  feedback: number;
  pushActive: boolean;
  activatedAt: string | null;
  firstActionAt: string | null;
  status: FamilyStatus;
  /** Apre l'app senza azioni negli ultimi 7 giorni. */
  readsOnly: boolean;
  /** Primo passo del funnel non raggiunto (null = funnel completo). */
  stoppedAt: FunnelStep | null;
  /** Il passo non raggiunto è un ritorno non ancora misurabile (famiglia troppo recente). */
  stoppedPending: boolean;
  ttvFirstActionHours: number | null;
  ttvActivationHours: number | null;
  zones: string[];
  pendingPartnerInvites: string[];
  openCenterRequests: string[];
  savedNotPlaced: number;
  unorganizedClosure: { from: string; to: string } | null;
}

function actionsUpTo(actions: RawAction[], asOfDay: string): RawAction[] {
  return actions.filter((a) => romeDay(a.at) <= asOfDay);
}

function hoursBetween(a: string, b: string): number {
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 3_600_000));
}

/**
 * Calcola la riga di una famiglia "al giorno asOfDay" (Europe/Rome): conta
 * solo azioni fino a quel giorno, così lo stesso codice serve per oggi e per
 * un report passato. I fatti che esistono solo come stato attuale (push,
 * inviti in attesa, salvati non collocati, chiusure) restano quelli di oggi.
 */
export function computeFamilyRow(
  fam: RawFamily,
  allActions: RawAction[],
  openDays: RawOpenDay[] | null,
  asOfDay: string,
  t: CockpitThresholds
): FamilyRow {
  const members = fam.members.filter((m) => romeDay(m.registeredAt) <= asOfDay);
  const registered = members.length > 0;
  const registeredAt = registered ? members.map((m) => m.registeredAt).sort()[0] : null;
  const regDay = registeredAt ? romeDay(registeredAt) : null;

  const actions = actionsUpTo(allActions, asOfDay).sort((a, b) => a.at.localeCompare(b.at));
  const actionDays = new Set(actions.map((a) => romeDay(a.at)));
  const familyOpenDays = openDays === null ? null : new Set(openDays.filter((o) => o.day <= asOfDay).map((o) => o.day));

  const commitmentActions = actions.filter((a) => COMMITMENT_KINDS.includes(a.kind) && a.active !== false);
  const commitments = commitmentActions.length;
  const firstKid = actions.find((a) => a.kind === "kid_added");
  const nth = commitmentActions[t.activationMinCommitments - 1];
  // Attivazione: il momento in cui ci sono sia un figlio sia l'N-esimo impegno reale.
  const activated = firstKid && nth ? (firstKid.at > nth.at ? firstKid.at : nth.at) : null;

  const last = actions.length ? actions[actions.length - 1] : null;
  const first = actions.length ? actions[0] : null;

  const daysIn = (n: number, set: Set<string> | null) => {
    if (!set) return 0;
    let c = 0;
    for (let i = 0; i < n; i++) if (set.has(addDays(asOfDay, -i))) c++;
    return c;
  };
  const activeDays7 = daysIn(7, actionDays);
  const activeDays14 = daysIn(14, actionDays);
  const openDays7 = familyOpenDays ? daysIn(7, familyOpenDays) : null;

  const adults = members.length;
  const secondAdult = adults >= 2;
  const coordinationUsed = actions.some((a) => COORDINATION_KINDS.includes(a.kind));
  const onboardingDone = members.some((m) => m.onboarding === "completed" || m.onboarding === "skipped");

  // Stato
  let status: FamilyStatus;
  if (!registered) status = "invitata";
  else if (!last) status = "non_partita";
  else {
    const since = diffDays(romeDay(last.at), asOfDay);
    if (since >= t.dormantAfterDays) status = "dormiente";
    else if (activated) status = since >= t.atRiskAfterDays ? "a_rischio" : "attiva";
    else status = "in_avvio";
  }

  // Funnel (sequenziale)
  const returned = (fromDay: number, toDay: number): boolean => {
    if (!regDay) return false;
    for (let i = fromDay; i <= toDay; i++) {
      const d = addDays(regDay, i);
      if (d > asOfDay) break;
      if (actionDays.has(d) || familyOpenDays?.has(d)) return true;
    }
    return false;
  };
  const age = regDay ? diffDays(regDay, asOfDay) : 0;
  const checks: { step: FunnelStep; ok: boolean; pending: boolean }[] = [
    { step: "invitata", ok: true, pending: false },
    { step: "registrata", ok: registered, pending: false },
    { step: "onboarding", ok: onboardingDone, pending: false },
    { step: "primo_impegno", ok: commitments >= 1, pending: false },
    { step: "tre_impegni", ok: commitments >= t.activationMinCommitments, pending: false },
    { step: "secondo_adulto_o_coordinamento", ok: secondAdult || coordinationUsed, pending: false },
    { step: "ritorno_settimana_1", ok: returned(1, 7), pending: age < 7 },
    { step: "ritorno_settimana_2", ok: returned(8, 14), pending: age < 14 },
  ];
  const stop = checks.find((c) => !c.ok) ?? null;

  const inLast7 = (at: string) => {
    const d = romeDay(at);
    return d <= asOfDay && d > addDays(asOfDay, -7);
  };

  return {
    key: fam.key,
    label: fam.label,
    invitedAt: fam.invitedAt,
    registeredAt,
    adults,
    onboardingDone,
    kids: fam.kids,
    school: fam.kidsWithSchool > 0,
    commitments,
    secondAdult,
    coordinationUsed,
    activeDays7,
    activeDays14,
    openDays7,
    lastActionAt: last?.at ?? null,
    lastActionLabel: last ? ACTION_DEF[last.kind].label : null,
    saved: actions.filter((a) => a.kind === "saved").length,
    fromDiscovery: actions.filter((a) => a.kind === "discovery_to_planner").length,
    centerRequests: actions.filter((a) => a.kind === "booking_requested" || a.kind === "inquiry_sent").length,
    sharesWeek: actions.filter((a) => a.kind === "plan_shared" && inLast7(a.at)).length,
    feedback: actions.filter((a) => a.kind === "feedback_sent" || a.kind === "survey_answered").length,
    pushActive: fam.members.some((m) => m.pushDevices > 0),
    activatedAt: activated,
    firstActionAt: first?.at ?? null,
    status,
    readsOnly: registered && activeDays7 === 0 && (openDays7 ?? 0) > 0,
    stoppedAt: stop?.step ?? null,
    stoppedPending: stop?.pending ?? false,
    ttvFirstActionHours: registeredAt && first ? hoursBetween(registeredAt, first.at) : null,
    ttvActivationHours: registeredAt && activated ? hoursBetween(registeredAt, activated) : null,
    zones: fam.zones,
    pendingPartnerInvites: fam.pendingPartnerInvites,
    openCenterRequests: fam.openCenterRequests,
    savedNotPlaced: fam.savedNotPlaced,
    unorganizedClosure: fam.unorganizedClosure,
  };
}

/** Raggruppa azioni e giorni aperti per famiglia e calcola tutte le righe. */
export function computeFamilyRows(raw: CockpitRaw, asOfDay: string, t: CockpitThresholds): FamilyRow[] {
  const actionsBy = groupBy(raw.actions, (a) => a.familyKey);
  const openBy = raw.openDays ? groupBy(raw.openDays, (o) => o.familyKey) : null;
  return raw.families
    .filter((f) => !f.invitedAt || romeDay(f.invitedAt) <= asOfDay || f.members.some((m) => romeDay(m.registeredAt) <= asOfDay))
    .map((f) => computeFamilyRow(f, actionsBy.get(f.key) ?? [], openBy ? (openBy.get(f.key) ?? []) : null, asOfDay, t))
    .sort(compareRows);
}

const STATUS_RANK: Record<FamilyStatus, number> = { a_rischio: 0, dormiente: 1, non_partita: 2, in_avvio: 3, attiva: 4, invitata: 5 };

/** Prima chi chiede attenzione, poi chi va; a parità, l'ultima azione più vecchia prima. */
function compareRows(a: FamilyRow, b: FamilyRow): number {
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  return (a.lastActionAt ?? "").localeCompare(b.lastActionAt ?? "");
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

// ── Overview ──────────────────────────────────────────────────────────────

export interface Kpi {
  key: string;
  label: string;
  value: number;
  /** Denominatore per "7 su 15" (null = valore assoluto). */
  of: number | null;
  /** Variazione rispetto al periodo precedente, solo se sensata. */
  delta: number | null;
  /** Filtro della tabella famiglie a cui porta. */
  filter: FamilyFilter | null;
  hint: string;
}

export type FamilyFilter =
  | { kind: "status"; status: FamilyStatus }
  | { kind: "registered" }
  | { kind: "activated" }
  | { kind: "active_period" }
  | { kind: "second_adult" }
  | { kind: "coordination" }
  | { kind: "stopped"; step: FunnelStep }
  | { kind: "friction"; friction: FrictionKey }
  | { kind: "alert"; alert: AlertKey }
  | { kind: "area"; area: UsageArea | "app" };

export function familiesActiveInPeriod(raw: CockpitRaw, p: { from: string; to: string }): Set<string> {
  const s = new Set<string>();
  for (const a of raw.actions) if (inPeriod(a.at, p)) s.add(a.familyKey);
  return s;
}

export function computeOverview(
  raw: CockpitRaw,
  rows: FamilyRow[],
  period: { from: string; to: string },
  feedbackInPeriod: number,
  t: CockpitThresholds,
  previous: { rows: FamilyRow[]; feedbackInPeriod: number } | null
): Kpi[] {
  const registered = rows.filter((r) => r.registeredAt);
  const reg = registered.length;
  const activeSet = familiesActiveInPeriod(raw, period);
  const prevActive = previous ? familiesActiveInPeriod(raw, previousPeriod(period)) : null;

  const comparable = previous !== null && reg >= t.minFamiliesForComparison && previous.rows.filter((r) => r.registeredAt).length >= t.minFamiliesForComparison;
  const d = (now: number, before: number | undefined) => (comparable && before !== undefined ? now - before : null);
  const prevRows = previous?.rows ?? [];
  const prevReg = prevRows.filter((r) => r.registeredAt);

  const k = (key: string, label: string, value: number, of: number | null, delta: number | null, filter: FamilyFilter | null, hint: string): Kpi => ({
    key,
    label,
    value,
    of,
    delta,
    filter,
    hint,
  });

  return [
    k("invitate", "Famiglie invitate", rows.length, null, d(rows.length, prevRows.length), null, "Nella lista invitati o registrate con un codice beta."),
    k("registrate", "Registrate", reg, rows.length, d(reg, prevReg.length), { kind: "registered" }, "Almeno un adulto con account."),
    k(
      "attivate",
      "Attivate",
      registered.filter((r) => r.activatedAt).length,
      reg,
      d(registered.filter((r) => r.activatedAt).length, prevReg.filter((r) => r.activatedAt).length),
      { kind: "activated" },
      `Almeno un figlio e ${t.activationMinCommitments} impegni reali.`
    ),
    k(
      "attive_periodo",
      "Attive nel periodo",
      registered.filter((r) => activeSet.has(r.key)).length,
      reg,
      prevActive ? d(registered.filter((r) => activeSet.has(r.key)).length, prevReg.filter((r) => prevActive.has(r.key)).length) : null,
      { kind: "active_period" },
      "Almeno un'azione significativa nel periodo."
    ),
    k("a_rischio", "A rischio", rows.filter((r) => r.status === "a_rischio").length, reg, null, { kind: "status", status: "a_rischio" }, STATUS_DEF.a_rischio.rule),
    k("dormienti", "Dormienti", rows.filter((r) => r.status === "dormiente").length, reg, null, { kind: "status", status: "dormiente" }, STATUS_DEF.dormiente.rule),
    k("due_adulti", "Con 2 adulti", rows.filter((r) => r.secondAdult).length, reg, d(rows.filter((r) => r.secondAdult).length, prevRows.filter((r) => r.secondAdult).length), { kind: "second_adult" }, "Due account nella stessa famiglia."),
    k(
      "coordinamento",
      "Con coordinamento usato",
      rows.filter((r) => r.coordinationUsed).length,
      reg,
      d(rows.filter((r) => r.coordinationUsed).length, prevRows.filter((r) => r.coordinationUsed).length),
      { kind: "coordination" },
      "Chi porta / chi ritira assegnato almeno una volta (o un passaggio nei gruppi)."
    ),
    k("feedback", "Feedback ricevuti", feedbackInPeriod, null, d(feedbackInPeriod, previous?.feedbackInPeriod), null, "Feedback e survey nel periodo."),
  ];
}

// ── Funnel ────────────────────────────────────────────────────────────────

export interface FunnelRow {
  step: FunnelStep;
  label: string;
  rule: string;
  reached: number;
  /** Famiglie che si sono fermate a questo passo (non lo hanno raggiunto). */
  stopped: number;
  /** Di cui ancora non misurabili (troppo recenti per il ritorno). */
  pending: number;
}

export function computeFunnel(rows: FamilyRow[]): FunnelRow[] {
  const order = FUNNEL_DEF.map((f) => f.step);
  const idx = (s: FunnelStep | null) => (s === null ? order.length : order.indexOf(s));
  return FUNNEL_DEF.map((def, i) => {
    const reached = rows.filter((r) => idx(r.stoppedAt) > i).length;
    const stoppedRows = rows.filter((r) => r.stoppedAt === def.step);
    return {
      step: def.step,
      label: def.label,
      rule: def.rule,
      reached,
      stopped: stoppedRows.length,
      pending: stoppedRows.filter((r) => r.stoppedPending).length,
    };
  });
}

// ── Time to value ─────────────────────────────────────────────────────────

export interface TtvStat {
  label: string;
  median: number | null;
  measured: number;
  /** Le famiglie più lente (ore), al massimo 3, e chi non ci è ancora arrivato. */
  slowest: { key: string; label: string; hours: number }[];
  notYet: { key: string; label: string }[];
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function computeTtv(rows: FamilyRow[]): TtvStat[] {
  const registered = rows.filter((r) => r.registeredAt);
  const build = (label: string, pick: (r: FamilyRow) => number | null): TtvStat => {
    const measured = registered.filter((r) => pick(r) !== null);
    return {
      label,
      median: median(measured.map((r) => pick(r)!)),
      measured: measured.length,
      slowest: measured
        .map((r) => ({ key: r.key, label: r.label, hours: pick(r)! }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 3),
      notYet: registered.filter((r) => pick(r) === null).map((r) => ({ key: r.key, label: r.label })),
    };
  };
  return [
    build("Registrazione → prima azione significativa", (r) => r.ttvFirstActionHours),
    build("Registrazione → attivazione", (r) => r.ttvActivationHours),
  ];
}

export function hoursLabel(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return "meno di un'ora";
  if (h < 48) return `${h} ${h === 1 ? "ora" : "ore"}`;
  return `${Math.round(h / 24)} giorni`;
}

// ── Utilizzo per area ─────────────────────────────────────────────────────

export interface UsageRow {
  area: UsageArea | "app";
  label: string;
  families: number;
  actions: number;
  /** Famiglie che l'hanno usata in almeno 2 giorni diversi del periodo. */
  repeatFamilies: number;
  note?: string;
}

export function computeUsage(raw: CockpitRaw, period: { from: string; to: string }, registeredKeys: Set<string>): UsageRow[] {
  const inP = raw.actions.filter((a) => inPeriod(a.at, period) && registeredKeys.has(a.familyKey));
  const rows: UsageRow[] = AREA_ORDER.map((area) => {
    const list = inP.filter((a) => ACTION_DEF[a.kind].area === area);
    const daysBy = new Map<string, Set<string>>();
    for (const a of list) {
      const s = daysBy.get(a.familyKey) ?? new Set<string>();
      s.add(romeDay(a.at));
      daysBy.set(a.familyKey, s);
    }
    return {
      area,
      label: AREA_LABEL[area],
      families: daysBy.size,
      actions: list.length,
      repeatFamilies: Array.from(daysBy.values()).filter((s) => s.size >= 2).length,
    };
  });
  if (raw.openDays) {
    const days = raw.openDays.filter((o) => o.day >= period.from && o.day <= period.to && registeredKeys.has(o.familyKey));
    const by = new Map<string, number>();
    for (const o of days) by.set(o.familyKey, (by.get(o.familyKey) ?? 0) + 1);
    rows.unshift({
      area: "app",
      label: "Home / app aperta",
      families: by.size,
      actions: days.length,
      repeatFamilies: Array.from(by.values()).filter((n) => n >= 2).length,
      note: "Giorni con app aperta, non azioni: dice chi torna a guardare.",
    });
  }
  return rows;
}

// ── Frizioni ──────────────────────────────────────────────────────────────

export type FrictionKey =
  | "no_commitment"
  | "onboarding_incomplete"
  | "no_second_adult"
  | "partner_invite_pending"
  | "push_off"
  | "saved_not_placed"
  | "closure_unorganized"
  | "center_no_reply"
  | "negative_feedback"
  | "abandoned_after_setup";

export interface FrictionRow {
  key: FrictionKey;
  label: string;
  families: string[];
  /** Variazione rispetto all'inizio del periodo (null = dato solo attuale). */
  trend: number | null;
}

export function frictionFamilies(
  rows: FamilyRow[],
  t: CockpitThresholds,
  now: Date,
  negativeFeedbackFamilies: Set<string>
): Record<FrictionKey, string[]> {
  const reg = rows.filter((r) => r.registeredAt);
  const olderThan = (iso: string, days: number) => Date.parse(iso) <= now.getTime() - days * 86_400_000;
  return {
    no_commitment: reg.filter((r) => r.commitments === 0).map((r) => r.key),
    onboarding_incomplete: reg.filter((r) => !r.onboardingDone).map((r) => r.key),
    no_second_adult: reg.filter((r) => !r.secondAdult && r.pendingPartnerInvites.length === 0).map((r) => r.key),
    partner_invite_pending: reg.filter((r) => r.pendingPartnerInvites.some((d) => olderThan(d, t.partnerInvitePendingDays))).map((r) => r.key),
    push_off: reg.filter((r) => !r.pushActive).map((r) => r.key),
    saved_not_placed: reg.filter((r) => r.savedNotPlaced > 0).map((r) => r.key),
    closure_unorganized: reg.filter((r) => r.unorganizedClosure).map((r) => r.key),
    center_no_reply: reg.filter((r) => r.openCenterRequests.some((d) => olderThan(d, t.centerReplyDays))).map((r) => r.key),
    negative_feedback: reg.filter((r) => negativeFeedbackFamilies.has(r.key)).map((r) => r.key),
    abandoned_after_setup: reg.filter((r) => r.status === "dormiente" && r.firstActionAt).map((r) => r.key),
  };
}

export const FRICTION_LABEL: Record<FrictionKey, (n: number, t: CockpitThresholds) => string> = {
  no_commitment: (n) => `${n} ${n === 1 ? "famiglia registrata non ha" : "famiglie registrate non hanno"} ancora nessun impegno`,
  onboarding_incomplete: (n) => `${n} ${n === 1 ? "famiglia non ha" : "famiglie non hanno"} concluso l'onboarding`,
  no_second_adult: (n) => `${n} ${n === 1 ? "famiglia è" : "famiglie sono"} senza un secondo adulto e senza inviti in corso`,
  partner_invite_pending: (n, t) => `${n} ${n === 1 ? "invito" : "inviti"} all'altro genitore senza risposta da almeno ${t.partnerInvitePendingDays} giorni`,
  push_off: (n) => `${n} ${n === 1 ? "famiglia" : "famiglie"} senza notifiche push attive`,
  saved_not_placed: (n) => `${n} ${n === 1 ? "famiglia ha" : "famiglie hanno"} salvato attività senza aggiungerle al Planner né chiederle`,
  closure_unorganized: (n) => `${n} ${n === 1 ? "famiglia ha" : "famiglie hanno"} una chiusura della scuola entro 14 giorni non organizzata`,
  center_no_reply: (n, t) => `${n} ${n === 1 ? "famiglia aspetta" : "famiglie aspettano"} la risposta di un centro da almeno ${t.centerReplyDays} giorni`,
  negative_feedback: (n) => `${n} ${n === 1 ? "famiglia ha" : "famiglie hanno"} segnalato un problema o risposto "poco/per niente" nel periodo`,
  abandoned_after_setup: (n) => `${n} ${n === 1 ? "famiglia si è fermata" : "famiglie si sono fermate"} dopo aver iniziato`,
};

/** Frizioni il cui conteggio si può ricostruire anche a inizio periodo (le altre sono solo "oggi"). */
const TRENDABLE: FrictionKey[] = ["no_commitment", "onboarding_incomplete", "no_second_adult", "abandoned_after_setup"];

export function computeFrictions(
  rowsNow: FamilyRow[],
  rowsAtStart: FamilyRow[],
  t: CockpitThresholds,
  now: Date,
  negativeFeedbackFamilies: Set<string>
): FrictionRow[] {
  const nowF = frictionFamilies(rowsNow, t, now, negativeFeedbackFamilies);
  const startF = frictionFamilies(rowsAtStart, t, now, new Set());
  return (Object.keys(nowF) as FrictionKey[])
    .map((key) => ({
      key,
      label: FRICTION_LABEL[key](nowF[key].length, t),
      families: nowF[key],
      trend: TRENDABLE.includes(key) ? nowF[key].length - startF[key].length : null,
    }))
    .sort((a, b) => b.families.length - a.families.length);
}

// ── Alert operativi ("Richiede attenzione") ───────────────────────────────

export type AlertKey = "not_activated" | "partner_invite" | "center_reply" | "new_feedback" | "dormant" | "at_risk";

export interface AlertRow {
  key: AlertKey;
  text: string;
  count: number;
  families: string[];
}

export function computeAlerts(rows: FamilyRow[], t: CockpitThresholds, now: Date, newFeedback: number): AlertRow[] {
  const reg = rows.filter((r) => r.registeredAt);
  const hoursAgo = (iso: string) => (now.getTime() - Date.parse(iso)) / 3_600_000;
  const daysAgo = (iso: string) => hoursAgo(iso) / 24;
  const notActivated = reg.filter((r) => !r.activatedAt && hoursAgo(r.registeredAt!) >= t.notActivatedAlertHours);
  const partner = reg.filter((r) => r.pendingPartnerInvites.some((d) => daysAgo(d) >= t.partnerInvitePendingDays));
  const center = reg.filter((r) => r.openCenterRequests.some((d) => daysAgo(d) >= t.centerReplyDays));
  const dormant = rows.filter((r) => r.status === "dormiente");
  const atRisk = rows.filter((r) => r.status === "a_rischio");
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const out: AlertRow[] = [
    {
      key: "not_activated",
      count: notActivated.length,
      families: notActivated.map((r) => r.key),
      text: `${notActivated.length} ${plural(notActivated.length, "famiglia registrata ma non attivata", "famiglie registrate ma non attivate")} da ${t.notActivatedAlertHours}h`,
    },
    {
      key: "partner_invite",
      count: partner.length,
      families: partner.map((r) => r.key),
      text: `${partner.length} ${plural(partner.length, "invito", "inviti")} all'altro genitore non ${plural(partner.length, "accettato", "accettati")} da ${t.partnerInvitePendingDays} giorni`,
    },
    {
      key: "center_reply",
      count: center.length,
      families: center.map((r) => r.key),
      text: `${center.length} ${plural(center.length, "famiglia aspetta", "famiglie aspettano")} un centro da ${t.centerReplyDays} giorni`,
    },
    { key: "new_feedback", count: newFeedback, families: [], text: `${newFeedback} ${plural(newFeedback, "feedback nuovo", "feedback nuovi")} da leggere` },
    { key: "at_risk", count: atRisk.length, families: atRisk.map((r) => r.key), text: `${atRisk.length} ${plural(atRisk.length, "famiglia a rischio", "famiglie a rischio")}` },
    { key: "dormant", count: dormant.length, families: dormant.map((r) => r.key), text: `${dormant.length} ${plural(dormant.length, "famiglia dormiente", "famiglie dormienti")}` },
  ];
  return out.filter((a) => a.count > 0);
}

// ── Filtro della tabella ──────────────────────────────────────────────────

export function applyFamilyFilter(
  rows: FamilyRow[],
  filter: FamilyFilter | null,
  ctx: { activeInPeriod: Set<string>; frictions: Record<FrictionKey, string[]>; alerts: AlertRow[]; areaFamilies: Record<string, Set<string>> }
): FamilyRow[] {
  if (!filter) return rows;
  switch (filter.kind) {
    case "status":
      return rows.filter((r) => r.status === filter.status);
    case "registered":
      return rows.filter((r) => r.registeredAt);
    case "activated":
      return rows.filter((r) => r.activatedAt);
    case "active_period":
      return rows.filter((r) => ctx.activeInPeriod.has(r.key));
    case "second_adult":
      return rows.filter((r) => r.secondAdult);
    case "coordination":
      return rows.filter((r) => r.coordinationUsed);
    case "stopped":
      return rows.filter((r) => r.stoppedAt === filter.step);
    case "friction":
      return rows.filter((r) => ctx.frictions[filter.friction]?.includes(r.key));
    case "alert": {
      const a = ctx.alerts.find((x) => x.key === filter.alert);
      return a ? rows.filter((r) => a.families.includes(r.key)) : [];
    }
    case "area":
      return rows.filter((r) => ctx.areaFamilies[filter.area]?.has(r.key));
  }
}

/** Filtro ↔ stringa per l'URL (?filtro=stato:a_rischio). */
export function filterToParam(f: FamilyFilter | null): string {
  if (!f) return "";
  switch (f.kind) {
    case "status":
      return `stato:${f.status}`;
    case "stopped":
      return `fermate:${f.step}`;
    case "friction":
      return `frizione:${f.friction}`;
    case "alert":
      return `alert:${f.alert}`;
    case "area":
      return `area:${f.area}`;
    default:
      return f.kind;
  }
}

export function parseFilterParam(v: string | null | undefined): FamilyFilter | null {
  if (!v) return null;
  const [a, b] = v.split(":");
  if (a === "stato" && b && b in STATUS_DEF) return { kind: "status", status: b as FamilyStatus };
  if (a === "fermate" && FUNNEL_DEF.some((f) => f.step === b)) return { kind: "stopped", step: b as FunnelStep };
  if (a === "frizione" && b && b in FRICTION_LABEL) return { kind: "friction", friction: b as FrictionKey };
  if (a === "alert" && ["not_activated", "partner_invite", "center_reply", "new_feedback", "dormant", "at_risk"].includes(b)) return { kind: "alert", alert: b as AlertKey };
  if (a === "area" && b && (b === "app" || b in AREA_LABEL)) return { kind: "area", area: b as UsageArea | "app" };
  if (["registered", "activated", "active_period", "second_adult", "coordination"].includes(a)) return { kind: a } as FamilyFilter;
  return null;
}

export function areaFamilies(raw: CockpitRaw, period: { from: string; to: string }): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const a of raw.actions) {
    if (!inPeriod(a.at, period)) continue;
    const area = ACTION_DEF[a.kind].area;
    (out[area] ??= new Set()).add(a.familyKey);
  }
  if (raw.openDays) {
    for (const o of raw.openDays) if (o.day >= period.from && o.day <= period.to) (out.app ??= new Set()).add(o.familyKey);
  }
  return out;
}

// ── Timeline della famiglia ───────────────────────────────────────────────

export interface TimelineEntry {
  day: string;
  text: string;
  significant: boolean;
}

/** Una riga per giorno e tipo ("3 impegni inseriti"), più registrazione, onboarding e (a richiesta) giorni con app aperta. */
export function buildTimeline(fam: RawFamily, actions: RawAction[], openDays: RawOpenDay[] | null): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  if (fam.invitedAt) out.push({ day: romeDay(fam.invitedAt), text: "invito", significant: true });
  for (const m of fam.members) {
    out.push({ day: romeDay(m.registeredAt), text: fam.members.length > 1 ? "registrazione di un adulto" : "registrazione", significant: true });
    if (m.onboardingAt && (m.onboarding === "completed" || m.onboarding === "skipped")) {
      out.push({ day: romeDay(m.onboardingAt), text: m.onboarding === "completed" ? "onboarding completato" : "onboarding saltato", significant: true });
    }
  }
  const byDayKind = new Map<string, { day: string; kind: ActionKind; n: number }>();
  for (const a of actions) {
    const day = romeDay(a.at);
    const k = `${day}|${a.kind}`;
    const e = byDayKind.get(k) ?? { day, kind: a.kind, n: 0 };
    e.n += 1;
    byDayKind.set(k, e);
  }
  for (const e of byDayKind.values()) {
    const label = ACTION_DEF[e.kind].label;
    out.push({ day: e.day, text: e.n > 1 ? `${label} (×${e.n})` : label, significant: true });
  }
  if (openDays) {
    const actionDays = new Set(actions.map((a) => romeDay(a.at)));
    for (const o of openDays) if (!actionDays.has(o.day)) out.push({ day: o.day, text: "app aperta, nessuna modifica", significant: false });
  }
  return out.sort((a, b) => (a.day === b.day ? 0 : a.day < b.day ? -1 : 1));
}

// ── Sintesi deterministica ────────────────────────────────────────────────

export interface ExecutiveSummary {
  lines: string[];
  signals: string[];
}

export function buildExecutiveSummary(input: {
  kpis: Kpi[];
  usage: UsageRow[];
  funnel: FunnelRow[];
  frictions: FrictionRow[];
  topDemand: { label: string; families: number } | null;
  periodLabel: string;
  t: CockpitThresholds;
}): ExecutiveSummary {
  const v = (key: string) => input.kpis.find((k) => k.key === key)?.value ?? 0;
  const lines = [
    `${v("invitate")} famiglie invitate`,
    `${v("registrate")} registrate`,
    `${v("attivate")} attivate`,
    `${v("attive_periodo")} attive nel periodo (${input.periodLabel.toLowerCase()})`,
    `${v("coordinamento")} con coordinamento`,
    `${v("a_rischio")} a rischio`,
  ];
  const signals: string[] = [];
  const areas = input.usage.filter((u) => u.area !== "app" && u.families > 0).sort((a, b) => b.families - a.families || b.actions - a.actions);
  if (areas[0]) signals.push(`${areas[0].label} è l'area usata da più famiglie (${areas[0].families}).`);
  const scopri = input.usage.find((u) => u.area === "scopri");
  if (scopri) signals.push(`Scopri: ${scopri.families} ${scopri.families === 1 ? "famiglia" : "famiglie"} con un'aggiunta o un centro suggerito.`);
  const beforeThree =
    (input.funnel.find((f) => f.step === "primo_impegno")?.stopped ?? 0) + (input.funnel.find((f) => f.step === "tre_impegni")?.stopped ?? 0);
  if (beforeThree > 0) signals.push(`${beforeThree} ${beforeThree === 1 ? "famiglia registrata si è fermata" : "famiglie registrate si sono fermate"} prima dei ${input.t.activationMinCommitments} impegni.`);
  if (input.topDemand && input.topDemand.families >= 2) signals.push(`${input.topDemand.families} famiglie citano lo stesso centro o attività (${input.topDemand.label}).`);
  const watch = input.frictions.filter((f) => f.families.length > 0).slice(0, 3).map((f) => f.label + ".");
  return { lines, signals: [...signals, ...watch] };
}

export function kpiValueLabel(k: Kpi): string {
  return k.of !== null ? countOf(k.value, k.of) : `${k.value}`;
}

export function deltaLabel(delta: number | null): string | null {
  if (delta === null || delta === 0) return delta === 0 ? "= periodo precedente" : null;
  return `${delta > 0 ? "+" : ""}${delta} vs periodo precedente`;
}

export function lastActionLabel(r: FamilyRow, todayIso: string): string {
  if (!r.lastActionAt) return "—";
  const d = romeDay(r.lastActionAt);
  const since = diffDays(d, todayIso);
  const when = since === 0 ? "oggi" : since === 1 ? "ieri" : `${since} giorni fa`;
  return `${when} · ${r.lastActionLabel}`;
}


// ── Chiusure della scuola non organizzate ─────────────────────────────────

/**
 * La prima chiusura (ponte, vacanza breve) che inizia entro `horizonDays` da
 * oggi e ha almeno un giorno feriale senza niente per almeno un figlio. Stessa
 * regola dei promemoria serali (lib/nextgen/family-reminders.ts).
 */
export function firstUnorganizedClosure(
  periods: { startDate: string; endDate: string; kidIds: string[]; weekdaysByKid: Record<string, string[]> }[],
  coverage: { kidIds: string[]; dates: string[] }[],
  todayIso: string,
  horizonDays = 14
): { from: string; to: string } | null {
  const limit = addDays(todayIso, horizonDays);
  for (const p of [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    if (p.endDate < todayIso || p.startDate > limit) continue;
    const uncovered = p.kidIds.some((kidId) =>
      (p.weekdaysByKid[kidId] ?? []).some(
        (day) => day >= todayIso && !coverage.some((c) => (c.kidIds.length === 0 || c.kidIds.includes(kidId)) && c.dates.includes(day))
      )
    );
    if (uncovered) return { from: p.startDate, to: p.endDate };
  }
  return null;
}
