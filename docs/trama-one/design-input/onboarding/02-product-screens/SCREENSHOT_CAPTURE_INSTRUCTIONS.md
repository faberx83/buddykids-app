# Screenshot da catturare manualmente — istruzioni per Fabrizio

Nessuno screenshot reale è stato generato in questo pack. Motivo: catturare le schermate richiede avviare l'app collegata a un account/dati reali (anche solo demo) e navigarla in un browser — un'azione che in questa sessione resta riservata a Fabrizio, per non eseguire run "live" dell'app per suo conto. Sotto la lista precisa delle 6 catture richieste, con route esatta e prerequisiti.

## Prerequisito: attivare la superficie NEXTGEN

L'app ha due superfici (LEGACY/NEXTGEN) selezionate da un cookie (`bk_version`), non da un dominio separato. Per essere sicuri di essere su NEXTGEN: accedere come genitore, andare su **Profilo → Impostazioni** e usare il toggle versione app, oppure verificare che l'URL sia sotto `/nextgen/...` (se si è su `/` senza prefisso, si è su LEGACY).

## Le 6 catture richieste

| # | Schermata | Route | Note |
|---|---|---|---|
| 1 | Parent Home | `/nextgen` | Catturare con almeno una settimana coperta e una scoperta visibili nella Hero Card (non un account completamente vuoto). |
| 2 | Parent Planner | `/nextgen/planner` | Tab "Organizzazione" di default; se possibile un secondo scatto con tab "Budget". |
| 3 | Parent Search | `/nextgen/search` | Con almeno un filtro attivo, per mostrare anche quello stato. |
| 4 | Activity Detail | Aprire una card attività da Search o da Home ("Prossimo appuntamento" / suggerimenti) — l'URL sarà `/activity/<id-reale>`, non prevedibile in anticipo. | Preferire un'attività con foto di copertina reale e almeno un badge (certificazione/dieta/accesso disabili) visibile. |
| 5 | Booking / richiesta | Dal dettaglio attività, cliccare "Prenota" — l'URL sarà `/booking/<id-reale>`. | Catturare lo step iniziale (selezione settimana), non serve completare la prenotazione. |
| 6 | Vista mobile | Una qualsiasi delle precedenti, a larghezza mobile reale (es. 390×844, iPhone) | L'app è già mobile-first (contenitore `.app-shell` max-width 480px) — su desktop apparirà comunque come un "telefono" centrato; per una vista mobile autentica usare i DevTools del browser in modalità responsive o un telefono reale. |

## Dati

Usare un account/dati demo o di test già esistenti, non dati personali di famiglie reali. Non serve creare nulla di nuovo: qualunque account genitore di test con almeno una prenotazione e una settimana scoperta è sufficiente per mostrare lo stato "reale" della UI.

## Come nominare i file

Quando gli screenshot sono pronti, un nome file allineato alla riga della tabella sopra (es. `01-parent-home.png`, `02-parent-planner.png`, ...) rende immediato l'abbinamento per chi li userà.
