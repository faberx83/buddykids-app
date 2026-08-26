# TRAMA — FINAL PLATFORM PRODUCT TRUTH

**Legacy Dependency, Completeness & Beta Promise Audit — 25/08/2026**

AUDIT ONLY. Nessuna remediation eseguita in questo documento o negli altri 8 output collegati. Ogni P0 trovato è registrato, non corretto.

---

## EXECUTIVE SUMMARY

**PLATFORM STATE:**
PILOT READY WITH CONDITIONS

**PARENT:**
AMBER

**PARTNER:**
RED

**ADMIN:**
AMBER

**CROSS-PLATFORM:**
AMBER

**PRODUCTION EVIDENCE:**
RED

**PILOT VALIDATION:**
RED

### TOP 10 LEGACY DEPENDENCIES

1. `/center` (dashboard Partner) in produzione legge oggi 100% `lib/mock-data.ts` per centro/attività/prenotazioni/promozioni/revenue/occupancy — nessun banner. LEGACY_DATA_MODEL + LEGACY_BLOCKING_EVOLUTION (rotto per un Partner reale).
2. `/admin`, `/admin/activities`, `/admin/analytics` (parziale) in produzione leggono `lib/mock-data.ts` — nessun banner. Stessa classe di rischio del punto 1.
3. `/admin/centers` in produzione legge mock con banner parziale ("Elenco demo", solo badge, nessuna spiegazione). LEGACY_VISUAL parzialmente mitigato.
4. NEXTGEN è una seconda implementazione parallela completa (non un semplice restyling) convivente con LEGACY nello stesso repo, selezionabile solo da un cookie client-side (`bk_version`, `VersionToggle.tsx`) senza enforcement server-side e senza mapping 1:1 pagina-per-pagina. LEGACY_NAVIGATION + LEGACY_TECH_DEBT_ONLY (stabile ma oneroso da mantenere in doppio).
5. `activities.spots_left` è un campo editoriale mai sincronizzato con la capacità reale (`activity_weeks`/`activity_days`), duplicazione nota e documentata, rischio MEDIO. LEGACY_DATA_MODEL.
6. Modello booking "richiesta, non prenotazione istantanea": nessuna riserva di capacità al momento della richiesta, solo all'accettazione Partner — comportamento voluto (DEC-42) ma mai spiegato esplicitamente al Parent nell'UI. LEGACY_LOGIC (di design, non bug).
7. `/nextgen/planner/logistica` — redirect shim deprecato verso `/nextgen/profile/famiglia`, tenuto solo per bookmark vecchi. LEGACY_TECH_DEBT_ONLY.
8. `/center/one` e `/admin/one/onboarding` sono orfani di navigazione (nessun link in nessun menu, raggiungibili solo via URL diretto o redirect condizionato dal flag). LEGACY_NAVIGATION residuo della costruzione incrementale di TRAMA ONE.
9. Nessun meccanismo di publish/unpublish attività: un'attività Partner è visibile dal momento della creazione, nessun modo di "spegnerla" se non intervento diretto DB/Admin. LEGACY_BLOCKING_EVOLUTION (assenza strutturale, non solo debito tecnico).
10. Cancellazione account = disattivazione soft; cancellazione GDPR reale è SQL manuale, senza SLA, senza export/portabilità. LEGACY_DATA_MODEL + rischio compliance.

### TOP 10 INCOMPLETE CAPABILITIES

1. Modifica/cancellazione figlio: solo avatar e interessi sono modificabili dopo la creazione; nessuna action per nome/data di nascita/genere; nessuna cancellazione figlio.
2. Cancellazione account: solo disattivazione soft, riattivazione richiede contatto assistenza manuale; nessuna cancellazione/export reale.
3. School Calendar: SCHEMA_ONLY — 4 tabelle vive in DB con 0 righe, zero codice applicativo, zero flag, zero UI, zero test. Non è "in corso", è pre-implementazione.
4. Editor add/remove giorni su prenotazione Giorni spot (Modifica prenotazione): codice completo, non ancora deployato.
5. Intero Legal Gate (route pubbliche /privacy /terms, wiring signup, dichiarazione parentale, rimozione service-role): codice completo, non ancora deployato; e comunque bloccato a monte dall'assenza di contenuti legali pubblicabili.
6. Partial accept strutturato per prenotazioni a settimana: non esiste, solo per Giorni spot; per le settimane l'unica via è una nota libera "Proponi alternativa".
7. Publish/unpublish attività Partner: non esiste alcun meccanismo.
8. Multi-site Partner (un Gestore con più centri): non supportato architetturalmente (FK singola `profiles.center_id`).
9. Analytics Partner-facing: non esiste (solo Admin ha `/admin/analytics`, e in produzione è parzialmente mock).
10. JourneyContext (correlationId unificato search→dettaglio→booking): infrastruttura costruita ma non collegata; la correlazione reale oggi avviene solo via parametri URL legacy.

