// TRAMA BETA v1.1.1 — FINAL FUNCTIONAL + UI CONSISTENCY FIXES (punto 7).
//
// ROOT CAUSE: bell (NotificationCenter, bottom-24 left-4) e chat
// (BetaFeedbackButton, bottom-24 right-4) sono position:absolute ancorati a
// .app-shell (fix VIS111 punto 10) — non figli del contenitore scrollabile,
// quindi NON si spostano con lo scroll: occupano SEMPRE la stessa fascia
// (96-148px dal fondo). Il padding-bottom aggiunto in quel fix (pb-40, vedi
// app/nextgen/layout.tsx) garantisce che l'ULTIMA riga di contenuto possa
// sempre scorrere oltre quella fascia — ma segnalazione successiva di
// Fabrizio: "durante lo scroll/interazione" una riga che transita
// MOMENTANEAMENTE sotto quella fascia resta comunque intercettata dal
// bottone (i due bottoni sono cerchi da 52px con pointer-events sempre
// attivi, indipendentemente da cosa sta facendo l'utente in quel momento).
//
// Fix SHARED/LAYOUT (non specifico a Settimana 14/Planner/un solo
// viewport — si applica a app/nextgen/layout.tsx, quindi a OGNI pagina
// genitore NEXTGEN): mentre il contenitore scrollabile è in movimento
// attivo, i due bottoni diventano pointer-events:none (più piccoli/
// semi-trasparenti) cosi un tap che finisce sopra di loro durante un gesto
// di scroll raggiunge la riga sottostante invece di essere intercettato dal
// bottone; tornano interattivi non appena lo scroll si ferma (~220ms di
// inattività). Nessuna riduzione di funzionalità a riposo: i bottoni restano
// sempre pienamente cliccabili quando il contenuto è fermo — questo risolve
// esattamente il caso descritto ("durante scroll/interazione"), non solo il
// contenuto in fondo alla pagina (già coperto da pb-40).
//
// Logica di stile estratta come funzione pura (stesso principio di
// bulk-assign.ts/groups-back-nav.ts) per essere testabile senza browser.

export function floatingControlClassName(isScrolling: boolean): string {
  return isScrolling
    ? "pointer-events-none scale-90 opacity-40"
    : "pointer-events-auto scale-100 opacity-100";
}
