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

// 29/10/2026, Fabrizio: "mancano i pulsanti per tornare indietro", poi
// "L'indietro però - es. quello del registro presenze - dovrebbe portare alla
// pagina prima non ad oggi". Come nell'app famiglie (lib/nextgen/
// in-app-history.ts): "‹" torna alla pagina da cui si è arrivati, col suo
// nome ("‹ Centro" se il registro è stato aperto da Centro, "‹ Oggi" se da
// Oggi). Solo se dietro non c'è nessuna pagina del portale (link da email o
// notifica, pagina ricaricata, PWA appena aperta) si va alla pagina "madre"
// qui sotto. Le quattro sezioni non hanno "‹" (ci sono le schede).
export interface PartnerBackLink {
  href: string;
  label: string;
}

// Sotto-pagine dell'account: hanno già il loro (PageHeader con backHref).
const OWN_BACK_LINK = ["/center/account/"];

const PAGE_LABELS: [RegExp, string][] = [
  [/^\/center$/, "Oggi"],
  [/^\/center\/prenotazioni$/, "Richieste"],
  [/^\/center\/richieste\/[^/]+$/, "Conversazione"],
  [/^\/center\/activities$/, "Attività"],
  [/^\/center\/activities\/new$/, "Nuova attività"],
  [/^\/center\/activities\/[^/]+\/calendar$/, "Date e posti"],
  [/^\/center\/activities\/[^/]+$/, "Attività"],
  [/^\/center\/promotions$/, "Promozioni"],
  [/^\/center\/centro$/, "Centro"],
  [/^\/center\/profile$/, "Profilo"],
  [/^\/center\/attendance$/, "Registro presenze"],
  [/^\/center\/report-presenze$/, "Report presenze"],
  [/^\/center\/invites$/, "Inviti"],
  [/^\/center\/servizi-consigliati$/, "Servizi consigliati"],
  [/^\/center\/account(\/.*)?$/, "Il mio account"],
];

const cleanPath = (pathname: string) => pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/center";

/** Nome breve di una pagina del portale, per "‹ <nome>". */
export function partnerPageLabel(pathname: string): string {
  const path = cleanPath(pathname);
  return PAGE_LABELS.find(([re]) => re.test(path))?.[1] ?? "Indietro";
}

/** Pagina "madre" di ripiego, quando dietro non c'è niente. null = niente "‹". */
export function partnerBackLink(pathname: string): PartnerBackLink | null {
  const path = cleanPath(pathname);
  if (PARTNER_TABS.some((t) => t.href === path)) return null;
  if (OWN_BACK_LINK.some((p) => path.startsWith(p))) return null;
  if (path.startsWith("/center/one")) return null;
  const calendar = path.match(/^\/center\/activities\/([^/]+)\/calendar$/);
  if (calendar) return { href: `/center/activities/${calendar[1]}`, label: "Attività" };
  if (path.startsWith("/center/richieste/")) return { href: "/center/prenotazioni?tipo=messaggi", label: "Richieste" };
  if (path === "/center/profile") return { href: "/center/centro", label: "Centro" };
  const tab = PARTNER_TABS.find((t) => t.key === sectionForPath(path));
  return tab ? { href: tab.href, label: tab.label } : null;
}

const MAX_STACK = 30;

/**
 * Pagine del portale visitate in questa scheda, dalla più vecchia all'ultima.
 * wasBack = ci si è arrivati con "indietro" (del telefono, del browser o "‹").
 */
export function nextPartnerStack(stack: string[], pathname: string, wasBack: boolean): string[] {
  const path = cleanPath(pathname);
  if (stack[stack.length - 1] === path) return stack;
  if (wasBack && stack[stack.length - 2] === path) return stack.slice(0, -1);
  return [...stack, path].slice(-MAX_STACK);
}

/** Dove porta "‹" e con che nome: la pagina di prima se c'è, altrimenti la madre. */
export function partnerBackTarget(pathname: string, stack: string[]): (PartnerBackLink & { history: boolean }) | null {
  const fallback = partnerBackLink(pathname);
  if (!fallback) return null;
  const path = cleanPath(pathname);
  const prev = stack[stack.length - 1] === path ? stack[stack.length - 2] : undefined;
  if (prev) return { href: prev, label: partnerPageLabel(prev), history: true };
  return { ...fallback, history: false };
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
