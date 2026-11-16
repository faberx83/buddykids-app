// TRAMA — LOTTO P0 BETA READINESS (16/11/2026). Richiesta di Fabrizio:
// "Rendi uniforme l'etichetta DEMO per i contenuti dimostrativi… Non esporre
// attività demo come offerte reali." Triage: claude/TRIAGE_brief_catalogo_feedback_1611.md.
//
// Una regola sola, la stessa delle code Admin (lib/admin-ops/demo.ts, REUSE):
// un centro o un'attività sono di prova se il centro è segnato
// is_test_fixture oppure se il nome lo dice ("· centro di prova", "(prova)",
// "Centro Demo", "UX DEMO …", "[TEST] …"). I centri is_test_fixture sono già
// nascosti alle famiglie (migration 47): qui arrivano solo quelli visibili per
// le prove guidate, che finora comparivano con il badge "Partner TRAMA".
// Pura, senza I/O (test: tests/one/beta-p0-1611.spec.ts).

import { looksLikeDemoName } from "@/lib/admin-ops/demo";

export const DEMO_BADGE = "DEMO";

export const DEMO_NOTE =
  "Attività di prova: serve a provare TRAMA e non è un'offerta reale. Una richiesta non arriva a un centro vero e non si paga nulla.";

/** Ripiego sul nome della sola attività ("UX DEMO …", "(prova)"). */
export function looksLikeDemoNameForActivity(name: string | null | undefined): boolean {
  return looksLikeDemoName(name);
}

export function isDemoActivity(a: { center?: string | null; name?: string | null } | null | undefined): boolean {
  if (!a) return false;
  return looksLikeDemoName(a.center) || looksLikeDemoName(a.name);
}

/** Etichetta di provenienza di un'attività con centro: "DEMO" per le prove, altrimenti "Partner TRAMA". */
export function activitySourceBadge(a: { center?: string | null; name?: string | null }): { label: string; demo: boolean } {
  return isDemoActivity(a) ? { label: DEMO_BADGE, demo: true } : { label: "Partner TRAMA", demo: false };
}

// ---------------------------------------------------------------------------
// RELEASE CANDIDATE 20/11 (16/11/2026), Lotto A1: chi può fare richieste a
// un'attività DEMO. Richiesta di Fabrizio: "account famiglia ordinario
// bloccato lato server; account tester autorizzato limitato a operazioni
// isolate… Non affidarti esclusivamente ai nomi". Le regole pure stanno qui;
// la lettura dei dati è in lib/demo/access.ts e il blocco nel database in
// supabase/migration_63_centri_demo.sql (stessa regola).

/** Un centro è di prova se il dato lo dice (is_demo, migration 63; is_test_fixture) o, in ripiego, se lo dice il nome. */
export function isDemoCenterRecord(c: { name?: string | null; isDemo?: boolean | null; isTestFixture?: boolean | null } | null | undefined): boolean {
  if (!c) return false;
  return c.isDemo === true || c.isTestFixture === true || looksLikeDemoName(c.name);
}

/** Collaudatore autorizzato: Admin piattaforma, coorte internal-preview o account di prova di Fabrizio. Fail-closed. */
export function isDemoTester(facts: { role?: string | null; isFabrizioTestAccount?: boolean; cohortKeys?: string[] | null }): boolean {
  if (facts.role === "platform_admin") return true;
  if (facts.isFabrizioTestAccount === true) return true;
  return (facts.cohortKeys ?? []).includes("internal-preview");
}

export type DemoRequestMode = "none" | "simulate" | "blocked";

/** "none" = attività vera (flusso normale); "simulate" = DEMO per un collaudatore; "blocked" = DEMO per chiunque altro. */
export function demoRequestMode(demo: boolean, tester: boolean): DemoRequestMode {
  if (!demo) return "none";
  return tester ? "simulate" : "blocked";
}

export const DEMO_SIMULATE_CTA = "Simula richiesta";
export const DEMO_BLOCKED_CTA = "Solo dimostrazione";
export const DEMO_BLOCKED_MESSAGE =
  "Questa è un'attività di prova: serve a mostrare come funziona TRAMA e non si può richiedere.";
export const DEMO_SIMULATE_NOTE =
  "Simulazione: la richiesta resta nell'ambiente di prova di TRAMA. Nessun centro vero la riceve, nessuna email parte e non si paga nulla.";
/** Messaggio del database (migration 63) quando un'insert DEMO non è ammessa. */
export const DEMO_DB_ERROR_TAG = "DEMO_NOT_ALLOWED";
