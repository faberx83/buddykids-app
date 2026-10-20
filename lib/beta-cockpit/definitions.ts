// TRAMA — ADMIN BETA COCKPIT (20/10/2026). Definizioni leggibili e
// documentate: azioni significative, aree, soglie, stati, passi del funnel.
// Logica pura, nessun import server-only: testata in tests/one/beta-cockpit.spec.ts.
//
// Principio: si contano solo AZIONI salvate nel database (un figlio, un
// impegno, un'assegnazione...), mai aperture di pagina o click. L'unica
// eccezione è "app aperta" (giorni con sessione rinnovata, migration 46),
// mostrata sempre a parte e mai promossa ad azione.

/** Tipi di azione significativa, ciascuno derivato da una tabella esistente. */
export type ActionKind =
  | "kid_added" // kids.created_at
  | "school_set" // kid_school_profiles.created_at / updated_at
  | "commitment_created" // external_planner_items (manual).created_at
  | "commitment_updated" // external_planner_items.updated_at (se diverso dalla creazione)
  | "discovery_to_planner" // external_planner_items (curated/community).created_at
  | "coordination_set" // week_responsibilities.updated_at
  | "partner_invited" // family_invites.created_at
  | "partner_joined" // family_members.joined_at (ruolo membro)
  | "helper_added" // family_people.created_at
  | "saved" // favorites / curated_favorites .created_at
  | "plan_shared" // plan_shares.created_at
  | "booking_requested" // bookings.created_at
  | "inquiry_sent" // activity_inquiries.created_at
  | "center_suggested" // center_leads (parent_referral).created_at
  | "radar_submitted" // discovery_submissions.created_at
  | "group_created" // groups.created_at
  | "group_joined" // group_members.joined_at
  | "group_invite_sent" // group_invites.created_at
  | "carpool" // carpool_offers / carpool_requests .created_at
  | "class_joined" // community_members.joined_at
  | "class_proposal" // community_activity_proposals / community_activity_interest .created_at
  | "feedback_sent" // beta_feedback (non survey).created_at
  | "survey_answered"; // beta_feedback (area survey_*).created_at

export type UsageArea =
  | "famiglia"
  | "planner"
  | "chi_accompagna"
  | "scuola"
  | "scopri"
  | "salvati"
  | "prenotazioni"
  | "gruppi"
  | "condivisione"
  | "radar"
  | "feedback";

export const AREA_LABEL: Record<UsageArea, string> = {
  famiglia: "Famiglia (figli, altro genitore, aiuti)",
  planner: "Planner (impegni)",
  chi_accompagna: "Chi accompagna",
  scuola: "Scuola / chiusure",
  scopri: "Scopri (aggiunte e centri suggeriti)",
  salvati: "Salvati",
  prenotazioni: "Prenotazioni e richieste",
  gruppi: "Gruppi e Classe e scuola",
  condivisione: "Condivisione del piano",
  radar: "Radar",
  feedback: "Feedback e survey",
};

export const AREA_ORDER: UsageArea[] = [
  "planner",
  "chi_accompagna",
  "famiglia",
  "scuola",
  "scopri",
  "salvati",
  "prenotazioni",
  "gruppi",
  "condivisione",
  "radar",
  "feedback",
];

export const ACTION_DEF: Record<ActionKind, { label: string; area: UsageArea }> = {
  kid_added: { label: "Figlio aggiunto", area: "famiglia" },
  school_set: { label: "Scuola impostata", area: "scuola" },
  commitment_created: { label: "Impegno inserito", area: "planner" },
  commitment_updated: { label: "Impegno modificato", area: "planner" },
  discovery_to_planner: { label: "Attività da Scopri aggiunta al Planner", area: "scopri" },
  coordination_set: { label: "Chi porta / chi ritira assegnato", area: "chi_accompagna" },
  partner_invited: { label: "Altro genitore invitato", area: "famiglia" },
  partner_joined: { label: "Altro genitore collegato", area: "famiglia" },
  helper_added: { label: "Persona di aiuto aggiunta (nonni, tata…)", area: "famiglia" },
  saved: { label: "Attività salvata", area: "salvati" },
  plan_shared: { label: "Piano condiviso", area: "condivisione" },
  booking_requested: { label: "Richiesta di prenotazione a un centro", area: "prenotazioni" },
  inquiry_sent: { label: "Messaggio a un centro", area: "prenotazioni" },
  center_suggested: { label: "Centro suggerito", area: "scopri" },
  radar_submitted: { label: "Scoperta inviata al Radar", area: "radar" },
  group_created: { label: "Gruppo creato", area: "gruppi" },
  group_joined: { label: "Entrata in un gruppo", area: "gruppi" },
  group_invite_sent: { label: "Invito a un gruppo", area: "gruppi" },
  carpool: { label: "Passaggio offerto o chiesto", area: "gruppi" },
  class_joined: { label: "Entrata in Classe e scuola", area: "gruppi" },
  class_proposal: { label: "Proposta o interesse in Classe e scuola", area: "gruppi" },
  feedback_sent: { label: "Feedback inviato", area: "feedback" },
  survey_answered: { label: "Survey compilata", area: "feedback" },
};

/** Azioni che contano come "impegno reale" per l'attivazione e il funnel. */
export const COMMITMENT_KINDS: ActionKind[] = ["commitment_created", "discovery_to_planner", "booking_requested"];

/** Azioni che dicono "coordinamento usato". */
export const COORDINATION_KINDS: ActionKind[] = ["coordination_set", "carpool"];

