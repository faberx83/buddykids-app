"use client";

import { useEffect } from "react";

// SPRINT CORRETTIVO (NEXTGEN) — "Nessuna modifica deve poter essere persa
// accidentalmente... autosave dove possibile, altrimenti dialog di conferma
// prima di uscire" (richiesta di Fabrizio).
//
// NOTA DI SCOPE (onesta, non un rinvio pigro): oggi NEXTGEN non ha ancora
// nessun form multi-campo con stato non salvato — il check-in salva ogni
// tocco immediatamente (vedi NextgenCheckinCard), il Planner è di sola
// lettura/navigazione (le azioni di modifica/annullo restano in LEGACY,
// /prenotazioni/[id]/modifica, per la scelta di scope già presa nello
// Sprint 1). Applicare questo hook oggi, senza un form a cui agganciarlo,
// sarebbe infrastruttura finta. Lo costruiamo comunque ORA, pronto all'uso,
// perché il prossimo sprint sui Gruppi (creazione gruppo, inviti, proposte)
// introdurrà i primi form NEXTGEN con stato non salvato — lì basterà
// chiamare useUnsavedChangesGuard(hasUnsavedChanges) senza altra
// infrastruttura da costruire.
//
// Copre due casi:
// 1) chiusura scheda/refresh/navigazione fuori dal sito -> beforeunload
//    nativo del browser (unico modo standard per intercettarlo).
// 2) navigazione INTERNA (Link/router.push) -> il chiamante deve comunque
//    intercettare il click (es. mostrando un dialog di conferma prima di
//    chiamare router.push) perché Next.js App Router non espone un evento
//    "route change" cancellabile lato client come il vecchio Pages Router:
//    per questo l'hook espone anche `confirmLeave`, da richiamare a mano nei
//    gestori di click prima di navigare.
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Il testo del messaggio non è mostrabile nei browser moderni (mostrano
      // sempre la loro dicitura standard) — il valore di ritorno serve solo a
      // far comparire il dialog nativo.
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);
}

// Da chiamare nei gestori di click di link/pulsanti di navigazione INTERNA,
// prima di router.push(...), quando hasUnsavedChanges è true. Ritorna true se
// si può procedere (nessuna modifica, o l'utente ha confermato di uscire).
export function confirmLeave(hasUnsavedChanges: boolean): boolean {
  if (!hasUnsavedChanges) return true;
  return window.confirm("Hai modifiche non salvate. Vuoi uscire senza salvare?");
}
