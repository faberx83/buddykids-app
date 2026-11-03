// TRAMA — PORTALE CENTRI V2, ATTIVITÀ APERTA (30/10/2026, tavola 7 del mock).
// Fabrizio: "Profilo e attività sono ancora vecchio style". La scheda di
// un'attività non è più un modulo lungo: è un elenco di righe (Informazioni,
// Date e posti, Come ci si iscrive, Prezzi, Servizi extra, La giornata tipo,
// Luogo, Foto, Il centro) con una riga di sintesi ciascuna; toccando una riga
// si aprono solo quei campi. Qui la logica pura: sezioni, sintesi, etichette.

import type { MealOption, ServiceOption } from "@/lib/types";
import type { ActivityDateSummary } from "@/lib/data/activity-dates";

export type ActivitySectionKey =
  | "info"
  | "iscrizione"
  | "prezzi"
  | "servizi"
  | "giornata"
  | "luogo"
  | "foto"
  | "centro";

export type BookingMode = "week_only" | "day_only" | "mixed";

export interface ActivityEditState {
  name: string;
  ageRange: string;
  description: string;
  tagIds: string[];
  bookingMode: BookingMode;
  minDaysPerBooking: number | null;
  spotsLeft: number;
  showExactSpots: boolean;
  pricePerWeek: number;
  shuttlePrice: number;
  preService: ServiceOption;
  postService: ServiceOption;
  mealOption: MealOption;
  mealPriceExtra: number;
  dietaryOptions: string[];
  schedule: { time: string; label: string; color: string }[];
  address: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  hasBar: boolean;
  accessible: boolean;
}

export const ACTIVITY_SECTIONS: { key: ActivitySectionKey; title: string; icon: string }[] = [
  { key: "info", title: "Informazioni", icon: "ti-info-circle" },
  { key: "iscrizione", title: "Come ci si iscrive", icon: "ti-user-check" },
  { key: "prezzi", title: "Prezzi", icon: "ti-receipt-euro" },
  { key: "servizi", title: "Servizi extra e pranzo", icon: "ti-tools-kitchen-2" },
  { key: "giornata", title: "La giornata tipo", icon: "ti-clock" },
  { key: "luogo", title: "Luogo", icon: "ti-map-pin" },
  { key: "foto", title: "Foto", icon: "ti-photo" },
  { key: "centro", title: "Accessibilità e punto ristoro", icon: "ti-building" },
];

export const BOOKING_MODE_V2: Record<BookingMode, { label: string; hint: string }> = {
  mixed: { label: "Settimane e giorni singoli", hint: "Le famiglie possono prenotare settimane intere oppure solo alcuni giorni." },
  week_only: { label: "Solo settimane", hint: "Le famiglie prenotano solo settimane intere." },
  day_only: { label: "Solo giorni singoli", hint: "Le famiglie scelgono i giorni dal calendario, senza settimane intere." },
};

export const MEAL_V2: Record<MealOption, string> = {
  included: "Pranzo incluso",
  packed: "Pranzo al sacco",
  none: "Pranzo non previsto",
};

const euro = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2)}`;

export function formatShortDay(isoDate: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${isoDate}T00:00:00Z`))
    .replace(/\./g, "");
}

/** Riga "Date e posti": prossima data e quante, oppure che mancano. */
export function datesSummary(d: ActivityDateSummary): { text: string; missing: boolean } {
  if (!d.next) return { text: "Mancano le date: le famiglie non possono iscriversi", missing: true };
  const amount =
    d.openDays > 0
      ? `${d.openDays} ${d.openDays === 1 ? "giorno aperto" : "giorni aperti"}`
      : `${d.weeks} ${d.weeks === 1 ? "settimana" : "settimane"}`;
  return { text: `Prossimo ${formatShortDay(d.next)} · ${amount}`, missing: false };
}

// UX-PARTNER-002 (report 30/10): l'editor mostrava "Prezzo a settimana 150"
// su un'attività solo a giorni venduta a €30 al giorno. Il prezzo di un
// giorno è sempre un quinto di quello della settimana (lib/day-pricing.ts,
// dailyRateFor, la stessa regola di scheda, richiesta e card): qui si
// scrive e si legge nell'unità della modalità scelta.
export function dayRate(pricePerWeek: number): number {
  return Math.round((pricePerWeek / 5) * 100) / 100;
}

/** Prezzo a settimana da salvare partendo dal prezzo di un giorno. */
export function weekPriceFromDay(dayPrice: number): number {
  return Math.round(dayPrice * 5 * 100) / 100;
}

