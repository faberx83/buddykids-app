# TRAMA ONE — Decision Log

Registro delle decisioni vincolanti prese durante l'Impact Assessment (Fase A) e i due Addendum, approvate da Fabrizio. Ogni decisione qui registrata è operativa da subito e vincola gli sprint successivi salvo una nuova decisione esplicita che la sostituisca — mai una correzione silenziosa.

| # | Decisione | Dettaglio | Fonte |
|---|---|---|---|
| DEC-01 | Convenzione TRAMA ONE Build Sprint 0-6 | Unica numerazione ufficiale per il lavoro TRAMA ONE: 0 Foundation, 1 Partner onboarding/Admin Review/Walkthrough foundation, 2 Catalogo/prezzo/capacità/Giorni spot Partner, 3 Parent discovery/selezione giorni, 4 Partner response/Booking/Planner Sync, 5 CenterLead/referral/incentivi, 6 Beta/analytics/hardening | Addendum 1 |
| DEC-02 | Conservazione Legacy e Next Gen | Nessuna route, tabella o test Legacy/NextGen viene eliminata, disattivata o indebolita durante TRAMA ONE; convivenza tramite pattern Strangler Fig e route isolate `/one` | Master Prompt + Addendum tecnico finale (§9B) |
| DEC-03 | Sede unica nel pilot | Un solo Centro = una sola sede operativa per il pilot settembre 2026; riuso di `centers.address` esistente | Addendum 1 |
| DEC-04 | Multi-sede differita | Nessuna tabella `locations` in Sprint 0-1; nessun vincolo tecnico che impedisca l'introduzione futura come estensione additiva | Addendum 1 |
| DEC-05 | Offering differita a Sprint 2 | Nessuna nuova entità Offering in Sprint 0; modello canonico `activities`+`activity_weeks`+`activity_days` da adattare, non sostituire; decisione strutturale finale (entità separata sì/no) presa in Build Sprint 2 dopo l'analisi Giorni spot | Addendum 1 |
| DEC-06 | PlannerItem differito a Sprint 4 | Planner resta proiezione calcolata dei dati canonici fino a Sprint 4; rivalutazione della persistenza dedicata basata su state machine Request, idempotenza, accettazioni parziali, giorni confermati, cancellazioni | Addendum 1 |
| DEC-07 | Feature flag server-only | Resolver (`lib/feature-flags/resolve.ts`) con `import "server-only"`, invocabile solo da Server Component/Server Action/layout; nessuna lettura client-side degli override; nessuna variabile `NEXT_PUBLIC_*` con override o regole di rollout | Addendum tecnico finale |
| DEC-08 | Nessuna query flag nel proxy | `proxy.ts` resta scope esclusivo tenant/autenticazione/ruolo/rewrite; il gate `TRAMA_ONE_ENABLED` è applicato nei layout server-side dei tre portali `/one`, non nel proxy | Addendum tecnico finale |
| DEC-09 | Feature Flag Engine obbligatorio nello Sprint 0 | Prerequisito hard, non placeholder; RLS `platform_admin`-only su `feature_flag_overrides`; client `createServiceClient()` (service-role, stesso pattern già in uso per `/internal/beta-pipeline`); fallback a `false` su qualunque errore/timeout/flag sconosciuto | Addendum 1 + Addendum tecnico finale |
| DEC-10 | Deploy/test classificati ADAPT | `deploy.sh` e `test-deploy.sh` corretti da REUSE_AS_IS ad ADAPT nella reuse matrix: `test-deploy.sh` usa oggi `\|\| true` incondizionato su ogni test, violando già oggi CLAUDE.md §3, indipendentemente da TRAMA ONE | Addendum 1 |
| DEC-11 | ONLY_SITEMAP senza deploy | `ONLY_SITEMAP=1 bash deploy.sh` deve essere intercettato prima di git push, `vercel --prod`, alias set, cleanup completo e suite Playwright ordinaria; esegue solo validazione variabili, sitemap, output, apertura opzionale, exit code coerente — nessun nuovo deploy prodotto | Addendum tecnico finale |
| DEC-12 | Trust avanzato differito | Ranking avanzato, benchmark, Trust Score visibile, livelli visibili, verifica AI, gamification, promozioni automatiche restano DEFER per l'intero arco Sprint 0-6, feature-flagged/shadow anche oltre il pilot settembre | Addendum 1 |
| DEC-13 | Walkthrough obbligatorio tra Sprint 1 e Sprint 2 | Non è più opzionale né rinviabile a Sprint 6: motore generico, progresso persistito, benvenuto/completamento profilo/interrompi/riprendi/salta/rilancia/Admin visibility minima in Sprint 1; step attività/settimane/prezzi/Giorni spot/pubblica/dashboard in Sprint 2 | Addendum tecnico finale |
| DEC-14 | Giorni spot negli Sprint 2-4 | Sprint 2: modalità settimana/giornaliera/mista, giorni, capacità, prezzo, minimo giorni, servizi, cancellazioni (Partner). Sprint 3: filtro, dettaglio, selezione giorni, costo, servizi, context (Parent). Sprint 4: accettazione completa/parziale, proposta alternativa, capacità per giorno, Planner Sync per giorno, notifiche, cancellazioni/rimborsi (fulfilment) | Addendum 1 |
| DEC-15 | Nessuna dismissione prima di parità e approvazione esplicita | Nessuna classificazione REMOVE ammessa nella Feature Parity Matrix; una dismissione (REPLACE_AFTER_PARITY) richiede tutte e cinque le condizioni: duplicazione dimostrata, parità funzionale raggiunta, test di regressione Legacy/NextGen verdi, rollback verificato, approvazione esplicita di Fabrizio | Addendum tecnico finale (§9B) |

