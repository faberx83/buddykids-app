// TRAMA — SEGNO DEL MARCHIO SOTTO I TITOLI (14/10/2026, richiesta Fabrizio:
// "su tutte le pagine attuali, non possiamo mettere qualcosa che rimandi ai
// colori di trama? una linea sotto il titolo").
// Quattro fili corti con i colori del logo (corallo, arancio, verde, viola),
// come la trama di un tessuto. Solo decorativo: aria-hidden, nessun testo.
//
// `auto`: visibile solo dentro l'area NEXTGEN con la nuova barra accesa
// (attributo data-nav-v2 messo da app/nextgen/layout.tsx, regola in
// app/globals.css). Serve a PageHeader, che è condiviso con Legacy e con il
// portale Gestore: lì il segno non compare finché la nuova barra è spenta.

const THREADS: { color: string; width: number }[] = [
  { color: "#F66B5E", width: 16 },
  { color: "#F6A623", width: 10 },
  { color: "#2DBA8C", width: 13 },
  { color: "#6F63C5", width: 8 },
];

export default function TramaThread({ className = "", auto = false }: { className?: string; auto?: boolean }) {
  return (
    <span aria-hidden="true" data-testid="trama-thread" className={`${auto ? "trama-thread-auto" : "flex"} items-center gap-[3px] ${className}`}>
      {THREADS.map((t) => (
        <span key={t.color} className="block h-[4px] rounded-full" style={{ width: t.width, background: t.color }} />
      ))}
    </span>
  );
}
