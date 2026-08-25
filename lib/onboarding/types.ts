// TRAMA ONE Build Sprint 1 — tipi condivisi per l'onboarding Centro.
// Nessuna dipendenza da lib/types.ts esistente: dominio nuovo, additivo,
// vedi supabase/migration_09_center_onboarding.sql.

export type CenterOnboardingStatus =
  | "LEAD"
  | "CLAIMED"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SUSPENDED";

export interface CenterOnboardingState {
  centerId: string;
  status: CenterOnboardingStatus;
  updatedAt: string | null;
}

export interface ChecklistItemState {
  itemKey: string;
  completed: boolean;
  completedAt: string | null;
}

export type IdentityVerificationStatus = "not_started" | "pending" | "verified" | "rejected";

export interface IdentityVerificationState {
  status: IdentityVerificationStatus;
  note: string | null;
  documentUrl: string | null;
  reviewedAt: string | null;
}

export interface OnboardingAuditEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CenterForReview {
  centerId: string;
  centerName: string;
  status: CenterOnboardingStatus;
  updatedAt: string | null;
}

// PRE-MICRO-PILOT GATE (R-01, 25/08/2026) — riga per l'elenco Admin di TUTTI
// i centri reali (non solo quelli con una riga in center_onboarding_state,
// a differenza di CenterForReview/listCentersForAdminReview sopra, pensata
// per la coda di revisione onboarding). Vedi listAllCentersForAdmin().
export interface CenterOperabilityRow {
  centerId: string;
  slug: string;
  name: string;
  city: string | null;
  createdAt: string | null;
  activityCount: number;
  onboardingStatus: CenterOnboardingStatus;
  // true se il centro è quasi certamente dato di test/demo (nome/slug con
  // pattern "[TEST]"/"test-"/"prova" — vedi isLikelyTestCenter()), non un
  // giudizio definitivo: un Admin può sempre aprire il dettaglio e
  // verificare.
  looksLikeTest: boolean;
}
