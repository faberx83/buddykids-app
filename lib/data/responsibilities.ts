// SPRINT 5.3 (NEXTGEN) — "Chi fa cosa?" (idea di Fabrizio): non un'ennesima
// lista di attività, ma la vista di CHI è responsabile del ritiro/
// accompagnamento per ciascun bambino in una settimana. Versione LEGGERA,
// esplicitamente richiesta da Fabrizio: un'etichetta libera (Io/Partner/
// Nonno/Nonna/Tata/Altro), SENZA il sistema multi-genitore vero (quello è la
// fase dedicata 5.5, più rischiosa). Chiave (kid_id, week_start_date) — la
// stessa convenzione di profiles.dismissed_weeks (SeasonWeek.startDate).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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

interface RawResponsibilityRow {
  kid_id: string;
  week_start_date: string;
  responsible: string;
  responsible_label: string | null;
}

// Tutte le assegnazioni della stagione per il genitore loggato — dataset
// piccolo (bambini x settimane coperte), nessun filtro per periodo: la UI
// (PlannerCalendarView) cerca localmente per (kidId, weekStartDate).
export async function getResponsibilitiesForParent(): Promise<WeekResponsibility[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("week_responsibilities")
    .select("kid_id, week_start_date, responsible, responsible_label")
    .eq("parent_id", user.id);

  if (error || !data) return [];

  return (data as RawResponsibilityRow[]).map((r) => ({
    kidId: r.kid_id,
    weekStartDate: r.week_start_date,
    responsible: r.responsible as ResponsibleValue,
    responsibleLabel: r.responsible_label,
  }));
}
