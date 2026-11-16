// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "Sotto
// Famiglie collega lista d'attesa, inviti, pilota e attivazione. Distingui
// invito preparato, invito effettivamente inviato, invito usato e
// registrazione: copiare un link non equivale a inviarlo. Mostra
// separatamente persone e famiglie. Mantieni gli invii manuali attuali finché
// non è disponibile un flusso verificabile." Iniziativa:
// claude/INIZIATIVA_admin_operativo.md.
//
// Cosa si può sapere oggi, verificato su codice e dati (12/11):
//   - "Richiesta": riga in beta_waitlist (pagina di benvenuto o "+ Famiglia
//     invitata" del cockpit).
//   - "Preparato": NON tracciato. "Scrivi l'invito" apre l'email nel
//     programma di posta, "Copia link invito" copia il link: nessuno dei due
//     lascia traccia nel database e nessuno dei due vuol dire inviato.
//   - "Inviato": stato 'invitato' con invited_at. Lo segna l'Admin a mano
//     ("Segna come inviato") DOPO aver spedito: è una dichiarazione, non una
//     prova di consegna (gli inviti partono dalla posta personale, non da
//     TRAMA).
//   - "Usato": l'account è stato creato con un codice beta
//     (profiles.beta_invited_by_code) — si sa il codice, non chi l'ha girato.
//   - "Registrata": esiste un account con la stessa email della richiesta.
// Persone = account genitore; famiglie = righe families con almeno un adulto
// (family_members), un genitore senza famiglia conta come famiglia da solo
// (stessa definizione del cockpit). Pura, senza I/O.

// LOTTO 2, primo incremento (16/11/2026). Richiesta di Fabrizio: "Usa la
// stessa regola operativa in Oggi, Lista d'attesa e Famiglie. Se l'account è
// già registrato, escludilo dalla coda e mantieni visibile che l'invio non è
// stato segnato. Non inventare una data di invio e non modificare i record
// storici." Caso QA: richiesta 'nuovo' con account già creato via codice
// contava 1 in Lista d'attesa e 0 in Inviti e registrazioni.
// Regola unica (inviteQueueState): l'account si cerca per email, qualunque
// ruolo, senza distinguere maiuscole; l'account vince sullo stato della riga.

export type InviteStage = "richiesta" | "inviato" | "registrata";

export const INVITE_STAGE_LABEL: Record<InviteStage, string> = {
  richiesta: "Da invitare",
  inviato: "Invito inviato (segnato a mano)",
  registrata: "Registrata",
};

export type InviteQueueState = "da_invitare" | "invito_segnato" | "registrata" | "archiviata";

export const INVITE_QUEUE_RULE =
  "Da invitare = richiesta non archiviata, senza invio segnato e senza un account con la stessa email.";

export interface AccountRef {
  id: string;
  createdAt: string;
  betaCode: string | null;
  /** Ha almeno una riga in beta_cohort_memberships: esiste la scheda in Pilota. */
  inPilot?: boolean;
}

export interface WaitlistLike {
  id: string;
  email: string;
  status: "nuovo" | "invitato" | "archiviato";
  createdAt: string;
  invitedAt: string | null;
  comune?: string | null;
  /** Account con la stessa email, se già risolto a monte (undefined = da cercare in parents). */
  account?: AccountRef | null;
}

export interface ParentLike {
  id: string;
  email: string | null;
  createdAt: string;
  betaCode: string | null;
}

/** Stato operativo di una richiesta. Unica fonte per Oggi, Lista d'attesa e Famiglie. */
export function inviteQueueState(w: Pick<WaitlistLike, "status">, account: AccountRef | null | undefined): InviteQueueState {
  if (w.status === "archiviato") return "archiviata";
  if (account) return "registrata";
  if (w.status === "invitato") return "invito_segnato";
  return "da_invitare";
}

export function isAwaitingInvite(w: Pick<WaitlistLike, "status">, account: AccountRef | null | undefined): boolean {
  return inviteQueueState(w, account) === "da_invitare";
}

/** Account creato ma invio mai segnato: lo si mostra, senza inventare una data. */
export function inviteNotMarked(w: Pick<WaitlistLike, "status" | "invitedAt">, account: AccountRef | null | undefined): boolean {
  return Boolean(account) && !w.invitedAt && w.status !== "invitato";
}

