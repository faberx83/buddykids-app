import PageHeader from "@/components/PageHeader";
import AttendanceTrendChart from "@/components/charts/AttendanceTrendChart";
import { getAttendanceReportForParent } from "@/lib/data/attendance-report";

// "Le presenze" (richiesto da Fabrizio insieme all'auto-hide del banner di
// check-in in Home): versione per il GENITORE del Report presenze già
// esistente lato Gestore (vedi app/center/report-presenze/page.tsx), ma
// "opportunamente rivisto" — niente tasso per attività dell'intero centro né
// "ritardatari abituali" (quella lista serve al gestore per contattare ALTRE
// famiglie: qui il genitore vede solo l'andamento dei propri figli). Sezione
// a sé in Profilo, separata da "Le mie prenotazioni" — le prenotazioni sono
// il PIANO futuro, le presenze sono lo STORICO di cosa è successo davvero.
export default async function PresenzePage() {
  const report = await getAttendanceReportForParent();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Le presenze" backHref="/profile" />
      <div className="px-5 pt-4">
        <p className="mb-4 text-xs text-ink-2">
          Storico di presenze, ritardi e assenze segnalati per i tuoi bambini — dal check-in in
          Home o dal registro del centro.
        </p>

        {!report.hasPastData && (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Nessun giorno di camp è ancora trascorso: qui vedrai lo storico man mano che passano i
            giorni delle settimane prenotate.
          </p>
        )}

        {report.hasPastData && (
          <>
            <div className="mb-4 rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <span className="text-sm font-bold text-ink">Andamento nel tempo</span>
              <p className="mb-2 mt-1 text-xs text-ink-2">
                Presenti, in ritardo e assenti per ciascun giorno già trascorso, su tutti i tuoi
                bambini.
              </p>
              <AttendanceTrendChart data={report.byDate} />
            </div>

            <div className="rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="border-b border-[#F0F2F5] px-4 py-3.5">
                <span className="text-[13.5px] font-bold text-ink">Riepilogo per bambino</span>
              </div>
              <div className="divide-y divide-[#F0F2F5]">
                {report.byKid.map((kid) => (
                  <div key={kid.kidId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{kid.kidName}</div>
                      <div className="text-xs text-ink-2">
                        {kid.totale} {kid.totale === 1 ? "giorno" : "giorni"} di camp trascorsi ·{" "}
                        {kid.presenzaRate}% presenza
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold">
                      <span className="rounded-full bg-partner/15 px-2.5 py-1 text-partner">
                        {kid.presente} presente
                      </span>
                      {kid.inRitardo > 0 && (
                        <span className="rounded-full bg-trama-orange/15 px-2.5 py-1 text-trama-orange">
                          {kid.inRitardo} ritardo
                        </span>
                      )}
                      {kid.assente > 0 && (
                        <span className="rounded-full bg-[#FBEAEA] px-2.5 py-1 text-[#C0392B]">
                          {kid.assente} assenze
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="h-4" />
    </div>
  );
}
