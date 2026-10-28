// TRAMA — PORTALE CENTRI V2, GUSCIO (28/10/2026).
// Richiesta di Fabrizio: "dobbiamo rivedere tutto il portale in ordine e
// pronto per una prima condivisione con potenziali partner".
// Quattro sezioni al posto delle 12 voci del menu di prima (mock "TRAMA
// Partner V2", tavole 3–8): Oggi, Richieste, Attività, Centro. Le pagine di
// oggi restano dove sono (REUSE): il guscio decide solo a quale sezione
// appartiene ciascuna e quali "schede" mostrare sotto il titolo.
// Logica pura, testata in tests/one/partner-shell-v2.spec.ts.

export const PARTNER_SHELL_FLAG = "PARTNER_SHELL_V2_ENABLED";

export type PartnerSection = "oggi" | "richieste" | "attivita" | "centro";

export interface PartnerTab {
  key: PartnerSection;
  label: string;
  href: string;
  icon: string;
}

export const PARTNER_TABS: PartnerTab[] = [
  { key: "oggi", label: "Oggi", href: "/center", icon: "ti-sun" },
  { key: "richieste", label: "Richieste", href: "/center/prenotazioni", icon: "ti-inbox" },
  { key: "attivita", label: "Attività", href: "/center/activities", icon: "ti-calendar" },
  { key: "centro", label: "Centro", href: "/center/centro", icon: "ti-building-community" },
];

/** Schede dentro una sezione (sotto il titolo), per le sezioni fatte di più pagine. */
export interface PartnerSubTab {
  label: string;
  href: string;
}

export const PARTNER_SUBTABS: Partial<Record<PartnerSection, PartnerSubTab[]>> = {
  richieste: [
    { label: "Prenotazioni", href: "/center/prenotazioni" },
    { label: "Messaggi", href: "/center/richieste" },
    { label: "Gruppi", href: "/center/group-requests" },
  ],
  attivita: [
    { label: "Attività", href: "/center/activities" },
    { label: "Promozioni", href: "/center/promotions" },
  ],
};

const startsWithPath = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** A quale sezione appartiene una pagina del portale. */
export function sectionForPath(pathname: string): PartnerSection {
  if (["/center/prenotazioni", "/center/richieste", "/center/group-requests"].some((p) => startsWithPath(pathname, p))) {
    return "richieste";
  }
  if (["/center/activities", "/center/promotions"].some((p) => startsWithPath(pathname, p))) return "attivita";
  if (
    [
      "/center/centro",
      "/center/profile",
      "/center/account",
      "/center/invites",
      "/center/servizi-consigliati",
      "/center/report-presenze",
    ].some((p) => startsWithPath(pathname, p))
  ) {
    return "centro";
  }
  // /center, il registro presenze di oggi e tutto il resto.
  return "oggi";
}

/** La scheda attiva dentro la sezione (la più lunga che combacia). */
export function activeSubTab(pathname: string): string | null {
  const tabs = PARTNER_SUBTABS[sectionForPath(pathname)] ?? [];
  const match = tabs
    .filter((t) => startsWithPath(pathname, t.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? null;
}

export interface PartnerBadges {
  /** Prenotazioni non lette, richieste di gruppo in attesa, messaggi non letti. */
  richieste: number;
  /** Check-in dei genitori da confermare. */
  oggi: number;
  /** Per le schede dentro Richieste (href → numero): le tre caselle di prima viste come una. */
  bySubTab: Record<string, number>;
}

export function partnerBadges(input: {
  unreadBookings: number;
  pendingGroupRequests: number;
  unreadMessages: number;
  unconfirmedCheckins: number;
}): PartnerBadges {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
  return {
    richieste: n(input.unreadBookings) + n(input.pendingGroupRequests) + n(input.unreadMessages),
    oggi: n(input.unconfirmedCheckins),
    bySubTab: {
      "/center/prenotazioni": n(input.unreadBookings),
      "/center/richieste": n(input.unreadMessages),
      "/center/group-requests": n(input.pendingGroupRequests),
    },
  };
}

/** "9+" oltre nove, come la campanella. */
export function badgeLabel(count: number): string | null {
  if (!count || count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}
