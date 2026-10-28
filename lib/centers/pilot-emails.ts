// TRAMA — PERCORSO DEI CENTRI DEL PILOTA (27/10/2026, P0 di
// claude/INIZIATIVA_partner_admin_v2.md, approvato da Fabrizio: "si ok su tutto").
//
// Le email che mancavano perché un centro arrivato da una campagna non resti
// mai senza risposta, e una sua richiesta non resti mai senza risposta:
//   1. al centro, quando una famiglia manda una richiesta (prima: solo push,
//      e solo se il gestore l'aveva attivata sul telefono);
//   2. al centro che si candida: "abbiamo ricevuto la candidatura";
//   3. a Fabrizio: "nuova candidatura" (stessa casella della lista d'attesa);
//   4. al centro approvato: "sei dentro, registrati con questa email" (o
//      "entra", se l'account c'era già).
// Logica pura, nessun I/O: testata in tests/one/center-pilot-flow.spec.ts.
// Stessa forma di tutte le email di TRAMA (lib/email-layout.ts).

import { escapeEmailHtml, tramaEmailHtml } from "@/lib/email-layout";

export const CENTER_PILOT_FLOW_FLAG = "CENTER_PILOT_FLOW_ENABLED";

/** Il portale dei centri: login e registrazione dei gestori. */
export const PARTNER_PUBLIC_ORIGIN = "https://partner.tramapp.it";

/**
 * Candidature di prova dei test automatici (tests/gestore/candidati.spec.ts,
 * nome "[TEST] …"): si salvano come sempre, ma senza email.
 */
export function isTestCandidacyName(name: string): boolean {
  return /^\[TEST\]/i.test(name.trim());
}

/**
 * Casella di contatto mostrata sulle pagine dei centri: la stessa delle
 * risposte alle email (EMAIL_REPLY_TO), mai scritta nel codice
 * (tests/one/email-mittente.spec.ts, EMM-06). Senza variabile: nessun contatto.
 */
export function centersContactAddress(
  env: Record<string, string | undefined>,
  extract: (raw: string | undefined | null) => string | null
): string | null {
  return extract(env.EMAIL_REPLY_TO);
}

export interface BuiltEmail {
  subject: string;
  html: string;
}

/** "3 giorni" / "1 settimana" / "" — quanto ha chiesto la famiglia. */
export function requestSizeLabel(days: number, weeks: number): string {
  if (days > 0) return days === 1 ? "1 giorno" : `${days} giorni`;
  if (weeks > 0) return weeks === 1 ? "1 settimana" : `${weeks} settimane`;
  return "";
}

export function centerNewRequestEmail(input: {
  activityName: string | null;
  kids: number;
  days: number;
  weeks: number;
}): BuiltEmail {
  const activity = input.activityName?.trim() || "una vostra attività";
  const size = requestSizeLabel(input.days, input.weeks);
  const kids = input.kids === 1 ? "1 bambino" : input.kids > 1 ? `${input.kids} bambini` : "";
  const what = [size, kids ? `per ${kids}` : ""].filter(Boolean).join(" ");
  const subject = `Nuova richiesta: ${activity}`;
  return {
    subject,
    html: tramaEmailHtml({
      title: subject,
      paragraphs: [
        `Una famiglia ha chiesto <strong>${escapeEmailHtml(activity)}</strong>${what ? ` — ${escapeEmailHtml(what)}` : ""}.`,
        "La famiglia aspetta la vostra risposta: potete accettare, proporre un'alternativa o metterla in lista d'attesa, anche per singolo giorno.",
        "Rispondere entro 24 ore fa la differenza: è la prima cosa che le famiglie ricordano.",
      ],
      cta: { label: "Rispondi alla richiesta", href: `${PARTNER_PUBLIC_ORIGIN}/center/prenotazioni` },
      showLinkFallback: true,
      footnote: "Ricevete questa email perché gestite questo centro su TRAMA.",
    }),
  };
}

