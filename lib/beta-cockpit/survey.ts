// TRAMA — ADMIN BETA COCKPIT · Survey beta. Due survey fisse nel codice
// (non un costruttore di questionari), accese con BETA_SURVEY_ENABLED e
// regolate da Admin (giorni dopo la registrazione, accesa/spenta).
// Le risposte finiscono in beta_feedback (area = id della survey): stessa
// coda, stessi permessi, nessuna tabella nuova. "Più tardi" usa
// announcement_receipts (dismissed_at), come le Novità.

export type SurveyId = "survey_1" | "survey_2";

export interface SurveyQuestion {
  id: string;
  text: string;
  type: "choice" | "text";
  options?: { value: string; label: string }[];
  /** Le domande a scelta sono obbligatorie; quelle a testo no. */
  placeholder?: string;
}

export interface SurveyDefinition {
  id: SurveyId;
  title: string;
  intro: string;
  defaultAfterDays: number;
  questions: SurveyQuestion[];
}

export const SURVEYS: SurveyDefinition[] = [
  {
    id: "survey_1",
    title: "Come sta andando con TRAMA?",
    intro: "Quattro domande, un minuto. Ci aiutano a capire cosa tenere e cosa cambiare.",
    defaultAfterDays: 3,
    questions: [
      {
        id: "piu_utile",
        text: "Quale cosa di TRAMA ti è stata più utile finora?",
        type: "choice",
        options: [
          { value: "settimana", label: "Vedere la settimana" },
          { value: "chi_accompagna", label: "Sapere chi accompagna" },
          { value: "chiusure", label: "Ponti e chiusure" },
          { value: "attivita", label: "Trovare attività" },
          { value: "condividere", label: "Condividere con altri" },
          { value: "nessuna", label: "Nessuna ancora" },
        ],
      },
      { id: "faticoso", text: "Qual è stata la cosa più faticosa o poco chiara?", type: "text", placeholder: "Scrivi pure in breve" },
      {
        id: "se_sparisse",
        text: "Se TRAMA sparisse domani, quanto ti dispiacerebbe?",
        type: "choice",
        options: [
          { value: "molto", label: "Molto" },
          { value: "abbastanza", label: "Abbastanza" },
          { value: "poco", label: "Poco" },
          { value: "per_niente", label: "Per niente" },
        ],
      },
      {
        id: "ancora_fuori",
        text: "Cosa fai ancora su WhatsApp, calendario o fogli che vorresti fare qui?",
        type: "text",
        placeholder: "Per esempio: avvisare i nonni, segnare i compiti…",
      },
    ],
  },
  {
    id: "survey_2",
    title: "Due settimane con TRAMA",
    intro: "Ultime domande della beta. Le risposte le legge il founder, una per una.",
    defaultAfterDays: 14,
    questions: [
      { id: "problema_risolto", text: "Quale problema ti ha risolto davvero?", type: "text" },
      { id: "non_useresti", text: "Cosa non useresti più?", type: "text" },
      { id: "manca_settimanale", text: "Cosa manca per usarla ogni settimana?", type: "text" },
      {
        id: "consiglieresti",
        text: "La consiglieresti a un genitore simile a te?",
        type: "choice",
        options: [
          { value: "si", label: "Sì" },
          { value: "forse", label: "Forse" },
          { value: "no", label: "No" },
        ],
      },
      { id: "perche", text: "Perché?", type: "text" },
    ],
  },
];

export function getSurvey(id: string): SurveyDefinition | null {
  return SURVEYS.find((s) => s.id === id) ?? null;
}

export interface SurveyConfig {
  survey_1: { enabled: boolean; afterDays: number };
  survey_2: { enabled: boolean; afterDays: number };
}

export function resolveSurveyConfig(saved: unknown): SurveyConfig {
  const out: SurveyConfig = {
    survey_1: { enabled: true, afterDays: 3 },
    survey_2: { enabled: true, afterDays: 14 },
  };
  if (!saved || typeof saved !== "object") return out;
  for (const id of ["survey_1", "survey_2"] as const) {
    const v = (saved as Record<string, unknown>)[id];
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    if (typeof r.enabled === "boolean") out[id].enabled = r.enabled;
    if (typeof r.afterDays === "number" && Number.isInteger(r.afterDays) && r.afterDays >= 1 && r.afterDays <= 60) out[id].afterDays = r.afterDays;
  }
  return out;
}