### TOP 10 MANUAL OPERATIONS

1. Iscrizione di un centro/famiglia reale al cohort `trama-one-controlled-beta`: SOLO SQL, nessuna UI Admin per `beta_cohort_memberships`.
2. Promozione di un account autoregistrato a `center_admin`: SOLO SQL — ma percorso di recovery per un caso non previsto (il percorso reale è la candidatura pubblica), non un'operazione ordinaria.
3. Sblocco profilo bloccato da bug RLS storico (migration_22): script SQL con bypass service-role — pericoloso, usare solo se necessario.
4. Pulizia igiene produzione (centri/lead di test orfani): SQL manuale, deliberatamente non automatizzato.
5. Cancellazione account GDPR: SQL manuale, nessuna SLA, nessun export — rischio alto trattandosi di dati di minori.
6. Approvazione candidatura centro reale ("Approva e crea centro"): UI Admin reale, operazione attesa e non un gap.
7. Revisione verifica identità Partner: UI Admin reale con audit log dedicato, operazione attesa.
8. Configurazione RESEND_API_KEY: gate su servizio esterno, di competenza Fabrizio, con fallback manuale già formalizzato per la durata del pilot.
9. "Pausa" di un'attività pilota in corso: nessuno switch dedicato, workaround = nasconderla da Ricerca via UI esistente.
10. Deploy in produzione: oggi bloccato da un problema di autenticazione Vercel CLI ("Not authorized") — non SQL, ma comunque un'operazione manuale di Fabrizio necessaria prima che qualunque fix arrivi agli utenti.

### TOP RELEASE CONDITIONS

- Risolvere l'errore di autenticazione Vercel e ridistribuire in produzione i 49 commit fermi da `6d7b102` — condizione bloccante per QUALSIASI altra chiusura elencata sopra, perché tutte le fix di mock/legal/day-editor esistono solo nel repo.
- Pubblicare contenuto legale reale (Privacy, Termini Genitore, Termini Partner/Beta, testo Dichiarazione parentale) e solo allora valutare l'attivazione di `LEGAL_TERMS_GATE`.
- Confermare `RESEND_API_KEY` in produzione o accettare esplicitamente il fallback manuale per la durata del Micro Pilot.
- Eseguire l'upgrade Next.js pianificato (16.3.3) subito dopo la Security Release del 26/08/2026.
- Decidere se procedere con un Micro Pilot reale prima o dopo il redeploy dei fix mock (raccomandazione: dopo, vedi verdetto finale).

### WHAT IS ALREADY CUSTOMER-PROMISABLE

Signup/login, gestione base famiglia e figli (aggiunta, non modifica/cancellazione), Home, Planner (copertura, budget, calendario, mappa con coordinate stubbate), Ricerca/scoperta con filtri avanzati, dettaglio attività, preferiti, flusso "Riempi"/richiesta prenotazione, risposta Partner (intera/per-giorno/rifiuto/alternativa), Le mie prenotazioni con cancellazione, gruppi/community, condivisione piano, promemoria, segnalazioni (NextGen), profilo/impostazioni. Lato Partner: candidatura, onboarding con verifica identità, creazione/gestione attività, calendario Giorni spot con edit massivo "Giornata particolare", prezzi/sconti/last-minute, capacità con protezione CAS, inbox richieste, risposta a prenotazioni, cancellazione/rimborso per giorno. Lato Admin: coda candidature, revisione onboarding/identità, gestione prenotazioni/richieste/gruppi, Feature Control Center, certificazioni, tag, segnalazioni beta — **tutto quanto sopra è però condizionato al superamento della condizione di release "redeploy"**, perché parte del codice che rende queste capability sicure/corrette oggi non è in produzione.

