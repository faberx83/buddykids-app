import { getSharedPlanMeta, getSharedPlanEntries } from "@/lib/data/plan-shares";
import { WEEKDAYS } from "@/lib/nextgen/responsibility-options";

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
        <div className="text-3xl">🔒</div>
        <p className="mt-3 text-base font-bold text-ink">Link non disponibile</p>
        <p className="mt-1 max-w-xs text-sm text-ink-2">
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

  return (
    <div className="min-h-screen bg-bg px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-3">
            Piano condiviso · TRAMA
          </div>
          <h1 className="text-xl font-bold text-ink">{meta.label || "Il piano dell'estate"}</h1>
          <p className="mt-1 text-xs text-ink-2">
            {friendlyDate(meta.scopeStart)} – {friendlyDate(meta.scopeEnd)}
          </p>
        </div>

        {weeks.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center">
            <p className="text-sm text-ink-2">Nessuna attività prenotata in questo periodo.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {weeks.map(([weekStartDate, w]) => (
              <div key={weekStartDate} className="rounded-2xl bg-white p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
                  {friendlyDate(weekStartDate)} – {friendlyDate(w.weekEndDate)}
                </div>
                <div className="flex flex-col gap-3">
                  {w.items.map((item, i) => (
                    <div key={i} className={i > 0 ? "border-t border-black/5 pt-3" : ""}>
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <div className="min-w-0">
                          <span className="font-semibold text-ink">{item.kidName}</span>
                          <span className="text-ink-2"> · {item.activityName}</span>
                        </div>
                        <span className="flex-shrink-0 text-[10.5px] font-semibold text-ink-3">
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>

                      {(item.centerName || item.address) && (
                        <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-ink-2">
                          <i className="ti ti-map-pin flex-shrink-0 text-ink-3" />
                          <span className="min-w-0 flex-1 truncate">
                            {item.centerName}
                            {item.centerName && item.address ? " · " : ""}
                            {item.address}
                          </span>
                          {item.address && (
                            <a
                              href={mapsUrl(item.address)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 font-semibold text-trama-violet"
                            >
                              Naviga →
                            </a>
                          )}
                        </div>
                      )}

                      {(item.days || item.hours) && (
                        <div className="mt-1 flex items-center gap-2 text-[11.5px] text-ink-2">
                          <i className="ti ti-clock flex-shrink-0 text-ink-3" />
                          <span>{[item.days, item.hours].filter(Boolean).join(" · ")}</span>
                        </div>
                      )}

                      {item.responsibilities.length > 0 && (
                        <div className="mt-2 rounded-xl bg-bg/60 px-2.5 py-2">
                          <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-ink-3">
                            Chi accompagna / ritira
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {item.responsibilities.map((cell) => (
                              <div key={cell.weekday} className="flex items-center gap-2 text-[11.5px] text-ink-2">
                                <span className="w-7 flex-shrink-0 font-semibold text-ink-3">
                                  {WEEKDAY_LABEL_IT[cell.weekday]}
                                </span>
                                <span className="min-w-0 flex-1">
                                  {cell.andata ? `${cell.andata.emoji} ${cell.andata.label}` : "Da assegnare"}
                                  <span className="mx-1 text-ink-3">→</span>
                                  {cell.ritorno ? `${cell.ritorno.emoji} ${cell.ritorno.label}` : "Da assegnare"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-ink-3">
          Pagina di sola lettura, condivisa da un genitore su TRAMA.
        </p>
      </div>
    </div>
  );
}
