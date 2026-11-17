import Link from "next/link";
import { getAdminBookings, getTestAccountIds } from "@/lib/data/admin-ops";
import {
  ACTOR_LABEL,
  BOOKING_STATE_LABEL,
  DEFAULT_BOOKING_FILTERS,
  bookingFiltersQuery,
  bookingsHref,
  filterAdminBookings,
  paginate,
  parseBookingFilters,
  romeTodayIso,
  sortAdminBookings,
  viewAdminBooking,
  type BookingStateKey,
} from "@/lib/admin-ops/bookings";
import { formatEuro } from "@/lib/nextgen/activity-price";
import { countOf } from "@/lib/admin-ops/text";

export const dynamic = "force-dynamic";

// TRAMA ONE Build Sprint 4 (DEC-42, ACR-007/ACR-022) — elenco reale da
// public.bookings (prima lib/mock-data.ts).
//
// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "In
// Prenotazioni aggiungi ricerca per riferimento e filtri per centro,
// attività, data di partecipazione e stato … Ogni riga deve aprire un
// dettaglio con link interno stabile … Usa filtri URL persistenti, così
// tornando dal dettaglio si ritrova lo stesso elenco." Tutti i filtri sono
// nella query string (form GET, nessuno stato nel browser): il tasto
// indietro e il link "Torna all'elenco" del dettaglio riportano qui con gli
// stessi filtri e la stessa pagina. Stato, filtri e conteggi da
// lib/admin-ops/bookings.ts: la card "Prenotazioni in attesa" di Oggi apre
// ?stato=da_rispondere e conta le stesse righe. Lettura dietro il controllo
// platform_admin (lib/data/admin-ops.ts). I centri e le attività di prova
// sono nascosti di default ("Mostra anche le prove").
type SP = Promise<Record<string, string | string[] | undefined>>;

const STATE_CLASS: Record<BookingStateKey, string> = {
  da_rispondere: "bg-orange-light text-trama-orange",
  confermata: "bg-green-light text-[#2d8f52]",
  parziale: "bg-[#F0EEFF] text-[#6F63C5]",
  proposta: "bg-sky-light text-sky",
  rifiutata: "bg-bg text-ink-3",
  annullata: "bg-bg text-ink-3",
};

