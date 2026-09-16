import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSchoolCalendarsForAdmin } from "@/lib/data/school-calendar-admin";
import SchoolCalendarAdminClient from "./SchoolCalendarAdminClient";

// TRAMA — SCHOOL CALENDAR INTELLIGENCE (14/09/2026, §B11). Vista Admin
// MINIMA (stesso principio "view-only + form semplice, non un CMS" di
// app/admin/legal/page.tsx): vedere i calendari esistenti (regione, anno
// scolastico, fonte, stato bozza/pubblicato) ed inserire/correggere eventi.
// Protetta dal gate di ruolo già esistente in app/admin/layout.tsx
// (nessun controllo aggiuntivo necessario qui — stesso principio di ogni
// altra pagina /admin/*).
//
// NESSUN dato reale viene inserito da questa sessione (governance): questa
// pagina è pronta perché Fabrizio la usi quando avrà deciso quale
// Regione/Comune popolare per il pilota (vedi report finale, §STOP).
export default async function AdminSchoolCalendarPage() {
  if (!isSupabaseConfigured) {
    return (
      <div>
        <h1 className="mb-1 text-xl font-bold text-white">Calendari scolastici</h1>
        <div className="mt-4 rounded-lg border border-[#E8EBF0] bg-white p-4 text-sm text-ink-2">
          Supabase non configurato: nessun calendario reale da mostrare in questo ambiente.
        </div>
      </div>
    );
  }

  const calendars = await getSchoolCalendarsForAdmin();

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-white">Calendari scolastici</h1>
      <p className="mb-4 text-sm text-white/70">
        Dataset per School Calendar Intelligence (V1) — solo calendari pubblicati sono usati dal Planner dei genitori.
        Ogni evento è a livello di Regione (Comune vuoto nel form) oppure locale a un singolo Comune (campo Comune
        valorizzato) — un evento locale si applica solo ai bambini con lo stesso Comune impostato nel profilo scuola.
      </p>
      <SchoolCalendarAdminClient initialCalendars={calendars} />
    </div>
  );
}
