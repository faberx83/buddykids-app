import PageHeader from "@/components/PageHeader";
import ActivityCardHorizontal from "@/components/ActivityCardHorizontal";
import { getFavoriteActivitiesForParent } from "@/lib/data/favorites";

// "Preferiti" (richiesta da Fabrizio per la v1): prima il cuore nella scheda
// attività non persisteva mai (vedi FUNCTIONAL-TC-026) — ora salva davvero
// (supabase/schema.sql#favorites) e questa pagina elenca i salvati.
export default async function PreferitiPage() {
  const favorites = await getFavoriteActivitiesForParent();

  return (
    <div className="animate-fade-in">
      {/* BUGFIX (segnalato da Fabrizio) — pagina condivisa tra profilo LEGACY
          e NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna sempre a dove l'utente era arrivato davvero. */}
      <PageHeader title="Preferiti" />
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
