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

export function isDemoActivity(a: { center?: string | null; name?: string | null } | null | undefined): boolean {
  if (!a) return false;
  return looksLikeDemoName(a.center) || looksLikeDemoName(a.name);
}

/** Etichetta di provenienza di un'attività con centro: "DEMO" per le prove, altrimenti "Partner TRAMA". */
export function activitySourceBadge(a: { center?: string | null; name?: string | null }): { label: string; demo: boolean } {
  return isDemoActivity(a) ? { label: DEMO_BADGE, demo: true } : { label: "Partner TRAMA", demo: false };
}
