// TRAMA — Avvisi Admin per la beta (20/11/2026).
// Richiesta di Fabrizio: "Attiva notifiche per nuovi utenti che entrano,
// segnalazioni, qualsiasi cosa utile per la fase beta."
// Iniziativa: claude/INIZIATIVA_avvisi_admin_beta.md (Project).
//
// Puro: dal tipo di evento al testo di push ed email. Nessun I/O.
// Push: niente email, nomi di bambini o testi liberi (il telefono li mostra a
// schermo bloccato; stessa regola di lib/push/send.ts). Email: va solo agli
// indirizzi Admin, può contenere l'email dell'account e un estratto.

export type AdminAlert =
  | {
      kind: "new_account";
      userId: string;
      role: string;
      email: string | null;
      betaCode: string | null;
      inBeta: boolean;
      /** false = registrato ma email non ancora confermata (spesso un intoppo da seguire). */
      confirmed: boolean;
    }
  | { kind: "beta_feedback"; actorId: string | null; area: string; pagePath: string; excerpt: string; category: string | null }
  | { kind: "booking_request"; actorId: string; bookingId: string; activityName: string | null; centerName: string | null }
  | { kind: "inquiry"; actorId: string; inquiryId: string; activityName: string | null; centerName: string | null }
  | { kind: "waitlist" }
  | { kind: "access_problem" }
  | { kind: "center_lead"; centerName: string | null }
  | { kind: "center_activation"; centerName: string | null };

export interface AlertMessage {
  push: { title: string; body: string; deepLink: string; tag: string };
  /** null = l'email esiste già nel flusso (lista d'attesa, accesso, candidature): solo push. */
  email: { subject: string; text: string } | null;
  /** Chiave per non avvisare due volte dello stesso fatto (null = ogni volta). */
  dedupeKey: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  parent: "genitore",
  center_admin: "gestore di centro",
  platform_admin: "admin",
};

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function buildAlertMessage(a: AdminAlert, adminOrigin: string): AlertMessage {
  switch (a.kind) {
    case "new_account": {
      const role = ROLE_LABEL[a.role] ?? a.role;
      const how = a.betaCode ? `con il codice ${a.betaCode}` : "senza codice beta";
      const link = a.role === "parent" ? `/admin/one/pilot/${a.userId}` : "/admin/famiglie";
      const state = a.confirmed ? "confermato" : "registrato, email NON ancora confermata";
      return {
        push: {
          title: a.confirmed ? "Nuovo account su TRAMA" : "Registrazione da completare",
          body: a.confirmed
            ? `Un ${role} ha confermato l'account (${how}).`
            : `Un ${role} si è registrato ma non ha ancora confermato l'email.`,
          deepLink: link,
          tag: `new_account:${a.userId}`,
        },
        email: {
          subject: `TRAMA beta · ${a.confirmed ? "nuovo account" : "registrazione da completare"} (${role})`,
          text: [
            `Account ${role} ${state}.`,
            `Email: ${a.email ?? "—"}`,
            `Accesso: ${how}${a.inBeta ? " · nella coorte beta" : " · NON nella coorte beta"}`,
            "",
            `Scheda: ${adminOrigin}${link}`,
          ].join("\n"),
        },
        // Due avvisi al massimo: "da completare" e poi "confermato".
        dedupeKey: `new_account:${a.userId}:${a.confirmed ? "confermato" : "in_attesa"}`,
      };
    }
    case "beta_feedback":
      return {
        push: {
          title: "Nuova segnalazione beta",
          body: `Area: ${a.area || "non indicata"}${a.category ? ` · ${a.category}` : ""}.`,
          deepLink: "/admin/segnalazioni-beta?stato=nuovo",
          tag: "beta_feedback",
        },
        email: {
          subject: `TRAMA beta · segnalazione (${a.area || "area non indicata"})`,
          text: [
            `Area: ${a.area || "—"}${a.category ? ` · ${a.category}` : ""}`,
            `Pagina: ${a.pagePath || "—"}`,
            "",
            clip(a.excerpt, 600),
            "",
            `Apri: ${adminOrigin}/admin/segnalazioni-beta?stato=nuovo`,
          ].join("\n"),
        },
        dedupeKey: null,
      };
    case "booking_request":
      return {
        push: {
          title: "Nuova prenotazione in beta",
          body: `${a.activityName ?? "Un'attività"}${a.centerName ? ` · ${a.centerName}` : ""}: in attesa del centro.`,
          deepLink: `/admin/bookings/${a.bookingId}`,
          tag: `booking:${a.bookingId}`,
        },
        email: {
          subject: "TRAMA beta · nuova richiesta di prenotazione",
          text: [
            `Attività: ${a.activityName ?? "—"}`,
            `Centro: ${a.centerName ?? "—"}`,
            "Il centro ha ricevuto la sua notifica; qui puoi seguire la risposta.",
            "",
            `Apri: ${adminOrigin}/admin/bookings/${a.bookingId}`,
          ].join("\n"),
        },
        dedupeKey: `booking:${a.bookingId}`,
      };
    case "inquiry":
      return {
        push: {
          title: "Una famiglia ha scritto a un centro",
          body: `${a.activityName ?? "Un'attività"}${a.centerName ? ` · ${a.centerName}` : ""}.`,
          deepLink: `/admin/richieste?caso=${a.inquiryId}#caso-${a.inquiryId}`,
          tag: `inquiry:${a.inquiryId}`,
        },
        email: {
          subject: "TRAMA beta · nuova richiesta a un centro",
          text: [
            `Attività: ${a.activityName ?? "—"}`,
            `Centro: ${a.centerName ?? "—"}`,
            "",
            `Apri: ${adminOrigin}/admin/richieste?caso=${a.inquiryId}#caso-${a.inquiryId}`,
          ].join("\n"),
        },
        dedupeKey: `inquiry:${a.inquiryId}`,
      };
    case "waitlist":
      return {
        push: { title: "Nuova richiesta d'invito", body: "Qualcuno si è messo in lista d'attesa.", deepLink: "/admin/lista-attesa", tag: "waitlist" },
        email: null,
        dedupeKey: null,
      };
    case "access_problem":
      return {
        push: { title: "Problema di accesso segnalato", body: "Qualcuno non riesce a entrare: ha lasciato un contatto.", deepLink: "/admin/segnalazioni-beta?stato=nuovo", tag: "access_problem" },
        email: null,
        dedupeKey: null,
      };
    case "center_lead":
      return {
        push: {
          title: "Nuova candidatura di un centro",
          body: a.centerName ? `${a.centerName} vuole entrare in TRAMA.` : "Un centro vuole entrare in TRAMA.",
          deepLink: "/admin/center-leads?tipo=candidature",
          tag: "center_lead",
        },
        email: null,
        dedupeKey: null,
      };
    case "center_activation":
      return {
        push: {
          title: "Un centro ha inviato il profilo",
          body: a.centerName ? `${a.centerName} aspetta la tua revisione.` : "Un centro aspetta la tua revisione.",
          deepLink: "/admin/centri-attivazione?f=trama",
          tag: "center_activation",
        },
        email: null,
        dedupeKey: null,
      };
  }
}

