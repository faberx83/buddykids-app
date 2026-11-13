// TRAMA — Feature flag: vista Per area e azioni in blocco (13/11/2026).
// Iniziativa: claude/INIZIATIVA_flag_aree_blocco.md. Richiesta di Fabrizio:
// "Usa 'Accompagnamento' come prova: seleziona tre flag con stati misti,
// applica solo al Pilot e verifica che Anteprima interna, Tutti e gli
// override estranei restino invariati. Prova anche una scadenza, un
// conflitto tra override e il ritorno al default dopo la rimozione.
// Verifica che la vista Per release e i controlli singoli continuino a
// funzionare."
import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { FEATURE_FLAG_REGISTRY } from "../../lib/feature-flags/registry";
import { evaluateFlag } from "../../lib/feature-flags/evaluate";
import { INTERNAL_PREVIEW_COHORT_KEY, PILOT_COHORT_KEY } from "../../lib/releases/visibility";
import { FLAG_AREAS, areaOfFlag, groupByArea, groupByRelease, matchesFlagSearch } from "../../lib/flag-admin/areas";
import {
  bulkFingerprint,
  computeBulkPreview,
  effectiveForAudience,
  inverseWrite,
  isBulkAudience,
  summarizeGroup,
  type BulkFlagInput,
  type BulkOverride,
  type BulkWrite,
} from "../../lib/flag-admin/bulk";
import { toBulkInputs } from "../../lib/flag-admin/inputs";
import { getReleaseCatalog } from "../../lib/releases/catalog";
import { getFeatureCatalog } from "../../lib/feature-registry/catalog";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const NOW = new Date("2026-11-13T10:00:00Z");
const T0 = "2026-11-01T09:00:00.000Z";

let seq = 0;
function ov(scopeType: string, scopeValue: string | null, enabled: boolean, expiresAt: string | null = null): BulkOverride {
  seq++;
  return { id: `row-${seq}`, scopeType, scopeValue, enabled, expiresAt, updatedAt: T0 };
}
const ip = (on: boolean, exp: string | null = null) => ov("cohort", INTERNAL_PREVIEW_COHORT_KEY, on, exp);
const pilot = (on: boolean, exp: string | null = null) => ov("cohort", PILOT_COHORT_KEY, on, exp);
const global = (on: boolean, exp: string | null = null) => ov("global", null, on, exp);

function flag(flagName: string, overrides: BulkOverride[], extra: Partial<BulkFlagInput> = {}): BulkFlagInput {
  return { flagName, defaultValue: false, allowedScopes: ["global", "environment", "user", "role", "tenant", "cohort"], releaseEligible: true, overrides, ...extra };
}

/** Applica le scritture a una copia in memoria, come farebbe il database. */
function applyInMemory(flags: BulkFlagInput[], writes: BulkWrite[]): Map<string, BulkOverride[]> {
  const db = new Map(flags.map((f) => [f.flagName, f.overrides.map((o) => ({ ...o }))]));
  for (const w of writes) {
    const rows = db.get(w.flagName)!;
    if (w.kind === "insert") rows.push({ id: `ins-${w.flagName}`, scopeType: "cohort", scopeValue: w.scopeValue, enabled: w.after!.enabled, expiresAt: w.after!.expiresAt, updatedAt: "x" });
    else if (w.kind === "update") {
      const r = rows.find((o) => o.id === w.overrideId)!;
      r.enabled = w.after!.enabled;
      r.expiresAt = w.after!.expiresAt;
    } else db.set(w.flagName, rows.filter((o) => o.id !== w.overrideId));
  }
  return db;
}

