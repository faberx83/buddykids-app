// TRAMA — Calendar Export V1 (11/09/2026, richiesta di Fabrizio: "CALENDAR
// EXPORT · INTERNAL PREVIEW"). Query + wrapper sottile attorno alla logica
// PURA in ./calendar-items-core.ts (stesso motivo di separazione già
// seguito per lib/checkin/action-token.ts/action-token-core.ts — vedi
// commento in cima a quel file). Questo modulo fa SOLO I/O: legge Supabase,
// passa le righe grezze al mapper puro.
//
// PERCHÉ UNA QUERY DEDICATA invece di estendere getMyBookingsForParent()
// (lib/data/my-bookings.ts): quella funzione ha molti consumer esistenti
// ("Le mie prenotazioni", Planner Overview/Calendario) ed espone
// deliberatamente TUTTI i giorni/settimane richiesti (anche pending/
// rifiutati/in lista d'attesa: la sua UI li deve mostrare comunque, solo
// con badge di stato diverso) più campi di gestione prenotazione (modifica/
// annulla) non pertinenti qui. Calendar Export ha una regola di filtro
// diversa e più stretta ("NON esportare come impegno confermato qualcosa
// che il dominio considera realmente rifiutato/non valido" — §2 della
// spec): estendere quella funzione avrebbe richiesto o un parametro che ne
// cambia il comportamento per un solo consumer, o esporre un nuovo campo
// "solo giorni accettati" mai usato dagli altri consumer. Una query
// separata, minima (solo i campi che servono a un evento calendario), è
// più semplice da leggere e verificare in isolamento, e non rischia di
// alterare il comportamento di "Le mie prenotazioni" per un cambiamento
// pensato per un'altra feature — stesso principio di isolamento già seguito
// altrove in questo codebase (vedi CAPABILITY_ISOLATION_STANDARD.md).

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapBookingRowsToPlannerCalendarItems, RawBookingRow, PlannerCalendarItem } from "./calendar-items-core";

export type { PlannerCalendarItem, PlannerCalendarItemSource } from "./calendar-items-core";

export async function getPlannerCalendarItemsForParent(): Promise<PlannerCalendarItem[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, partner_decision, activities ( name, centers ( name, city, address ) ), booking_weeks ( activity_weeks ( id, start_date, end_date ) ), booking_days ( partner_decision, activity_days ( date ) ), booking_kids ( kids ( name ) )"
    )
    .eq("parent_id", user.id)
    // Un impegno cancellato non è mai un impegno reale, a prescindere dalla
    // risposta del centro — getMyBookingsForParent() (lib/data/my-bookings.ts)
    // NON applica questo filtro perché "Le mie prenotazioni" deve mostrare
    // anche le prenotazioni cancellate (storico); Calendar Export non deve
    // esportarle mai.
    .neq("status", "cancelled");

  if (error || !data) return [];

  return mapBookingRowsToPlannerCalendarItems(data as RawBookingRow[]);
}
