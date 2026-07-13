// SPRINT 5.3 (NEXTGEN) — tipi/costanti "Chi fa cosa?" estratti da
// lib/data/responsibilities.ts in un modulo SENZA import server-only: stesso
// motivo di lib/nextgen/address-kinds.ts — PlannerCalendarView.tsx ("use
// client") importava RESPONSIBLE_OPTIONS (una costante, non solo un tipo)
// direttamente da lib/data/responsibilities.ts, che importa
// lib/supabase/server (next/headers), facendo fallire la build Next.js con
// lo stesso errore visto per gli Indirizzi. lib/data/responsibilities.ts ora
// importa da qui e ri-esporta, il codice server-side resta invariato.

export type ResponsibleValue = "io" | "partner" | "nonno" | "nonna" | "tata" | "altro";

export const RESPONSIBLE_OPTIONS: { value: ResponsibleValue; emoji: string; label: string }[] = [
  { value: "io", emoji: "🧑", label: "Io" },
  { value: "partner", emoji: "❤️", label: "Partner" },
  { value: "nonno", emoji: "👴", label: "Nonno" },
  { value: "nonna", emoji: "👵", label: "Nonna" },
  { value: "tata", emoji: "🧑‍🍼", label: "Tata" },
  { value: "altro", emoji: "✏️", label: "Altro" },
];

// SPRINT CORRETTIVO (feedback di Fabrizio: "non è detto che sia sempre la
// stessa persona a gestire") — granularità per singolo giorno feriale e
// momento (andata/ritorno), invece di un'unica assegnazione per l'intera
// settimana: persone diverse possono alternarsi nella stessa settimana.
export type Weekday = "lun" | "mar" | "mer" | "gio" | "ven";

export const WEEKDAYS: { value: Weekday; label: string; dayOffset: number }[] = [
  { value: "lun", label: "Lun", dayOffset: 0 },
  { value: "mar", label: "Mar", dayOffset: 1 },
  { value: "mer", label: "Mer", dayOffset: 2 },
  { value: "gio", label: "Gio", dayOffset: 3 },
  { value: "ven", label: "Ven", dayOffset: 4 },
];

export type Moment = "andata" | "ritorno";

export const MOMENTS: { value: Moment; label: string; icon: string }[] = [
  { value: "andata", label: "Andata", icon: "ti-arrow-right" },
  { value: "ritorno", label: "Ritorno", icon: "ti-arrow-left" },
];

export interface WeekResponsibility {
  kidId: string;
  weekStartDate: string;
  weekday: Weekday;
  moment: Moment;
  responsible: ResponsibleValue;
  responsibleLabel: string | null; // solo per responsible="altro"
}
