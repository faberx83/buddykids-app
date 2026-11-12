import Link from "next/link";
import { getAdminInquiries } from "@/lib/data/admin-ops";
import { romeTodayIso } from "@/lib/admin-ops/bookings";
import { aggregateByCenter, filterInquiries, inquiriesHref, parseInquiryFilters, viewInquiry } from "@/lib/admin-ops/inquiries";

export const dynamic = "force-dynamic";

// Proposta Admin (Fabrizio ha chiesto cosa portare lato piattaforma dalle
// nuove funzionalità: ticketing, presenze, preferiti — questa copre il
// ticketing). Il Gestore ha già "Le mie richieste" per il proprio centro;
// qui l'Admin vede TUTTI i centri per controllare la qualità del servizio:
// chi ha troppe richieste aperte, chi risponde lentamente o per niente.
//
// TRAMA — ADMIN OPERATIVO (12/11/2026). Richiesta di Fabrizio: "In Richieste
// SLA e Segnalazioni collega gli aggregati ai singoli casi. Conserva gli
// stati". Prima: solo la tabella per centro (lib/data/admin-inquiries.ts),
// nessun modo di arrivare al messaggio. Ora: tabella per centro e totali
// calcolati dalle STESSE righe dell'elenco dei casi (lib/admin-ops/
// inquiries.ts), ogni numero apre l'elenco filtrato (?centro=…&stato=aperta),
// ogni caso ha un'ancora stabile (#caso-<id>). Stati invariati
// (aperta/risposta/chiusa). I centri e le attività di prova sono nascosti di
// default, come in "Oggi". Lettura dietro il controllo platform_admin.
type SP = Promise<Record<string, string | string[] | undefined>>;

const STATUS_LABEL: Record<string, string> = { aperta: "Aperta", risposta: "Risposta", chiusa: "Chiusa" };

