// TRAMA — LOTTO P0 BETA READINESS (16/11/2026). Richiesta di Fabrizio:
// "Aggiungi nella schermata di login un link 'Problemi ad accedere?'…
// Deve usare il sistema di feedback esistente, funzionare senza
// autenticazione, includere protezione antispam e non esporre informazioni
// sensibili. Le segnalazioni devono essere visibili e gestibili in Admin."
//
// ADAPT di beta_feedback (stessa tabella, stessa coda Admin
// /admin/segnalazioni-beta): una segnalazione "accesso" ha parent_id null,
// app_source 'accesso' ed email di contatto facoltativa
// (supabase/migration_62_segnalazioni_accesso.sql). Controlli puri qui,
// senza rete (test: tests/one/beta-p0-1611.spec.ts); salvataggio in
// app/actions/access-problem.ts col client di servizio, come la lista
// d'attesa (app/actions/waitlist.ts, stesso campo nascosto "website").
//
// Niente IP salvato: l'anti-spam è campo nascosto + tempo minimo di
// compilazione + tetto orario complessivo + doppioni ignorati.

import { checkEmail } from "@/lib/auth/email-check";

export const ACCESS_PROBLEM_SOURCE = "accesso" as const;
export const ACCESS_PROBLEM_AREA = "Accesso";
/** Sotto questo tempo tra apertura del modulo e invio non è una persona. */
export const ACCESS_PROBLEM_MIN_FILL_MS = 3000;
export const ACCESS_PROBLEM_MESSAGE_MIN = 10;
export const ACCESS_PROBLEM_MESSAGE_MAX = 1500;
/** Tetto complessivo di segnalazioni "accesso" all'ora (tutti i visitatori). */
export const ACCESS_PROBLEM_HOURLY_CAP = 30;

export const ACCESS_PROBLEM_KINDS = [
  { value: "link", label: "Il link d'invito o di conferma non funziona" },
  { value: "password", label: "Non ricordo la password o non arriva l'email" },
  { value: "errore", label: "Vedo un errore quando accedo o mi registro" },
  { value: "altro", label: "Altro" },
] as const;
export type AccessProblemKind = (typeof ACCESS_PROBLEM_KINDS)[number]["value"];

export interface AccessProblemInput {
  kind?: string | null;
  message: string;
  email?: string | null;
  /** Campo nascosto: se compilato è un programma automatico. */
  website?: string | null;
  /** Millisecondi tra apertura del modulo e invio (dal browser). */
  elapsedMs?: number | null;
  /** Pagina da cui arriva ("/auth/login?beta=…" → solo il percorso). */
  fromPath?: string | null;
  viewport?: string | null;
  standalone?: boolean | null;
  language?: string | null;
  userAgent?: string | null;
}

export interface AccessProblemRow {
  parent_id: null;
  app_source: typeof ACCESS_PROBLEM_SOURCE;
  area: string;
  page_path: string;
  message: string;
  status: "nuovo";
  category: "problema";
  contact_email: string | null;
  client_context: { route: string; source: "accesso"; kind: AccessProblemKind; viewport?: string; standalone?: boolean; language?: string; userAgent?: string };
}

export type AccessProblemCheck =
  | { ok: true; row: AccessProblemRow }
  | { ok: false; field: "bot" | "message" | "email"; message: string; suggestion?: string };

function oneLine(v: string | null | undefined, max: number): string | undefined {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
}

/**
 * Solo il percorso, mai la query: un link d'invito (?beta=CODICE, ?invite=…)
 * non deve finire nella coda Admin. Accetta solo percorsi interni.
 */
export function safeAccessPath(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/auth/login";
  const path = v.split(/[?#]/)[0].replace(/[^A-Za-z0-9/_\-.]/g, "").slice(0, 120);
  return path || "/auth/login";
}

/** Toglie dal testo token e codici lunghi che una persona potrebbe incollare (link con token, OTP). */
export function redactSecrets(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, (url) => {
      try {
        const u = new URL(url);
        return `${u.origin}${u.pathname}${u.search ? " [parametri tolti]" : ""}`;
      } catch {
        return "[link tolto]";
      }
    })
    .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, "[codice tolto]");
}

export function checkAccessProblem(input: AccessProblemInput): AccessProblemCheck {
  if ((input.website ?? "").trim()) return { ok: false, field: "bot", message: "Richiesta non valida." };
  const elapsed = typeof input.elapsedMs === "number" && Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0;
  if (elapsed < ACCESS_PROBLEM_MIN_FILL_MS) return { ok: false, field: "bot", message: "Richiesta non valida." };

  const text = (input.message ?? "").replace(/\r\n/g, "\n").trim();
  if (text.length < ACCESS_PROBLEM_MESSAGE_MIN) {
    return { ok: false, field: "message", message: "Raccontaci in qualche parola cosa succede (almeno 10 caratteri)." };
  }

  let contactEmail: string | null = null;
  const rawEmail = (input.email ?? "").trim();
  if (rawEmail) {
    const e = checkEmail(rawEmail);
    if (!e.ok) return { ok: false, field: "email", message: e.message, suggestion: e.suggestion };
    contactEmail = e.email;
  }

  const kind: AccessProblemKind = ACCESS_PROBLEM_KINDS.some((k) => k.value === input.kind)
    ? (input.kind as AccessProblemKind)
    : "altro";
  const kindLabel = ACCESS_PROBLEM_KINDS.find((k) => k.value === kind)!.label;
  const route = safeAccessPath(input.fromPath);
  const context: AccessProblemRow["client_context"] = { route, source: "accesso", kind };
  const viewport = oneLine(input.viewport, 20);
  const language = oneLine(input.language, 20);
  const userAgent = oneLine(input.userAgent, 200);
  if (viewport) context.viewport = viewport;
  if (language) context.language = language;
  if (userAgent) context.userAgent = userAgent;
  if (typeof input.standalone === "boolean") context.standalone = input.standalone;

  return {
    ok: true,
    row: {
      parent_id: null,
      app_source: ACCESS_PROBLEM_SOURCE,
      area: ACCESS_PROBLEM_AREA,
      page_path: route,
      message: `[${kindLabel}] ${redactSecrets(text.slice(0, ACCESS_PROBLEM_MESSAGE_MAX))}`,
      status: "nuovo",
      category: "problema",
      contact_email: contactEmail,
      client_context: context,
    },
  };
}
