// TRAMA — PORTALE CENTRI V2, SEZIONE "OGGI" (28/10/2026, tavola 3 del mock).
// Logica pura dei testi di Oggi: quante cose aspettano una risposta e dove
// portare il centro. Testata in tests/one/partner-shell-v2.spec.ts.

export interface ToAnswerInput {
  bookings: number;
  messages: number;
  groups: number;
  /** Giorni di attesa della prenotazione più vecchia (0 = oggi). */
  oldestBookingDays: number;
}

export interface ToAnswer {
  total: number;
  /** "2 prenotazioni e 1 messaggio · la più vecchia da 1 giorno" */
  detail: string;
  /** Dove porta il riquadro: la pagina dell'unico tipo presente, altrimenti le prenotazioni. */
  href: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function toAnswerSummary(input: ToAnswerInput): ToAnswer {
  const b = Math.max(0, input.bookings | 0);
  const m = Math.max(0, input.messages | 0);
  const g = Math.max(0, input.groups | 0);
  const parts = [
    b > 0 ? plural(b, "prenotazione", "prenotazioni") : null,
    m > 0 ? plural(m, "messaggio", "messaggi") : null,
    g > 0 ? plural(g, "richiesta di gruppo", "richieste di gruppo") : null,
  ].filter((x): x is string => x !== null);
  const list = parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  const age =
    b > 0 && input.oldestBookingDays > 0
      ? ` · la più vecchia da ${plural(input.oldestBookingDays, "giorno", "giorni")}`
      : "";
  const only = [b > 0, m > 0, g > 0].filter(Boolean).length === 1;
  const href = only && m > 0 ? "/center/richieste" : only && g > 0 ? "/center/group-requests" : "/center/prenotazioni";
  return { total: b + m + g, detail: list ? `${list}${age}` : "", href };
}

/** "mer 29 ott" in italiano, fuso di Roma. */
export function shortItalianDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "short", day: "numeric", month: "short" })
    .format(d)
    .replace(/\./g, "");
}
