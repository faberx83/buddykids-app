# Home V2 — Fase 1 (13/10/2026)

Iniziativa "Home e Planner v2" (documento completo nel Project claude.ai:
`claude/INIZIATIVA_home_planner_v2.md`). Baseline visuale congelata: canvas
"TRAMA Home e Planner V2.1". Il Planner V2.1 è solo specifica: **non
implementato** in questa fase.

## Cosa fa
Con `HOME_V2_ENABLED` acceso la Home famiglie diventa `HomeDashboardV2Client`:

1. intestazione: saluto, data, impegni di oggi, campanella (apre il centro
   notifiche esistente, che in Home V2 non mostra il pulsante flottante);
2. alert **solo** per un problema operativo di oggi (manca chi accompagna o
   ritira); tutto il resto va in "Da fare";
3. **Oggi**: timeline unica con prenotazioni TRAMA, Scoperte nel Planner e
   impegni aggiunti a mano, provenienza discreta; coordinamento della
   giornata in una riga se completo, tabella Porta/Ritira se manca qualcuno
   (per figlio + giorno + momento, come il modello dati attuale);
4. **Da fare**: una lista, max 3 + "Vedi tutte", priorità rifiuti >
   passaggi dei prossimi 7 giorni > conferme parziali > inviti > profilo >
   push; nascosta se vuota;
5. riepilogo del periodo (`SeasonSummaryCard`): "X di Y settimane
   organizzate", barra, stati organizzata / da completare / da organizzare;
   stato di benvenuto per famiglie nuove ("Iniziamo a costruire il vostro
   piano"); niente budget;
6. **Prossima chiusura** della scuola (solo con
   `SCHOOL_CALENDAR_INTELLIGENCE_ENABLED` e scuola indicata), "Organizza" e
   "Più tardi" (per dispositivo);
7. suggerimenti Partner (logica attuale), max 3, in carosello;
8. azioni rapide: Aggiungi impegno (con il suo flag), Cerca attività,
   Condividi piano.

## Rilascio e rollback
- Flag `HOME_V2_ENABLED`, default false, release "TRAMA — Home V2" nella card
  Admin → Feature Flags → Release.
- Flag spento, utente non autenticato o errore di lettura → Home attuale
  (`HomeDashboardClient`), invariata. Rollback = spegnere il flag.
- Nessuna migration, nessuna tabella, nessuna scrittura nuova.

## Limiti noti (Fase 1)
- Il riepilogo usa la stagione estiva già calcolata dal Planner (titolo
  "Estate AAAA"); il componente accetta già altri periodi.
- Gli impegni aggiunti a mano compaiono in Oggi ma non contano nella
  copertura (regola attuale del Planner, non cambiata).
- Suggerimenti solo Partner; le Scoperte TRAMA arriveranno dopo.

## Verifica dal vivo (Fabrizio, pending local verification)
Con il flag acceso per `internal-preview` e l'account `+testparent`:
- [ ] una sola campanella in Home; il tap apre il centro notifiche; fuori
      dalla Home la campanella flottante torna;
- [ ] Oggi mostra insieme prenotazioni e impegni aggiunti a mano, in ordine
      di orario;
- [ ] con un ritiro di oggi non assegnato: alert in cima + tabella
      Porta/Ritira con "da decidere"; dopo l'assegnazione: una riga
      compressa;
- [ ] Da fare: massimo 3 voci, "Vedi tutte" se ce ne sono di più;
- [ ] riepilogo coerente con il Planner (stesse settimane);
- [ ] prossima chiusura (se la scuola è indicata): 7–8 dicembre a Milano;
- [ ] spegnendo il flag torna la Home attuale.