function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function AdminBookingsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = parseBookingFilters(sp);
  const today = romeTodayIso();
  const rows = await getAdminBookings();
  // 17/11/2026: anche le prenotazioni degli account di prova sono "prova".
  const testAccounts = await getTestAccountIds();
  const views = rows.map((r) => viewAdminBooking(r, today, testAccounts));
  const filtered = sortAdminBookings(filterAdminBookings(views, f));
  const page = paginate(filtered, f.pagina);
  const scope = views.filter((v) => f.demo || !v.isDemo);
  const hiddenDemo = views.length - scope.length;

  // Opzioni dei filtri dalle stesse righe (rispettando "prove sì/no").
  const centers = [...new Map(scope.filter((v) => v.row.centerId).map((v) => [v.row.centerId as string, v.row.centerName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const activities = [
    ...new Map(
      scope.filter((v) => v.row.activityId && (!f.centro || v.row.centerId === f.centro)).map((v) => [v.row.activityId as string, v.row.activityName])
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  // SLA per centro, dalle stesse viste (stessa regola "da rispondere").
  const byCenter = new Map<string, { name: string; total: number; pending: number; imminent: number; oldest: number | null }>();
  for (const v of scope) {
    if (!v.row.centerId || v.row.status === "cancelled") continue;
    const c = byCenter.get(v.row.centerId) ?? { name: v.row.centerName, total: 0, pending: 0, imminent: 0, oldest: null };
    c.total += 1;
    if (v.state === "da_rispondere") {
      c.pending += 1;
      c.oldest = Math.max(c.oldest ?? 0, v.ageDays);
      if (v.imminent) c.imminent += 1;
    }
    byCenter.set(v.row.centerId, c);
  }
  const slaRows = [...byCenter.entries()].sort((a, b) => b[1].pending - a[1].pending || b[1].total - a[1].total);
  const pendingCount = filterAdminBookings(views, { ...DEFAULT_BOOKING_FILTERS, stato: "da_rispondere", demo: f.demo }).length;
  const imminentCount = filterAdminBookings(views, { ...DEFAULT_BOOKING_FILTERS, stato: "da_rispondere", imminenti: true, demo: f.demo }).length;
  const backQuery = encodeURIComponent(bookingFiltersQuery(f));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Prenotazioni</h1>
        <p className="text-sm text-navy-text2">
          Tutte le prenotazioni su tutti i centri. Cerca per riferimento (es. #370F7E44), famiglia, bambino o attività.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Link href={bookingsHref({ stato: "da_rispondere", demo: f.demo })} className="rounded-lg border border-[#E8EBF0] bg-white p-4 no-underline hover:border-trama-violet">
          <div className="text-xl font-bold text-ink">{pendingCount}</div>
          <div className="text-xs text-ink-2">In attesa di risposta (piattaforma)</div>
        </Link>
        <Link href={bookingsHref({ stato: "da_rispondere", imminenti: true, demo: f.demo })} className="rounded-lg border border-[#E8EBF0] bg-white p-4 no-underline hover:border-trama-violet">
          <div className={`text-xl font-bold ${imminentCount > 0 ? "text-[#C0392B]" : "text-ink"}`}>{imminentCount}</div>
          <div className="text-xs text-ink-2">Con una data entro 7 giorni</div>
        </Link>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="text-xl font-bold text-ink">{byCenter.size}</div>
          <div className="text-xs text-ink-2">Centri con prenotazioni</div>
        </div>
      </div>

      <form method="get" action="/admin/bookings" className="mb-4 grid gap-2 rounded-lg border border-[#E8EBF0] bg-white p-3 text-sm md:grid-cols-6" role="search">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[11px] font-semibold text-ink-2">Cerca</span>
          <input name="q" defaultValue={f.q} placeholder="#riferimento, famiglia, bambino…" className="rounded-md border border-[#E3E6EC] px-2.5 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-2">Centro</span>
          <select name="centro" defaultValue={f.centro} className="rounded-md border border-[#E3E6EC] px-2 py-1.5">
            <option value="">Tutti</option>
            {centers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-2">Attività</span>
          <select name="attivita" defaultValue={f.attivita} className="rounded-md border border-[#E3E6EC] px-2 py-1.5">
            <option value="">Tutte</option>
            {activities.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-2">Data di partecipazione</span>
          <input type="date" name="data" defaultValue={f.data} className="rounded-md border border-[#E3E6EC] px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-ink-2">Stato</span>
          <select name="stato" defaultValue={f.stato} className="rounded-md border border-[#E3E6EC] px-2 py-1.5">
            <option value="tutte">Tutti</option>
            {(Object.keys(BOOKING_STATE_LABEL) as BookingStateKey[]).map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-4 md:col-span-6">
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" name="imminenti" value="1" defaultChecked={f.imminenti} /> Solo date entro 7 giorni senza risposta
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" name="demo" value="1" defaultChecked={f.demo} /> Mostra anche le prove
          </label>
          <button type="submit" className="rounded-md bg-trama-primary px-3 py-1.5 text-xs font-bold text-white">
            Filtra
          </button>
          <Link href="/admin/bookings" className="text-xs font-semibold text-sky">
            Azzera filtri
          </Link>
        </div>
      </form>

      <div className="mb-2 text-xs text-navy-text2" data-testid="bookings-count">
        {filtered.length} {filtered.length === 1 ? "prenotazione" : "prenotazioni"}
        {!f.demo && hiddenDemo > 0 ? ` · ${hiddenDemo} di prova nascoste` : ""}
      </div>

      <div className="mb-3 overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-3 py-2.5 font-medium">Rif.</th>
              <th className="px-3 py-2.5 font-medium">Famiglia e bambini</th>
              <th className="px-3 py-2.5 font-medium">Centro · attività</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Stato</th>
              <th className="px-3 py-2.5 font-medium">Chi deve agire</th>
              <th className="px-3 py-2.5 font-medium">Importo richiesto</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((v) => {
              const href = `/admin/bookings/${v.row.id}?da=${backQuery}`;
              return (
                <tr key={v.row.id} className="border-b border-[#F0F2F5] align-top last:border-0 hover:bg-bg">
                  <td className="px-3 py-2.5">
                    <Link href={href} className="font-mono text-xs font-semibold text-sky">
                      {v.ref}
                    </Link>
                    {v.isDemo && <span className="ml-1 rounded bg-[#EEF0F4] px-1 text-[10px] text-[#6B7280]">prova</span>}
                  </td>
                  <td className="px-3 py-2.5 text-ink">
                    <Link href={href} className="text-ink no-underline hover:underline">
                      {v.row.parentName}
                    </Link>
                    <span className="block text-xs text-ink-2">{v.row.kidNames.join(", ") || "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">
                    <span className="block text-ink">{v.row.centerName}</span>
                    <span className="block text-xs">{v.row.activityName}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">
                    {v.dates.length === 0 ? "—" : v.dates.length === 1 ? shortDate(v.dates[0]) : `${shortDate(v.dates[0])} → ${shortDate(v.dates[v.dates.length - 1])} (${v.row.days.length > 0 ? `${v.dates.length} giorni` : `${v.row.weeks.length} sett.`})`}
                    {v.imminent && <span className="block font-semibold text-[#C0392B]">prima data tra {v.dueInDays} gg</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATE_CLASS[v.state]}`}>{BOOKING_STATE_LABEL[v.state]}</span>
                    <span className="block pt-1 text-[11px] text-ink-2">da {v.ageDays} gg</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-ink-2">
                    {v.actor ? <span className="font-semibold text-ink">{ACTOR_LABEL[v.actor]}</span> : "—"}
                    {v.nextStep && <span className="block">{v.nextStep}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-ink">{formatEuro(v.row.totalAmount)}</td>
                </tr>
              );
            })}
            {page.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-ink-2">
                  Nessuna prenotazione con questi filtri.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {page.pages > 1 && (
        <nav className="mb-6 flex items-center gap-3 text-xs text-navy-text2" aria-label="Pagine">
          {page.page > 1 && (
            <Link href={bookingsHref({ ...f, pagina: page.page - 1 })} className="font-semibold text-white underline">
              ← Precedente
            </Link>
          )}
          <span>
            Pagina {page.page} di {page.pages}
          </span>
          {page.page < page.pages && (
            <Link href={bookingsHref({ ...f, pagina: page.page + 1 })} className="font-semibold text-white underline">
              Successiva →
            </Link>
          )}
        </nav>
      )}

      <p className="mb-6 text-[11px] text-navy-text2">
        L&apos;importo è quello richiesto dalla famiglia al centro (al netto degli sconti). Nella beta non ci sono pagamenti:
        non è un incasso, né del centro né di TRAMA.
      </p>

      {slaRows.length > 0 && (
        <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">SLA per centro</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                  <th className="px-4 py-3 font-medium">Centro</th>
                  <th className="px-4 py-3 font-medium">Totale</th>
                  <th className="px-4 py-3 font-medium">In attesa</th>
                  <th className="px-4 py-3 font-medium">Date entro 7 giorni</th>
                  <th className="px-4 py-3 font-medium">In attesa più vecchia</th>
                </tr>
              </thead>
              <tbody>
                {slaRows.map(([id, c]) => (
                  <tr key={id} className="border-b border-[#F0F2F5] last:border-0">
                    <td className="px-4 py-3">
                      <Link href={bookingsHref({ centro: id, demo: f.demo })} className="font-semibold text-ink no-underline hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{c.total}</td>
                    <td className="px-4 py-3">
                      {c.pending > 0 ? (
                        <Link href={bookingsHref({ centro: id, stato: "da_rispondere", demo: f.demo })} className="rounded-full bg-orange-light px-2.5 py-1 text-xs font-semibold text-trama-orange no-underline">
                          {c.pending} in attesa
                        </Link>
                      ) : (
                        <span className="text-ink-2">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-2">{c.imminent}</td>
                    <td className="px-4 py-3 text-ink-2">{c.oldest === null ? "—" : c.oldest >= 1 ? countOf(c.oldest, "giorno", "giorni") : "meno di 1 giorno"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
