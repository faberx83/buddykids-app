import PageHeader from "@/components/PageHeader";
import RichiesteGenitoreClient from "@/app/(main)/richieste/RichiesteGenitoreClient";
import { ParentInquiry } from "@/lib/data/inquiries";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/richieste/page.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/richieste),
// stesso pattern già usato per "Le mie prenotazioni" (task #524): nessuna
// nuova query, solo il contenitore visivo cambia (showBrandIcon).
export default function RichiesteView({
  inquiries,
  showBrandIcon,
}: {
  inquiries: ParentInquiry[];
  showBrandIcon?: boolean;
}) {
  return (
    <div className="animate-fade-in">
      {/* BUGFIX (segnalato da Fabrizio) — pagina condivisa tra profilo LEGACY
          e NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna sempre a dove l'utente era arrivato davvero. */}
      <PageHeader title="Le mie richieste" showBrandIcon={showBrandIcon} />
      <RichiesteGenitoreClient initialInquiries={inquiries} />
    </div>
  );
}
