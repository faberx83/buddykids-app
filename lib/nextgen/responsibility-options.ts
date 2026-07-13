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

export interface WeekResponsibility {
  kidId: string;
  weekStartDate: string;
  responsible: ResponsibleValue;
  responsibleLabel: string | null; // solo per responsible="altro"
}
