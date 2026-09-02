// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 4-5).
//
// Root cause (GROUP-BACK): sia GroupsClient (freccia Indietro) sia
// app/nextgen/groups/[id]/page.tsx (backHref del dettaglio) avevano un
// target FISSO ("/nextgen/planner" e "/nextgen/groups" rispettivamente),
// scelto senza sapere da dove il genitore fosse davvero arrivato. Risultato:
// Planner → tab Gruppi → "Gruppi & Community" → Indietro riportava sempre a
// Planner/Organizzazione (PlannerClient.tsx sceglie la tab iniziale da
// "?mode=", assente di default → "organizzazione", vedi PLANNER_MODES in
// PlannerModeTabs.tsx), perdendo il contesto "Gruppi".
//
// Fix: un marcatore di contesto "from"/"backContext" propagato via query
// string (nessun hack su browser history, per esplicita richiesta — la
// history del browser può contenere redirect/refresh intermedi e produce
// risultati incoerenti) lungo l'intera catena:
//   PlannerGroupsView (link "Vedi tutti"/card gruppo, ?from=planner-gruppi)
//     → app/nextgen/groups/page.tsx (searchParams.from → backContext)
//       → GroupsClient (resolveGroupsListBackHref + groupsDetailQuery)
//         → GroupCard/ScopriTab/InvitiTab (append groupsDetailQuery)
//           → app/nextgen/groups/[id]/page.tsx (searchParams.from → resolveGroupDetailBackHref)
//             → GroupDetailClient (backHref, invariato)
//
// Logica pura estratta qui (stesso principio già in uso in questa sessione
// per responsibility-tone.ts/planner-insights.ts/build-entries.ts): nessun
// import Next.js/React, testabile senza browser/deploy — vedi
// tests/nextgen/groups-back-nav.spec.ts (GROUP-BACK-01..04).

export const PLANNER_GRUPPI_CONTEXT = "planner-gruppi";

// Freccia "Indietro" nella lista Gruppi (GroupsClient): se il contesto è
// "planner-gruppi", torna alla tab Gruppi del Planner (non a Organizzazione,
// il default di staticBackHref). Altrimenti comportamento INVARIATO.
export function resolveGroupsListBackHref(
  backContext: string | undefined,
  staticBackHref: string | undefined
): string | undefined {
  if (backContext === PLANNER_GRUPPI_CONTEXT) return "/nextgen/planner?mode=gruppi";
  return staticBackHref;
}

// Suffisso query string da appendere ad ogni link verso il dettaglio di un
// gruppo aperto da questa lista, per portare avanti lo stesso contesto.
export function groupsDetailQuery(backContext: string | undefined): string {
  return backContext === PLANNER_GRUPPI_CONTEXT ? `?from=${PLANNER_GRUPPI_CONTEXT}` : "";
}

// backHref del dettaglio gruppo (app/nextgen/groups/[id]/page.tsx): se
// raggiunto risalendo da Planner/Gruppi, il Back deve tornare alla LISTA con
// lo stesso contesto ancora attaccato (cosi un secondo Back da lì torni a
// Planner/Gruppi). Altrimenti comportamento INVARIATO ("/nextgen/groups").
export function resolveGroupDetailBackHref(from: string | undefined): string {
  return from === PLANNER_GRUPPI_CONTEXT ? `/nextgen/groups?from=${PLANNER_GRUPPI_CONTEXT}` : "/nextgen/groups";
}
