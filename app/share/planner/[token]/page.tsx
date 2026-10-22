import { getSharedPlanMeta, getSharedPlanEntries } from "@/lib/data/plan-shares";
import { WEEKDAYS } from "@/lib/nextgen/responsibility-options";
import { SHARED_PLANNER_STATUS } from "@/lib/plan-shares/build-entries";

// SPRINT 5.3 (NEXTGEN) — "Condivisione Piano": pagina pubblica di sola
// lettura, SENZA login — per chi non ha un account (nonni, tata, altri
// genitori). Passa sempre da getSharedPlanEntries()/getSharedPlanMeta()
// (lib/data/plan-shares.ts, service-role/RPC security-definer, vedi quel
// file), che restituiscono SOLO campi pensati apposta per essere pubblici
// (mai importi, contatti, parent_id/kid_id/booking_id). Route fuori da
// "/nextgen" di proposito: niente toggle LEGACY/NEXTGEN né banner
// "Installa l'app" (vedi VersionToggle.tsx/InstallPrompt.tsx, entrambi
// escludono "/share").
//
// TRAMA BETA v1.1.1 — PIANO CONDIVISO (02/09/2026, richiesta esplicita di
// Fabrizio dopo aver visto la pagina live: "le informazioni sono poche...
// nome del centro, attività, indirizzo (Naviga), orari, chi fa cosa" — per
// chi accompagna/ritira davvero (nonni, tata) sapere solo "In attesa di
// conferma" non basta). Aggiunti centro/indirizzo/orari/"chi fa cosa" per
// giorno (vedi SharedPlanEntry, lib/plan-shares/build-entries.ts) — scelta
// consapevole e confermata dall'utente: il link resta pubblico e senza
// login, quindi ora espone più dettagli operativi di prima (non più solo
// nome/attività/data/stato). Indirizzo/centro/orari sono dati pubblici
// dell'attività stessa (già visibili a chiunque su Scopri, senza account);
// "chi fa cosa" mostra emoji+etichetta (es. "🧑‍🍼 Tata"), mai un nome
// completo/contatto non già scritto dal genitore stesso (responsible_label
// libero, "altro").

const MONTH_LABELS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa di conferma",
  confirmed: "Confermata",
};

const WEEKDAY_LABEL_IT: Record<string, string> = Object.fromEntries(WEEKDAYS.map((w) => [w.value, w.label]));

function friendlyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTH_LABELS_IT[d.getUTCMonth()]}`;
}

// Link diretto a Google Maps — stesso servizio già usato altrove nell'app
// per "Naviga" (Planner Mappa), nessun nuovo provider di mappe introdotto.
function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function SharedPlannerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meta = await getSharedPlanMeta(token);

  if (!meta || !meta.valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-trama-page px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-trama-primary-soft text-[26px] text-trama-primary">
          <i className="ti ti-lock" aria-hidden="true" />
        </span>
        <p className="mt-4 font-poppins text-[20px] font-semibold text-ink">Link non disponibile</p>
        <p className="mt-1.5 max-w-xs text-[15px] leading-snug text-ink-2">
          Questo link di condivisione non esiste più o è stato revocato da chi lo ha creato.
        </p>
      </div>
    );
  }

  const entries = await getSharedPlanEntries(token);

  const byWeek = new Map<string, { weekEndDate: string; items: typeof entries }>();
  for (const e of entries) {
    const bucket = byWeek.get(e.weekStartDate) ?? { weekEndDate: e.weekEndDate, items: [] };
    bucket.items.push(e);
    byWeek.set(e.weekStartDate, bucket);
  }
  const weeks = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b));

  // 20/10/2026 — PIANO CONDIVISO V2: è la pagina che vedono nonni, tata e
  // chi non usa TRAMA, quindi un biglietto da visita. Stessi dati di prima,
  // aspetto V2: logo, titolo grande, una card per attività, stato a
  // pillola, "Apri in Maps" toccabile, chi porta e chi ritira giorno per
  // giorno senza emoji.
  const statusPill = (status: string) =>
    status === "confirmed" ? "bg-[#E6F6F0] text-[#146B4F]" : "bg-[#FFF3E0] text-[#8A5300]";
  return (
    <div className="min-h-screen bg-trama-page px-5 pb-10 pt-8">
      <div className="mx-auto flex max-w-md flex-col">
        <header className="mb-7 flex flex-col items-start">
          <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="h-9 w-auto" />
          <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.12em] text-trama-accent-ink">Piano condiviso</p>
          <h1 className="mt-1 font-poppins text-[28px] font-semibold leading-tight text-ink">{meta.label || "Il piano dell'estate"}</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            {friendlyDate(meta.scopeStart)} – {friendlyDate(meta.scopeEnd)}
          </p>
        </header>

        {weeks.length === 0 ? (
          <div className="rounded-2xl border border-trama-line bg-white px-4 py-6 text-center">
            <p className="text-[15px] text-ink-2">Niente in programma in questo periodo.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {weeks.map(([weekStartDate, w]) => (
              <section key={weekStartDate} className="flex flex-col gap-2.5" aria-label={`Settimana ${friendlyDate(weekStartDate)} – ${friendlyDate(w.weekEndDate)}`}>
                <h2 className="font-poppins text-[18px] font-semibold text-ink">
                  {friendlyDate(weekStartDate)} – {friendlyDate(w.weekEndDate)}
                </h2>
                {w.items.map((item, i) => (
                  <article key={i} className="rounded-2xl border border-trama-line bg-white px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[16px] font-semibold leading-snug text-ink">{item.activityName}</p>
                        <p className="text-[14px] font-semibold text-trama-accent-ink">{item.kidName}</p>
                      </div>
                      {/* 22/10/2026: gli impegni del Planner non hanno una conferma del centro. */}
                      {item.status !== SHARED_PLANNER_STATUS && (
                        <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusPill(item.status)}`}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      )}
                    </div>

                    {(item.days || item.hours) && (
                      <p className="mt-2 flex items-center gap-2 text-[14px] text-ink-2">
                        <i className="ti ti-clock flex-shrink-0 text-[16px] text-ink-3" aria-hidden="true" />
                        <span>{[item.days, item.hours].filter(Boolean).join(" · ")}</span>
                      </p>
                    )}

                    {(item.centerName || item.address) && (
                      <div className="mt-1 flex items-center gap-2 text-[14px] text-ink-2">
                        <i className="ti ti-map-pin flex-shrink-0 text-[16px] text-ink-3" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          {item.centerName}
                          {item.centerName && item.address ? " · " : ""}
                          {item.address}
                        </span>
                      </div>
                    )}
                    {item.address && (
                      <a
                        href={mapsUrl(item.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-trama-accent-ink"
                      >
                        <i className="ti ti-navigation text-[16px]" aria-hidden="true" />
                        Apri in Maps
                      </a>
                    )}

                    {item.responsibilities.length > 0 && (
                      <div className="mt-2 border-t border-[#F0F2F5] pt-3">
                        <p className="mb-1.5 text-[13px] font-semibold text-ink">Chi porta e chi ritira</p>
                        <ul className="flex flex-col gap-1">
                          {item.responsibilities.map((cell) => (
                            <li key={cell.weekday} className="flex items-baseline gap-2 text-[14px] text-ink-2">
                              <span className="w-9 flex-shrink-0 font-semibold text-ink">{WEEKDAY_LABEL_IT[cell.weekday]}</span>
                              <span className="min-w-0 flex-1">
                                Porta <b className={cell.andata ? "font-semibold text-ink" : "font-semibold text-[#8A5300]"}>{cell.andata ? cell.andata.label : "da decidere"}</b>
                                {" · "}
                                ritira <b className={cell.ritorno ? "font-semibold text-ink" : "font-semibold text-[#8A5300]"}>{cell.ritorno ? cell.ritorno.label : "da decidere"}</b>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </section>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-[13px] leading-snug text-ink-3">
          Pagina di sola lettura, condivisa da un genitore su TRAMA.
        </p>
      </div>
    </div>
  );
}
