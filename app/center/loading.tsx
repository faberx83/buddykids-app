import TramaSpinner, { LOADER_SCREEN_PARTNER } from "@/components/TramaSpinner";

// TRAMA Sprint 3bis — vedi app/(main)/loading.tsx per la nota sul perché il
// contenitore è passato da h-64 a min-h-[60vh].
// v5 — richiesta di Fabrizio: lo spinner Partner deve essere navy come il
// logo della piattaforma gestore (BrandMark in DashboardLayout.tsx usa la
// stessa variante), non a colori.
// 03/11/2026, Fabrizio: "nel loader del portale centri dovresti cambiare il
// colore della barra con i colori del centro": filo petrolio e senape, sfondo
// della pagina del portale centri.
export default function Loading() {
  return (
    <div className={LOADER_SCREEN_PARTNER}>
      <TramaSpinner size={220} tone="navy" palette="partner" />
    </div>
  );
}
