// TRAMA — SCHEDA ATTIVITÀ V2 (14/10/2026, proposta approvata da Fabrizio).
// Logica pura della scheda attività nello stile V2 (components/nextgen/
// ActivityDetailV2.tsx), testata in tests/one/scheda-v2.spec.ts.
//
// Regole:
//  - niente numeri che sembrano veri e non lo sono: voto, numero di
//    recensioni e km sono valori inseriti a mano nei dati (activities.rating,
//    reviews_count, distance_km), non calcolati → in V2 non si mostrano;
//  - al massimo 3 motivi chiari ("perché fa per voi"), come le card di Scopri;
//  - si elencano solo i servizi DISPONIBILI (prima comparivano anche quelli
//    assenti, in grigio); "Nessuna limitazione" diventa "Accessibile".

import type { Activity, Kid } from "@/lib/types";
import { isAgeEligible } from "@/lib/matching";

export interface ActivityService {
  key: string;
  icon: string;
  label: string;
  detail?: string;
}

function euro(n: number): string {
  return `€${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")}`;
}

/** Servizi realmente disponibili, con orario/costo quando c'è. */
export function includedServices(activity: Activity): ActivityService[] {
  const out: ActivityService[] = [];
  if (activity.preService?.available) {
    const extra = activity.preService.priceExtra > 0 ? ` · +${euro(activity.preService.priceExtra)}/sett.` : " · incluso";
    out.push({ key: "pre", icon: "ti-sunrise", label: "Pre-scuola", detail: `dalle ${activity.preService.time}${extra}` });
  }
  if (activity.postService?.available) {
    const extra = activity.postService.priceExtra > 0 ? ` · +${euro(activity.postService.priceExtra)}/sett.` : " · incluso";
    out.push({ key: "post", icon: "ti-sunset-2", label: "Post-scuola", detail: `fino alle ${activity.postService.time}${extra}` });
  }
  if (activity.mealOption === "included") out.push({ key: "pranzo", icon: "ti-tools-kitchen-2", label: "Pranzo", detail: "incluso" });
  else if (activity.mealOption === "packed") out.push({ key: "pranzo", icon: "ti-tools-kitchen-2", label: "Pranzo", detail: "al sacco" });
  if (activity.shuttlePrice > 0) out.push({ key: "navetta", icon: "ti-bus", label: "Navetta", detail: `+${euro(activity.shuttlePrice)}/sett.` });
  if (activity.centerHasBar) out.push({ key: "bar", icon: "ti-cup", label: "Bar nel centro" });
  if (activity.centerAccessible) {
    out.push({ key: "accessibile", icon: "ti-wheelchair", label: "Accessibile", detail: activity.centerAccessibleNote || undefined });
  }
  return out;
}

/**
 * Fino a 3 motivi leggibili, in ordine di utilità:
 *  1. età adatta ai figli (dalla fascia d'età dell'attività);
 *  2. interessi dei figli (stessa soglia di Scopri, lib/nextgen/smart-search.ts);
 *  3. servizi che contano per la logistica (pranzo, pre/post, navetta).
 * Mai il voto: è un valore inserito a mano, non recensioni vere.
 */
export function activityDetailReasons(activity: Activity, kids: Pick<Kid, "name" | "age" | "interests">[]): string[] {
  const reasons: string[] = [];
  const ageFit = kids.filter((k) => k.age > 0 && isAgeEligible(k.age, activity.ageRange)).map((k) => k.name);
  if (ageFit.length === 1) reasons.push(`Età giusta per ${ageFit[0]}`);
  else if (ageFit.length >= 2) reasons.push(kids.length === ageFit.length ? "Età giusta per i tuoi figli" : `Età giusta per ${ageFit.join(" e ")}`);

  // Solo gli interessi (non il punteggio di Scopri, dove l'età da sola vale
  // già abbastanza per "Piace a…"): parola dell'interesse nel nome, nella
  // descrizione o nei tag dell'attività.
  const liked = kids.filter((k) => isAgeEligible(k.age, activity.ageRange) && sharesInterest(k.interests ?? [], activity)).map((k) => k.name);
  if (liked.length === 1) reasons.push(`Vicina agli interessi di ${liked[0]}`);
  else if (liked.length >= 2) reasons.push("Vicina agli interessi dei tuoi figli");

  if (activity.mealOption === "included") reasons.push("Pranzo incluso");
  if (activity.preService?.available && activity.postService?.available) reasons.push("Anche pre e post scuola");
  else if (activity.postService?.available) reasons.push("C'è il post-scuola");
  if (activity.shuttlePrice > 0) reasons.push("Navetta disponibile");

  return reasons.slice(0, 3);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
}

/** true se almeno un interesse del figlio compare nell'attività (stessa regola di lib/matching.ts). */
export function sharesInterest(interests: string[], activity: Pick<Activity, "name" | "description" | "tags">): boolean {
  const haystack = normalize([activity.name, activity.description, ...activity.tags.map((t) => t.label)].join(" "));
  return interests.some((interest) =>
    normalize(interest)
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .some((w) => haystack.includes(w))
  );
}

/** Riga sotto il titolo: "Centro · zona" senza ripetere l'indirizzo. */
export function placeLine(activity: Pick<Activity, "center" | "address">): string {
  const center = (activity.center ?? "").trim();
  const address = (activity.address ?? "").trim();
  if (!center) return address;
  if (!address) return center;
  return `${center} · ${address}`;
}

/** Etichette uniche (tag e badge dicevano spesso la stessa cosa due volte). */
export function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const clean = raw.replace(/^[^\p{L}\p{N}]+/u, "").trim(); // via emoji iniziali ("🏊 Piscina" → "Piscina")
    const key = clean.toLowerCase().replace(/\s+incl\.?$/, "");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

/**
 * Destinazione per "Avvia navigazione": l'indirizzo scritto se c'è, altrimenti
 * le coordinate (14/10, "Prova FP": coordinate presenti ma indirizzo vuoto, il
 * pulsante non compariva). null se non c'è né l'uno né le altre.
 */
export function navigationDestination(address: string | null | undefined, lat: number | null | undefined, lng: number | null | undefined): string | null {
  const text = (address ?? "").trim();
  if (text) return text;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) return `${lat},${lng}`;
  return null;
}
