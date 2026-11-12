// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Verifica se
// 'Centri da attivare' e 'Onboarding centri — TRAMA ONE' gestiscono lo stesso
// processo … Conserva 'Tocca a TRAMA / Tocca al centro', motivo del blocco,
// ultima azione e storico." Iniziativa: claude/INIZIATIVA_admin_operativo.md.
// Verificato: stesso processo (center_onboarding_state, LEAD → CLAIMED →
// SUBMITTED → APPROVED / CHANGES_REQUESTED, storico in
// center_onboarding_audit_log). La coda è una sola: Centri da attivare.
// Pura.

import type { AdminBucket } from "@/lib/centers/activation";
import type { CenterOnboardingStatus } from "@/lib/onboarding/types";

export interface BlockReasonInput {
  bucket: AdminBucket;
  status: CenterOnboardingStatus | null;
  checks: { label: string; done: boolean }[];
  changesNote: string | null;
  referentConfirmed: boolean;
  activitiesChecked: boolean;
}

/**
 * ADMIN OPERATIVO (12/11/2026): perché il centro è fermo e chi deve agire.
 * Richiesta di Fabrizio: "Conserva 'Tocca a TRAMA / Tocca al centro',
 * motivo del blocco, ultima azione e storico." Pura, esportata per i test.
 */
export function blockReason(r: BlockReasonInput): string | null {
  if (r.bucket === "trama") {
    const todo = [!r.referentConfirmed ? "confermare il referente" : null, !r.activitiesChecked ? "controllare le attività" : null].filter(Boolean);
    return todo.length > 0 ? `TRAMA deve ${todo.join(" e ")}, poi approvare` : "Pronto: TRAMA può approvare";
  }
  if (r.bucket === "centro") {
    if (r.status === "CHANGES_REQUESTED") return `Modifica richiesta al centro${r.changesNote ? `: ${r.changesNote}` : ""}`;
    if (r.status === "LEAD") return "Il centro non ha ancora creato l'accesso";
    const missing = r.checks.filter((c) => !c.done).map((c) => c.label.toLowerCase());
    return missing.length > 0 ? `Al profilo mancano: ${missing.join(", ")}` : "Profilo completo: il centro deve premere \"Invia a TRAMA\"";
  }
  if (r.bucket === "sospesi") return "Centro sospeso";
  return null;
}

