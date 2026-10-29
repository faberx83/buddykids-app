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
  // 29/10/2026: Richieste non ha più schede: prenotazioni, messaggi e gruppi
  // sono in un elenco solo con i filtri (components/center/InboxV2.tsx).
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

// 29/10/2026, Fabrizio: "mancano i pulsanti per tornare indietro". Le pagine
// dentro una sezione (aperte da una riga di Centro, da Oggi o da una
// richiesta) hanno in alto "‹ <pagina di provenienza>". Destinazione fissa,
// mai la cronologia del browser: dalla PWA o da un link nelle email la
// cronologia può essere vuota. Le quattro sezioni non ce l'hanno (ci sono le
// schede in basso); profilo e attività hanno già il loro, nella pagina.
export interface PartnerBackLink {
  href: string;
  label: string;
}

// Hanno già il loro "indietro": profilo e pagine di un'attività (nella
// pagina), sotto-pagine dell'account (PageHeader con backHref).
const OWN_BACK_LINK = ["/center/profile", "/center/activities/", "/center/account/"];

export function partnerBackLink(pathname: string): PartnerBackLink | null {
  const path = pathname.replace(/\/+$/, "") || "/center";
  if (PARTNER_TABS.some((t) => t.href === path)) return null;
  if (OWN_BACK_LINK.some((p) => (p.endsWith("/") ? path.startsWith(p) : startsWithPath(path, p)))) return null;
  if (path.startsWith("/center/richieste/")) return { href: "/center/prenotazioni?tipo=messaggi", label: "Richieste" };
  if (path.startsWith("/center/one")) return null;
  const tab = PARTNER_TABS.find((t) => t.key === sectionForPath(path));
  return tab ? { href: tab.href, label: tab.label } : null;
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
