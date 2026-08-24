import { getMyBookingsForParent } from "@/lib/data/my-bookings";
import { getPlannerData } from "@/lib/data/planner";
import { getKidsForUser } from "@/lib/data/kids";
import PrenotazioniClient from "@/app/(main)/prenotazioni/PrenotazioniClient";

// TRAMA ONE — Prenotazioni NEXTGEN-native (24/08/2026): chiude il gap di
// "shell discontinuity" segnalato da Fabrizio ("le prenotazioni vanno ancora
// sul vecchio schema"). Il contenuto (PrenotazioniClient) è già TRAMA-current
// (Sprint 4, DEC-42) e condiviso senza dipendenze LEGACY-specifiche: questa
// pagina lo monta sotto /nextgen così eredita il guscio NEXTGEN (layout +
// NextgenBottomNav) invece di quello LEGACY (app/(main)/layout.tsx +
// BottomNav), con showBrandIcon=true come ogni altra pagina NEXTGEN Genitore.
// Riuso deliberato (non duplicazione): stessa logica di fetch di
// app/(main)/prenotazioni/page.tsx, che resta invariata per il call site
// LEGACY esistente.
export default async function NextgenPrenotazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ kid?: string; bookingId?: string }>;
}) {
  const { kid, bookingId } = await searchParams;
  const [bookings, planner, kids] = await Promise.all([
    getMyBookingsForParent(),
    getPlannerData(),
    getKidsForUser(),
  ]);

  return (
    <div className="animate-fade-in">
      <PrenotazioniClient
        bookings={bookings}
        planner={planner}
        kids={kids}
        initialKidFilter={kid ?? null}
        initialHighlightBookingId={bookingId ?? null}
        showBrandIcon
      />
    </div>
  );
}
