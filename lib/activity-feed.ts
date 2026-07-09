// "Attività recente" della Dashboard Partner (handoff redesign 6a): un feed
// cronologico unico che unisce eventi di natura diversa — settimane deboli,
// richieste gruppo, prenotazioni, promozioni — ordinati per data decrescente.
// Non esiste ancora nel codebase un'unione di questo tipo: prima ogni fonte
// dati viveva nella propria card separata.

import { WeekOccupancy } from "@/lib/analytics";
import { BookingRecord, GroupRequestItem, Promotion } from "@/lib/types";

export interface ActivityFeedItem {
  id: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  text: string;
  relativeLabel: string;
}

function relativeTimeIt(date: Date, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return diffMin <= 1 ? "adesso" : `${diffMin} minuti fa`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} or${diffH === 1 ? "a" : "e"} fa`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "ieri";
  if (diffD < 7) return `${diffD} giorni fa`;
  const diffW = Math.round(diffD / 7);
  return `${diffW} settiman${diffW === 1 ? "a" : "e"} fa`;
}

export function buildActivityFeed({
  weakWeeks,
  groupRequests,
  bookings,
  promotions,
  now = new Date(),
  limit = 6,
}: {
  weakWeeks: WeekOccupancy[];
  groupRequests: GroupRequestItem[];
  bookings: BookingRecord[];
  promotions: Promotion[];
  now?: Date;
  limit?: number;
}): ActivityFeedItem[] {
  const timestamped: { id: string; icon: string; iconBg: string; iconColor: string; text: string; timestamp: Date }[] = [];

  // Le settimane deboli non hanno un timestamp reale (l'occupazione non è
  // "loggata" nel tempo): usiamo un orario sintetico solo per intercalarle
  // in modo plausibile con gli altri eventi nel feed.
  weakWeeks.forEach((w, i) => {
    timestamped.push({
      id: `weak-${w.label}`,
      icon: "ti-bolt",
      iconBg: "#FFF0EA",
      iconColor: "#d4622a",
      text: `${w.label} sotto il 40%`,
      timestamp: new Date(now.getTime() - (i + 1) * 3 * 60 * 60 * 1000),
    });
  });

  groupRequests
    .filter((r) => r.status === "pending")
    .forEach((r) => {
      timestamped.push({
        id: `group-${r.id}`,
        icon: "ti-users-group",
        iconBg: "#E3F5F1",
        iconColor: "#1FA88E",
        text: `Richiesta gruppo — ${r.groupName}`,
        timestamp: new Date(r.createdAt),
      });
    });

  bookings
    .filter((b) => b.status !== "cancelled")
    .forEach((b) => {
      timestamped.push({
        id: `booking-${b.id}`,
        icon: "ti-ticket",
        iconBg: "#E8F9EE",
        iconColor: "#52C87A",
        text: `Prenotazione — ${b.kidName}`,
        timestamp: new Date(b.createdAt),
      });
    });

  // Le promozioni non hanno ancora una data di attivazione reale in questo
  // modello dati (manca un campo "activated_at") — orario sintetico, solo
  // per dare loro una posizione plausibile nel feed.
  promotions
    .filter((p) => p.active)
    .forEach((p, i) => {
      timestamped.push({
        id: `promo-${p.id}`,
        icon: "ti-discount-2",
        iconBg: "#F0EEFF",
        iconColor: "#8B7CF8",
        text: `Promo "${p.label}" attiva`,
        timestamp: new Date(now.getTime() - (i + 2) * 24 * 60 * 60 * 1000),
      });
    });

  return timestamped
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit)
    .map(({ timestamp, ...rest }) => ({ ...rest, relativeLabel: relativeTimeIt(timestamp, now) }));
}
