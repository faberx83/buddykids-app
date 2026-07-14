import AttendanceTrendChart from "@/components/charts/AttendanceTrendChart";
import AttendanceRateByActivityChart from "@/components/charts/AttendanceRateByActivityChart";
import { getAttendanceReportForCenter } from "@/lib/data/attendance-report";

// Report grafico presenze (richiesto da Fabrizio, oltre al Registro presenze
// giorno-per-giorno): andamento nel tempo, tasso assenza/ritardo per
// attività, elenco "ritardatari abituali" — vedi lib/data/attendance-report.ts.
export default async function ReportPresenzePage() {
  const report = await getAttendanceReportForCenter();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Report presenze</h1>
        <p className="text-sm text-ink-2">
          Andamento storico, confronto tra attività e famiglie da contattare — il Registro
          presenze resta il posto per segnare/correggere il singolo giorno.
        </p>
      </div>

      {!report.hasPastData && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Nessun giorno di camp è ancora trascorso: il report si popola man mano che passano i
          giorni delle settimane prenotate.
        </div>
      )}

      <div className="mb-4 rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="text-sm font-bold text-ink">Andamento nel tempo</span>
        <p className="mb-2 mt-1 text-xs text-ink-2">
          Presenti, in ritardo e assenti per ciascun giorno già trascorso, su tutte le attività del
          centro.
        </p>
        <AttendanceTrendChart data={report.byDate} />
      </div>

      <div className="mb-4 rounded-[14px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <span className="text-sm font-bold text-ink">Tasso assenza/ritardo per attività</span>
        <p className="mb-2 mt-1 text-xs text-ink-2">
          Percentuale di giorni segnati in ritardo o assente, per capire quale attività ha più
          problemi di frequenza.
        </p>
        <AttendanceRateByActivityChart data={report.byActivity} />
      </div>

      <div className="rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#F0F2F5] px-4 py-3.5">
          <span className="text-[13.5px] font-bold text-ink">Ritardatari abituali</span>
          <p className="mt-1 text-xs text-ink-2">
            Bambini con almeno 2 giorni segnati in ritardo o assente — utile per contattare la
            famiglia prima che diventi un&apos;abitudine.
          </p>
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {report.topIssues.map((kid) => (
            <div key={kid.kidId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{kid.kidName}</div>
                <div className="text-xs text-ink-2">
                  {kid.activityNames.join(", ")} · {kid.parentName}
                  {kid.parentEmail && ` · ${kid.parentEmail}`}
                  {kid.parentPhone && ` · ${kid.parentPhone}`}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-semibold">
                {kid.inRitardoCount > 0 && (
                  <span className="rounded-full bg-trama-orange/15 px-2.5 py-1 text-trama-orange">
                    {kid.inRitardoCount} in ritardo
                  </span>
                )}
                {kid.assenteCount > 0 && (
                  <span className="rounded-full bg-[#FBEAEA] px-2.5 py-1 text-[#C0392B]">
                    {kid.assenteCount} assenze
                  </span>
                )}
              </div>
            </div>
          ))}
          {report.topIssues.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Nessuna famiglia con ritardi/assenze ricorrenti al momento.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