export default async function AdminRichiestePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = parseInquiryFilters(sp);
  const caso = typeof sp.caso === "string" ? sp.caso : "";
  const today = romeTodayIso();
  const views = (await getAdminInquiries()).map((r) => viewInquiry(r, today));
  const scope = filterInquiries(views, { centro: "", stato: "tutte", demo: f.demo });
  const aggregates = aggregateByCenter(scope);
  const cases = filterInquiries(views, f).sort((a, b) => (a.row.status === "aperta" ? 0 : 1) - (b.row.status === "aperta" ? 0 : 1) || b.ageDays - a.ageDays);
  const openCount = scope.filter((v) => v.row.status === "aperta").length;
  const responses = scope.filter((v) => v.responseHours !== null);
  const avg = responses.length > 0 ? responses.reduce((s, v) => s + (v.responseHours ?? 0), 0) / responses.length : null;
  const hiddenDemo = views.length - scope.length;
  const centerName = f.centro ? aggregates.find((a) => a.centerId === f.centro)?.centerName : null;

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Richieste — SLA per centro</h1>
        <p className="text-sm text-navy-text2">
          Messaggi delle famiglie ai centri (&quot;Contatta il gestore&quot;): chi aspetta una risposta e da quanto. Ogni numero apre i
          singoli casi.
          {!f.demo && hiddenDemo > 0 ? (
            <>
              {" "}
              {hiddenDemo} di prova nascosti ·{" "}
              <Link href={inquiriesHref({ ...f, demo: true }).replace("#casi", "")} className="font-semibold text-white underline">
                mostrali
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Link href={inquiriesHref({ stato: "aperta", demo: f.demo })} className="rounded-lg border border-[#E8EBF0] bg-white p-4 no-underline hover:border-trama-violet">
          <div className="text-xl font-bold text-ink">{openCount}</div>
          <div className="text-xs text-ink-2">Richieste aperte (piattaforma)</div>
        </Link>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="text-xl font-bold text-ink">{avg !== null ? formatHours(avg) : "—"}</div>
          <div className="text-xs text-ink-2">Tempo medio di risposta</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-4">
          <div className="text-xl font-bold text-ink">{aggregates.length}</div>
          <div className="text-xs text-ink-2">Centri con richieste</div>
        </div>
      </div>

      <div className="mb-7 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
                <th className="px-4 py-3 font-medium">Centro</th>
                <th className="px-4 py-3 font-medium">Totale richieste</th>
                <th className="px-4 py-3 font-medium">Aperte</th>
                <th className="px-4 py-3 font-medium">Tempo medio risposta</th>
                <th className="px-4 py-3 font-medium">Aperta più vecchia</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((c) => (
                <tr key={c.centerId} className="border-b border-[#F0F2F5] last:border-0">
                  <td className="px-4 py-3">
                    <Link href={inquiriesHref({ centro: c.centerId, demo: f.demo })} className="font-semibold text-ink no-underline hover:underline">
                      {c.centerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{c.total}</td>
                  <td className="px-4 py-3">
                    {c.open > 0 ? (
                      <Link href={inquiriesHref({ centro: c.centerId, stato: "aperta", demo: f.demo })} className="rounded-full bg-orange-light px-2.5 py-1 text-xs font-semibold text-trama-orange no-underline">
                        {c.open} in attesa
                      </Link>
                    ) : (
                      <span className="text-ink-2">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{c.avgResponseHours !== null ? formatHours(c.avgResponseHours) : "—"}</td>
                  <td className="px-4 py-3">
                    {c.oldestOpenDays !== null ? (
                      <span className={`font-semibold ${c.oldestOpenDays > 3 ? "text-[#C0392B]" : "text-ink-2"}`}>
                        {c.oldestOpenDays >= 1 ? `${c.oldestOpenDays} giorni` : "meno di 1 giorno"}
                      </span>
                    ) : (
                      <span className="text-ink-2">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {aggregates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-2">
                    Nessuna richiesta ancora registrata (o la tabella activity_inquiries non è stata ancora creata su Supabase).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div id="casi" className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[15px] font-bold text-white">Casi{centerName ? ` · ${centerName}` : ""}</span>
        {(["tutte", "aperta", "risposta", "chiusa"] as const).map((s) => (
          <Link
            key={s}
            href={inquiriesHref({ ...f, stato: s })}
            className={`rounded-full border px-3 py-1 no-underline ${f.stato === s ? "border-sky bg-sky text-white" : "border-navy-3 text-navy-text2"}`}
          >
            {s === "tutte" ? "Tutti" : STATUS_LABEL[s]}
          </Link>
        ))}
        {f.centro && (
          <Link href={inquiriesHref({ ...f, centro: "" })} className="text-white underline">
            tutti i centri
          </Link>
        )}
        <span className="text-navy-text2">{cases.length} casi</span>
      </div>
      <ul className="flex flex-col gap-2">
        {cases.slice(0, 200).map((v) => (
          <li
            key={v.row.id}
            id={`caso-${v.row.id}`}
            className={`rounded-lg border bg-white px-4 py-3 text-sm ${caso === v.row.id ? "border-trama-violet ring-2 ring-trama-violet" : "border-[#E8EBF0]"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${v.row.status === "aperta" ? "bg-orange-light text-trama-orange" : "bg-green-light text-[#2d8f52]"}`}>
                {STATUS_LABEL[v.row.status] ?? v.row.status}
              </span>
              <span className="font-semibold text-ink">{v.row.activityName}</span>
              <span className="text-xs text-ink-2">
                {v.row.centerName} · {v.row.parentName} · da {v.ageDays} {v.ageDays === 1 ? "giorno" : "giorni"}
              </span>
              {v.isDemo && <span className="rounded bg-[#EEF0F4] px-1 text-[10px] text-[#6B7280]">prova</span>}
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-ink-2">{v.row.message}</p>
            {v.row.reply && <p className="mt-1 line-clamp-2 border-l-2 border-[#E8EBF0] pl-2 text-xs text-ink-2">Risposta: {v.row.reply}</p>}
            {v.nextStep && (
              <p className="mt-1 text-xs">
                <span className="font-semibold text-ink">Tocca al centro</span> · <span className="text-ink-2">{v.nextStep}</span>
              </p>
            )}
            <div className="mt-1 flex gap-3 text-xs">
              <Link href={`/admin/richieste?caso=${v.row.id}${f.demo ? "&demo=1" : ""}#caso-${v.row.id}`} className="text-sky">
                Link al caso
              </Link>
              {v.row.centerId && (
                <Link href={`/admin/centers/${v.row.centerId}`} className="text-sky">
                  Centro
                </Link>
              )}
            </div>
          </li>
        ))}
        {cases.length === 0 && <li className="rounded-lg border border-[#E8EBF0] bg-white px-4 py-4 text-sm text-ink-2">Nessun caso con questi filtri.</li>}
      </ul>
      {cases.length > 200 && <p className="mt-2 text-xs text-navy-text2">Mostrati i primi 200: restringi per centro.</p>}
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} ore`;
  return `${Math.round(hours / 24)} giorni`;
}
