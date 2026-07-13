import { getSharedPlanMeta, getSharedPlanEntries } from "@/lib/data/plan-shares";

// SPRINT 5.3 (NEXTGEN) — "Condivisione Piano": pagina pubblica di sola
// lettura, SENZA login — per chi non ha un account (nonni, tata, altri
// genitori). Passa sempre dalle funzioni RPC get_shared_plan_meta()/
// get_shared_plan() (security definer, vedi supabase/schema.sql), che
// restituiscono SOLO nome bambino/attività/date/stato — mai importi,
// indirizzi o dati di contatto. Route fuori da "/nextgen" di proposito:
// niente toggle LEGACY/NEXTGEN né banner "Installa l'app" (vedi
// VersionToggle.tsx/InstallPrompt.tsx, entrambi escludono "/share").

const MONTH_LABELS_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

const STATUS_LABEL: Record<string, string> = {
  pending: "In attesa di conferma",
  confirmed: "Confermata",
};

function friendlyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MONTH_LABELS_IT[d.getUTCMonth()]}`;
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
                <div className="flex flex-col gap-2">
                  {w.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[13px]">
                      <div className="min-w-0">
                        <span className="font-semibold text-ink">{item.kidName}</span>
                        <span className="text-ink-2"> · {item.activityName}</span>
                      </div>
                      <span className="flex-shrink-0 text-[10.5px] font-semibold text-ink-3">
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
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