/** L'autore dell'evento è un account di prova (lista "Account di prova"): nessun avviso. */
export function isAlertFromTestAccount(a: AdminAlert, testIds: ReadonlySet<string>): boolean {
  const actor =
    a.kind === "new_account" ? a.userId : a.kind === "beta_feedback" ? a.actorId : a.kind === "booking_request" || a.kind === "inquiry" ? a.actorId : null;
  return Boolean(actor && testIds.has(actor));
}

export interface DailyDigestCounts {
  newAccounts: number;
  feedback: number;
  bookings: number;
  inquiries: number;
  waitlist: number;
}

/**
 * Riepilogo del giorno prima (cron delle 7). null se non è successo niente:
 * nessun messaggio vuoto. Account di prova già esclusi dal chiamante.
 */
export function buildDailyDigest(c: DailyDigestCounts, adminOrigin: string): { push: AlertMessage["push"]; email: { subject: string; text: string } } | null {
  const parts: [number, string, string][] = [
    [c.newAccounts, "nuovo account", "nuovi account"],
    [c.feedback, "segnalazione", "segnalazioni"],
    [c.bookings, "prenotazione", "prenotazioni"],
    [c.inquiries, "richiesta a un centro", "richieste ai centri"],
    [c.waitlist, "richiesta d'invito", "richieste d'invito"],
  ];
  const lines = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (lines.length === 0) return null;
  const body = lines.join(" · ");
  return {
    push: { title: "Ieri su TRAMA", body, deepLink: "/admin", tag: "admin_daily_digest" },
    email: {
      subject: `TRAMA beta · ieri: ${body}`,
      text: [`Nelle ultime 24 ore (account di prova esclusi):`, ...lines.map((l) => `- ${l}`), "", `Oggi in Admin: ${adminOrigin}/admin`, `Beta Famiglie: ${adminOrigin}/admin/beta`].join("\n"),
    },
  };
}

/** Righe "Ultimi 7 giorni" per il Beta Report settimanale (anche gli zeri: è un resoconto). */
export function weeklyActivityLines(c: DailyDigestCounts): string[] {
  return [
    `Nuovi account: ${c.newAccounts}`,
    `Segnalazioni: ${c.feedback}`,
    `Prenotazioni: ${c.bookings}`,
    `Richieste ai centri: ${c.inquiries}`,
    `Richieste d'invito: ${c.waitlist}`,
  ];
}
