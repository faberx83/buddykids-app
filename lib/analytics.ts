// Funzioni di analisi derivate dai dati mock — pensate per essere sostituite
// in futuro da query aggregate su Supabase (es. viste SQL o RPC), mantenendo
// la stessa forma di dati in uscita.

import { Activity, BookingRecord, Center, DayAvailability } from "./types";
import { activities, activityDaysByActivity, bookingsMock, categories, centers } from "./mock-data";

export interface WeekOccupancy {
  label: string;
  capacity: number;
  spotsLeft: number;
  occupancyPercent: number; // 0-100
}

// Occupazione settimanale di una singola attività, ricavata dal calendario
// giorno-per-giorno (raggruppato in blocchi di 5 giorni feriali).
export function weeklyOccupancy(activityId: string): WeekOccupancy[] {
  const days = activityDaysByActivity[activityId] ?? [];
  return chunkIntoWeeks(days).map((week, i) => summarizeWeek(week, `Sett. ${i + 1}`));
}

// Come weeklyOccupancy, ma a partire da un elenco di giorni già disponibile
// (es. letto da Supabase) invece che dalla mappa mock.
export function weeklyOccupancyFromDays(days: DayAvailability[]): WeekOccupancy[] {
  return chunkIntoWeeks(days).map((week, i) => summarizeWeek(week, `Sett. ${i + 1}`));
}

// Occupazione settimanale aggregata su più attività (stesso indice di
// settimana sommato tra le attività) — utile per un centro con più attività
// o per la piattaforma nel suo complesso.
export function aggregateWeeklyOccupancy(activityIds: string[]): WeekOccupancy[] {
  const perActivity = activityIds.map((id) => chunkIntoWeeks(activityDaysByActivity[id] ?? []));
  const maxWeeks = Math.max(0, ...perActivity.map((w) => w.length));

  return Array.from({ length: maxWeeks }, (_, weekIndex) => {
    const combined = perActivity
      .map((weeks) => weeks[weekIndex])
      .filter((w): w is DayAvailability[] => Boolean(w))
      .flat();
    return summarizeWeek(combined, `Sett. ${weekIndex + 1}`);
  });
}

function chunkIntoWeeks(days: DayAvailability[]): DayAvailability[][] {
  const chunks: DayAvailability[][] = [];
  for (let i = 0; i < days.length; i += 5) chunks.push(days.slice(i, i + 5));
  return chunks;
}

function summarizeWeek(days: DayAvailability[], label: string): WeekOccupancy {
  const openDays = days.filter((d) => d.isOpen);
  const capacity = openDays.reduce((sum, d) => sum + d.capacity, 0);
  const spotsLeft = openDays.reduce((sum, d) => sum + d.spotsLeft, 0);
  const occupancyPercent = capacity > 0 ? Math.round(((capacity - spotsLeft) / capacity) * 100) : 0;
  return { label, capacity, spotsLeft, occupancyPercent };
}

// ─────────────────────────────────────────────
// Composizione clienti: tag attività ed età bambini
// ─────────────────────────────────────────────

export interface CategoryCount {
  categoryId: string;
  label: string;
  emoji: string;
  count: number;
}

// Conteggio prenotazioni per tag — un'attività può avere più tag (tagIds),
// quindi una prenotazione può contribuire a più di un tag nel grafico
// (non sono fette mutuamente esclusive, ma una "nuvola" di interessi).
export function tagBreakdown(bookings: BookingRecord[] = bookingsMock): CategoryCount[] {
  const active = bookings.filter((b) => b.status !== "cancelled");
  const counts = new Map<string, number>();

  for (const b of active) {
    const activity = activities.find((a) => a.id === b.activityId);
    if (!activity) continue;
    for (const tagId of activity.tagIds) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    }
  }

  return categories
    .map((c) => ({ categoryId: c.id, label: c.label, emoji: c.emoji, count: counts.get(c.id) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

export interface AgeBucketCount {
  bucket: string;
  count: number;
}

const AGE_BUCKETS: { bucket: string; min: number; max: number }[] = [
  { bucket: "6-8 anni", min: 6, max: 8 },
  { bucket: "9-11 anni", min: 9, max: 11 },
  { bucket: "12-14 anni", min: 12, max: 14 },
  { bucket: "15+ anni", min: 15, max: 999 },
];

export function ageBucketBreakdown(bookings: BookingRecord[] = bookingsMock): AgeBucketCount[] {
  const active = bookings.filter((b) => b.status !== "cancelled");
  return AGE_BUCKETS.map(({ bucket, min, max }) => ({
    bucket,
    count: active.filter((b) => b.kidAge >= min && b.kidAge <= max).length,
  })).filter((b) => b.count > 0);
}

// ─────────────────────────────────────────────
// Cross-selling tra centri vicini
// ─────────────────────────────────────────────

export interface CenterSuggestion {
  centerA: Center;
  centerB: Center;
  distanceKm: number;
  categoriesA: string[];
  categoriesB: string[];
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function centerCategories(center: Center, all: Activity[]): string[] {
  const tagIds = all.filter((a) => a.centerId === center.id).flatMap((a) => a.tagIds);
  return Array.from(new Set(tagIds));
}

// Suggerisce coppie di centri vicini con tag diversi (candidati per
// iniziative di cross-selling, es. navetta condivisa) entro una distanza
// massima (default 2 km). Se i due centri hanno esattamente lo stesso unico
// tag (quindi sono diretti concorrenti sulla stessa nicchia) li si scarta.
export function nearbyComplementaryCenters(maxDistanceKm = 2): CenterSuggestion[] {
  const suggestions: CenterSuggestion[] = [];

  for (let i = 0; i < centers.length; i++) {
    for (let j = i + 1; j < centers.length; j++) {
      const a = centers[i];
      const b = centers[j];
      const distanceKm = haversineDistanceKm(a.lat, a.lng, b.lat, b.lng);
      if (distanceKm > maxDistanceKm) continue;

      const categoriesA = centerCategories(a, activities);
      const categoriesB = centerCategories(b, activities);
      const isSameSingleTag =
        categoriesA.length === 1 && categoriesB.length === 1 && categoriesA[0] === categoriesB[0];
      if (isSameSingleTag) continue;

      suggestions.push({ centerA: a, centerB: b, distanceKm, categoriesA, categoriesB });
    }
  }

  return suggestions.sort((a, b) => a.distanceKm - b.distanceKm);
}