### WHAT MUST NOT YET BE PROMISED

Contenuto legale reale (Privacy/Termini/Dichiarazione parentale) e qualunque claim di conformità GDPR; cancellazione account come "cancellazione dati reale" (è soft-deactivation); modifica/cancellazione profilo figlio; School Calendar in qualunque forma ("arriva presto" è la formulazione massima accettabile, non "in sviluppo"); pagamenti in-app; multi-site Partner; analytics Partner; notifiche email come garantite (Resend non configurato); publish/unpublish attività autonomo; partial accept strutturato su prenotazioni a settimana; qualunque numero di utenti/metriche di trazione reali (nessun Micro Pilot è stato ancora eseguito con utenti reali).

### SEPTEMBER PRIVATE BETA SCOPE

Vedi `TRAMA_SEPTEMBER_BETA_PRODUCT_CONTRACT.md` e `TRAMA_BETA_ROADMAP_EXTERNAL.md` per il dettaglio contrattuale. In sintesi: 1 Partner + 3 famiglie, poi 3-5 Partner + 10-20 famiglie, sui journey "customer-promisable" sopra elencati, con assistenza TRAMA per onboarding/verifica identità/email mancante, e senza le capability nella lista "must not yet be promised".

### POST-BETA SCOPE

Vedi `TRAMA_BETA_ROADMAP_EXTERNAL.md`.

---

## 1. FREEZE DELLA FOTOGRAFIA REALE (25/08/2026, ore 18:31 CEST)

