// TRAMA — PORTALE CENTRI V2, PROFILO DEL CENTRO A SEZIONI (03/11/2026).
// Fabrizio (30/10): "Profilo e attività sono ancora vecchio style". Come la
// scheda attività (lib/centers/activity-edit-v2.ts): ogni riga di Centro apre
// solo la sua parte del profilo (/center/profile?sezione=…), si salva, e si
// torna alla pagina da cui si è partiti con una conferma. Logica pura qui.

export type ProfileSectionKey =
  | "contatti"
  | "indirizzo"
  | "descrizione"
  | "accessibilita"
  | "social"
  | "cancellazioni"
  | "sconti";

export const PROFILE_SECTIONS: { key: ProfileSectionKey; title: string; group: "profilo" | "regole" }[] = [
  { key: "contatti", title: "Nome, zona e contatti", group: "profilo" },
  { key: "indirizzo", title: "Indirizzo", group: "profilo" },
  { key: "descrizione", title: "Descrizione e logo", group: "profilo" },
  { key: "accessibilita", title: "Accessibilità e punto ristoro", group: "profilo" },
  { key: "social", title: "Sito e social", group: "profilo" },
  { key: "cancellazioni", title: "Cancellazioni e modifiche", group: "regole" },
  { key: "sconti", title: "Sconti per più settimane, fratelli e gruppi", group: "regole" },
];

export function profileSectionFromQuery(v: string | string[] | undefined | null): ProfileSectionKey | null {
  const s = Array.isArray(v) ? v[0] : v;
  return PROFILE_SECTIONS.some((p) => p.key === s) ? (s as ProfileSectionKey) : null;
}

export type ProfileOrigin = "centro" | "oggi";

/** Indirizzo di una sezione del profilo, con la pagina a cui tornare dopo il salvataggio. */
export function profileSectionHref(key: ProfileSectionKey, from?: ProfileOrigin): string {
  return `/center/profile?sezione=${key}${from ? `&da=${from}` : ""}`;
}

/**
 * Dove si torna dopo "Salva": la pagina di partenza (Oggi se si è partiti
 * dalla card di attivazione — la richiesta di Fabrizio del 28/10 "al
 * salvataggio ritornasse sulla dashboard" — Centro se dalle sue righe),
 * altrimenti l'elenco del profilo. Solo valori noti, mai un indirizzo libero.
 */
export function profileReturnHref(from: string | string[] | undefined | null): string {
  const v = Array.isArray(from) ? from[0] : from;
  if (v === "oggi" || v === "attivazione") return "/center";
  if (v === "centro") return "/center/centro";
  return "/center/profile";
}

export interface ProfileSummaryInput {
  name: string;
  city: string;
  address: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  logoUrl?: string | null;
  accessible: boolean;
  hasBar: boolean;
  socialLinks: Record<string, string | undefined>;
  cancellationWindowDays: number;
  multiweekDiscountPercent: number;
  familyDiscountTiers: number[];
}

export function profileSummaries(p: ProfileSummaryInput, minDescription: number): Record<ProfileSectionKey, { text: string; todo?: boolean }> {
  const contacts = [p.contactEmail, p.contactPhone].filter((x) => x && x.trim()).join(" · ");
  const socials = Object.values(p.socialLinks ?? {}).filter((x) => x && String(x).trim()).length;
  const descLen = p.description.trim().length;
  const extras = [p.accessible ? "accessibile" : "", p.hasBar ? "punto ristoro" : ""].filter(Boolean).join(" · ");
  return {
    contatti:
      p.name.trim() && p.city.trim() && contacts
        ? { text: `${p.name.trim()} · ${p.city.trim()} · ${contacts}` }
        : { text: "Nome, città e un contatto per le famiglie", todo: true },
    indirizzo: p.address.trim() ? { text: [p.address.trim(), p.city.trim()].filter(Boolean).join(", ") } : { text: "Da indicare", todo: true },
    descrizione:
      descLen >= minDescription
        ? { text: `${descLen} caratteri${p.logoUrl ? " · con logo" : " · senza logo"}` }
        : { text: descLen ? `Mancano ${minDescription - descLen} caratteri` : `Almeno ${minDescription} caratteri`, todo: true },
    accessibilita: { text: extras ? extras[0].toUpperCase() + extras.slice(1) : "Facoltativo" },
    social: { text: socials ? `${socials} ${socials === 1 ? "collegamento" : "collegamenti"}` : "Facoltativo" },
    cancellazioni: {
      text: `Si annulla in app fino a ${p.cancellationWindowDays} ${p.cancellationWindowDays === 1 ? "giorno" : "giorni"} prima`,
    },
    sconti: {
      text: `Più settimane ${p.multiweekDiscountPercent}% · fratelli ${p.familyDiscountTiers.join("/")}%`,
    },
  };
}

/** Il nome del centro non può essere vuoto (stessa regola delle attività, UX-PARTNER-003). */
export function centerNameError(name: string): string | null {
  return name.trim() ? null : "Scrivete il nome del centro: è quello che leggono le famiglie.";
}