/** Nuovo messaggio di una famiglia nella conversazione (27/10/2026). */
export function centerNewMessageEmail(input: {
  activityName: string | null;
  parentFirstName: string | null;
  preview: string;
  inquiryId: string;
}): BuiltEmail {
  const activity = input.activityName?.trim() || "una vostra attività";
  const who = input.parentFirstName?.trim() || "Una famiglia";
  const text = input.preview.replace(/\s+/g, " ").trim();
  const short = text.length > 280 ? `${text.slice(0, 279)}…` : text;
  const subject = `Nuovo messaggio: ${activity}`;
  return {
    subject,
    html: tramaEmailHtml({
      title: subject,
      paragraphs: [
        `${escapeEmailHtml(who)} vi ha scritto per <strong>${escapeEmailHtml(activity)}</strong>:`,
        `<em>“${escapeEmailHtml(short)}”</em>`,
        "Rispondete dal portale: la famiglia vede tutta la conversazione in TRAMA.",
      ],
      cta: { label: "Apri la conversazione", href: `${PARTNER_PUBLIC_ORIGIN}/center/richieste/${input.inquiryId}` },
      showLinkFallback: true,
      footnote: "Ricevete questa email perché gestite questo centro su TRAMA.",
    }),
  };
}

export function candidacyReceivedEmail(input: { centerName: string; statusUrl: string | null }): BuiltEmail {
  const subject = "Abbiamo ricevuto la vostra candidatura";
  return {
    subject,
    html: tramaEmailHtml({
      title: subject,
      paragraphs: [
        `Grazie! La candidatura di <strong>${escapeEmailHtml(input.centerName)}</strong> è arrivata a TRAMA.`,
        "Vi scriviamo noi entro pochi giorni lavorativi, di solito con una breve telefonata per conoscerci e capire quali attività volete proporre.",
        "Quando la candidatura è approvata vi arriva un'altra email, con il link per creare l'accesso: usate questo stesso indirizzo.",
      ],
      cta: input.statusUrl ? { label: "Vedi lo stato della candidatura", href: input.statusUrl } : null,
      footnote: "Per qualunque domanda rispondete a questa email.",
    }),
  };
}

export function candidacyAdminNoticeEmail(input: {
  centerName: string;
  locality: string | null;
  email: string;
  phone: string | null;
  description: string | null;
  source?: string | null;
}): BuiltEmail {
  const lines = [
    `<b>Centro:</b> ${escapeEmailHtml(input.centerName)}`,
    input.locality ? `<b>Zona:</b> ${escapeEmailHtml(input.locality)}` : null,
    `<b>Email:</b> ${escapeEmailHtml(input.email)}`,
    input.phone ? `<b>Telefono:</b> ${escapeEmailHtml(input.phone)}` : null,
    input.description ? `<b>Descrizione:</b> ${escapeEmailHtml(input.description)}` : null,
    input.source ? `<b>Arrivata da:</b> ${escapeEmailHtml(input.source)}` : null,
  ].filter(Boolean) as string[];
  const subject = `TRAMA — nuova candidatura: ${input.centerName}`;
  return {
    subject,
    html: tramaEmailHtml({
      title: "Nuova candidatura di un centro",
      paragraphs: [lines.join("<br>"), "La trovi in Admin → Segnalazioni centri: \"Approva e crea centro\"."],
      cta: { label: "Apri Segnalazioni centri", href: "https://admin.tramapp.it/admin/center-leads" },
    }),
  };
}

/** Link di registrazione già precompilato (stessa email della candidatura). */
export function partnerSignupUrl(email: string): string {
  return `${PARTNER_PUBLIC_ORIGIN}/auth/login?mode=signup&email=${encodeURIComponent(email)}`;
}

