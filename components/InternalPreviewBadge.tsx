// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Badge "Anteprima interna" — deve comparire SOLO quando la pagina che lo
// monta ha risolto almeno una capability tramite lo scope
// cohort:"internal-preview" specificamente (vedi
// lib/feature-flags/internal-preview.ts::anyResolvedViaInternalPreview,
// chiamata dalla pagina che passa il risultato come prop `visible` — questo
// componente non fa alcuna risoluzione flag da solo, resta puramente
// presentazionale e quindi banale da testare in isolamento).
//
// Posizionamento: `absolute`, ancorato a `.app-shell` (la cornice "telefono"
// con position:relative — vedi globals.css), STESSA tecnica già in
// produzione per components/nextgen/NextgenBadge.tsx (corner ribbon
// "Beta · vX"), non `fixed` al viewport (l'app non usa quel pattern altrove
// per gli overlay decorativi). Angolo in ALTO A SINISTRA — deliberatamente
// opposto a NextgenBadge (alto a destra) per non sovrapporsi quando
// entrambi sono montati sulla stessa pagina — e distante per costruzione da
// components/BottomNav.tsx (elemento in flusso, non absolute/fixed, sempre
// in fondo alla pagina) e da qualunque FAB ancorato in basso (Fix "Floating
// actions: fix collisione bell/chat con contenuto", stesso principio:
// niente qui vive in fondo alla pagina). pointer-events-none sul
// contenitore esterno: informativo, non deve mai rubare un tap al contenuto
// sottostante — stesso principio di NextgenBadge.
//
// Non dismissable per istruzione esplicita (nessuno stato, nessuna X):
// resta visibile per l'intera permanenza sulla pagina, esattamente come
// deve essere per un indicatore "questo non è ancora pubblico".

export default function InternalPreviewBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 max-w-[calc(100%-16px)] p-2">
      <div
        role="status"
        aria-label="Anteprima interna. Solo account TRAMA autorizzati. Questa funzionalità non è ancora pubblica."
        className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-ink/85 px-2.5 py-1 shadow-sm"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-white">Anteprima interna</span>
        <span className="text-[10px] font-normal text-white/75">· Solo account TRAMA autorizzati</span>
      </div>
    </div>
  );
}