/** Dopo "Più tardi" la survey torna dopo questi giorni. */
export const SURVEY_SNOOZE_DAYS = 2;

/**
 * Quale survey mostrare oggi (al massimo una). Dal giorno della survey 2 in
 * poi vale quella: la survey 1 mai compilata a quel punto non ha più senso.
 */
export function dueSurvey(input: {
  registeredDaysAgo: number;
  answered: Set<string>;
  /** survey → ultimo "Più tardi" (ISO) */
  snoozedAt: Map<string, string>;
  now: Date;
  config: SurveyConfig;
}): SurveyDefinition | null {
  const { config } = input;
  const candidates: SurveyId[] =
    config.survey_2.enabled && input.registeredDaysAgo >= config.survey_2.afterDays ? ["survey_2"] : ["survey_1"];
  for (const id of candidates) {
    const cfg = config[id];
    if (!cfg.enabled || input.registeredDaysAgo < cfg.afterDays) continue;
    if (input.answered.has(id)) continue;
    const snoozed = input.snoozedAt.get(id);
    if (snoozed && input.now.getTime() - Date.parse(snoozed) < SURVEY_SNOOZE_DAYS * 86_400_000) continue;
    return getSurvey(id);
  }
  return null;
}

export interface SurveyAnswersResult {
  ok: boolean;
  error?: string;
  answers: Record<string, string>;
  /** Testo leggibile salvato come messaggio del feedback. */
  message: string;
}

/** Valida le risposte: solo domande note, scelte tra le opzioni, testi fino a 600 caratteri. */
export function validateSurveyAnswers(survey: SurveyDefinition, raw: Record<string, unknown>): SurveyAnswersResult {
  const answers: Record<string, string> = {};
  for (const q of survey.questions) {
    const v = raw[q.id];
    if (q.type === "choice") {
      if (typeof v !== "string" || !q.options!.some((o) => o.value === v)) {
        return { ok: false, error: "Rispondi alle domande a scelta", answers: {}, message: "" };
      }
      answers[q.id] = v;
    } else if (typeof v === "string" && v.trim()) {
      answers[q.id] = v.trim().slice(0, 600);
    }
  }
  const message = survey.questions
    .filter((q) => answers[q.id])
    .map((q) => {
      const a = answers[q.id];
      const shown = q.type === "choice" ? (q.options!.find((o) => o.value === a)?.label ?? a) : a;
      return `${q.text} — ${shown}`;
    })
    .join("\n");
  return { ok: true, answers, message };
}

/** Risposta "poco" o "per niente" alla domanda di Sean Ellis, o "no" alla raccomandazione. */
export function isNegativeSurveyAnswer(surveyId: string | null, answers: Record<string, unknown> | null | undefined): boolean {
  if (!answers) return false;
  if (surveyId === "survey_1") return answers.se_sparisse === "poco" || answers.se_sparisse === "per_niente";
  if (surveyId === "survey_2") return answers.consiglieresti === "no";
  return false;
}

export interface SurveyResults {
  survey: SurveyDefinition;
  responses: number;
  choices: { questionId: string; text: string; options: { label: string; count: number }[] }[];
  texts: { questionId: string; text: string; answers: { familyKey: string | null; familyLabel: string | null; text: string }[] }[];
}

export function summarizeSurvey(
  survey: SurveyDefinition,
  responses: { familyKey: string | null; familyLabel: string | null; answers: Record<string, string> }[]
): SurveyResults {
  return {
    survey,
    responses: responses.length,
    choices: survey.questions
      .filter((q) => q.type === "choice")
      .map((q) => ({
        questionId: q.id,
        text: q.text,
        options: q.options!.map((o) => ({ label: o.label, count: responses.filter((r) => r.answers[q.id] === o.value).length })),
      })),
    texts: survey.questions
      .filter((q) => q.type === "text")
      .map((q) => ({
        questionId: q.id,
        text: q.text,
        answers: responses
          .filter((r) => r.answers[q.id])
          .map((r) => ({ familyKey: r.familyKey, familyLabel: r.familyLabel, text: r.answers[q.id] })),
      })),
  };
}
