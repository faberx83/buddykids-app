import TramaSpinner from "@/components/TramaSpinner";

// TRAMA Sprint 3bis — vedi app/(main)/loading.tsx per la nota sul perché il
// contenitore è passato da h-64 a min-h-[60vh].
// v5 — richiesta di Fabrizio: lo spinner Partner deve essere navy come il
// logo della piattaforma gestore (BrandMark in DashboardLayout.tsx usa la
// stessa variante), non a colori.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <TramaSpinner size={160} tone="navy" />
    </div>
  );
}
