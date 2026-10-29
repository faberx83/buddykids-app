// TRAMA — CHI ACCOMPAGNA DOVE SI TOCCA (29/10/2026, release
// "chi-accompagna-giornate-piene"). Fabrizio: "non è possibile far aprire la
// scheda nel contesto di dove viene cliccata? oggi ricarica la pagina e
// finisce nel planner". I link al foglio (Home "Assegna", il +, il
// buongiorno) restano link al Planner; se nella pagina c'è il foglio sopra
// la pagina (components/nextgen/ChiAccompagnaOverlay.tsx) si apre quello.
// Nel Planner resta il foglio del Planner. Test: tests/one/chi-accompagna-giornate-piene.spec.ts.

export type ChiTarget = { kind: "week"; monday: string | null } | { kind: "day"; date: string };

export const CHI_EVENT = "trama:chi-accompagna";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Dal link del Planner al foglio: ?assegna=<data> → giorno; ?panel=chi → settimana. */
export function chiTargetFromHref(href: string): ChiTarget | null {
  let url: URL;
  try {
    url = new URL(href, "https://tramapp.it");
  } catch {
    return null;
  }
  if (url.pathname !== "/nextgen/planner") return null;
  const day = url.searchParams.get("assegna");
  if (day && ISO.test(day)) return { kind: "day", date: day };
  if (url.searchParams.get("panel") === "chi") {
    const week = url.searchParams.get("week");
    return { kind: "week", monday: week && ISO.test(week) ? week : null };
  }
  return null;
}

/** Lunedì della settimana di una data. */
export function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

let overlayMounted = false;

export function setChiOverlayMounted(on: boolean) {
  overlayMounted = on;
}

/**
 * Apre il foglio sopra la pagina, se si può: true = aperto (il chiamante non
 * deve navigare), false = si segue il link come prima.
 */
export function openChiAccompagna(href: string): boolean {
  if (typeof window === "undefined" || !overlayMounted) return false;
  if (window.location.pathname.startsWith("/nextgen/planner")) return false;
  const target = chiTargetFromHref(href);
  if (!target) return false;
  window.dispatchEvent(new CustomEvent(CHI_EVENT, { detail: { target, href } }));
  return true;
}
