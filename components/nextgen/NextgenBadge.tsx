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
// PLANNER BETA v1.1 (Wave 5, punto 25-26) — estensione minimale: il ribbon
// mostrava solo "Beta" senza numero di versione, e non esisteva alcuna
// source of truth per quel numero altrove nel repo (verificato via grep).
// Aggiunto il numero riusando lo STESSO ribbon (nessun secondo badge, come
// richiesto), leggendo l'unica costante centralizzata in
// lib/beta-version.ts — cambiarla lì aggiorna automaticamente ogni pagina
// che monta NextgenBadge, senza toccare le pagine stesse.
import { TRAMA_BETA_VERSION } from "@/lib/beta-version";

// TRAMA BETA v1.1.1 (FINAL VISUAL CONFORMANCE PASS, punto 11) —
// segnalazione: il ribbon "BETA · v1.1" competeva visivamente col
// PageHeader appena sotto (troppo ingombrante rispetto al mockup HD
// approvato). Ridotto proporzionalmente (box 84px→64px, banda 130px→100px,
// padding verticale 3px→2px, font 9px→8.5px) e tono più leggero
// (bg-ink→bg-ink/85, meno "nero pieno") — stessa identica meccanica di
// posizionamento (absolute, ancorato a .app-shell), stesso testo/contenuto
// (nessun secondo badge), solo meno ingombrante. Testo resta interamente
// leggibile: nessun clipping, nessuna compressione ulteriore del carattere.
export default function NextgenBadge() {
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-20 h-16 w-16 overflow-hidden">
      <span className="absolute right-[-22px] top-3 block w-[100px] rotate-45 bg-ink/85 py-[2px] text-center text-[8.5px] font-bold uppercase tracking-wide text-white shadow-sm">
        Beta · {TRAMA_BETA_VERSION}
      </span>
    </div>
  );
}