/** Righe della coda "Da invitare" per Oggi (stessa regola delle altre pagine). */
export function waitlistQueue<T extends WaitlistLike>(items: T[]): { queue: T[]; registeredNotMarked: T[] } {
  return {
    queue: items.filter((w) => isAwaitingInvite(w, w.account)),
    registeredNotMarked: items.filter((w) => w.status !== "archiviato" && inviteNotMarked(w, w.account)),
  };
}

/** Nota per Oggi: chi è fuori dalla coda perché già registrato. */
export function registeredNotMarkedNote(n: number): string {
  return n === 1
    ? "1 richiesta già registrata senza invio segnato: fuori dalla coda"
    : `${n} richieste già registrate senza invio segnato: fuori dalla coda`;
}

export interface InvitePipelineRow {
  waitlistId: string;
  email: string;
  comune: string | null;
  stage: InviteStage;
  archived: boolean;
  requestedAt: string;
  invitedAt: string | null;
  registeredAt: string | null;
  usedCode: string | null;
  accountId: string | null;
  inPilot: boolean;
  /** Registrata senza invio segnato (resta nello storico, fuori dalla coda). */
  inviteNotMarked: boolean;
}

const norm = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

export function invitePipeline(waitlist: WaitlistLike[], parents: ParentLike[]): InvitePipelineRow[] {
  const byEmail = new Map(parents.filter((p) => p.email).map((p) => [norm(p.email), p]));
  return waitlist.map((w) => {
    const p = byEmail.get(norm(w.email)) ?? null;
    const account: AccountRef | null =
      w.account !== undefined ? w.account : p ? { id: p.id, createdAt: p.createdAt, betaCode: p.betaCode } : null;
    const state = inviteQueueState(w.status === "archiviato" ? { status: "nuovo" } : w, account);
    const stage: InviteStage = state === "registrata" ? "registrata" : state === "invito_segnato" ? "inviato" : "richiesta";
    return {
      waitlistId: w.id,
      email: w.email,
      comune: w.comune ?? null,
      stage,
      archived: w.status === "archiviato",
      requestedAt: w.createdAt,
      invitedAt: w.invitedAt,
      registeredAt: account?.createdAt ?? null,
      usedCode: account?.betaCode ?? null,
      accountId: account?.id ?? null,
      inPilot: Boolean(account?.inPilot),
      inviteNotMarked: inviteNotMarked(w, account),
    };
  });
}

export interface PeopleFamiliesCount {
  people: number;
  families: number;
  /** Persone escluse (account di prova o esclusi nel cockpit). */
  excludedPeople: number;
}

/** Persone e famiglie distinte, escludendo gli id indicati. */
export function countPeopleAndFamilies(
  parents: { id: string }[],
  memberships: { userId: string; familyId: string }[],
  excludedIds: Set<string>
): PeopleFamiliesCount {
  const included = parents.filter((p) => !excludedIds.has(p.id));
  const familyOf = new Map<string, string>();
  for (const m of memberships) if (!familyOf.has(m.userId)) familyOf.set(m.userId, m.familyId);
  const keys = new Set(included.map((p) => familyOf.get(p.id) ?? `solo:${p.id}`));
  return { people: included.length, families: keys.size, excludedPeople: parents.length - included.length };
}

export interface CodeUsage {
  code: string;
  label: string | null;
  active: boolean;
  redeemed: number;
  max: number | null;
  expiresAt: string | null;
  /** Account creati con questo codice (profiles.beta_invited_by_code). */
  accounts: number;
}

export function codeUsage(
  codes: { code: string; label: string | null; active: boolean; redeemedCount: number; maxRedemptions: number | null; expiresAt: string | null }[],
  parents: ParentLike[]
): CodeUsage[] {
  return codes.map((c) => ({
    code: c.code,
    label: c.label,
    active: c.active,
    redeemed: c.redeemedCount,
    max: c.maxRedemptions,
    expiresAt: c.expiresAt,
    accounts: parents.filter((p) => (p.betaCode ?? "").toUpperCase() === c.code.toUpperCase()).length,
  }));
}
