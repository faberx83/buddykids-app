import PageHeader from "@/components/PageHeader";
import { getVisibleAnnouncementsForCurrentParent } from "@/lib/data/announcements";

// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), NOVITÀ TRAMA — LEVEL 3
// (§10 del task: "valuta se implementabile quasi gratis con Release
// Catalog — una semplice history per mese/feature. Se richiede UI/
// architettura significativa: BACKLOG"). Questa lo è: riusa
// getVisibleAnnouncementsForCurrentParent() (già scritta per Level 1/2),
// nessuna nuova query, nessun nuovo stato — solo un elenco cronologico.
// Non collegata alla bottom nav (nessuna voce di navigazione dedicata
// richiesta dal task): raggiungibile via deep link dal Notification Center
// ("Vedi tutte le novità") e dai deep link degli annunci stessi.
export default async function NovitaPage() {
  const announcements = await getVisibleAnnouncementsForCurrentParent();
  const sorted = [...announcements].sort((a, b) => (a.releasedAt < b.releasedAt ? 1 : -1));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Novità TRAMA" showBrandIcon />
      <div className="px-5 pt-4">
        {sorted.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Nessuna novità al momento.
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {sorted.map((a) => (
            <li key={a.id} className="rounded-lg border border-[#F0F2F5] bg-white p-3.5">
              <p className="text-[11px] font-semibold text-ink-3">
                {new Date(`${a.releasedAt}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <p className="mt-0.5 text-[13.5px] font-bold text-ink">{a.userTitle}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{a.userBody}</p>
              <a href={a.deepLink} className="mt-2 inline-block text-[12px] font-semibold text-trama-violet underline underline-offset-2">
                Scopri la novità
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
