// TRAMA — Feature flag: azioni in blocco (13/11/2026).
// Richiesta di Fabrizio: "Seleziona → pubblico → azione → anteprima →
// conferma. [...] Parti da Anteprima interna e Pilot; mantieni 'Tutti' sui
// controlli singoli nel primo rilascio. Non ampliare implicitamente il
// pubblico. [...] Se rimuovere un override fa tornare a un default attivo,
// mostralo: non chiamare l'azione 'Spegni' se il risultato resta attivo."
// Iniziativa: claude/INIZIATIVA_flag_aree_blocco.md (Project).
//
// Logica pura, nessun I/O: calcola l'anteprima e le scritture necessarie.
// Regole riusate, non reinventate:
//   - precedenza e scadenze: le stesse di lib/feature-flags/evaluate.ts
//     (cohort prevale su global; override scaduti ignorati; il test
//     "equivalenza con evaluateFlag" in tests/one/flag-aree-blocco.spec.ts
//     lo verifica sui flag reali);
//   - coorti: INTERNAL_PREVIEW_COHORT_KEY e PILOT_COHORT_KEY di
//     lib/releases/visibility.ts;
//   - permessi: solo flag releaseEligible e con scope "cohort" ammesso,
//     come setFeatureVisibilityAction.
// Un'azione in blocco tocca SOLO la riga cohort del pubblico scelto: mai
// l'altra coorte, mai "global", mai override di altri scope.

import { INTERNAL_PREVIEW_COHORT_KEY, PILOT_COHORT_KEY } from "@/lib/releases/visibility";

export type BulkAudience = "internal_preview" | "pilot";
export type BulkAction = "on" | "off" | "remove";
export type AudienceColumn = "internal_preview" | "pilot" | "global";

export const BULK_AUDIENCES: { key: BulkAudience; label: string }[] = [
  { key: "internal_preview", label: "Anteprima interna" },
  { key: "pilot", label: "Pilot" },
];

export const AUDIENCE_COLUMNS: { key: AudienceColumn; label: string }[] = [
  { key: "internal_preview", label: "Anteprima interna" },
  { key: "pilot", label: "Pilot" },
  { key: "global", label: "Tutti" },
];

export const BULK_ACTIONS: { key: BulkAction; label: string; hint: string }[] = [
  { key: "on", label: "Accendi", hint: "Accende per il pubblico scelto, senza toccare gli altri." },
  { key: "off", label: "Spegni", hint: "Spegne per il pubblico scelto, senza toccare gli altri." },
  {
    key: "remove",
    label: "Togli override (torna al default)",
    hint: "Cancella la regola del pubblico scelto: vale di nuovo quello che c'è sotto (Tutti o il default).",
  },
];

export const AUDIENCE_COHORT_KEY: Record<BulkAudience, string> = {
  internal_preview: INTERNAL_PREVIEW_COHORT_KEY,
  pilot: PILOT_COHORT_KEY,
};

export const AUDIENCE_LABEL: Record<AudienceColumn, string> = {
  internal_preview: "Anteprima interna",
  pilot: "Pilot",
  global: "Tutti",
};

/**
 * Dipendenze note, verificate nel codice (13/11/2026):
 *   - app/nextgen/planner/planner-v2-data.ts è caricato solo con Planner V2
 *     acceso: le funzioni del foglio "Chi accompagna", la vista giorno e
 *     l'avviso sovrapposizioni si vedono solo lì;
 *   - planner-v2-data.ts riga ~99: PASSAGE_PERSON_FIRST si legge solo se
 *     PASSAGE_RESPONSIBILITIES è acceso.
 * Non bloccano l'azione: compaiono come avviso in anteprima.
 */
export const KNOWN_FLAG_DEPENDENCIES: Record<string, string[]> = {
  PASSAGE_RESPONSIBILITIES_ENABLED: ["PLANNER_V2_ENABLED"],
  PASSAGE_PERSON_FIRST_ENABLED: ["PASSAGE_RESPONSIBILITIES_ENABLED", "PLANNER_V2_ENABLED"],
  CHI_ACCOMPAGNA_PLUS_ENABLED: ["PLANNER_V2_ENABLED"],
  PLANNER_DAY_VIEW_ENABLED: ["PLANNER_V2_ENABLED"],
  PLANNER_OVERLAP_WARNING_ENABLED: ["PLANNER_V2_ENABLED"],
};

