// TRAMA — PORTALE CENTRI V2, FASE 1: ATTIVAZIONE DEL CENTRO (27/10/2026).
// Decisioni di Fabrizio: timeline a passi in alto + % del profilo nel passo
// che dipende dal centro; attività visibili alle famiglie solo dopo
// l'approvazione; l'identità la conferma TRAMA dopo la telefonata (niente
// documenti). Iniziativa: claude/INIZIATIVA_partner_admin_v2.md §10.
//
// Logica pura, nessun I/O: dai fatti (stato in center_onboarding_state, dati
// del centro, attività con date, verifiche di TRAMA) a cosa mostrare al
// centro e all'Admin. Testata in tests/one/partner-v2-activation.spec.ts.
// I 5 controlli del profilo sono CALCOLATI dai dati: sostituiscono le spunte
// manuali di center_onboarding_checklist_completions, tranne "regole di
// cancellazione", che ha un valore di partenza (3 giorni) e quindi va
// confermata (si riusa la voce cancellation_policy_set).

import type { CenterOnboardingStatus } from "@/lib/onboarding/types";

export const PARTNER_V2_FLAG = "PARTNER_V2_ENABLED";

export interface CenterProfileFacts {
  name: string | null;
  city: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  address: string | null;
  cancellationWindowDays: number | null;
  /** Il centro ha confermato (o cambiato) le regole di cancellazione. */
  cancellationConfirmed: boolean;
  /** Attività con almeno un giorno aperto o una settimana da oggi in poi. */
  activitiesWithFutureDates: number;
}

export interface ActivationFacts {
  /** null = centro esistente prima dell'attivazione: attivo per costruzione. */
  status: CenterOnboardingStatus | null;
  profile: CenterProfileFacts;
  referentConfirmed: boolean;
  activitiesChecked: boolean;
  /** Nota dell'ultima "modifica richiesta" da TRAMA. */
  changesNote: string | null;
  /** Quando il centro ha inviato il profilo l'ultima volta. */
  submittedAt: string | null;
}

export type ProfileCheckKey = "contacts" | "description" | "address" | "cancellation" | "activity";

export interface ProfileCheck {
  key: ProfileCheckKey;
  label: string;
  hint: string;
  done: boolean;
  /** Dove si completa nel portale. */
  href: string;
  /** Testo del pulsante quando manca. */
  cta: string;
}

export const MIN_DESCRIPTION = 30;

const filled = (v: string | null | undefined) => Boolean(v && v.trim().length > 0);

export function profileChecks(p: CenterProfileFacts): ProfileCheck[] {
  return [
    {
      key: "contacts",
      label: "Nome, zona e contatti",
      hint: "Un'email o un telefono a cui le famiglie possono scrivervi",
      done: filled(p.name) && filled(p.city) && (filled(p.contactEmail) || filled(p.contactPhone)),
      href: "/center/profile",
      cta: "Completa",
    },
    {
      key: "description",
      label: "Descrizione del centro",
      hint:
        (p.description ?? "").trim().length > 0
          ? `Almeno ${MIN_DESCRIPTION} caratteri: ne mancano ${MIN_DESCRIPTION - (p.description ?? "").trim().length}`
          : `Chi siete e cosa fate, almeno ${MIN_DESCRIPTION} caratteri`,
      done: (p.description ?? "").trim().length >= MIN_DESCRIPTION,
      href: "/center/profile",
      cta: "Scrivi",
    },
    {
      key: "address",
      label: "Indirizzo",
      hint: "Serve alla mappa e alla distanza da casa",
      done: filled(p.address),
      href: "/center/profile",
      cta: "Aggiungi",
    },
    {
      key: "cancellation",
      label: "Regole di cancellazione",
      hint:
        p.cancellationWindowDays != null
          ? `Si annulla senza costi fino a ${p.cancellationWindowDays} ${p.cancellationWindowDays === 1 ? "giorno" : "giorni"} prima`
          : "Entro quanti giorni si annulla senza costi",
      done: p.cancellationConfirmed,
      href: "/center/profile",
      cta: "Conferma",
    },
    {
      key: "activity",
      label: "Prima attività con le date",
      hint: "Almeno un'attività con giorni o settimane da oggi in poi",
      done: p.activitiesWithFutureDates > 0,
      href: "/center/activities",
      cta: "Crea",
    },
  ];
}

