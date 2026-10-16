import TramaSpinner from "@/components/TramaSpinner";

// TRAMA — caricamento delle pagine famiglie V2 (16/10/2026, Fabrizio: "vuoi
// mettere il logo che fa qualche animazione? E utilizzarlo su pagine che si
// stanno caricando?"). Compare dentro la cornice dell'app (barra in basso
// sempre visibile) mentre il server prepara la pagina, al posto dello
// schermo fermo o vuoto. Stesso logo animato di Partner, Admin e V1.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <TramaSpinner size={96} />
    </div>
  );
}