test.describe("FA — aree", () => {
  test("FA-01 ogni flag del registro finisce in una sola area, nessuno sparisce", () => {
    const names = Object.keys(FEATURE_FLAG_REGISTRY);
    const groups = groupByArea(names.map((flagName) => ({ flagName })));
    const placed = groups.flatMap((g) => g.items.map((i) => i.flagName));
    expect(placed.sort()).toEqual([...names].sort());
    expect(new Set(placed).size).toBe(names.length);
    // Oggi tutti i flag sono classificati.
    expect(groups.find((g) => g.key === "da_classificare")).toBeUndefined();
  });

  test("FA-02 la mappa non contiene nomi inesistenti né doppioni e ha le 5 aree richieste", () => {
    expect(FLAG_AREAS.map((a) => a.label)).toEqual([
      "Planner e accompagnamento",
      "Famiglie e onboarding",
      "Scopri e Radar",
      "Centri e messaggi",
      "Piattaforma",
    ]);
    const all = FLAG_AREAS.flatMap((a) => a.flags);
    expect(new Set(all).size).toBe(all.length);
    for (const n of all) expect(Object.keys(FEATURE_FLAG_REGISTRY)).toContain(n);
  });

  test("FA-03 un flag nuovo non mappato va in 'Da classificare'", () => {
    const groups = groupByArea([{ flagName: "PLANNER_V2_ENABLED" }, { flagName: "NUOVO_FLAG_ENABLED" }]);
    expect(areaOfFlag("NUOVO_FLAG_ENABLED")).toBe("da_classificare");
    expect(groups.map((g) => g.key)).toEqual(["planner", "da_classificare"]);
  });

  test("FA-04 vista per release: flag in più release compare in ognuna, chi non ha release va in 'Senza release'", () => {
    const items = [{ flagName: "A" }, { flagName: "B" }, { flagName: "C" }];
    const groups = groupByRelease(items, [
      { id: "r1", label: "R1", flagNames: ["A", "B"] },
      { id: "r2", label: "R2", flagNames: ["B"] },
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.flagName)])).toEqual([
      ["R1", ["A", "B"]],
      ["R2", ["B"]],
      ["Senza release", ["C"]],
    ]);
    // Con le release reali, nessun flag del registro sparisce.
    const real = getReleaseCatalog().map((r) => ({
      id: r.id,
      label: r.label,
      flagNames: r.featureKeys.map((k) => getFeatureCatalog().find((e) => e.key === k)?.flagName).filter((n): n is string => Boolean(n)),
    }));
    const names = Object.keys(FEATURE_FLAG_REGISTRY);
    const placed = new Set(groupByRelease(names.map((flagName) => ({ flagName })), real).flatMap((g) => g.items.map((i) => i.flagName)));
    expect(placed.size).toBe(names.length);
  });

  test("FA-05 ricerca e stato sintetico per pubblico (tutte attive / tutte spente / misto)", () => {
    expect(matchesFlagSearch({ flagName: "PLANNER_V2_ENABLED", label: "Planner V2" }, "planner")).toBe(true);
    expect(matchesFlagSearch({ flagName: "X", description: "Chi accompagna" }, "ACCOMPAGNA")).toBe(true);
    expect(matchesFlagSearch({ flagName: "X" }, "radar")).toBe(false);
    const s = summarizeGroup([flag("A", [ip(true), pilot(true)]), flag("B", [ip(true)])], NOW);
    expect(s.internal_preview).toEqual({ state: "all_on", on: 2, total: 2 });
    expect(s.pilot).toEqual({ state: "mixed", on: 1, total: 2 });
    expect(s.global).toEqual({ state: "all_off", on: 0, total: 2 });
  });
});