## Decisioni correlate non elencate esplicitamente da Fabrizio ma derivate e vincolanti

| # | Decisione | Dettaglio | Fonte |
|---|---|---|---|
| DEC-16 | Alternativa A per il Feature Flag Engine | Registry TypeScript versionato + override persistiti in tabella, preferita all'Alternativa B (tutto persistito) per minore complessità e rollback via `git revert` | Addendum 1 |
| DEC-17 | Tre route fisiche distinte per `/one` | `app/one/` (Parent), `app/center/one/` (Partner), `app/admin/one/` (Admin) — nessuna route fisica unica può servire i tre tenant per via del rewrite di `proxy.ts` | Addendum 1 |
| DEC-18 | `tests/one/` additiva | La nuova cartella di test TRAMA ONE non sostituisce né duplica gli smoke test esistenti; scope `smoke`/`journeys` realizzati con tag `@smoke`/`@journey` su spec esistenti + nuovi file in `tests/one/` | Addendum tecnico finale |
| DEC-19 | Feature Parity Matrix per capability sufficiente solo per Sprint 0 | Prima di Build Sprint 1 va prodotta una matrice pagina-per-pagina/route-per-route dedicata alle capability coinvolte in quello sprint; da estendere prima di ogni sprint successivo | Addendum tecnico finale |

## Decisioni post Build Sprint 0 (passaggio di consegne operativo)

| # | Decisione | Dettaglio | Fonte |
|---|---|---|---|
| DEC-20 | Passaggio di consegne operativo a Claude | Da questo momento Claude mantiene lo stato del programma, propone la sequenza, implementa autonomamente le attività tecniche reversibili e interne al repository (lettura, analisi, codice nel perimetro dello sprint approvato, test, documentazione, commit granulari, correzioni tecniche chiaramente individuate), e si ferma solo per i 13 gate espliciti elencati dal comando di passaggio (migrazioni/SQL su Supabase, dati reali, merge su main, deploy/rollback, domini/alias/DNS/Vercel, credenziali/secret, acquisti, migrazioni distruttive, dismissione capability, decisioni di prodotto non ricavabili dai documenti, rischio concreto, test browser sul Mac di Fabrizio) | Comando "TRAMA ONE — PASSAGGIO DI CONSEGNE OPERATIVO A CLAUDE" |
| DEC-21 | Correzione TC-N303/TC-N304: navigazione per path fisico, non per host | I due test smoke Partner/Admin navigavano a `/one` assumendo che il ruolo dell'utente loggato determinasse la route servita; in realtà il routing Partner/Admin è basato sull'HOST (rewrite di `proxy.ts` su `buddykids-partner.vercel.app`/`buddykids-admin.vercel.app`), non esercitato da una suite che gira sempre contro un unico `TEST_BASE_URL`. Corretto navigando ai path fisici `/center/one` e `/admin/one` — decisione tecnica presa autonomamente (correzione di errore tecnicamente individuato, non ambiguità di prodotto), nessun impatto sul comportamento dell'applicazione, solo sulla navigazione del test | Prima esecuzione reale `TEST_SCOPE=smoke bash deploy.sh` in produzione, riportata da Fabrizio |

## Nota

Ogni nuova decisione futura va aggiunta in coda a questo log con numero progressivo, mai sovrascrivendo le voci esistenti. Se una decisione precedente viene superata, la nuova voce deve citare esplicitamente il numero della decisione che sostituisce.
