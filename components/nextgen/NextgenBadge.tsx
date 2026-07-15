// SPRINT CORRETTIVO (feedback Fabrizio: "mettiamo una bandina trasversale
// all'angolo in alto a destra con 'Beta'?") — il pill "NEXTGEN" inline
// accanto ai sottotitoli è stato sostituito da un ribbon diagonale
// nell'angolo, pattern standard "corner ribbon". Il componente è ora
// posizionato ASSOLUTO (non più un elemento in flusso): si aggancia al primo
// antenato con position:relative, che è sempre .app-shell (vedi
// globals.css — la cornice "telefono" da 480px), quindi resta ancorato
// all'angolo della cornice sia su mobile (app-shell = intera viewport) sia
// su desktop (app-shell = mockup centrato), indipendentemente da dove viene
// montato nell'albero della pagina e senza essere spostato dallo scroll del
// contenuto interno (che scrolla in un div figlio con overflow-y-auto,
// mentre app-shell stessa non scrolla mai). pointer-events-none sul
// contenitore esterno: il ribbon è puramente decorativo, non deve rubare
// click al contenuto sottostante.
export default function NextgenBadge() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-20 h-[84px] w-[84px] overflow-hidden">
      <span className="absolute right-[-30px] top-[16px] block w-[130px] rotate-45 bg-ink py-[3px] text-center text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
        Beta
      </span>
    </div>
  );
}