test.describe("FB — azioni in blocco", () => {
  test("FB-01 Accompagnamento: tre flag misti, solo Pilot; Anteprima interna, Tutti e override estranei invariati", () => {
    const unrelatedRole = ov("role", "platform_admin", true);
    const unrelatedUser = ov("user", "00000000-0000-0000-0000-000000000001", false);
    const flags = [
      flag("PASSAGE_RESPONSIBILITIES_ENABLED", [ip(true), pilot(true)]), // già acceso al Pilot
      flag("PASSAGE_PERSON_FIRST_ENABLED", [ip(true)]), // Pilot assente
      flag("CHI_ACCOMPAGNA_PLUS_ENABLED", [pilot(false), unrelatedRole, unrelatedUser]), // Pilot spento, Anteprima assente
      flag("PLANNER_V2_ENABLED", [ip(true), pilot(true), global(false)]), // estraneo, non selezionato
    ];
    const selected = flags.slice(0, 3);
    const p = computeBulkPreview(selected, "pilot", "on", NOW);

    expect(p.counts).toEqual({ change: 2, noop: 1, blocked: 0, excluded: 0 });
    expect(p.flags.map((f) => f.status)).toEqual(["noop", "change", "change"]);
    // Solo righe della coorte Pilot.
    expect(p.writes.every((w) => w.scopeValue === PILOT_COHORT_KEY)).toBe(true);
    expect(p.writes.map((w) => [w.flagName, w.kind])).toEqual([
      ["PASSAGE_PERSON_FIRST_ENABLED", "insert"],
      ["CHI_ACCOMPAGNA_PLUS_ENABLED", "update"],
    ]);
    for (const f of p.flags) {
      expect(f.after.pilot.on).toBe(true);
      expect(f.after.internal_preview).toEqual(f.before.internal_preview);
      expect(f.after.global).toEqual(f.before.global);
    }
    // Chi accompagna veloce: Anteprima resta spenta, detto esplicitamente.
    const plus = p.flags.find((f) => f.flagName === "CHI_ACCOMPAGNA_PLUS_ENABLED")!;
    expect(plus.after.internal_preview.on).toBe(false);
    expect(plus.dependencies.join(" ")).toContain("Anteprima interna resta spenta");
    // Override estranei (ruolo/utente) segnalati e non toccati.
    expect(plus.conflicts.some((c) => c.includes("role:platform_admin") && c.includes("non viene toccato"))).toBe(true);

    const db = applyInMemory(selected, p.writes);
    for (const f of selected) {
      const after = db.get(f.flagName)!;
      for (const o of f.overrides) {
        const isPilotRow = o.scopeType === "cohort" && o.scopeValue === PILOT_COHORT_KEY;
        if (!isPilotRow) expect(after.find((x) => x.id === o.id)).toEqual(o);
      }
      expect(effectiveForAudience(false, after, "internal_preview", NOW)).toEqual(effectiveForAudience(false, f.overrides, "internal_preview", NOW));
      expect(effectiveForAudience(false, after, "global", NOW)).toEqual(effectiveForAudience(false, f.overrides, "global", NOW));
      expect(effectiveForAudience(false, after, "pilot", NOW).on).toBe(true);
    }
    // Il flag non selezionato non compare nelle scritture.
    expect(p.writes.some((w) => w.flagName === "PLANNER_V2_ENABLED")).toBe(false);
  });

  test("FB-02 scadenza: una regola Pilot scaduta viene riattivata senza scadenza; una futura resta e viene mostrata", () => {
    const expired = pilot(true, "2026-09-30T22:00:00Z");
    const p = computeBulkPreview([flag("CALENDAR_EXPORT_ENABLED", [ip(true), expired])], "pilot", "on", NOW);
    expect(p.flags[0].before.pilot.on).toBe(false); // scaduta = ignorata, come evaluate.ts
    expect(p.writes[0]).toMatchObject({ kind: "update", overrideId: expired.id, after: { enabled: true, expiresAt: null } });
    expect(p.flags[0].expiries[0]).toContain("era scaduta");

    const future = pilot(true, "2027-09-30T22:00:00Z");
    const q = computeBulkPreview([flag("CALENDAR_EXPORT_ENABLED", [future])], "pilot", "on", NOW);
    expect(q.flags[0].status).toBe("noop");
    expect(q.flags[0].expiries[0]).toMatch(/scade il .*2027.*spenta \(default\)/);

    // Spegnere una regola con scadenza futura mantiene la scadenza.
    const r = computeBulkPreview([flag("CALENDAR_EXPORT_ENABLED", [future])], "pilot", "off", NOW);
    expect(r.writes[0]).toMatchObject({ kind: "update", after: { enabled: false, expiresAt: future.expiresAt } });
  });

  test("FB-03 conflitti: Tutti acceso blocca lo spegnimento per coorte; Pilot spento sotto Tutti acceso è segnalato", () => {
    const p = computeBulkPreview([flag("PARTNER_V2_ENABLED", [ip(true), pilot(true), global(true)])], "pilot", "off", NOW);
    expect(p.flags[0].status).toBe("blocked");
    expect(p.flags[0].reason).toContain('togli "Tutti" dal controllo singolo');
    expect(p.writes).toHaveLength(0);

    const q = computeBulkPreview([flag("PARTNER_V2_ENABLED", [pilot(false), global(true)])], "pilot", "on", NOW);
    expect(q.flags[0].conflicts.join(" ")).toContain("Pilot è spenta mentre Tutti è acceso");
    expect(q.writes[0]).toMatchObject({ kind: "update", after: { enabled: true } });

    const role = ov("role", "platform_admin", true);
    const r = computeBulkPreview([flag("TRAMA_ONE_ENABLED", [pilot(true), role])], "pilot", "off", NOW);
    expect(r.flags[0].conflicts.some((c) => c.includes("prevale sul pubblico"))).toBe(true);
  });

  test("FB-04 ritorno al default: togliere l'override con default attivo non si chiama 'Spegni'", () => {
    const off = pilot(false);
    const p = computeBulkPreview([flag("SINTETICO", [off], { defaultValue: true })], "pilot", "remove", NOW);
    expect(p.writes[0]).toMatchObject({ kind: "delete", overrideId: off.id });
    expect(p.flags[0].after.pilot).toEqual({ on: true, source: "default" });
    expect(p.flags[0].outcome).toContain("resta attiva");
    expect(p.flags[0].outcome).not.toMatch(/spegn/i);

    const q = computeBulkPreview([flag("SINTETICO", [pilot(true)])], "pilot", "remove", NOW);
    expect(q.flags[0].outcome).toBe("Torna al default: si spegne per Pilot");

    const viaGlobal = computeBulkPreview([flag("SINTETICO", [pilot(false), global(true)])], "pilot", "remove", NOW);
    expect(viaGlobal.flags[0].outcome).toContain("resta attiva per Pilot (da Tutti)");

    const none = computeBulkPreview([flag("SINTETICO", [ip(true)])], "pilot", "remove", NOW);
    expect(none.flags[0].status).toBe("noop");
  });

  test("FB-05 esclusi e permessi: flag fuori dalle release e senza scope cohort non vengono scritti", () => {
    const entries = [
      { flagName: "BUILD_INFO_BUBBLE_ENABLED", defaultValue: false, allowedScopes: ["global", "cohort"], overrides: [] },
      { flagName: "PLANNER_V2_ENABLED", defaultValue: false, allowedScopes: ["global", "cohort"], overrides: [] },
    ];
    const inputs = toBulkInputs(entries);
    expect(inputs.find((i) => i.flagName === "BUILD_INFO_BUBBLE_ENABLED")!.releaseEligible).toBe(false);
    const p = computeBulkPreview(inputs, "internal_preview", "on", NOW);
    expect(p.flags.map((f) => f.status)).toEqual(["excluded", "change"]);
    const noCohort = computeBulkPreview([flag("X", [], { allowedScopes: ["global"] })], "pilot", "on", NOW);
    expect(noCohort.flags[0].status).toBe("excluded");
    // "Tutti" non è un pubblico ammesso in blocco.
    expect(isBulkAudience("global")).toBe(false);
    expect(isBulkAudience("pilot")).toBe(true);
  });

  test("FB-06 dipendenze note: Persona prima senza Chi accompagna per passaggio viene segnalata", () => {
    const p = computeBulkPreview(
      [flag("PASSAGE_PERSON_FIRST_ENABLED", []), flag("PLANNER_V2_ENABLED", [pilot(true)]), flag("PASSAGE_RESPONSIBILITIES_ENABLED", [])],
      "pilot",
      "on",
      NOW
    );
    // Tutti e tre accesi insieme: nessun avviso di dipendenza spenta.
    expect(p.flags[0].dependencies.filter((d) => d.includes("resta spento"))).toHaveLength(0);
    const q = computeBulkPreview([flag("PASSAGE_PERSON_FIRST_ENABLED", [])], "pilot", "on", NOW);
    expect(q.flags[0].dependencies.join(" ")).toContain("PASSAGE_RESPONSIBILITIES_ENABLED");
  });

  test("FB-07 anteprima vecchia: l'impronta cambia se una riga cambia fra anteprima e conferma", () => {
    const row = pilot(true);
    const a = bulkFingerprint([flag("A", [row])]);
    expect(bulkFingerprint([flag("A", [{ ...row }])])).toBe(a);
    expect(bulkFingerprint([flag("A", [{ ...row, updatedAt: "2026-11-13T10:00:01Z" }])])).not.toBe(a);
    expect(bulkFingerprint([flag("A", [row, ip(true)])])).not.toBe(a);
  });

  test("FB-08 rientro: la scrittura inversa riporta le righe com'erano", () => {
    const flags = [flag("A", [pilot(false, "2027-01-01T00:00:00Z")]), flag("B", []), flag("C", [pilot(true)])];
    const writes = [
      ...computeBulkPreview([flags[0]], "pilot", "on", NOW).writes,
      ...computeBulkPreview([flags[1]], "pilot", "on", NOW).writes,
      ...computeBulkPreview([flags[2]], "pilot", "remove", NOW).writes,
    ];
    expect(writes.map((w) => w.kind)).toEqual(["update", "insert", "delete"]);
    const applied = applyInMemory(flags, writes);
    const asFlags = flags.map((f) => ({ ...f, overrides: applied.get(f.flagName)! }));
    const inverses = writes.map((w) => inverseWrite(w.kind === "insert" ? { ...w, overrideId: `ins-${w.flagName}` } : w)).reverse();
    const back = applyInMemory(asFlags, inverses);
    for (const f of flags) {
      const norm = (rows: BulkOverride[]) => rows.map((o) => [o.scopeType, o.scopeValue, o.enabled, o.expiresAt]).sort();
      expect(norm(back.get(f.flagName)!)).toEqual(norm(f.overrides));
    }
  });

  test("FB-09 stessa precedenza di evaluateFlag sui flag reali", () => {
    const combos: BulkOverride[][] = [
      [],
      [global(true)],
      [global(true), pilot(false)],
      [ip(true), pilot(false), global(false)],
      [pilot(true, "2026-01-01T00:00:00Z"), global(true)],
      [ip(false), global(true, "2026-01-01T00:00:00Z")],
    ];
    for (const rows of combos) {
      const inputs = rows.map((o) => ({ scopeType: o.scopeType as "cohort" | "global", scopeValue: o.scopeValue, enabled: o.enabled, expiresAt: o.expiresAt }));
      for (const [col, keys] of [["internal_preview", [INTERNAL_PREVIEW_COHORT_KEY]], ["pilot", [PILOT_COHORT_KEY]], ["global", []]] as const) {
        expect(effectiveForAudience(false, rows, col, NOW).on).toBe(evaluateFlag("PLANNER_V2_ENABLED", { cohortKeys: [...keys] }, inputs, NOW));
      }
    }
  });
});