| Dimensione | Valore verificato |
|---|---|
| Data/ora rilevazione | 25/08/2026, 18:31 CEST |
| Branch | `main` |
| HEAD SHA (repo current) | `e0d4911a1024d32cbdb279e680f7d6fc7ced5228` |
| origin/main SHA | `e0d4911` (allineato, push riuscito) |
| Working tree | clean |
| Ahead/behind vs origin | 0/0 |
| **Ultimo deploy PRODUZIONE realmente riuscito e verificato** | commit `6d7b102`, 24/08/2026 ore ~18:05 — build "✓ Ready in 27m", alias confermato su `buddykids-app.vercel.app` + `buddykids-partner.vercel.app` + `buddykids-admin.vercel.app`, **93 test Playwright live passati / 51 skipped post-deploy** |
| Commit repo-current NON ancora deployati | **49 commit** tra `6d7b102` e `e0d4911` (inclusa l'intera costruzione Legal Gate, rimozione service-role, editor giorni prenotazione TC-N658, fix dashboard mock Admin/Partner, fix Copertura estate, fix Modifica prenotazione, capacity CAS, Wave 1 completo) |
| Tentativi di deploy odierni (25/08) | **2 falliti**: ore 17:51 → `Error: fetch failed` durante download file di build (infrastrutturale Vercel); ore 18:29 → `Error: Not authorized` (autenticazione Vercel CLI) |
| Ultimo commit realmente testato live (Playwright post-deploy) | `6d7b102` |
| Ultimo critical test eseguito (locale, non post-deploy) | 25/08, `tests/one/legal-gate.spec.ts` — 11 passed, 8 skipped |
| Feature flag live (DB `feature_flag_overrides`) | `TRAMA_ONE_ENABLED`: globale=false; `role=platform_admin`=true (nessuna scadenza); `cohort=trama-one-controlled-beta`=true fino al 2026-10-02. `LEGAL_TERMS_GATE`: nessun override — usa il default codice, OFF |
| Cohort live | `trama-one-controlled-beta` (unica esistente, scadenza 2026-10-02) |
| Migrations effettivamente live | Tracciamento nativo Supabase (`list_migrations`) vuoto — le migration di questo progetto sono applicate come SQL diretto, non via CLI migration tracking. Verificate live per contenuto reale: migration_27 LIVE, migration_28 LIVE BUT DEFECTIVE / SUPERSEDED BY migration_29, migration_29 LIVE (PASS), migration_26 (School Calendar schema) **LIVE** (4 tabelle esistenti, 0 righe — non risulta nella documentazione come applicata, discrepanza di tracciamento, non di sicurezza) |
| Supabase project | `eagsgfxunwyyxwwilldy` (buddykids, eu-west-3) |
| Stato Resend | NON configurato in produzione (`RESEND_API_KEY` assente); fallback manuale formalizzato in `GATE_RESEND_API_KEY.md` |
| Versione Next.js | `16.2.10` — 4 advisory HIGH note (alcune non applicabili), patch a `16.3.3` intenzionalmente rimandata a dopo la Security Release del 26/08/2026 (decisione Fabrizio), non ancora eseguita |
| Stato LEGAL_TERMS_GATE | OFF, `legal_documents` contiene 0 righe pubblicate |

**Distinzione esplicita richiesta dalla governance:**

- **REPO CURRENT** = `e0d4911` (tutto il codice descritto in questo audit come "costruito" esiste qui).
- **DEPLOYED PRODUCTION** = `6d7b102` — un'utenza reale che usa l'app oggi vede il prodotto COME ERA IL 24/08, non come descritto nelle sezioni "repo current" di questo documento, salvo dove esplicitamente segnalato "YES" nella colonna Deployed.
- **DB LIVE** = le migration/tabelle Supabase, verificate per query diretta, indipendenti dal deploy applicativo (una migration DB può essere live anche se il codice che la usa non è ancora deployato — è esattamente il caso del Legal Gate).
- **LAST TESTED** = 25/08 in locale (tsc/eslint/Playwright non-live) per i 49 commit undeployed; 24/08 in produzione reale per tutto il resto.
- **PILOT VALIDATED** = nessuna riga di questo audit può reclamare questo stato: nessun Partner o famiglia reale ha ancora usato la piattaforma in un Micro Pilot.

---

## 2. ARCHITETTURA REALE — TRE SUPERFICI PRODOTTO

Correzione rispetto all'assunzione comune "Legacy vs NextGen = vecchio vs nuovo, TRAMA ONE = la stessa cosa di NextGen": **esistono tre superfici distinte**, non due:

1. **LEGACY** — `app/(main)/*`, `app/center/*` (meno `/one`), `app/admin/*` (meno `/one`), `app/booking`, `app/activity`, `app/prenotazioni`, `app/auth/*`. Nessun flag. Sempre attiva. È la superficie in produzione oggi per la stragrande maggioranza degli utenti.
2. **NEXTGEN** — `app/nextgen/*` (Parent, Partner minimale, Admin minimale/placeholder). **Non gated da alcun feature flag**: raggiungibile da chiunque loggato visitando `/nextgen`. Il passaggio è governato solo da un cookie client-side (`bk_version`, `components/VersionToggle.tsx`), senza enforcement server-side e senza mapping 1:1 pagina-per-pagina (passare a metà percorso atterra sempre sulla Home dell'altro prodotto). È una seconda implementazione quasi completa del prodotto Parent, con capability aggiuntive (Community, Segnalazioni beta, Mappa, Promemoria, Condivisione Piano) assenti in Legacy.
3. **TRAMA ONE** (`/one`, `/center/one`, `/admin/one`) — un terzo shell più piccolo, davvero gated da `TRAMA_ONE_ENABLED`. Riguarda soprattutto Admin (Command Center) e Partner (onboarding a stati + Spotlight); ha pochissimo impatto sul Parent. Con lo stato flag odierno, `platform_admin` e i membri del cohort vedono sempre questa superficie; tutti gli altri vengono rimandati silenziosamente a LEGACY.

Questa architettura a tre livelli è la lente attraverso cui vanno letti `TRAMA_ROUTE_LEGACY_MATRIX.md` e `TRAMA_CAPABILITY_COMPLETENESS_MATRIX.md`.

---

## 3. IL FINDING PIÙ GRAVE DELL'INTERO AUDIT

**In produzione oggi (commit `6d7b102`), sia `/center` (dashboard Partner) sia `/admin` (dashboard Admin root) sia `/admin/activities` mostrano dati interamente finti (`lib/mock-data.ts`) senza alcun banner di disclosure. `/admin/analytics` è parzialmente finta (grafico occupazione mock, resto reale). `/admin/centers` mostra mock con un badge parziale ("Elenco demo").**

Un Gestore reale che fa login su `/center` oggi vede un centro fisso e finto (`demoCenterAdminCenterId`), con prenotazioni, promozioni e ricavi non suoi — senza alcun avviso. Un platform_admin vede la stessa cosa su `/admin`. La correzione reale (dati veri, con banner di disclosure solo nei rari casi di fallback) esiste già nel repo (commit `c27b5c3`, `1d698e8`, `e9bf05a`, tutti pre-Legal-Gate quindi tra i più "anziani" dei 49 commit non deployati) ma **non è in produzione** a causa dei due tentativi di deploy falliti oggi.

Questo finding, non un problema del Legal Gate o di School Calendar, è la condizione di rilascio più urgente di questo intero audit: nessun Micro Pilot con un Partner reale dovrebbe iniziare finché questo fix non è live.

---

## 4. RIMANDO AGLI ALTRI 8 DOCUMENTI

Il dettaglio per route, capability, legacy exit, operazioni manuali, e le comunicazioni esterne (promessa prodotto, roadmap, script demo, contratto prodotto Beta) sono nei documenti dedicati elencati in `docs/trama-one/analysis/` con prefisso `TRAMA_`. Questo documento è il punto di ingresso e la fonte del verdetto finale.

---

## 5. BUSINESS READINESS — VERDETTO FINALE

**PLATFORM PRODUCT STATE:**
PILOT READY WITH CONDITIONS — il codice per un Micro Pilot onesto e sicuro esiste quasi interamente nel repo, ma non è ancora nelle mani di un utente reale, e il gap più grave (dashboard mock undisclosed) è precisamente il tipo di problema che un pilot è pensato per evitare.

**SEPTEMBER PRIVATE BETA:**
READY WITH CONDITIONS

**FIRST PARTNER DEMO:**
SAFE WITH CAVEATS (vedi `TRAMA_FIRST_PARTNER_DEMO_SCRIPT.md` per le route da NON aprire e le risposte consigliate)

**FIRST FAMILY DEMO:**
SAFE WITH CAVEATS

**FIRST REAL MICRO PILOT:**
READY WITH CONDITIONS — condizione principale: redeploy riuscito che porti in produzione i 49 commit fermi, prima di onboardare un Partner reale su `/center`.

**SELF-SERVICE PARTNER:**
PARTIAL (onboarding, attività, calendario, risposta prenotazioni sono self-service; approvazione candidatura e verifica identità restano admin-assisted by design)

**SELF-SERVICE FAMILY:**
YES (per i journey già elencati come customer-promisable; edit/cancellazione figlio e cancellazione account restano limitati)

**LEGACY USER-VISIBLE:**
LIMITED (l'utente non vede mai esplicitamente "Legacy" come tale; il rischio reale è la convivenza silenziosa di due prodotti — Legacy e NextGen — senza indicazione di quale sia "quello vero")

**MOCK USER-VISIBLE:**
SIGNIFICANT (in produzione oggi, non nel repo — due dashboard chiave, Partner e Admin, sono completamente finte senza disclosure)

### THE FIVE THINGS THAT MOST SEPARATE TRAMA TODAY FROM A VALIDATED MVP

1. **Zero validazione con utenti reali**: ogni evidenza in questo audit è CODE_VERIFIED, DB_VERIFIED o LIVE_TESTED via Playwright — mai PILOT_VALIDATED da una persona reale al di fuori del team.
2. **Il deploy è oggi bloccato**: 49 commit di lavoro reale, incluso il fix del problema più grave trovato in questo audit, sono fermi fuori dalla produzione per un problema di autenticazione Vercel non ancora risolto.
3. **Le dashboard Partner e Admin in produzione mostrano dati finti senza dirlo**: esattamente l'errore che un audit di verità prodotto esiste per intercettare prima che un cliente reale lo scopra da solo.
4. **Il contenuto legale non esiste**: zero documenti pubblicabili (Privacy in draft esterno, Termini Genitore/Partner e Dichiarazione parentale non trovati) — indipendentemente da quanto sia solido il codice del Legal Gate, non c'è nulla da mostrare oggi.
5. **Due prodotti Parent completi convivono nello stesso repo senza un criterio di convergenza dichiarato** (Legacy e NextGen, selezionabili da un cookie senza enforcement) — un costo di manutenzione e di coerenza UX che cresce ogni sprint finché non si decide quale sia il prodotto definitivo.

---

AUDIT COMPLETE — NO REMEDIATION PERFORMED.