/** Sintesi del prezzo nell'unità della modalità; la navetta conta solo per le settimane. */
export function priceSummary(f: Pick<ActivityEditState, "bookingMode" | "pricePerWeek" | "shuttlePrice">): string {
  if (!f.pricePerWeek) return "";
  if (f.bookingMode === "day_only") return `${euro(dayRate(f.pricePerWeek))} al giorno`;
  const parts = [`${euro(f.pricePerWeek)} a settimana`];
  if (f.bookingMode === "mixed") parts.push(`${euro(dayRate(f.pricePerWeek))} al giorno`);
  if (f.shuttlePrice) parts.push(`navetta ${euro(f.shuttlePrice)}`);
  return parts.join(" · ");
}

/** UX-PARTNER-003: il nome non può essere vuoto (né fatto di soli spazi). */
/**
 * Età leggibile: "6-11 anni". Test browser 03/11/2026: ageRange arriva già
 * con "anni" (lib/data/activities.ts) e sottotitolo e Informazioni
 * aggiungevano un altro "anni" → "6-11 anni anni". Si aggiunge solo se manca.
 */
export function ageLabel(ageRange: string | null | undefined): string {
  const v = (ageRange ?? "").trim();
  if (!v) return "";
  return /\banni\b/i.test(v) ? v : `${v} anni`;
}

export function activityNameError(name: string): string | null {
  return name.trim().length === 0 ? "Scrivete il nome dell'attività: è quello che leggono le famiglie." : null;
}

export interface SectionSummary {
  text: string;
  /** Da completare: la riga lo dice. */
  todo?: boolean;
}

/** Una riga di sintesi per ogni sezione (quello che c'è, o cosa manca). */
export function sectionSummaries(
  f: ActivityEditState,
  tagLabel: (id: string) => string | undefined
): Record<ActivitySectionKey, SectionSummary> {
  const tags = f.tagIds.map(tagLabel).filter(Boolean) as string[];
  const desc = f.description.trim();
  const info = [ageLabel(f.ageRange), tags.length ? tags.slice(0, 2).join(", ") + (tags.length > 2 ? ` +${tags.length - 2}` : "") : ""]
    .filter(Boolean)
    .join(" · ");

  const iscrizione = [
    BOOKING_MODE_V2[f.bookingMode].label,
    f.bookingMode !== "week_only" && f.minDaysPerBooking ? `minimo ${f.minDaysPerBooking} ${f.minDaysPerBooking === 1 ? "giorno" : "giorni"}` : "",
    f.showExactSpots ? `${f.spotsLeft} posti mostrati` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const prezzi = priceSummary(f);

  const servizi = [
    f.preService.available ? `entrata dalle ${f.preService.time}` : "",
    f.postService.available ? `uscita fino alle ${f.postService.time}` : "",
    f.mealOption !== "none" ? MEAL_V2[f.mealOption].toLowerCase() : "",
    f.dietaryOptions.length ? `${f.dietaryOptions.length} ${f.dietaryOptions.length === 1 ? "dieta" : "diete"}` : "",
  ].filter(Boolean);

  const giornata = f.schedule
    .filter((s) => s.label.trim())
    .slice(0, 2)
    .map((s) => `${s.time} ${s.label}`.trim());

  const photos = f.galleryUrls.length;
  const foto = f.coverImageUrl
    ? `Copertina${photos ? ` e ${photos} ${photos === 1 ? "foto" : "foto"}` : ""}`
    : photos
      ? `${photos} foto, senza copertina`
      : "";

  const centro = [f.accessible ? "accessibile" : "", f.hasBar ? "punto ristoro" : ""].filter(Boolean).join(" · ");

  return {
    info: desc ? { text: info || "Nome e descrizione" } : { text: "Manca la descrizione", todo: true },
    iscrizione: { text: iscrizione },
    prezzi: prezzi ? { text: prezzi } : { text: "Prezzo da indicare", todo: true },
    servizi: { text: servizi.length ? capitalize(servizi.join(" · ")) : "Nessun servizio extra" },
    giornata: giornata.length ? { text: giornata.join(", ") + (f.schedule.length > 2 ? "…" : "") } : { text: "Da raccontare (facoltativo)" },
    luogo: f.address.trim() ? { text: f.address.trim() } : { text: "Indirizzo da indicare", todo: true },
    foto: foto ? { text: foto } : { text: "Nessuna foto: le famiglie vedono un'immagine generica" },
    centro: { text: centro ? capitalize(centro) + " · vale per tutto il centro" : "Facoltativo · vale per tutto il centro" },
  };
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * UX-PARTNER-005 (report 30/10): nell'editor del centro i tag di prova
 * ("Test", "Test 1786…", tags.is_test_fixture) non si propongono, come già
 * lato famiglie (familyVisibleTags). Un tag di prova già assegnato a questa
 * attività resta visibile, per poterlo togliere: nessuna associazione
 * cancellata alla cieca.
 */
export function partnerSelectableTags<T extends { id: string; isTestFixture?: boolean }>(tags: T[], assigned: string[]): T[] {
  const keep = new Set(assigned);
  return tags.filter((t) => t.isTestFixture !== true || keep.has(t.id));
}