export function candidacyApprovedEmail(input: {
  centerName: string;
  email: string;
  /** true se l'account esisteva già ed è già gestore del centro. */
  alreadyRegistered: boolean;
}): BuiltEmail {
  const subject = `${input.centerName} è su TRAMA`;
  const center = `<strong>${escapeEmailHtml(input.centerName)}</strong>`;
  const paragraphs = input.alreadyRegistered
    ? [
        `Buone notizie: la candidatura di ${center} è approvata e il vostro accesso è già collegato al centro.`,
        "Entrate nel portale dei centri: completate il profilo e create la prima attività, anche per singoli giorni (ponti, vacanze, pomeriggi).",
      ]
    : [
        `Buone notizie: la candidatura di ${center} è approvata.`,
        `Ora create l'accesso al portale dei centri con <strong>questo stesso indirizzo</strong> (${escapeEmailHtml(input.email)}): il centro si collega da solo.`,
        "Poi completate il profilo e create la prima attività, anche per singoli giorni (ponti, vacanze, pomeriggi). Se vi serve una mano, rispondete a questa email.",
      ];
  return {
    subject,
    html: tramaEmailHtml({
      title: subject,
      paragraphs,
      cta: input.alreadyRegistered
        ? { label: "Entra nel portale", href: `${PARTNER_PUBLIC_ORIGIN}/auth/login` }
        : { label: "Crea l'accesso", href: partnerSignupUrl(input.email) },
      showLinkFallback: true,
      footnote: "Ricevete questa email perché avete candidato il centro su tramapp.it.",
    }),
  };
}

// ─── Attivazione del centro (portale centri V2, 27/10/2026) ──────────

/** A TRAMA: un centro ha inviato il profilo per la verifica. */
export function activationSubmittedNoticeEmail(input: { centerName: string; city: string | null }): BuiltEmail {
  const subject = `TRAMA — profilo da verificare: ${input.centerName}`;
  return {
    subject,
    html: tramaEmailHtml({
      title: "Un centro ha inviato il profilo",
      paragraphs: [
        `<strong>${escapeEmailHtml(input.centerName)}</strong>${input.city ? ` · ${escapeEmailHtml(input.city)}` : ""} ha completato il profilo e aspetta la verifica.`,
        "Telefona al referente, controlla le attività, spunta le due verifiche e approva (o chiedi una modifica).",
      ],
      cta: { label: "Apri Centri da attivare", href: "https://admin.tramapp.it/admin/centri-attivazione" },
    }),
  };
}

/** Al centro: TRAMA chiede una modifica, con la nota. */
export function activationChangesEmail(input: { centerName: string; note: string }): BuiltEmail {
  const subject = `${input.centerName}: TRAMA vi chiede una modifica`;
  return {
    subject,
    html: tramaEmailHtml({
      title: "Una modifica prima dell'attivazione",
      paragraphs: [
        `Abbiamo guardato il profilo di <strong>${escapeEmailHtml(input.centerName)}</strong>. Prima di attivarlo vi chiediamo:`,
        `<em>“${escapeEmailHtml(input.note)}”</em>`,
        "Correggete dal portale e reinviate: lo riguardiamo subito.",
      ],
      cta: { label: "Apri il portale", href: `${PARTNER_PUBLIC_ORIGIN}/center` },
      showLinkFallback: true,
      footnote: "Per qualunque domanda rispondete a questa email.",
    }),
  };
}

/** Al centro: attivato, visibile alle famiglie. */
export function activationApprovedEmail(input: { centerName: string }): BuiltEmail {
  const subject = `${input.centerName} è attivo su TRAMA`;
  return {
    subject,
    html: tramaEmailHtml({
      title: subject,
      paragraphs: [
        "Verifica fatta: da ora le vostre attività sono visibili alle famiglie, che possono mandarvi richieste per giorni e settimane.",
        "Vi avvisiamo per email e notifica a ogni nuova richiesta. Rispondere presto fa la differenza.",
      ],
      cta: { label: "Apri il portale", href: `${PARTNER_PUBLIC_ORIGIN}/center` },
      showLinkFallback: true,
    }),
  };
}
