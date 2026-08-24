import PageHeader from "@/components/PageHeader";
import ActivityCardHorizontal from "@/components/ActivityCardHorizontal";
import { Activity } from "@/lib/types";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/preferiti/page.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/preferiti),
// stesso pattern già usato per "Le mie prenotazioni" (task #524): nessuna
// nuova query, solo il contenitore visivo cambia (showBrandIcon).
export default function PreferitiView({
  favorites,
  showBrandIcon,
}: {
  favorites: Activity[];
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
            Non hai ancora nessun preferito. Tocca il cuore nella scheda di un&apos;attività per
            salvarla qui.
          </p>
        )}
        {favorites.map((a) => (
          <ActivityCardHorizontal key={a.id} activity={a} />
        ))}
      </div>
    </div>
  );
}
