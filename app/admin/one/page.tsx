import Link from "next/link";
import { getWalkthroughAdminSummary, getWalkthroughRestartCount } from "@/lib/walkthrough/data";
import { computeWalkthroughFunnel } from "@/lib/walkthrough/funnel";
import { getCommandCenterQueues, summarizeCommandCenterQueues } from "@/lib/data/command-center";
import { QueuePriority } from "@/lib/command-center/priority";

// Dipende dal ruolo dell'utente loggato (visibilità aggregata solo per
// platform_admin, applicata dalla RLS di tutorial_progress/onboarding/ecc.)
// — stessa motivazione delle altre pagine /one già forzate a dynamic.
export const dynamic = "force-dynamic";

// TRAMA ONE Build Sprint 6 (E08, ACR-001/008/015, DEC-51) — Command Center
// Admin: prima di questo sprint questa pagina era solo un placeholder con
// due link ("command center completo resta Sprint 6, fuori scope" — vedi
// git history). Ora aggrega le code operative già esistenti nei sette
// domini Admin (onboarding, prenotazioni, richieste, centri-lead,
// certificazioni, segnalazioni BETA, feature flag) in un'unica vista
// prioritizzata (lib/data/command-center.ts) — nessuna delle pagine per
// dominio viene toccata o sostituita, restano l'unico posto dove l'Admin
// AGISCE davvero (Separation of duties, Handbook Admin 1.1 §1.2): questa
// pagina è solo un punto di ingresso più rapido con priorità già calcolata.
//
// CONTROLLED BETA EXPERIENCE GATE (§4-6, restyle prima del wiring/DEC-58) —
// era la route con il gap visivo più ampio dell'inventario (§4ter del Route
// Release Matrix): interamente in `style={{}}` inline, colori hardcoded per
// priorità (#FDECEA/#C0392B/#FFF6E5/#B7791F/#EAF7EE/#2E7D46), `<h1>` di
// sistema, nessuna classe Tailwind/token, nessun breakpoint responsive. Ora
// diventerà `PRIMARY_NAV` (§6.3): non è accettabile restare così. Sostituiti
// tutti gli inline style con classi Tailwind — stessa palette badge già in
// uso in `FeatureFlagsAdminClient.tsx`/`RichiesteClient.tsx`
// (bg-green-light/text-[#2d8f52], bg-orange-light/text-trama-orange,
// bg-[#FBEAEA]/text-[#C0392B]) invece di inventarne una nuova, h1 bianco +
// sottotitolo `text-navy-text2` (convenzione admin già stabilita: il
// container di `DashboardLayout` per `variant="admin"` ha sfondo
// `bg-navy` scuro, vedi `components/dashboard/DashboardLayout.tsx` riga 237).
// Rimosso il `<main style={{padding:24}}>`: `DashboardLayout` applica già
// `p-5 md:p-8` responsive al suo `<main>`. Aggiunto uno stato vuoto esplicito
// per code/funnel (prima: tabella/lista vuota senza spiegazione). Nessun
// cambio ai testi che i test verificano (label delle code, riga di sintesi,
// titolo del funnel) — solo alla presentazione, vedi tests/one/command-center.spec.ts.
const PRIORITY_LABEL: Record<QueuePriority, string> = { alta: "Alta", media: "Media", bassa: "Bassa" };
const PRIORITY_CLASS: Record<QueuePriority, string> = {
  alta: "bg-[#FBEAEA] text-[#C0392B]",
  media: "bg-orange-light text-trama-orange",
  bassa: "bg-green-light text-[#2d8f52]",
};

export default async function OneAdminPage() {
  const [queues, walkthroughSummary, restartCount] = await Promise.all([
    getCommandCenterQueues(),
    getWalkthroughAdminSummary("welcome_parent"),
    getWalkthroughRestartCount("welcome_parent"),
  ]);
  const summary = summarizeCommandCenterQueues(queues);
  const funnel = computeWalkthroughFunnel(walkthroughSummary);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">TRAMA ONE — Admin</h1>
        <p className="mt-1 text-sm text-navy-text2">
          Command Center: {summary.totalOpen} elementi in sospeso su tutte le code
          {summary.criticalQueueCount > 0
            ? `, ${summary.criticalQueueCount} coda${summary.criticalQueueCount === 1 ? "" : "e"} in priorità alta`
            : ""}
          .
        </p>
      </div>

      {queues.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-3 p-6 text-center">
          <p className="text-sm text-navy-text2">Nessuna coda operativa configurata.</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {queues.map((q) => {
            const badgeClass = PRIORITY_CLASS[q.priority];
            return (
              <Link
                key={q.key}
                href={q.href}
                className="flex flex-col gap-2 rounded-lg border border-[#E8EBF0] bg-white px-4 py-3 no-underline transition-colors hover:border-trama-violet sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-ink">{q.label}</div>
                  {q.detail && <div className="mt-0.5 text-xs text-ink-2">{q.detail}</div>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}>
                    {PRIORITY_LABEL[q.priority]}
                  </span>
                  <span className="min-w-[28px] text-right text-lg font-bold text-ink">{q.count}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-7">
        <h2 className="mb-1 text-[15px] font-bold text-white">
          Walkthrough &quot;Benvenuto in TRAMA ONE&quot; — avanzamento e funnel (Sprint 6, hardening)
        </h2>
        <p className="mb-2 text-xs text-navy-text2">
          &quot;Raggiunti&quot; = utenti arrivati almeno a questo step; &quot;Abbandono&quot; = persi rispetto allo
          step precedente (in corso, completato o saltato ma senza mai proseguire).
          {restartCount !== null
            ? ` Percorso ricominciato ${restartCount} volt${restartCount === 1 ? "a" : "e"} in totale.`
            : " Conteggio riavvii non disponibile (richiede migration_20_product_events.sql applicata)."}
        </p>
        {funnel.length === 0 ? (
          <div className="rounded-lg border border-dashed border-navy-3 p-6 text-center">
            <p className="text-sm text-navy-text2">Nessun dato di funnel disponibile.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="border-b border-[#E8EBF0] px-3 py-1.5 text-left font-semibold text-ink-2">Step</th>
                  <th className="border-b border-[#E8EBF0] px-3 py-1.5 text-left font-semibold text-ink-2">
                    Raggiunti
                  </th>
                  <th className="border-b border-[#E8EBF0] px-3 py-1.5 text-left font-semibold text-ink-2">
                    In corso
                  </th>
                  <th className="border-b border-[#E8EBF0] px-3 py-1.5 text-left font-semibold text-ink-2">
                    Completato
                  </th>
                  <th className="border-b border-[#E8EBF0] px-3 py-1.5 text-left font-semibold text-ink-2">
                    Saltato
                  </th>
                  <th className="border-b border-[#E8EBF0] px-3 py-1.5 text-left font-semibold text-ink-2">
                    Abbandono vs step prec.
                  </th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((s) => (
                  <tr key={s.key}>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5 text-ink">{s.title}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5 text-ink">{s.reached}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5 text-ink">{s.inProgress}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5 text-ink">{s.completed}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5 text-ink">{s.skipped}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5 text-ink">
                      {s.dropOffFromPrevious === null ? "—" : `${s.dropOffFromPrevious} (${s.dropOffRatePercent}%)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
