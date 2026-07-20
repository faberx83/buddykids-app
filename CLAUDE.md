# CLAUDE.md — Regole permanenti di sviluppo TRAMA / TRAMA ONE

Regole operative permanenti per qualunque lavoro su questo repository. Non sono uno sprint, non scadono, non richiedono riconferma: si applicano sempre, in aggiunta alle istruzioni specifiche di ciascuno sprint. Riferimento normativo completo: `docs/trama-one/README.md` (gerarchia e prevalenza documentale) e `docs/trama-one/derived/INDEX.md` (mappa dei contenuti).

## 1. Gerarchia delle fonti

- Repository, database, migrazioni e configurazioni rappresentano la verità dell'AS-IS tecnico.
- Il documento MVP settembre 2026 definisce il perimetro prioritario del pilot.
- Gli Handbook aggiornati definiscono il TO-BE dei portali Parent, Partner e Admin.
- L'Implementation Pack definisce il metodo di delivery.
- Il Master Prompt governa l'Impact Assessment iniziale.
- L'Architecture Blueprint rappresenta visivamente l'architettura, ma non prevale sul repository o sugli Handbook.
- I documenti originali sono canonici.
- Le copie Markdown presenti in `/docs/trama-one/derived` sono copie operative non canoniche.
- Quando un requisito dipende da un diagramma o da un'immagine, consultare anche il documento originale o il file presente in `/docs/trama-one/derived/media/`.
- I conflitti non risolvibili devono essere registrati nell'Assumption Log e non risolti autonomamente.

## 2. Principio reuse-first

- Legacy deve restare disponibile e funzionante.
- Next Gen deve restare disponibile e funzionante.
- TRAMA ONE deve essere sviluppato in parallelo.
- Prima di creare un nuovo componente, servizio, hook, API, tabella o entità, verificare sempre cosa esiste già.
- Ogni elemento analizzato deve essere classificato: REUSE, ADAPT, WRAP, REPLACE oppure NEW.
- REPLACE e NEW richiedono una motivazione tecnica esplicita.
- Per REPLACE e NEW devono essere indicate: alternativa di riuso valutata, rischi, migrazione e rollback.
- Non duplicare senza necessità: Utente, Famiglia, Bambino, Partner, Centro, Sede, Attività, Settimana, Disponibilità, Booking o Planner.
- Preferire migrazioni additive, compatibili e reversibili.
- Non modificare retroattivamente migrazioni già applicate.
- Utilizzare route isolate, feature flag, coorti beta e adapter.
- Non implementare capability fuori dall'MVP senza autorizzazione.

## 3. Deploy e test

- `deploy.sh` resta il punto di ingresso operativo principale.
- `deploy.sh` e `test-deploy.sh` devono essere adattati incrementalmente, non riscritti senza necessità.
- `bash deploy.sh` deve eseguire deploy e test automatici.
- `SKIP_TESTS=1 bash deploy.sh` deve eseguire il solo deploy.
- `ONLY_SITEMAP=1` deve continuare a funzionare.
- `SITEMAP_OPEN_BROWSER=1` deve controllare l'apertura automatica della mappa.
- Non utilizzare "|| true" per ignorare test falliti nel comportamento standard.
- Un'eventuale modalità permissiva deve essere esplicita e chiaramente segnalata.
- Ogni capability deve aggiornare i test nello stesso sprint.
- Non rimuovere o indebolire assertion per far passare la pipeline.
- I test browser non eseguibili nel sandbox Claude devono essere classificati: pending local verification.
- Claude deve fornire i comandi completi da eseguire sul Mac.
- Lo sprint non è verificato definitivamente fino alla ricezione e analisi del log locale.

## 4. Modalità di lavoro

- Prima analizzare, poi proporre, poi implementare.
- Prima di ogni modifica mostrare: file coinvolti, riuso, rischi, test e rollback.
- Non modificare file fuori dal perimetro approvato.
- Non anticipare sprint successivi.
- Implementare una vertical slice alla volta.
- Aggiornare insieme: codice, test, documentazione, business rule e DDL.
- Non trasformare un'ipotesi in decisione approvata.
- Nessun dato test deve essere visibile in produzione.
- Nessun segreto deve essere scritto nel repository.

## 5. Capability pianificata: Disponibilità giornaliera / Giorni spot

- La capability deve essere affrontata negli Sprint 2, 3 e 4.
- Non deve essere implementata nello Sprint 0 o nello Sprint 1.
- Non deve essere modellata come semplice booleano senza analisi del dominio.
- Devono essere valutati: giorni selezionabili, capacità, prezzi, pacchetti minimi, servizi, booking, cancellazioni, Planner, notifiche e reporting.
- La configurazione deve riutilizzare quanto più possibile Activity, Week, Availability, Capacity, Price, Service e Booking esistenti.

> Nota terminologica: "Sprint" in questo file e nella capability sopra si riferisce alla sequenza di build TRAMA ONE (Sprint 0–5, Master Prompt/Implementation Pack), non alla numerazione del backlog interno dell'Handbook Parent (Sprint 6–12/"Ecosystem S9-S10") né alla cronologia degli sprint già eseguiti su questo repository (Sprint 1–8, storico Legacy/Next Gen). Vedi `docs/trama-one/derived/INDEX.md`, sezione 7, in caso di ambiguità.
