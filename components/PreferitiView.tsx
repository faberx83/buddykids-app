import PageHeader from "@/components/PageHeader";
import ActivityCardHorizontal from "@/components/ActivityCardHorizontal";
import CuratedFavoriteCard from "@/components/CuratedFavoriteCard";
import type { UnifiedFavoriteItem } from "@/lib/discovery/unified-favorites";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/preferiti/page.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/preferiti),
// stesso pattern già usato per "Le mie prenotazioni" (task #524): nessuna
// nuova query, solo il contenitore visivo cambia (showBrandIcon).
//
// TRAMA — POST-DISCOVERY CONSOLIDATION (23/09/2026), §5 "PREFERITI VIEW".
// Prima: solo Activity[] Partner. Ora: `favorites` è UnifiedFavoriteItem[]
// (lib/discovery/unified-favorites.ts) — UNICA lista con Partner e Scoperta
// TRAMA mescolati (mai due sezioni separate, richiesta esplicita di
// Fabrizio), ordinata dal chiamante (getUnifiedFavoritesForParent: Partner
// prima, poi Curated per data di aggiunta — nessun ordinamento cross-domain
// inventato, stesso principio già seguito in result-model.ts).
export default function PreferitiView({
  favorites,
  showBrandIcon,
}: {
  favorites: UnifiedFavoriteItem[];
  showBrandIcon?: boolean;
}) {
  return (
    <div className="animate-fade-in">
      {/* BUGFIX (segnalato da Fabrizio) — pagina condivisa tra profilo LEGACY
          e NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna sempre a dove l'utente era arrivato davvero. */}
      <PageHeader title="Preferiti" showBrandIcon={showBrandIcon} />
      <div className="pt-4">
        {favorites.length === 0 && (
          <p className="mx-5 rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Non hai ancora nessun preferito. Tocca il cuore su un&apos;attività o su una Scoperta
            TRAMA per salvarla qui.
          </p>
        )}
        {favorites.map((item) =>
          item.kind === "partner" ? (
            <ActivityCardHorizontal key={`partner-${item.activity.id}`} activity={item.activity} />
          ) : (
            <CuratedFavoriteCard key={`curated-${item.curatedLeadId}`} lead={item.lead} />
          )
        )}
      </div>
    </div>
  );
}
