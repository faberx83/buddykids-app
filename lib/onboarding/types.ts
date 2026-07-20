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
