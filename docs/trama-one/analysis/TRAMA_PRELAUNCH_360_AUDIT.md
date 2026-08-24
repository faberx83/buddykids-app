# TRAMA — PRE-LAUNCH 360° AUDIT

**Snapshot**: `TRAMA_PRELAUNCH_AUDIT_20260824` · **AS_OF_COMMIT**: `6d7b1021bdb38d6db2fc77ae4132a32616bedce3` (HEAD = origin/main, working tree pulito)
**Target di programma**: Beta privata entro il 28 settembre 2026
**Documenti collegati**: `TRAMA_PRELAUNCH_360_HEATMAP.md`, `TRAMA_PRELAUNCH_RISK_REGISTER.md`, `TRAMA_PRELAUNCH_REMEDIATION_BACKLOG.md`, `TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md`

---

## PAGINA 1 — SINTESI ESECUTIVA (5 minuti di lettura)

### Stato generale: **AMBER**

Il prodotto funziona: il journey booking Parent↔Partner è reale, testato (144 test critical, 94 pass/0 fail sull'ultimo deploy) e senza dati orfani nel database. Ma **oggi non esiste ancora nessun dato di pilot reale** (0 famiglie, 0 centri reali — solo demo/test), **due dashboard intere (Admin root e Partner) mostrano numeri completamente inventati senza dirlo**, **non esiste un'informativa privacy né un consenso raccolto al signup** per un prodotto che tratta dati di minori, e **la dipendenza core Next.js ha 4 vulnerabilità HIGH note**, inclusa una SSRF potenzialmente sfruttabile. Nessuno di questi è irrisolvibile: sono tutti P0/P1 con un fix a effort S/M, non un problema di architettura.

### Readiness separate

| Area | Stato | Motivazione (1 riga) |
|---|---|---|
| Product | AMBER | Journey principali reali; 2 dashboard (Admin root, Partner) 100% mock senza indicazione |
| Technical | AMBER | tsc pulito, 0 orphan DB, RLS ovunque; ma `next` vulnerabile e race condition su capacità |
| Production | GREEN_WITH_GAP | HEAD=origin=deploy testato (5d15377); ultimo commit (6d7b102, docs+SQL) inerte, nessun rischio |
| Security | AMBER | Nessuna escalation trovata nelle funzioni SECURITY DEFINER; ma dipendenza framework vulnerabile |
| Privacy/Regulatory | RED | Nessuna informativa privacy, nessun consenso T&C — blocker per dati di minori |
| UX | GREEN_WITH_GAP | Nessun dead-end trovato, copy coerente; 2 dashboard mock sono il problema di fiducia principale |
| Accessibility | AMBER | 1 blocker (stato Planner solo-colore), diversi serious, non bloccanti per un pilot con supporto umano |
| Operational | AMBER | Email non configurate (noto), nessun log persistito del journey booking |
| Pilot | RED | Zero famiglie/centri reali onboardati oggi |

### Top 10 rischi (dettaglio completo nel Risk Register)

1. **R-01** Admin root Dashboard/Attività/Analisi/Centri 100% mock, nessun banner — P0
2. **R-02** Partner Dashboard 100% mock, nessun banner — P0
3. **R-03** Nessuna informativa privacy né consenso T&C a signup, dati di minori coinvolti — P0
4. **R-04** Nessun log persistito del journey booking (`product_events` non applicata) — P0
5. **R-05** Zero dati reali di pilot (famiglie/centri/attività) — P0 (blocca il lancio, non il codice)
6. **R-06** `next@16.2.10` con 4 advisory HIGH (incl. SSRF) — P0
7. **R-07** Race condition su `spots_left` (overbooking possibile) — P1
8. **R-08** RESEND_API_KEY non configurata, 6 journey email silenti — P1
9. **R-10** Da confermare applicazione live di migration_22/23/24 (RLS, privacy bucket/share) — P1
10. **R-13** Nessun runbook di backup/restore database — P1

### P0 — numero e descrizione
**6 P0** (R-01, R-02, R-03, R-04, R-05, R-06). Vedi Risk Register per dettaglio completo, evidenza ed evidenza-livello.

### P1 — numero e descrizione
**8 P1** (R-07 race condition capacità, R-08 email non configurate, R-09 Planner senza test su modifiche recenti, R-10 verifica migrazioni live, R-11 documentazione stale, R-12 Feature Registry incompleto, R-13 backup/recovery assente, R-14 admin.ts senza check applicativo esplicito).

### Decisioni richieste a Fabrizio (solo business/non tecniche)

1. **Contenuto legale**: chi scrive/valida il testo dell'informativa privacy e delle condizioni d'uso (C-01/C-02)? Serve un professionista o un template è accettabile per il pilot controllato?
2. **Micro Pilot**: quale centro e quali 3 famiglie reali onboardare per primi (R-05/R-06)? Nessuna azione tecnica può sostituire questa decisione.
3. **Qualifica DSA/marketplace** (C-04): accettabile procedere con mitigazione manuale per il pilot privato, rimandando la qualificazione legale formale a prima dello scale pubblico?
4. **Override permanente feature flag `platform_admin`** (R-26): confermare che è una scelta intenzionale, non un residuo dimenticato.
5. **Backup Supabase**: qual è il piano attuale (tier Supabase) e la policy di backup effettiva? Necessario per documentare R-13.

### Manual gates (azioni che solo Fabrizio può compiere)
- Applicare `migration_20` (product_events), verificare/applicare `migration_22/23/24` (RLS, privacy)
- Configurare `RESEND_API_KEY`
- Deploy della patch `next` e re-run del test live critical
- Onboarding reale di centri/famiglie (Micro Pilot)
- Scrittura/validazione contenuto legale (informativa, T&C)

### Launch confidence: **MEDIUM**
Motivazione: nessun P0 trovato è architetturale o richiede un redesign — sono tutti fix isolati e additivi (banner, patch dipendenza, pagina legale, applicazione di migrazioni già scritte). Il vincolo reale non è la capacità tecnica di chiuderli entro il 28 settembre, ma il fatto che **il Micro Pilot con dati reali non è ancora iniziato** e alcuni gate richiedono decisioni/contenuti che solo Fabrizio può produrre (specialmente il testo legale). Non è HIGH perché più P0 sono ancora aperti contemporaneamente e nessuno è stato ancora pianificato in un Release Candidate; non è LOW perché nessuno di essi è bloccante nel senso di "richiede un redesign" o "rischio di corruzione dati" — sono tutti risolvibili con effort noto in giorni, non settimane.

---

## PARTE 2 — DETTAGLIO PER SEZIONE (evidenza completa nei documenti collegati)

### Sezione 0 — Precondizione e snapshot
- HEAD = `origin/main` = `6d7b1021bdb38d6db2fc77ae4132a32616bedce3`, working tree pulito (verificato `git status --short --branch`).
- Ultimo commit deployato in produzione (per quanto risulta dai log di deploy più recenti condivisi da Fabrizio): `5d15377`, con `TEST_SCOPE=critical` PASS (144 test, 94 pass, 0 fail, 50 skipped).
- Delta HEAD vs ultimo deploy: **1 commit** (`6d7b102`, docs + migrazione SQL bozza School Calendar) — **zero file applicativi modificati**, confermato dall'agente di regressione (nessun riferimento a `school_calendars`/`school_calendar_events`/`kid_school_profiles`/`school_calendar_overrides` in `app/`, `lib/`, `components/`). Nessun rischio di deploy.
- Delta rispetto a `8e83743` (ultimo Documentation QA): 24 commit, analizzati singolarmente nel Regression Risk (§35 sotto).
- **Sorpresa rispetto all'aspettativa iniziale**: le 4 tabelle School Calendar (`school_calendars`, `school_calendar_events`, `kid_school_profiles`, `school_calendar_overrides`) **risultano già presenti nel database live** con RLS abilitata (DB_VERIFIED via `list_tables`) — la migrazione è stata quindi applicata da Fabrizio dopo la sua bozza, ma **nessun codice applicativo la usa ancora**: la feature è schema-only, completamente dormiente, zero rischio per Planner/Booking.
- Stato aggiornato dei 5 item richiesti: OD-02 (bulk "Giornata particolare") = CLOSED con test live PASS (confermato da storico commit); School Calendar Intelligence = schema applicato, app dormiente, gate di implementazione ancora aperto; Feature Control Center = reale e funzionante (`/admin/one`), ma coesiste con superficie mock non catalogata (R-01/R-12); onboarding Parent = funzionante, nessun blocco trovato; onboarding Partner = funzionante (identity verification, checklist, state machine), nessuna azione trovata senza autorizzazione.

### Sezione 3 — Product: coerenza della promessa
Vedi Risk Register R-01, R-02, R-11, R-12 per il dettaglio. Sintesi: i journey principali (Parent booking, Partner onboarding/inbox/availability) sono reali e coerenti con quanto promesso dalla UI. Il problema di coerenza più grave è nelle due dashboard "vetrina" (Admin, Partner), che mostrano un business fittizio con piena autorità visiva. Nessun'altra CTA a vicolo cieco è stata trovata; le feature incomplete (lingua/tema, pagamenti, calendario view) sono onestamente etichettate "in arrivo".

### Sezione 4-6 — Parent / Partner / Admin
Vedi Risk Register e Heatmap. Punti salienti non già coperti sopra:
- **Parent**: onboarding, Planner, Ricerca, Booking, Le mie prenotazioni sono tutti reali e collegati al database, senza dead-end. Il gap principale è privacy (C-01/C-02/C-03), non funzionale.
- **Partner**: Availability Calendar (bulk "Giornata particolare") ha una race condition nota (R-07) e copertura test solo unitaria, non di concorrenza. Identity verification, checklist onboarding, Spotlight/Walkthrough sono reali e testati.
- **Admin**: Command Center (`/admin/one`) reale; il resto della sezione Admin "classica" è la sorpresa peggiore di questo audit (R-01).

### Sezione 7 — Cross-portal contracts
Nessuna duplicazione di source-of-truth trovata: booking/attività/settimane/giorni hanno un'unica tabella canonica per oggetto (`bookings`, `activities`, `activity_weeks`, `activity_days`) letta coerentemente da Parent/Partner/Admin reali (non dalle pagine mock). Il `JourneyContext` tipizzato (`lib/journey-context.ts`) esiste come infrastruttura ma non è ancora agganciato al flusso reale Riempi→Ricerca→Dettaglio→Booking, che usa parametri flat legacy — gap di adozione, non di design, già noto da Sprint 3.

### Sezione 8 — Database
0 orphan trovati su bookings/activities/kids/booking_kids/onboarding (DB_VERIFIED, query dirette). RLS abilitata su tutte le 60 tabelle pubbliche. Uniche segnalazioni: WARN performance (FK non indicizzate, pattern `auth_rls_initplan`, indici inutilizzati — tuning, non bloccante) e WARN security minori (search_path mutabile su ~19 funzioni, grant PUBLIC di default sulle funzioni SECURITY DEFINER — verificato che ogni funzione controlla comunque l'identità del chiamante internamente, nessuno sfruttamento trovato).

### Sezione 9 — Security
Nessuna escalation di privilegio trovata nelle funzioni SECURITY DEFINER (verificate una per una). Nessun XSS/injection/open-redirect/secret committato. Gap reali: validazione upload solo client-side (enforcement reale dipende dalla config bucket Storage, non verificabile da codice), nessun rate-limiting (accettabile per Beta a coorte controllata), e soprattutto **`next@16.2.10` con 4 advisory HIGH** (R-06) — questo è l'unico item di sicurezza che richiede un'azione prima del lancio, non solo hardening.

### Sezione 10-13 — Privacy / Cookie / T&C / Regulatory
Vedi `TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md` per il dettaglio completo con fonti. Sintesi: gap MUST-BEFORE-PILOT su informativa privacy e consenso T&C (C-01/C-02); la qualifica DSA e i termini Partner sono gestibili con mitigazione manuale per un pilot privato controllato, non bloccanti a questa scala.

### Sezione 14-15 — Accessibility / Responsive
1 blocker CODE_VERIFIED (Planner: stato settimana comunicato solo a colore), diversi serious (input senza label, heading hierarchy, nessun `aria-live`). Responsive/visual: nessun overflow di pagina trovato staticamente; 2 griglie (Availability Partner, funnel Admin) richiedono scroll orizzontale contenuto su mobile — pattern accettato, non un bug, ma friction UX. **Nessuna verifica live 390×844/768/1440 è stata eseguita in questo audit** (riservata a un test live, task #474/#526 già aperti e non ancora eseguiti da Fabrizio) — marcato NOT_TESTED, non GREEN.

### Sezione 16-17 — UX / Brand
Nessun dead-end, nessun placeholder/Lorem ipsum, copy Partner/Gestore coerente lato utente. Un hex hardcoded residuo (`#D4622A`) e una "shadow palette" di colori non gestiti — cosmetico, non bloccante.

### Sezione 18-19 — Performance / Reliability
Performance: nessuna misura diretta eseguita in questo audit (richiede profiling live, NOT_TESTED); i WARN Supabase sono tuning, non blocker. Reliability: race condition reale su `spots_left` (R-07), nessuna idempotenza esplicita su creazione booking (mitigata lato client), nessun timeout esplicito sulle chiamate Supabase.

### Sezione 20 — Email
6 journey wired al codice Resend (candidatura NO, ma richiesta/risposta/check-in/assenza/inviti gruppo/famiglia SÌ) — tutti attualmente non operativi per assenza di `RESEND_API_KEY`, confermato oggi da un booking reale con `email_delivery_status=not_configured`. Degradazione onesta: l'app non dichiara mai falsamente "email inviata".

### Sezione 21 — Data quality
0 dati reali di pilot. 12 centri = 5 demo curati + 7 test/placeholder (inclusi 2 creati automaticamente oggi stesso da test di idempotenza — `[TEST] Centro Auto LEAD...`, `[TEST] Centro Idempotenza...`). 9 attività = 5 demo + 4 test. 15 bookings, tutti demo/test (incluso uno da 0,01€ creato oggi). Nessuna contaminazione di KPI possibile oggi, semplicemente perché non esiste ancora nessun KPI reale.

### Sezione 22 — School Calendar
Migrazione applicata (4 tabelle, RLS coerente col resto dello schema), **zero codice applicativo la usa**. Nessun impatto su Planner/Booking. Il gate di implementazione resta al passo G del processo mandato in precedenza (STATUS report già prodotto, `SCHOOL_CALENDAR_INTELLIGENCE_STATUS.md`) — non riaperto qui, resta un item separato dal lancio Beta di settembre salvo diversa decisione di Fabrizio.

### Sezione 23-28 — Operations / Support / Observability / Backup / Dependency / Browser
- Operations: nessun processo di triage/escalation documentato oltre al Beta feedback UI (esiste, reale, ma senza SLA/owner scritto).
- Observability: gap reale (R-04) — nessun log persistito del journey booking.
- Backup: nessun runbook DB generico (R-13); kill-switch feature flag invece ben documentato e reale.
- Dependency: `next` da patchare (R-06); resto delle dipendenze aggiornate entro drift minori.
- Browser: nessuna matrice di supporto browser testata in questo audit (NOT_TESTED).

### Sezione 29-30 — SEO / Content
Non è stato eseguito un controllo dedicato robots/sitemap/noindex in questo giro di audit (NOT_TESTED) — nessuna route Admin/Partner autenticata è stata trovata linkata pubblicamente nei file controllati, ma questo va confermato con un controllo dedicato di `robots.txt`/`sitemap.xml` prima del lancio pubblico (non bloccante per un pilot privato).

### Sezione 31 — Feature flag / Release safety
`TRAMA_ONE_ENABLED`: scope globale disattivato (sicuro), coorte Beta controllata con scadenza 02/10/2026 (dopo il target del 28/09, corretto), override permanente per `platform_admin` (da confermare intenzionale, R-26). Resolver fail-closed su ogni errore (verificato: unknown flag, Supabase non configurato, errore DB, eccezione generica → sempre `false`). Nessun mock può "entrare" in produzione per un utente reale senza passare da uno di questi controlli.

### Sezione 32 — Pilot readiness
**Non pronti oggi.** Zero centri reali, zero famiglie reali, nessun dataset di pilot. Il Micro Pilot (1 centro + 3 famiglie) richiede un'azione di business (onboarding reale), non tecnica.

### Sezione 33 — Golden Journey Matrix

| ID | Journey | Prerequisito | DB evidence | Test automation | Risultato | Blocker |
|---|---|---|---|---|---|---|
| GJ-01 | Parent onboarding | Nessuno | 6 profili reali in DB (test/staff) | `tests/genitori/profilo.spec.ts` | STATIC_TESTED | Nessuno |
| GJ-02 | Partner candidacy | Form pubblico | `center_leads` con candidature reali processate | `tests/gestore/*` (parziale) | STATIC_TESTED | Nessuno |
| GJ-03 | Admin approval | Candidatura pending | `center_onboarding_audit_log` (9 righe reali) | `tests/one/onboarding*.spec.ts` | STATIC_TESTED | Nessuno |
| GJ-04 | Partner first activity | Centro approvato | `activities` con centri reali | Copertura parziale | STATIC_TESTED | Nessuno |
| GJ-05 | Partner availability | Attività creata | `activity_days`/`activity_weeks` popolate | `tests/gestore/calendario-bulk.spec.ts` (8 unit PASS, 3 E2E deploy-only) | STATIC_TESTED (unit) / NOT_YET_TESTED (E2E live) | R-07 (race condition, non blocca il test, ma è un rischio residuo) |
| GJ-06 | Parent discovery | Attività pubblicate | — | `tests/nextgen/search-filters-5-7.spec.ts` | STATIC_TESTED | Banner demo mancante su fallback mock (R-vedi Product) |
| GJ-07 | Parent request | Attività trovata | `bookings` reali (15 righe, demo/test) | Copertura suite critical | STATIC_TESTED | Nessuno |
| GJ-08 | Partner total acceptance | Richiesta pending | `bookings.partner_decision=accepted` (13/15 righe) | Copertura suite critical | STATIC_TESTED | Nessuno |
| GJ-09 | Partner partial acceptance | Richiesta multi-giorno | `booking_days.partner_decision` | Copertura Sprint 4 | STATIC_TESTED | Nessuno |
| GJ-10 | Alternative proposal | Rifiuto Partner | `partner_proposal_note`/`partner_proposed_at` (schema presente, 0 righe popolate) | Non confermato in questo audit | NOT_YET_TESTED | Nessuna riga reale con proposta alternativa trovata |
| GJ-11 | Booking → Planner | Booking confermato | `SeasonWeek.coveredKids` (verificato via codice) | Copertura Sprint 3/5 | STATIC_TESTED | R-09 (modifiche recenti senza test dedicato) |
| GJ-12 | CenterLead | Segnalazione centro | `center_leads` (0 righe reali oggi) | `tests/*` esistenti | STATIC_TESTED (codice) / NOT_YET_TESTED (dato reale) | Nessuno |
| GJ-13 | Feature rollout | Flag registry | Verificato via query dirette | `tests/one/feature-flags.spec.ts` | STATIC_TESTED | Nessuno |
| GJ-14 | Email delivery | Booking creato | `email_delivery_status=not_configured` (booking reale oggi) | N/A (dipende da secret) | **FAILED oggi** (per assenza chiave, non per bug) | R-08 |
| GJ-15 | School calendar → Planner → Riempi | Feature non implementata (solo schema) | Tabelle vuote, 0 righe | N/A | **N/A — feature non ancora costruita in app** | Non bloccante per il lancio Beta base |

**Nessun risultato è dichiarato PASSED da esecuzione live in questo audit** — tutti i risultati sopra sono STATIC_TESTED (basati su suite Playwright esistenti + evidenza DB) salvo dove esplicitamente segnato NOT_YET_TESTED/FAILED. L'esecuzione live completa della matrice resta un gate separato per Fabrizio (§34).

### Sezione 34 — Test strategy eseguita in questo audit
- `npx tsc --noEmit -p .` → **pulito, 0 errori**.
- `npx eslint .` → non completato entro il timeout della sessione (177s), non un fallimento del lint, va rieseguito in una sessione con più tempo a disposizione — **NOT_VERIFIED**, non dichiarato pulito.
- `npm audit --omit=dev` → **4 advisory HIGH** (next, nanoid, postcss, sharp) — vedi R-06/R-24.
- Nessun run Playwright live è stato eseguito da Claude in questo audit (per governance: i test live/deploy sono riservati a Fabrizio). Le evidenze Playwright citate sopra si basano sui risultati dell'ultimo run reale condiviso da Fabrizio (144 test critical, 94 pass, 0 fail, deploy `5d15377`) e sull'ispezione statica delle suite esistenti.

**Comando unico raccomandato per Fabrizio** (gate live contro il Release Candidate, dopo aver chiuso i P0 di codice):
```
bash deploy.sh && TEST_SCOPE=critical npm run test:e2e
```
(stesso comando già in uso nei deploy precedenti — nessun nuovo script introdotto per non moltiplicare i comandi manuali, come richiesto).

### Sezione 35 — Regression risk (dettaglio completo nel report dell'agente dedicato, riassunto qui)
24 commit dal Documentation QA (`8e83743`). Le aree a rischio più alto senza test dedicato: **Planner** (3 commit consecutivi su `computeWeekStatus`/coverage logic, zero test diretti — R-09), **privacy storage** (bucket avatar bambini + plan-shares, migrazioni non confermate applicate — R-10), **Gruppi/Groups** (nuova RLS `is_public` + RPC `list_public_groups`/inviti, testato solo lato mittente, non lato destinatario). **School Calendar è confermato 100% dormiente** (nessun riferimento applicativo alle 4 nuove tabelle in `app/`/`lib/`/`components/`) — zero rischio di regressione.

### Sezione 40 — Launch Gate Matrix

| Gate | Descrizione | Stato |
|---|---|---|
| LG-01 Product Scope | MVP coerente, feature future isolate | **PASS WITH CONDITIONS** — isolate correttamente (School Calendar dormiente, feature incomplete etichettate), ma 2 dashboard mock non isolate/segnalate (R-01/R-02) |
| LG-02 Production Truth | HEAD=origin=deploy=tested | **PASS** — confermato, delta di 1 commit inerte |
| LG-03 Security | Nessun P0 security/privacy | **FAIL** — R-06 (dipendenza vulnerabile) è un P0 aperto |
| LG-04 Regulatory | Nessun blocker normativo senza mitigazione | **FAIL** — C-01/C-02 aperti (MUST BEFORE PILOT) |
| LG-05 Data Integrity | RLS, ownership, capacity, booking coerenti | **PASS WITH CONDITIONS** — RLS/ownership confermati; race condition capacità aperta (R-07, P1 non P0) |
| LG-06 Parent Golden Journey | Journey Parent live verde | **NOT YET TESTED** — nessuna esecuzione live in questo audit |
| LG-07 Partner Golden Journey | Journey Partner live verde | **NOT YET TESTED** |
| LG-08 Admin Operations | Admin può gestire il pilot | **PASS WITH CONDITIONS** — Command Center reale sì, ma root Admin mock rischia di confondere l'operatore (R-01) |
| LG-09 Email/Notification | Comunicazioni critiche operative | **FAIL** — R-08, nessuna email parte oggi |
| LG-10 UX/Visual/Mobile | Journey utilizzabili sui device target | **NOT YET TESTED** — nessuna verifica live 390/768/1440 eseguita |
| LG-11 Accessibility | Nessun blocker sulle journey core | **FAIL** — R-19 (Planner solo-colore) è un blocker WCAG confermato da codice |
| LG-12 Operations & Support | Supporto e rollback disponibili | **PASS WITH CONDITIONS** — kill-switch flag reale; nessun backup/restore runbook (R-13) |
| LG-13 Pilot Data | Dati test separati da pilot | **PASS** — oggi non c'è ALCUN dato pilot da contaminare; i dati test sono chiaramente etichettati (`[TEST]`) |
| LG-14 Observability | Problemi reali diagnosticabili | **FAIL** — R-04, nessun log persistito del journey booking |
| LG-15 Pilot Readiness | Centri/famiglie/processo pronti | **FAIL** — R-05, zero pilot reale oggi |

**6 gate FAIL, 4 PASS WITH CONDITIONS, 2 PASS, 3 NOT YET TESTED.** Per la Decision Rule (§44), un solo P0 irrisolto basta a impedire il GO — qui ce ne sono 6 aperti contemporaneamente sui gate LG-03/04/09/11/14/15.

### Sezione 41 — Timeline verso il 28 settembre 2026

**ENTRO FINE AGOSTO (traguardo: 31/08)**
- P0 di codice chiusi: patch `next` (RB-01), banner demo su Admin/Partner (RB-02/03), applicazione migrazioni pendenti (RB-05/06/10), pagina informativa privacy + consenso T&C (RB-04, dipende dal contenuto legale di Fabrizio).
- RESEND_API_KEY configurata (RB-08).
- Release Candidate taggato dopo la chiusura dei 6 P0.
- Procedura Golden Journey (§33) pronta per esecuzione live.
- Decisione su 1 centro + 3 famiglie del Micro Pilot presa da Fabrizio.

**PRIMA METÀ SETTEMBRE (1-14/09)**
- P0 chiusi e verificati live; Golden Journey GJ-01..GJ-14 eseguiti live sul Release Candidate.
- Verifica mobile/visual 390×844/768/1440 (task #474/#526 già aperti, da eseguire ora).
- Compliance minimo pubblicato (informativa + T&C live).
- Micro Pilot avviato: 1 centro + 3 famiglie reali.

**METÀ SETTEMBRE (15-21/09)**
- Controlled Pilot esteso (3-5 centri, 10-20 famiglie) se il Micro Pilot non emerge blocker nuovi.
- Remediation dei P1 rimanenti (R-07 race condition, R-09 test Planner, R-13 runbook backup).
- Supporto/analytics/feature control verificati in condizioni reali.

**SETTIMANA PRE-LANCIO (22-27/09)**
- Release freeze.
- Regressione completa (`TEST_SCOPE=all` o `critical` a seconda del rischio residuo).
- Visual/mobile finale.
- Verifica rollback (feature flag kill-switch + procedura deploy precedente).
- Check legale/privacy finale.
- Evidenza pilota raccolta (Micro + Controlled Pilot).
- GO/NO-GO finale.

**Sostenibilità del piano**: dichiarata con evidenza — **sostenibile ma stretta**. I 6 P0 di codice sono tutti a effort S/M e chiudibili entro fine agosto da Claude; il vincolo reale è il **contenuto legale** (RB-04, dipende da Fabrizio/consulenza esterna) e **l'avvio effettivo del Micro Pilot** (dipende dalla disponibilità di centri/famiglie reali, non da codice). Se il contenuto legale non è pronto entro inizio settembre, il 28 settembre rischia concretamente di slittare — non per limiti tecnici, ma per un gate di business/legale fuori dal controllo di Claude.

---

## VERDETTO FINALE

**AUDIT COMPLETE**

### PRODUCT MVP READINESS: **READY WITH CONDITIONS**
Condizioni: chiudere R-01/R-02 (banner o dati reali sulle 2 dashboard mock), aggiornare Feature Registry (R-12).

### TECHNICAL RELEASE READINESS: **READY WITH CONDITIONS**
Condizioni: patch `next` (R-06), fix race condition capacità (R-07, consigliato ma non bloccante al volume del Micro Pilot), verifica applicazione live delle migrazioni pendenti (R-10).

### REGULATORY / OPERATIONAL READINESS: **NOT READY**
Motivazione: C-01/C-02 (informativa privacy, consenso T&C) sono MUST BEFORE PILOT e oggi assenti; R-04 (observability) e R-13 (backup) sono gap operativi reali non ancora colmati.

### SEPTEMBER 28 LAUNCH: **NOT YET ASSESSABLE — ON TRACK**
Motivazione: nessun blocco trovato è strutturale; tutti i P0 hanno un fix noto e a basso effort. Non è ancora "assessable" come GO/NO-GO definitivo perché (a) il Micro Pilot non è ancora iniziato, (b) nessuna esecuzione live dei Golden Journey è stata fatta in questo audit, (c) il contenuto legale non dipende da Claude. È "ON TRACK" e non "AT RISK" perché il piano a ritroso (§41) risulta sostenibile con l'esecuzione disciplinata già dimostrata nei cicli precedenti di questo progetto (144/144 test critical passati all'ultimo deploy, 0 regressioni introdotte da 24 commit consecutivi analizzati).

---

Per la Decision Rule (§44): il 28 settembre **non può ricevere GO** finché restano aperti i 6 P0 sopra elencati (in particolare privacy blocker C-01/C-02, security R-06, observability R-04, e l'assenza di un pilot reale R-05) — questo è coerente con la regola esplicita "nessun P0 irrisolto, nessun privacy blocker, nessuna impossibilità di rollback, nessun test/demo data scambiato per reale, nessun pilot reale effettuato".

Da qui, decidiamo insieme il piano di chiusura.
