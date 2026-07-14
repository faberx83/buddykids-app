import TramaSpinner from "@/components/TramaSpinner";

// TRAMA Sprint 3bis — vedi app/(main)/loading.tsx per la nota sul perché il
// contenitore è passato da h-64 a min-h-[60vh].
// v5 — richiesta di Fabrizio: lo spinner Admin deve essere bianco su sfondo
// navy come tutta la piattaforma Admin, non più appoggiato su un disco
// bianco (quel trattamento risale a quando lo spinner era ancora a fili SVG
// pensati per sfondi chiari — col logo pieno ricolorato in bianco non serve
// più: il pannello Admin è già bg-navy, vedi DashboardLayout.tsx).
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <TramaSpinner size={160} tone="white" />
    </div>
  );
}
