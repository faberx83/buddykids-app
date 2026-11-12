import Link from "next/link";
import { getWalkthroughAdminSummary, getWalkthroughRestartCount } from "@/lib/walkthrough/data";
import { computeWalkthroughFunnel } from "@/lib/walkthrough/funnel";
import { getFavoritesDemandSignal } from "@/lib/data/admin-favorites";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): "Analisi e crescita". Richiesta di
// Fabrizio: "Togli le dashboard con dati statici dal menu operativo …
// Preferiti in Analisi come segnale di domanda." Pagina di raccordo: porta
// alle viste con dati reali (Beta Famiglie e report, Preferiti, Radar) e
// tiene il funnel del walkthrough che prima stava nel Command Center
// (/admin/one, ora "Oggi"). Le dashboard su dati finti (Dashboard e Analisi
// di prima) restano raggiungibili da qui, etichettate "dimostrative".
// Il Lotto 2 (KPI su dati reali) parte da qui: vedi
// claude/INIZIATIVA_admin_operativo.md.
export default async function AdminCrescitaPage() {
  const [walkthroughSummary, restartCount, favorites] = await Promise.all([
    getWalkthroughAdminSummary("welcome_parent"),
    getWalkthroughRestartCount("welcome_parent"),
    getFavoritesDemandSignal().catch(() => null),
  ]);
  const funnel = computeWalkthroughFunnel(walkthroughSummary);
  const links: { href: string; title: string; text: string; real: boolean }[] = [
    { href: "/admin/beta", title: "Beta Famiglie", text: "Una riga per famiglia: attivazione, ritorno, frizioni, centri richiesti.", real: true },
    { href: "/admin/beta/report", title: "Report della beta", text: "Report per periodo, decisioni, impostazioni.", real: true },
    { href: "/admin/preferiti", title: "Preferiti — segnale di domanda", text: "Quali attività le famiglie salvano, anche senza richiedere.", real: true },
    { href: "/admin/radar", title: "Radar community", text: "Scoperte segnalate dalle famiglie.", real: true },
    { href: "/admin/analytics", title: "Analisi (dimostrativa)", text: "Grafici su dati di esempio; solo la tabella dei gestori è reale.", real: false },
    { href: "/admin/demo", title: "Dashboard (dimostrativa)", text: "La vecchia home Admin, su dati di esempio.", real: false },
    { href: "/admin/activities", title: "Attività (dimostrativa)", text: "Elenco su dati di esempio. Le attività vere si aprono dal centro.", real: false },
  ];
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Analisi e crescita</h1>
        <p className="mt-1 text-sm text-navy-text2">
          Viste su dati reali per capire uso e domanda. Le pagine &quot;dimostrative&quot; usano dati di esempio e non vanno
          lette come numeri della beta.
        </p>
      </div>

      <div className="mb-7 grid gap-2.5 md:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg border border-[#E8EBF0] bg-white px-4 py-3 no-underline hover:border-trama-violet">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              {l.title}
              {!l.real && <span className="rounded-full bg-[#FDEDEA] px-2 py-0.5 text-[10.5px] font-bold text-[#B23A2C]">dati di esempio</span>}
            </div>
            <div className="mt-0.5 text-xs text-ink-2">{l.text}</div>
          </Link>
        ))}
      </div>

      {favorites && favorites.length > 0 && (
        <div className="mb-7">
          <h2 className="mb-1 text-[15px] font-bold text-white">Domanda dai preferiti</h2>
          <p className="mb-2 text-xs text-navy-text2">Le 5 attività più salvate. Dettaglio completo in Preferiti.</p>
          <div className="overflow-hidden rounded-lg border border-[#E8EBF0] bg-white">
            {favorites.slice(0, 5).map((f) => (
              <div key={f.activityId} className="flex items-center justify-between border-b border-[#F0F2F5] px-4 py-2 text-[13px] last:border-0">
                <span className="truncate text-ink">{f.activityName}</span>
                <span className="text-xs text-ink-2">{f.favoritesCount} salvataggi · {f.bookingsCount} prenotazioni</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-1 text-[15px] font-bold text-white">
          Walkthrough &quot;Benvenuto in TRAMA ONE&quot; — avanzamento e funnel (Sprint 6, hardening)
        </h2>
        <p className="mb-2 text-xs text-navy-text2">
          &quot;Raggiunti&quot; = utenti arrivati almeno a questo step; &quot;Abbandono&quot; = persi rispetto allo step precedente.
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
                <tr className="text-left text-ink-2">
                  {["Step", "Raggiunti", "In corso", "Completato", "Saltato", "Abbandono vs step prec."].map((h) => (
                    <th key={h} className="border-b border-[#E8EBF0] px-3 py-1.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {funnel.map((s) => (
                  <tr key={s.key} className="text-ink">
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5">{s.title}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5">{s.reached}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5">{s.inProgress}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5">{s.completed}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5">{s.skipped}</td>
                    <td className="border-b border-[#F0F2F5] px-3 py-1.5">
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
