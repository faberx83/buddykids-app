# Pipeline Parent — report del 30/10/2026

Tabella di avanzamento richiesta dal report consolidato "TRAMA PARENT — Report consolidato e comandi di revisione per Claude" (30/10/2026). Aggiornarla a ogni lotto.

Stati: Da riprodurre → Riprodotto → In sviluppo → In review → Verificato in staging → Rilasciato → Ritest produzione → Chiuso. Alternative: Non riprodotto, Bloccato, Rinviato.

Ambienti:
- **locale** = sandbox di Claude: test unitari, controlli sul sorgente, controllo dei tipi;
- **produzione** = tramapp.it dopo `bash deploy.sh` di Fabrizio.

Non esiste uno staging separato: "Verificato in staging" non si applica. I percorsi nel browser restano *pending local verification* finché non c'è un ritest.

Aggiornato il 03/11/2026, ramo `claude/report-parent-3010`.

| ID | Tipo | Lotto | Stato | Owner | Dipendenze | PR/commit | Ambiente/build | Test/evidenza | Blocco residuo |
|---|---|---|---|---|---|---|---|---|---|
| UX-CROSS-003 ricevuta "Quando —" | Bug verificato | L1 | In review | Claude | — | ramo `claude/report-parent-3010` | locale | RP-04, RP-05. Causa: `getBookingSummary` leggeva solo `booking_weeks`, mai `booking_days` | Ritest produzione: richiesta di un giorno → la ricevuta mostra giorno, orario, figlio, importo e "In attesa del centro" |
| REV-PARENT-001 "€30 spesi" | Revisione | L1 | In review | Claude | — | idem | locale | SPV2-05 aggiornato. Ora: "€30 di prenotazioni confermate nel 2026"; esclusi in attesa, rifiutati e annullati; confermata in parte = quota dei giorni accettati | Nessun pagamento registrato in TRAMA: la metrica resta un valore prenotato, non una spesa |
| UX-CROSS-001 prezzo card | Bug verificato, contratto condiviso | L1/L2 | In review | Claude | Acceptance anche del portale centri | idem | locale | RP-01, RP-02. Causa: Scopri mostrava `price_per_week` "a settimana" anche per le attività solo a giornate (demo: 150 → 30/giorno). Regola unica `lib/nextgen/activity-price.ts`, usata da card Scopri, card Planner, scheda V2 e scheda di prima | Il portale centri calcola già €30/giorno con `dailyRateFor`: da confermare in acceptance dalla chat Partner |
| UX-CROSS-002 link canonico | Bug verificato, contratto condiviso | L2 | In review | Claude | UX-CROSS-001 | idem | locale | RP-03. Causa verificata: senza accesso la scheda è quella di prima (flag per coorte), e i giorni dopo l'estate venivano tolti salvo PARENT_UX_FIX_ENABLED, che si risolve solo da loggati. Il parametro `source` non c'entra. Ora giorni, posti e prezzo sono uguali per tutti | La scheda anonima resta nella grafica di prima (Legacy). Mostrare la V2 anche senza accesso è una scelta di prodotto aperta |
| UX-PARENT-024 Home accompagnamenti | Bug storico | L0/L2 | Rilasciato, da ritestare in produzione | Claude | Release "per passaggio" e "Planner giorno", accese per la beta | b8741a7 (29/10) | produzione dal 29/10 | R024-01…03 | Ritest con lo scenario del report: Luca solo scuola, Giulia decisa |
| UX-PARENT-023 nome scuola | Bug storico | L1 | Ritest produzione PASS (30/10, account prova) | Claude | migration 56 (applicata) | b8741a7 | produzione | R023-01…03 | Completare: orari ON e secondo account |
| UX-PARENT-025 posti liberi / CTA | Bug storico | L1 | Ritest produzione PASS (30/10) | Claude | — | b8741a7 e questo ramo | produzione | R025-01…03 | Dal 03/11 il prezzo usa la regola condivisa e i giorni dopo l'estate valgono per tutti |
| REV-PARENT-002 "Foto aggiornata" | Rifinitura | L1 | In review | Claude | — | ramo `claude/report-parent-3010` | locale | RP-06. "Foto aggiornata" (role=status) solo dopo il salvataggio riuscito; in errore il messaggio e la foto di prima | Errori di rete, file non validi e dispositivi reali non provati (VER-PARENT-003) |
| VER-PARENT-001 regressioni | Verifica | L3 | Da fare | ChatGPT / Fabrizio | deploy di questo ramo | — | — | — | Scuola, Planner, inviti e avatar dopo nuovo caricamento |
| VER-PARENT-002 primo uso | Verifica | L3 | Da fare | Fabrizio | account vuoto di prova | — | — | — | — |
| VER-PARENT-003 mobile e upload | Verifica | L3 | Da fare | Fabrizio | telefono reale | — | — | — | — |
| VER-PARENT-004 eccezioni richiesta | Verifica | L3 | Da fare | ChatGPT / Fabrizio | fixture centrodemo | — | — | — | Rifiuto, annullamento, posti esauriti, doppio invio |
| EVO-PARENT-001 / 002 | Evoluzione | L4 | Rinviato | — | pilota | — | — | — | Fuori dal lotto immediato |