/** Soglie (configurabili da Admin → Report → Impostazioni, migration 46). */
export interface CockpitThresholds {
  /** Impegni reali minimi per l'attivazione (con almeno un figlio). */
  activationMinCommitments: number;
  /** Attivata e ultima azione da almeno N giorni → A rischio. */
  atRiskAfterDays: number;
  /** Ultima azione da almeno N giorni → Dormiente. */
  dormantAfterDays: number;
  /** Alert: registrata e non attivata da più di N ore. */
  notActivatedAlertHours: number;
  /** Alert: invito all'altro genitore senza risposta da N giorni. */
  partnerInvitePendingDays: number;
  /** Alert: richiesta al centro senza risposta da N giorni. */
  centerReplyDays: number;
  /** Il confronto con il periodo precedente compare solo da N famiglie registrate in su. */
  minFamiliesForComparison: number;
}

export const DEFAULT_THRESHOLDS: CockpitThresholds = {
  activationMinCommitments: 3,
  atRiskAfterDays: 4,
  dormantAfterDays: 7,
  notActivatedAlertHours: 48,
  partnerInvitePendingDays: 5,
  centerReplyDays: 3,
  minFamiliesForComparison: 5,
};

export const THRESHOLD_LABEL: Record<keyof CockpitThresholds, string> = {
  activationMinCommitments: "Impegni per l'attivazione",
  atRiskAfterDays: "A rischio dopo (giorni senza azioni)",
  dormantAfterDays: "Dormiente dopo (giorni senza azioni)",
  notActivatedAlertHours: "Avviso 'non attivata' dopo (ore)",
  partnerInvitePendingDays: "Avviso invito genitore dopo (giorni)",
  centerReplyDays: "Avviso richiesta senza risposta dopo (giorni)",
  minFamiliesForComparison: "Confronto col periodo precedente da (famiglie)",
};

/** Legge le soglie salvate, tenendo solo numeri interi sensati; il resto torna al default. */
export function resolveThresholds(saved: unknown): CockpitThresholds {
  const out: CockpitThresholds = { ...DEFAULT_THRESHOLDS };
  if (!saved || typeof saved !== "object") return out;
  const raw = saved as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_THRESHOLDS) as (keyof CockpitThresholds)[]) {
    const v = raw[key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 720) out[key] = v;
  }
  if (out.atRiskAfterDays >= out.dormantAfterDays) {
    out.atRiskAfterDays = DEFAULT_THRESHOLDS.atRiskAfterDays;
    out.dormantAfterDays = DEFAULT_THRESHOLDS.dormantAfterDays;
  }
  return out;
}

/**
 * Stato della famiglia. L'attivazione è un traguardo (colonna a parte, con la
 * data); lo stato dice cosa sta succedendo adesso.
 */
export type FamilyStatus = "invitata" | "non_partita" | "in_avvio" | "attiva" | "a_rischio" | "dormiente";

export const STATUS_DEF: Record<FamilyStatus, { label: string; rule: string; tone: "grey" | "blue" | "green" | "amber" | "red" }> = {
  invitata: { label: "Invitata", rule: "Invitata, nessun account registrato.", tone: "grey" },
  non_partita: { label: "Non partita", rule: "Registrata, nessuna azione significativa.", tone: "grey" },
  in_avvio: { label: "In avvio", rule: "Qualche azione, non ancora attivata, ultima azione recente.", tone: "blue" },
  attiva: { label: "Attiva", rule: "Attivata, ultima azione entro la soglia 'a rischio'.", tone: "green" },
  a_rischio: { label: "A rischio", rule: "Attivata, ultima azione tra la soglia 'a rischio' e quella 'dormiente'.", tone: "amber" },
  dormiente: { label: "Dormiente", rule: "Nessuna azione significativa da almeno la soglia 'dormiente'.", tone: "red" },
};

export const STATUS_ORDER: FamilyStatus[] = ["attiva", "in_avvio", "a_rischio", "dormiente", "non_partita", "invitata"];

export type FunnelStep =
  | "invitata"
  | "registrata"
  | "onboarding"
  | "primo_impegno"
  | "tre_impegni"
  | "secondo_adulto_o_coordinamento"
  | "ritorno_settimana_1"
  | "ritorno_settimana_2";

export const FUNNEL_DEF: { step: FunnelStep; label: string; rule: string }[] = [
  { step: "invitata", label: "Invitata", rule: "Nella lista invitati o registrata con un codice beta." },
  { step: "registrata", label: "Registrata", rule: "Almeno un adulto con account." },
  { step: "onboarding", label: "Onboarding concluso", rule: "Le schermate di benvenuto completate o saltate." },
  { step: "primo_impegno", label: "Primo impegno", rule: "Almeno un impegno nel Planner o una richiesta a un centro." },
  { step: "tre_impegni", label: "3 impegni", rule: "Almeno 3 (soglia di attivazione)." },
  {
    step: "secondo_adulto_o_coordinamento",
    label: "Secondo adulto o coordinamento",
    rule: "Un secondo genitore collegato, oppure 'chi porta / chi ritira' usato.",
  },
  {
    step: "ritorno_settimana_1",
    label: "Ritorno settimana 1",
    rule: "Un giorno con azioni o app aperta tra il giorno 1 e il 7 dopo la registrazione.",
  },
  {
    step: "ritorno_settimana_2",
    label: "Ritorno settimana 2",
    rule: "Un giorno con azioni o app aperta tra il giorno 8 e il 14 dopo la registrazione.",
  },
];

/** Formato "7 su 15": prima il conteggio, la percentuale solo da 20 in su e senza decimali. */
export function countOf(n: number, total: number): string {
  if (total <= 0) return `${n}`;
  if (total >= 20) return `${n} su ${total} (${Math.round((n / total) * 100)}%)`;
  return `${n} su ${total}`;
}