export interface BulkOverride {
  id: string;
  scopeType: string;
  scopeValue: string | null;
  enabled: boolean;
  expiresAt: string | null;
  updatedAt: string;
}

export interface BulkFlagInput {
  flagName: string;
  label?: string;
  defaultValue: boolean;
  allowedScopes: readonly string[];
  releaseEligible: boolean;
  overrides: BulkOverride[];
}

export type EffectiveSource = "cohort" | "global" | "default";

export interface EffectiveState {
  on: boolean;
  source: EffectiveSource;
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function isExpired(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return true; // come evaluate.ts: data non valida = scaduta
  return t <= now.getTime();
}

function cohortKeyFor(column: AudienceColumn): string | null {
  return column === "global" ? null : AUDIENCE_COHORT_KEY[column];
}

/**
 * Stato effettivo per chi appartiene SOLO a quel pubblico (colonna). Stessa
 * precedenza di evaluate.ts per gli scope che la colonna determina: cohort
 * del pubblico > global > default. Gli altri scope (utente, ruolo, tenant,
 * ambiente, altre coorti) non dipendono dal pubblico: li segnala
 * collectConflicts.
 */
export function effectiveForAudience(
  defaultValue: boolean,
  overrides: BulkOverride[],
  column: AudienceColumn,
  now: Date
): EffectiveState {
  const live = overrides.filter((o) => !isExpired(o.expiresAt, now));
  const key = cohortKeyFor(column);
  if (key) {
    const c = live.find((o) => o.scopeType === "cohort" && norm(o.scopeValue) === key);
    if (c) return { on: c.enabled, source: "cohort" };
  }
  const g = live.find((o) => o.scopeType === "global");
  if (g) return { on: g.enabled, source: "global" };
  return { on: defaultValue, source: "default" };
}

export function effectiveAll(defaultValue: boolean, overrides: BulkOverride[], now: Date): Record<AudienceColumn, EffectiveState> {
  return {
    internal_preview: effectiveForAudience(defaultValue, overrides, "internal_preview", now),
    pilot: effectiveForAudience(defaultValue, overrides, "pilot", now),
    global: effectiveForAudience(defaultValue, overrides, "global", now),
  };
}

export type AudienceSummary = "all_on" | "all_off" | "mixed";

export const AUDIENCE_SUMMARY_LABEL: Record<AudienceSummary, string> = {
  all_on: "tutte attive",
  all_off: "tutte spente",
  mixed: "misto",
};

/** Stato sintetico di un gruppo (area o release) per ciascun pubblico. */
export function summarizeGroup(
  flags: BulkFlagInput[],
  now: Date
): Record<AudienceColumn, { state: AudienceSummary; on: number; total: number }> {
  const out = {} as Record<AudienceColumn, { state: AudienceSummary; on: number; total: number }>;
  for (const col of AUDIENCE_COLUMNS) {
    const on = flags.filter((f) => effectiveForAudience(f.defaultValue, f.overrides, col.key, now).on).length;
    const total = flags.length;
    out[col.key] = { state: total > 0 && on === total ? "all_on" : on === 0 ? "all_off" : "mixed", on, total };
  }
  return out;
}

function findAudienceRow(flag: BulkFlagInput, audience: BulkAudience): BulkOverride | undefined {
  const key = AUDIENCE_COHORT_KEY[audience];
  return flag.overrides.find((o) => o.scopeType === "cohort" && norm(o.scopeValue) === key);
}

export type BulkWriteKind = "insert" | "update" | "delete";

export interface BulkWrite {
  flagName: string;
  kind: BulkWriteKind;
  overrideId: string | null;
  scopeValue: string;
  before: { enabled: boolean; expiresAt: string | null } | null;
  after: { enabled: boolean; expiresAt: string | null } | null;
  /** updated_at letto in anteprima: se in conferma è diverso, l'anteprima è vecchia. */
  expectedUpdatedAt: string | null;
}

export type BulkFlagStatus = "change" | "noop" | "blocked" | "excluded";

export interface BulkFlagPreview {
  flagName: string;
  label: string;
  status: BulkFlagStatus;
  /** Frase breve su cosa succede DAVVERO al pubblico scelto. */
  outcome: string;
  reason?: string;
  before: Record<AudienceColumn, EffectiveState>;
  after: Record<AudienceColumn, EffectiveState>;
  write: BulkWrite | null;
  expiries: string[];
  conflicts: string[];
  dependencies: string[];
}

export interface BulkPreview {
  audience: BulkAudience;
  action: BulkAction;
  flags: BulkFlagPreview[];
  writes: BulkWrite[];
  counts: Record<BulkFlagStatus, number>;
  fingerprint: string;
  computedAt: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
}

function stateWord(s: EffectiveState): string {
  const base = s.on ? "attiva" : "spenta";
  if (s.source === "default") return `${base} (default)`;
  if (s.source === "global") return `${base} (da Tutti)`;
  return base;
}

function scopeLabel(o: BulkOverride): string {
  if (o.scopeType === "cohort") {
    const v = norm(o.scopeValue);
    if (v === INTERNAL_PREVIEW_COHORT_KEY) return "Anteprima interna";
    if (v === PILOT_COHORT_KEY) return "Pilot";
    return `coorte ${o.scopeValue}`;
  }
  if (o.scopeType === "global") return "Tutti";
  if (o.scopeType === "user") return "utente singolo";
  return `${o.scopeType}:${o.scopeValue ?? ""}`;
}

/** Override di scope che il pubblico non determina: valgono comunque per qualcuno. */
export function collectConflicts(flag: BulkFlagInput, now: Date): string[] {
  const out: string[] = [];
  for (const o of flag.overrides) {
    if (isExpired(o.expiresAt, now)) continue;
    const isMatrix =
      o.scopeType === "global" ||
      (o.scopeType === "cohort" && [INTERNAL_PREVIEW_COHORT_KEY, PILOT_COHORT_KEY].includes(norm(o.scopeValue)));
    if (isMatrix) continue;
    const prevails = o.scopeType === "user" || o.scopeType === "role";
    out.push(
      `Override ${scopeLabel(o)} ${o.enabled ? "acceso" : "spento"}: ${
        prevails ? "prevale sul pubblico per chi ne fa parte" : "vale per chi ne fa parte"
      } e non viene toccato.`
    );
  }
  const eff = effectiveAll(flag.defaultValue, flag.overrides, now);
  for (const col of ["internal_preview", "pilot"] as const) {
    if (eff.global.on && !eff[col].on) {
      out.push(`${AUDIENCE_LABEL[col]} è spenta mentre Tutti è acceso: chi è in ${AUDIENCE_LABEL[col]} non la vede.`);
    }
  }
  return out;
}

/** Scadenze rilevanti per il pubblico dopo l'operazione, con lo stato che ne segue. */
function describeExpiries(defaultValue: boolean, overrides: BulkOverride[], audience: BulkAudience, now: Date): string[] {
  const out: string[] = [];
  const key = AUDIENCE_COHORT_KEY[audience];
  const relevant = overrides.filter(
    (o) =>
      o.expiresAt &&
      !isExpired(o.expiresAt, now) &&
      (o.scopeType === "global" || (o.scopeType === "cohort" && norm(o.scopeValue) === key))
  );
  for (const o of relevant.sort((a, b) => Date.parse(a.expiresAt!) - Date.parse(b.expiresAt!))) {
    const after = new Date(Date.parse(o.expiresAt!) + 1000);
    const state = effectiveForAudience(defaultValue, overrides, audience, after);
    out.push(`La regola ${scopeLabel(o)} scade il ${fmtDate(o.expiresAt!)}: da allora per ${AUDIENCE_LABEL[audience]} sarà ${stateWord(state)}.`);
  }
  return out;
}

function applyWrite(overrides: BulkOverride[], write: BulkWrite | null, nowIso: string): BulkOverride[] {
  if (!write) return overrides;
  if (write.kind === "delete") return overrides.filter((o) => o.id !== write.overrideId);
  if (write.kind === "update") {
    return overrides.map((o) =>
      o.id === write.overrideId ? { ...o, enabled: write.after!.enabled, expiresAt: write.after!.expiresAt, updatedAt: nowIso } : o
    );
  }
  return [
    ...overrides,
    { id: `nuovo:${write.flagName}:${write.scopeValue}`, scopeType: "cohort", scopeValue: write.scopeValue, enabled: write.after!.enabled, expiresAt: write.after!.expiresAt, updatedAt: nowIso },
  ];
}

/** Impronta delle righe dei flag selezionati: se cambia fra anteprima e conferma, l'anteprima va rifatta. */
export function bulkFingerprint(flags: BulkFlagInput[]): string {
  const parts: string[] = [];
  for (const f of [...flags].sort((a, b) => a.flagName.localeCompare(b.flagName))) {
    const rows = [...f.overrides]
      .map((o) => `${o.id}|${o.scopeType}|${norm(o.scopeValue)}|${o.enabled ? 1 : 0}|${o.expiresAt ?? ""}|${o.updatedAt}`)
      .sort();
    parts.push(`${f.flagName}:${rows.join(";")}`);
  }
  const s = parts.join("\n");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `${flags.length}-${s.length}-${h.toString(16)}`;
}

/**
 * Anteprima dell'azione in blocco. Non scrive nulla. Ogni flag selezionato
 * compare con un esito: change (verrà scritto), noop (già così), blocked
 * (l'azione non ha senso senza toccare altri pubblici) o excluded (non
 * gestibile dalle release).
 */
export function computeBulkPreview(
  flags: BulkFlagInput[],
  audience: BulkAudience,
  action: BulkAction,
  now: Date = new Date()
): BulkPreview {
  const nowIso = now.toISOString();
  const key = AUDIENCE_COHORT_KEY[audience];
  const aud = AUDIENCE_LABEL[audience];
  const selectedOn = new Map<string, boolean>();
  const previews: BulkFlagPreview[] = [];

  for (const flag of flags) {
    const label = flag.label ?? flag.flagName;
    const before = effectiveAll(flag.defaultValue, flag.overrides, now);
    const conflicts = collectConflicts(flag, now);
    const base = { flagName: flag.flagName, label, before, conflicts, dependencies: [] as string[] };

    if (!flag.releaseEligible) {
      previews.push({ ...base, status: "excluded", outcome: "Esclusa", reason: "Non è collegata a una funzione pronta per le release: si gestisce solo dagli override qui sotto.", after: before, write: null, expiries: [] });
      continue;
    }
    if (!flag.allowedScopes.includes("cohort")) {
      previews.push({ ...base, status: "excluded", outcome: "Esclusa", reason: "Il flag non ammette regole per coorte.", after: before, write: null, expiries: [] });
      continue;
    }

    const row = findAudienceRow(flag, audience);
    const rowExpired = row ? isExpired(row.expiresAt, now) : false;
    const beforeAud = before[audience];
    let write: BulkWrite | null = null;
    let blocked: string | null = null;

    if (action === "on" || action === "off") {
      const want = action === "on";
      if (action === "off" && before.global.on) {
        blocked = `È accesa per Tutti: spegnerla solo per ${aud} creerebbe un'eccezione. Prima togli "Tutti" dal controllo singolo.`;
      } else if (row) {
        const alreadyLive = row.enabled === want && !rowExpired;
        if (!alreadyLive) {
          write = {
            flagName: flag.flagName,
            kind: "update",
            overrideId: row.id,
            scopeValue: key,
            before: { enabled: row.enabled, expiresAt: row.expiresAt },
            // Una regola scaduta viene riattivata senza scadenza; una scadenza
            // futura resta com'è (compare fra le scadenze).
            after: { enabled: want, expiresAt: rowExpired ? null : row.expiresAt },
            expectedUpdatedAt: row.updatedAt,
          };
        }
      } else if (beforeAud.on !== want) {
        write = { flagName: flag.flagName, kind: "insert", overrideId: null, scopeValue: key, before: null, after: { enabled: want, expiresAt: null }, expectedUpdatedAt: null };
      }
    } else if (row) {
      write = {
        flagName: flag.flagName,
        kind: "delete",
        overrideId: row.id,
        scopeValue: key,
        before: { enabled: row.enabled, expiresAt: row.expiresAt },
        after: null,
        expectedUpdatedAt: row.updatedAt,
      };
    }

    const afterOverrides = applyWrite(flag.overrides, write, nowIso);
    const after = effectiveAll(flag.defaultValue, afterOverrides, now);
    selectedOn.set(flag.flagName, after[audience].on);
    const expiries = describeExpiries(flag.defaultValue, afterOverrides, audience, now);
    if (rowExpired && row) {
      expiries.unshift(
        write?.kind === "update"
          ? `La regola ${aud} era scaduta il ${fmtDate(row.expiresAt!)}: viene riattivata senza scadenza.`
          : write?.kind === "delete"
          ? `La regola ${aud} era già scaduta il ${fmtDate(row.expiresAt!)}: viene cancellata.`
          : `La regola ${aud} è scaduta il ${fmtDate(row.expiresAt!)}.`
      );
    }

    let status: BulkFlagStatus;
    let outcome: string;
    if (blocked) {
      status = "blocked";
      outcome = "Bloccata";
    } else if (!write) {
      status = "noop";
      outcome = action === "remove" ? `Nessuna regola ${aud} da togliere: resta ${stateWord(beforeAud)}` : `Già ${stateWord(beforeAud)} per ${aud}`;
    } else {
      status = "change";
      const a = after[audience];
      if (action === "remove") {
        outcome = a.on
          ? `Torna al default: resta attiva per ${aud} (${a.source === "global" ? "da Tutti" : "default attivo"})`
          : `Torna al default: si spegne per ${aud}`;
      } else {
        outcome = a.on ? `Si accende per ${aud}` : `Si spegne per ${aud}`;
      }
    }

    previews.push({ ...base, status, outcome, reason: blocked ?? undefined, after, write, expiries });
  }

  // Dipendenze: valutate dopo, così tengono conto degli altri flag selezionati.
  const byName = new Map(flags.map((f) => [f.flagName, f]));
  for (const p of previews) {
    if (p.status === "excluded") continue;
    const deps = KNOWN_FLAG_DEPENDENCIES[p.flagName] ?? [];
    if (p.after[audience].on) {
      for (const d of deps) {
        const depOn = selectedOn.has(d) ? selectedOn.get(d)! : byName.has(d) ? effectiveForAudience(byName.get(d)!.defaultValue, byName.get(d)!.overrides, audience, now).on : null;
        if (depOn === false) p.dependencies.push(`Per ${aud} si vede solo con ${d} acceso, che resta spento.`);
        if (depOn === null) p.dependencies.push(`Per ${aud} si vede solo con ${d} acceso (non selezionato: controllalo).`);
      }
    }
    if (!p.after[audience].on) {
      for (const other of previews) {
        if ((KNOWN_FLAG_DEPENDENCIES[other.flagName] ?? []).includes(p.flagName) && other.after[audience].on) {
          p.dependencies.push(`${other.flagName} resta accesa per ${aud} ma senza questo flag non si vede.`);
        }
      }
    }
    // Nessun ampliamento implicito: lo diciamo quando l'altra coorte resta diversa.
    const other: BulkAudience = audience === "pilot" ? "internal_preview" : "pilot";
    if (p.status === "change" && p.after[audience].on && !p.after[other].on) {
      p.dependencies.push(`${AUDIENCE_LABEL[other]} resta spenta: non viene accesa in automatico.`);
    }
  }

  const counts: Record<BulkFlagStatus, number> = { change: 0, noop: 0, blocked: 0, excluded: 0 };
  for (const p of previews) counts[p.status]++;

  return {
    audience,
    action,
    flags: previews,
    writes: previews.flatMap((p) => (p.write ? [p.write] : [])),
    counts,
    fingerprint: bulkFingerprint(flags),
    computedAt: nowIso,
  };
}

export function isBulkAudience(v: unknown): v is BulkAudience {
  return v === "internal_preview" || v === "pilot";
}

export function isBulkAction(v: unknown): v is BulkAction {
  return v === "on" || v === "off" || v === "remove";
}

/** Esito di una singola scrittura al momento della conferma. */
export interface BulkWriteOutcome {
  flagName: string;
  ok: boolean;
  rolledBack?: boolean;
  error?: string;
}

/**
 * Scrittura inversa, per riportare una riga com'era prima (rientro
 * automatico se una scrittura successiva fallisce).
 */
export function inverseWrite(w: BulkWrite): BulkWrite {
  if (w.kind === "insert") return { ...w, kind: "delete", before: w.after, after: null };
  if (w.kind === "delete") return { ...w, kind: "insert", before: null, after: w.before };
  return { ...w, before: w.after, after: w.before };
}

/** Testo per il recupero manuale, se anche il rientro automatico fallisce. */
export function recoveryHint(w: BulkWrite): string {
  const aud = w.scopeValue === PILOT_COHORT_KEY ? "Pilot" : "Anteprima interna";
  if (!w.before) return `${w.flagName}: cancella la regola ${aud} dalla scheda override del flag.`;
  return `${w.flagName}: riporta la regola ${aud} a ${w.before.enabled ? "accesa" : "spenta"}${
    w.before.expiresAt ? ` con scadenza ${fmtDate(w.before.expiresAt)}` : " senza scadenza"
  } dalla scheda override del flag.`;
}
