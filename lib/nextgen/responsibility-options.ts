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

// TRAMA BETA v1.1.1 (UI Refinement, punto 15 — "Mamma/Papà contestuale") —
// segnalazione: il selettore mostrava sempre "Partner" in modo generico,
// anche quando l'app conosce già il ruolo del genitore che sta guardando lo
// schermo (profiles.parent_role, "padre"/"madre"/"tutore" — già letto da
// app/nextgen/planner/page.tsx come profile.parentRole, ma mai passato più
// giù). ADAPT, non NEW: nessuna nuova opzione responsabile, nessuna
// modifica allo schema — riusiamo lo stesso valore tecnico "partner" già
// persistito (week_responsibilities.responsible resta invariato: "partner"
// in DB, qualunque sia l'etichetta mostrata), risolvendo dinamicamente solo
// la LABEL visibile. "import type" per ParentRole (da lib/data/profile.ts,
// che importa lib/supabase/server): il tipo viene eliminato a compile-time,
// stesso pattern già usato per SeasonWeek/KidOverlap altrove in questo
// modulo client-safe — nessun import server-only finisce nel bundle client.
//
// Nessuna inferenza da nome/avatar/sesso presunto/email (esplicitamente
// vietato dalla revisione): SOLO parent_role, esplicito nel profilo. Se il
// ruolo non è noto (profilo incompleto) o è "tutore", fallback a "Partner"
// (comportamento identico a prima).
import type { ParentRole } from "@/lib/data/profile";

export function resolveResponsibleOptions(
  parentRole: ParentRole | null
): { value: ResponsibleValue; emoji: string; label: string }[] {
  const partnerLabel = parentRole === "padre" ? "Mamma" : parentRole === "madre" ? "Papà" : "Partner";
  const partnerEmoji = parentRole === "padre" ? "👩" : parentRole === "madre" ? "👨" : "❤️";
  return RESPONSIBLE_OPTIONS.map((opt) =>
    opt.value === "partner" ? { ...opt, label: partnerLabel, emoji: partnerEmoji } : opt
  );
}