export type StepKey = "candidatura" | "accesso" | "profilo" | "verifica" | "attivo";
export type StepState = "done" | "current" | "todo";

export interface ActivationStep {
  key: StepKey;
  label: string;
  state: StepState;
}

export type Actor = "centro" | "trama";

export interface ActivationView {
  /** Attivo: niente timeline, le attività sono visibili alle famiglie. */
  active: boolean;
  suspended: boolean;
  steps: ActivationStep[];
  current: StepKey;
  actor: Actor | null;
  checks: ProfileCheck[];
  done: number;
  total: number;
  percent: number;
  /** Il pulsante "Invia a TRAMA" è attivo. */
  canSubmit: boolean;
  /** Va fatto il passaggio LEAD → CLAIMED prima dell'invio. */
  needsClaim: boolean;
  changesNote: string | null;
  submittedAt: string | null;
  /** Una riga sotto il titolo. */
  headline: string;
}

const STEP_LABELS: Record<StepKey, string> = {
  candidatura: "Candidatura",
  accesso: "Accesso",
  profilo: "Profilo",
  verifica: "Verifica",
  attivo: "Attivo",
};
const ORDER: StepKey[] = ["candidatura", "accesso", "profilo", "verifica", "attivo"];

export function isActiveStatus(status: CenterOnboardingStatus | null): boolean {
  return status === null || status === "APPROVED";
}

export function activationView(f: ActivationFacts): ActivationView {
  const checks = profileChecks(f.profile);
  const done = checks.filter((c) => c.done).length;
  const total = checks.length;
  const percent = Math.round((done / total) * 100);
  const active = isActiveStatus(f.status);
  const suspended = f.status === "SUSPENDED";
  const current: StepKey = active ? "attivo" : f.status === "SUBMITTED" || suspended ? "verifica" : "profilo";
  const idx = ORDER.indexOf(current);
  const steps = ORDER.map((key, i) => ({
    key,
    label: STEP_LABELS[key],
    state: (active ? "done" : i < idx ? "done" : i === idx ? "current" : "todo") as StepState,
  }));
  const editable = f.status === "LEAD" || f.status === "CLAIMED" || f.status === "CHANGES_REQUESTED";
  const missing = total - done;
  const headline = active
    ? "Attivo: le vostre attività sono visibili alle famiglie."
    : suspended
      ? "Attivazione sospesa: scrivete a TRAMA."
      : f.status === "SUBMITTED"
        ? "Profilo inviato. Ora tocca a noi."
        : f.status === "CHANGES_REQUESTED"
          ? "TRAMA vi chiede una modifica: correggete e reinviate."
          : missing === 0
            ? "Il profilo è completo: inviatelo a TRAMA per la verifica."
            : `Ancora ${missing} ${missing === 1 ? "cosa" : "cose"} e potete inviare il profilo a TRAMA.`;
  return {
    active,
    suspended,
    steps,
    current,
    actor: active ? null : current === "profilo" ? "centro" : "trama",
    checks,
    done,
    total,
    percent,
    canSubmit: editable && done === total,
    needsClaim: f.status === "LEAD",
    changesNote: f.status === "CHANGES_REQUESTED" ? f.changesNote : null,
    submittedAt: f.status === "SUBMITTED" ? f.submittedAt : null,
    headline,
  };
}

// ─── Lato Admin ──────────────────────────────────────────────────────

export type AdminBucket = "trama" | "centro" | "attivi" | "sospesi";

export function adminBucket(status: CenterOnboardingStatus | null): AdminBucket {
  if (status === null || status === "APPROVED") return "attivi";
  if (status === "SUSPENDED") return "sospesi";
  if (status === "SUBMITTED") return "trama";
  return "centro";
}

/** "Approva" si attiva solo da inviato e con le due verifiche (come la funzione SQL). */
export function canApprove(f: Pick<ActivationFacts, "status" | "referentConfirmed" | "activitiesChecked">): boolean {
  return f.status === "SUBMITTED" && f.referentConfirmed && f.activitiesChecked;
}

/** Giorni interi tra due istanti (per "aspetta da N giorni"). */
export function daysWaiting(sinceIso: string | null, now: Date = new Date()): number | null {
  if (!sinceIso) return null;
  const ms = now.getTime() - new Date(sinceIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86400000);
}
