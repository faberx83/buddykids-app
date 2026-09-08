# TRAMA — Final Pre-Freeze Report — 08/09/2026

**Tipo di documento**: report di chiusura della sessione "FINAL PRE-FREEZE IMPLEMENTATION WAVE" (Partner Daily Workspace + Onboarding Experience + Documentation Reconciliation + Final Audit). Consegnato inizialmente come messaggio di chiusura in chat; salvato qui su richiesta di Fabrizio per archiviazione insieme a `TRAMA_CURRENT_STATE_ADDENDUM_2026-09-08.md`.

**As-of repository**: `93db96b`
**As-of produzione (verificato via query SQL diretta su `deploy_events`)**: `a30bcc6`, **7 commit indietro** rispetto al repository — tutta la wave "Dashboard Partner / Il mio centro / Onboarding" esiste nel codice ma non è ancora servita a nessun utente reale.
**Deploy**: non eseguito da questa sessione, per policy (azione riservata a Fabrizio).
**Autore**: sessione Claude (Cowork).

---

## Stato per dominio (GREEN / AMBER / RED)

**Prenotazioni & Disponibilità (Partner+Genitore)** — GREEN. In produzione, verificato nel tempo su più cicli precedenti a questa sessione (conferma parziale, lista d'attesa, race-condition capacità chiusa, età come filtro hard).

**Check-in & Presenze** — GREEN. Cron push confermato firing in produzione (08:22 UTC 08/09) dopo il fix CRON_SECRET; roster cross-portale via `booking_days` in produzione.

**Promemoria partenza & Servizi extra prenotazione** — GREEN. Entrambe feature nuove di questo periodo, entrambe già in produzione (precedono `a30bcc6`).

**Dashboard Gestore (redesign)** — AMBER. Implementata e verificata staticamente (tsc/eslint/build puliti), test `DASH-P-01..10` scritti; **non in produzione**, e i test `isRealDeployment` non sono mai stati eseguiti contro un ambiente vero in questa sessione (limite del sandbox, non un fallimento).

**"Il mio centro"** — AMBER, stesso motivo del punto sopra. Gap aggiuntivo dichiarato: nessuna route pubblica `/centro/[slug]` — la CTA "Vedi come ti vedono le famiglie" dipende dall'esistenza di almeno un'attività pubblicata.

**Onboarding (carousel Parent rinnovato + carousel Partner nuovo + replay)** — AMBER. Stesso limite di verifica live dei due punti sopra, **più** un limite strutturale indipendente da questa wave: `TRAMA_ONE_ENABLED` resta OFF globalmente (verificato via query), visibile solo a Controlled Beta Cohort (scade 02/10/2026) e `platform_admin`.

**Documentazione** — AMBER. Gap di freschezza di oltre un mese (package v4 fermo al 06/08) ora colmato da un Addendum verificabile e da rimandi in entrambi i README; i documenti numerici del v4 (Master Requirement Catalog, Traceability Matrix, Coverage Heatmap, SAL) restano incompleti, non falsi.

**Deploy & Feature Flag (readiness infrastrutturale)** — RED per il lancio pubblico, AMBER per la beta controllata attuale: è il blocco centrale sopra a tutto il resto.

## Gap classificati (13 totali, nessuno oltre P1 nuovo introdotto da questa sessione)

**P0 — bloccante prima di qualunque verifica reale**
1. Produzione ferma 7 commit indietro: nessuna delle feature Dashboard/Il mio centro/Onboarding è oggi osservabile fuori da questa sessione.
2. ~30 test `isRealDeployment`-gated (DASH-P, CENTER-P, ONB-P13, ONB-C) mai eseguiti contro un ambiente live in questa sessione — nessuna conferma end-to-end ancora, solo verifica statica.
3. `TRAMA_ONE_ENABLED` OFF globalmente: se l'obiettivo è includere l'onboarding nel lancio di settembre, serve una decisione esplicita di Fabrizio su quando/come allargare la coorte.

**P1 — importante, non bloccante per la beta controllata**
4. Nessuna route pubblica dedicata al centro (`/centro/[slug]`) — gap confermato via audit, non solo assunto.
5. Documenti numerici del package v4 non riflettono ancora le feature post-06/08 (Sezione 21 dell'Addendum ha la mappa completa).
6. OD-15 (menu "Scatta foto" Profilo mobile) — ancora aperto, non toccato in questa sessione.
7. 88 ID `DEFER`/`ROADMAP_TO_BE` del backlog Handbook non coperti codice-per-codice — dichiarato in v4, non nuovo.

**P2 — minore**
8. Alcuni file di `package/` (Manifest, QA Report) non aggiornati con la nuova voce di changelog.
9. Carousel Parent/Partner duplicati come componenti separati (non un motore condiviso) — debito tecnico dichiarato in codice, non un difetto.

**P3 — trascurabile**
Nessuno rilevato oltre quanto sopra.

## Verdetti di readiness (4 fasi di lancio)

- **Controlled Beta Cohort (oggi)**: READY WITH CONDITIONS — condizionato al deploy dei 7 commit pendenti + verifica manuale (o via Chrome) dei test live.
- **Beta allargata**: NOT YET ASSESSABLE — dipende dalla decisione su `TRAMA_ONE_ENABLED` (gap #3) e dalla conferma live della wave finale.
- **Lancio pubblico Settembre 2026**: NOT YET ASSESSABLE — ON TRACK sui domini core (prenotazioni/check-in/presenze GREEN), ma Dashboard/Il mio centro/onboarding restano variabili non ancora testate live.
- **Piena produzione (rollout globale flag)**: NOT READY — dipende dalle tre fasi precedenti.

## Cosa NON è stato fatto in questa sessione (per costruzione, non per dimenticanza)

Nessun deploy, nessuna migration applicata, nessuna scrittura su dati di produzione, nessun test Playwright live eseguito contro l'ambiente reale, nessun flag abilitato globalmente.

## Commit di questa sessione (7, granulari, titolo in italiano)

1. `23d31e8` — Redesign Dashboard Gestore: blocco "Oggi al centro" + collegamenti rapidi
2. `02b53d7` — Dashboard Gestore: rifinitura workspace operativo giornaliero
3. `c51b9ce` — "Il mio centro": header con anteprima + riepilogo configurazione
4. `a5d172f` — feat: rinnova carosello di benvenuto Parent + punto di replay in Preferenze
5. `853be2f` — feat: aggiunge carosello di benvenuto Partner + punto di replay in Preferenze
6. `46af2a3` — test: copertura Dashboard Partner, Il mio centro e carosello onboarding Partner
7. `93db96b` — docs: Current State Addendum 08/09/2026 + riconciliazione pacchetto v4

## Prossimo passo (di Fabrizio, non di questa sessione)

1. Deploy dei 7 commit pendenti.
2. Verifica live dei flussi (manuale, o assistita via Chrome su richiesta) — in particolare i banner condizionali "Oggi al centro"/"stato positivo singolo" e i due replay onboarding.
3. Decisione su tempistica/ampiezza di allargamento di `TRAMA_ONE_ENABLED` oltre la Controlled Beta Cohort, in vista del lancio di settembre.