test.describe("FC — pagina e controlli esistenti", () => {
  test("FC-01 la pagina conserva matrice, card Release e schede override; la nuova sezione si aggiunge", () => {
    const client = read("app/admin/feature-flags/FeatureFlagsAdminClient.tsx");
    expect(client).toContain("<ReleaseAdminSection initialReleases={initialReleases} />");
    expect(client).toContain("<FlagBulkSection entries={entries} releases={initialReleases} history={initialHistory} />");
    expect(client.indexOf("<ReleaseAdminSection")).toBeLessThan(client.indexOf("<FlagBulkSection"));
    expect(client).toContain("data-testid={`flag-card-${entry.flagName}`}");
    expect(client).toContain("id={`flag-${entry.flagName}`}");
    expect(client).toContain("updateFeatureFlagOverrideAction");
    const matrix = read("app/admin/feature-flags/ReleaseMatrix.tsx");
    expect(matrix).toContain("setFeatureVisibilityAction");
    expect(matrix).toContain("GLOBAL");
    const section = read("app/admin/feature-flags/FlagBulkSection.tsx");
    expect(section).toContain('"Per area"');
    expect(section).toContain('"Per release"');
    expect(section).toContain("href={`#flag-${f.flagName}`}");
    expect(section).not.toContain("setFeatureVisibilityAction");
    expect(section).toContain("flag-bulk-stale");
  });

  test("FC-02 l'azione rilegge, confronta l'impronta, scrive solo con updated_at atteso e registra nello storico", () => {
    const src = read("app/actions/flag-bulk.ts");
    expect(src.startsWith('"use server"')).toBe(true);
    expect(src).toContain("adminSession()");
    expect(src).toContain("fresh.fingerprint !== previewFingerprint");
    expect(src).toContain("return { stale: true, preview: fresh }");
    expect(src).toContain('q.eq("updated_at", w.expectedUpdatedAt)');
    expect(src).toContain("inverseWrite(");
    expect(src).toContain('from("activity_log")');
    expect(src).toContain("center_id: null");
    expect(src).toContain('entity_type: "feature_flag_bulk"');
    // I KPI Gestori ignorano le righe senza centro.
    expect(read("lib/data/gestori-activity.ts")).toContain("if (!row.center_id) continue;");
  });

  test("FC-03 i controlli singoli non cambiano: setFeatureVisibilityAction e la sua conferma GLOBAL restano", () => {
    const rel = read("app/actions/releases.ts");
    expect(rel).toContain("export async function setFeatureVisibilityAction(");
    expect(rel).toContain('if (target === "global") {');
    expect(rel).toContain("validateGlobalConfirmation(confirmText");
  });
});
