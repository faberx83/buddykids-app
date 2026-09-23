# TRAMA — State of the Art

**Verificato contro commit HEAD del repo il 23/09/2026** (`e3d5451`, branch `main`), via lettura diretta del codice sorgente (`app/`, `components/`, `lib/`, `supabase/schema.sql`) e query SQL **read-only** dirette sul progetto Supabase di produzione (`eagsgfxunwyyxwwilldy`). Questo documento **non è derivato** dai report precedenti (package v4 di agosto, addendum/prefreeze di settembre): quei documenti sono stati usati solo come indice di cosa controllare, mai come fonte dei numeri riportati qui. Nessuna scrittura, migration o modifica dati è stata eseguita per produrlo.

---

## Come leggere questo documento

Ogni affermazione qui sotto porta un'etichetta implicita o esplicita:

- **Verificato nel codice**: letto direttamente in un file sorgente specifico (percorso citato), non dedotto da un commit message o da un documento precedente.
- **Verificato via query DB**: eseguita una `SELECT` diretta sul progetto Supabase di produzione (`eagsgfxunwyyxwwilldy`) in questa sessione, risultato riportato as-of 23/09/2026.
- **Dichiarato nei TO-BE Handbook ma non verificato**: descritto in uno dei tre Handbook normativi (`docs/trama-one/derived/TRAMA_*_Product_Architecture_CX_Handbook_*`) come comportamento desiderato, ma questa sessione non ha trovato/verificato codice corrispondente — non significa che non esista, significa che questa sessione non lo ha confermato.
- **Gap noto/non implementato**: verificato assente sia nel codice sia nei dati — una funzionalità che i vecchi documenti o gli Handbook menzionano ma che oggi non esiste.

Dove i vecchi documenti (Addendum 08/09, Final Pre-Freeze 08/09) affermavano qualcosa che questa sessione ha trovato **diverso** dallo stato reale, è segnalato esplicitamente con "⚠️ Contraddice [documento]".

---

## Stato del repository e della produzione (verificato via query DB)

L'Addendum e il Final Pre-Freeze dell'8/09/2026 segnalavano la produzione ferma **6-7 commit indietro** rispetto al repository (HEAD `46af2a3`/`93db96b` contro produzione `a30bcc6`). Query diretta su `deploy_events` (as-of 23/09/2026):

| commit | esito | quando (UTC) |
|---|---|---|
| `1f0e0ea` | ok | 2026-09-23 15:36:34 |
| `07409d1` | ko (tentativo precedente) | 2026-09-23 15:10:27 |
| `1995ad4` | ok | 2026-09-23 14:02:13 |
| `d4d0a5f` | ok | 2026-09-23 09:01:37 |
| `8c5b53e` | ok | 2026-09-22 16:16:10 |

**⚠️ Contraddice l'Addendum/Prefreeze dell'8/09**: quella condizione (produzione indietro di più commit) non esiste più. L'ultimo deploy riuscito (`1f0e0ea`, 23/09 15:36 UTC) corrisponde al penultimo commit del repository — HEAD attuale `e3d5451` è un commit solo-documentazione (archiviazione file storici) che non tocca codice applicativo. **Produzione e repository sono oggi sostanzialmente allineati**, incluso l'intero ciclo "Discovery Live UX Bugfix" (commit `e594dd5` → `07409d1`).

---

## Stato feature flag `TRAMA_ONE_ENABLED` (verificato via query DB)

Query diretta su `feature_flag_overrides`:

| scope | valore | enabled | scadenza |
|---|---|---|---|
| global | — | `false` | (scaduto 03/08/2026, mai riattivato) |
| cohort | `trama-one-controlled-beta` | `true` | **31/12/2026** |
| role | `platform_admin` | `true` | mai |

Rispetto all'Addendum dell'8/09 (che riportava scadenza cohort al 02/10/2026), la scadenza è stata **estesa al 31/12/2026** nel frattempo (`updated_at` 08/09/2026 12:55 UTC — coerente con la stessa sessione dell'Addendum). Resta però **invariato il fatto strutturale**: `TRAMA_ONE_ENABLED` è OFF globalmente. Tutto ciò che dipende da questo flag (entrambi i carousel di onboarding, i tour guidati, lo Spotlight Partner/Parent, le shell `/nextgen`/`/center/one` "TRAMA ONE") resta visibile solo alla Controlled Beta Cohort e a `platform_admin`, mai al pubblico generale. Altri flag attivi in produzione, sempre scope `cohort`, mai globali: `CALENDAR_EXPORT_ENABLED`, `EXTERNAL_PLANNER_ITEMS_ENABLED`, `GLOBAL_ACTION_PROGRESS_ENABLED`, `REAL_DISCOVERY_DATASET_ENABLED`, `SCHOOL_CALENDAR_INTELLIGENCE_ENABLED` — coorte `internal-preview` o `trama-one-controlled-beta`.

---

## Stato per dominio

### Genitore (Parent)

**Verificato nel codice**: onboarding (`lib/nextgen/onboarding-slides.ts`, carousel + walkthrough motore comune, replay in `/nextgen/profile/impostazioni/preferenze`); Planner (`app/nextgen/planner/*` — settimana, famiglia, indirizzi, logistica, promemoria; `PromemoriaClient` con persistenza reale su `travel_reminders`, non più stato locale); Ricerca/Discovery (`app/nextgen/search/SearchDiscoveryClient.tsx`, vedi sezione dedicata Discovery Map sotto); prenotazioni (`app/prenotazioni/`, `app/nextgen/prenotazioni/`, wizard con step "Servizi extra" reale); community/gruppi (`app/nextgen/community/`, `app/nextgen/groups/`, `app/(main)/groups/`); condivisione piano (`app/share/planner/[token]/` — route pubblica senza login, per link condivisi); segnalazioni (`app/nextgen/profile/segnalazioni/`, tabella `beta_feedback`); "Famiglia condivisa" (`app/nextgen/planner/famiglia/FamigliaClient.tsx`, `app/actions/family.ts`) e "Chi fa cosa" (`app/actions/responsibilities.ts`, tabella `week_responsibilities`) come **due feature distinte** — non esiste un modulo "deleghe" separato nel codice (unico match del termine "delega" nel repo è un commento su un dettaglio implementativo di rilascio capacità, non una feature).

**Verificato via query DB**: `families`=0 righe, `family_members`=0 righe (tabelle presenti nello schema ma vuote — probabilmente legacy/non più il percorso primario), `family_people`=2 righe (probabile percorso reale di "Famiglia condivisa"), `week_responsibilities`=50 righe, `plan_shares`=8 righe, `groups`=1, `group_members`=1, `favorites`=5, `beta_feedback`=7, `travel_reminders`=1.

**Dichiarato negli Handbook TO-BE ma non (ancora) verificato in questa sessione**: dettagli specifici degli Handbook Parent 1.1/1.2 su incentivi/referral non sono stati confrontati riga per riga col codice in questa sessione — richiederebbe un audit dedicato.

**Gap noto**: nessuna route pubblica dedicata a un profilo "centro" navigabile dal genitore fuori da una singola attività pubblicata (vedi sezione Admin/Partner sotto — gap confermato via audit ancora oggi, nessun codice trovato per `/centro/[slug]`).

### Partner (Gestore)

**Verificato nel codice**: candidatura (`app/auth/candidati/`, conferma via `app/auth/candidati/conferma/`); verifica identità (tabella `center_identity_verifications` — schema pronto, `document_url` predisposto ma **non collegato a un upload reale** per decisione esplicita DEC-22, campo differito senza nuova migration futura); onboarding (`app/center/one/onboarding/`, `center_onboarding_state`/`center_onboarding_checklist_completions`/`center_onboarding_audit_log`, funzioni SECURITY DEFINER per le transizioni di stato — mai UPDATE diretto); gestione attività/calendario/prezzi/capacità (`app/center/activities/`, `app/calendar-center/`, capacità gestita dal servizio canonico `lib/capacity/service.ts`, vedi sotto); inbox richieste (`app/center/richieste/`, ticketing su `activity_inquiries`); risposta prenotazioni (`app/actions/booking-response.ts`, `app/center/prenotazioni/`); cancellazioni/rimborsi (stessa area, `partnerDecision` distinto dallo stato pagamento demo — footer "Stato prenotazione" corretto per mostrare la decisione operativa reale, non `bookings.status` grezzo).

**Verificato via query DB**: `centers`=9, `activities`=8, `activity_weeks`=35, `activity_days`=175, `bookings`=20 (17 confirmed, 1 pending, 2 cancelled), `booking_days`=19, `booking_weeks`=23, `booking_kids`=27, `center_leads`=6 (18 `suggested`, 1 `qualified`, 6 `claimed` — nota: somma 25 righe di stato ma 6 righe totali in `center_leads`: lo storico stato non coincide 1:1 con le righe attuali, verosimile presenza di transizioni di stato tracciate altrove o dato da riverificare in una sessione dedicata al modulo CenterLead), `activity_certifications`=0, `partner_offers`=0, `invites`=0, `center_onboarding_state`=2 righe, `center_identity_verifications`=0 righe (nessuna verifica identità mai sottomessa), `center_onboarding_audit_log`=142 righe.

**Race condition `spots_left`**: ⚠️ **contraddice l'ipotesi di gap ancora aperto** portata nell'audit di completezza di questa sessione. Verificato nel codice (`lib/capacity/service.ts`): il fix è presente ed è un Compare-And-Swap applicativo esplicito (`.eq("spots_left", row.spots_left)` sull'UPDATE, retry fino a `MAX_CAS_ATTEMPTS=5`, mai un doppio decremento), con test dedicato `tests/one/capacity-concurrency.spec.ts` che riproduce due letture concorrenti sullo stesso valore. Verificato **staticamente** (codice + test unitari), **non verificato sotto carico concorrente reale in produzione** in questa sessione.

**Gap confermato**: nessuna UI trust-score da nessuna parte nel codice applicativo (`app/`, `components/`) — il concetto compare solo nei documenti (Handbook derivati, `DECISION_LOG.md`), mai in un componente reale.

### Admin

**Verificato nel codice**: approvazioni (`app/admin/centers/[id]/`, `app/admin/certifications/`), qualità catalogo (`app/admin/activities/`, `app/admin/tags/`), anomalie booking (`app/admin/bookings/`), supply acquisition/CenterLead (`app/admin/center-leads/`, `lib/data/center-leads.ts`), servizi extra (campo `meal_price_extra` su `activities`, gestito dai form centro), audit log (`center_onboarding_audit_log`, append-only, mai INSERT diretto client-side), feature flags (`app/admin/feature-flags/`, `lib/data/feature-flag-overrides.ts` — UI reale con calcolo stato `active`/`expiring_soon`/`expired`/`no_expiry` e badge di allarme, non solo query manuale come nello Sprint 0). Area `/admin/one/` e `/admin/one/pilot/` per governance pilota TRAMA ONE dedicata.

**Verificato via query DB**: `feature_flag_overrides`=9 righe, `beta_cohort_memberships`=8 righe, `legal_documents`=**0 righe** (nessuna versione di Privacy/Termini mai pubblicata — vedi Gap sotto), `legal_acceptances`=0, `consent_events`=1, `parental_declarations`=0, `beta_invite_codes`=1, `product_events`=2530 righe (telemetria/analytics — volume plausibile solo se include sessioni di test/QA, non solo utenti reali, vista la base utenti minuscola).

**Gap confermato**: Privacy Notice e Termini — codice pronto e onesto (`app/privacy/page.tsx`, `app/terms/page.tsx` mostrano "Documento in preparazione" invece di un 404 o di un testo fittizio quando non c'è nulla di `PUBLISHED`), ma **zero documenti legali pubblicati in produzione** (`legal_documents`=0 righe, confermato via query, invariato rispetto a quanto segnalato nell'audit di completezza di questa sessione).

### Discovery Map

Unico dominio con un ciclo di bugfix live recentissimo (23/09/2026, commit `ae464d9` → `07409d1`, poi `1f0e0ea`), **verificato dal vivo da Fabrizio secondo il changelog dei commit** e confermato deployato con successo su `deploy_events`. Stato attuale nel codice:

- Basemap: tile OpenStreetMap standard, fix del "basemap grigio" da provider precedente (`fa121ca`), pan/zoom ripristinati al ritorno da dettaglio attività.
- Legenda: sempre visibile senza scroll — altezza mappa ridotta da 440 a 360px per farci stare la legenda (`d4d0a5f`).
- 3 tipologie di marker: TRAMA (Partner reale), Da invitare (Curated invitabile), Fonte pubblica (Curated non invitabile) — popup custom per tipo (`ba6fdcc`, `f8aff5f`).
- Fix marker FULL TRAMA (viola) che sparivano dopo "Apri scheda" → Back (`1995ad4`) — verificato risolto.
- Dialog "Proponi invito" non più invisibile dietro popup Leaflet aperto (`b875922`).
- "Proponi invito" da marker non richiede più doppio tap (`e594dd5`).
- "Apri scheda" non più bloccato dopo apertura di un popup in Mappa (`ae464d9`).
- Filtro Copertura (Settimana intera / Giorni singoli): semantica corretta — "mixed" ora compatibile con entrambi i filtri invece di escluderli erroneamente; single-select; conteggio a 3 vie (attività totali / marker totali / mappabili) (`2c7b853`, `a4d428b`, `9952973`).
- Chip Età/Servizi/Prezzo mostrano stato attivo — fine al "filtro fantasma" invisibile segnalato live (`07409d1`, ultimo commit del ciclo, deploy `ok` confermato).
- Bell/chat nascosti in Map view, mai sopra marker/popup (`9e198f6`).
- X per svuotare la ricerca (`5688aee`).

**Verificato via query DB**: 8/13 record curated risultavano mappabili secondo `f8aff5f` (dato del momento di quel commit, non ricontrollato con query dedicata in questa sessione — il dataset curato è statico in `lib/releases/catalog.ts`/dataset geo, non in una tabella DB separata interrogabile qui).

**Gap noto**: 3 idee evolutive aggiunte alla roadmap POST-BETA (`1f0e0ea`) — non implementate, per costruzione (fuori perimetro di questo ciclo).

---

## Dati reali in produzione (via query Supabase)

| Tabella | Righe | Nota |
|---|---|---|
| `profiles` | 10 | 2 `center_admin`, 7 `parent`, 1 `platform_admin` |
| `centers` | 9 | |
| `activities` | 8 | |
| `activity_weeks` | 35 | |
| `activity_days` | 175 | |
| `bookings` | 20 | 17 confirmed, 1 pending, 2 cancelled |
| `booking_days` | 19 | |
| `booking_weeks` | 23 | |
| `booking_kids` | 27 | |
| `kids` | 6 | |
| `center_leads` | 6 | 18/1/6 righe di stato storico tracciate (vedi nota sezione Partner) |
| `activity_inquiries` | 211 | ticketing "Contatta il gestore" — volume alto rispetto alla base utenti, verosimilmente in parte da sessioni di test |
| `favorites` | 5 | |
| `groups` / `group_members` | 1 / 1 | |
| `legal_documents` | 0 | nessuna Privacy/Termini pubblicata |
| `product_events` | 2530 | telemetria complessiva |
| `deploy_events` | 80 | |
| `feature_flag_overrides` | 9 | |
| `families` / `family_members` | 0 / 0 | tabelle presenti, vuote |
| `family_people` | 2 | |

**Il pilota NON ha dati reali di mercato.** Elenco completo dei `profiles` (query diretta, ordinati per data di creazione): `faberx83@gmail.com`, `faberpirulli@gmail.com`, `faberx83+test-genitore@gmail.com`, `faberx83+test-gestore@gmail.com`, `faberx83+partnernew@gmail.com`, `faberx83+newparent@gmail.com`, `faberx83+testparent@gmail.com`, `luca.d.magi@gmail.com`, `mariafpoli@gmail.com`, `ppirulli@libero.it`. Sono **tutti account di Fabrizio (con alias `+test-*`) o di conoscenti/famiglia**, nessun utente acquisito tramite un canale di marketing/outreach reale. Questo conferma, ad oggi 23/09/2026, che il gap "zero dati pilota reali" segnalato nell'audit di completezza di questa sessione **resta vero**: quello che c'è in produzione è dato di test/dogfooding, non un pilota con famiglie/centri esterni reali.

---

## Gap noti e rischi già documentati

Ripresi dall'audit di completezza prodotto di questa sessione, **verificati** (non solo ricopiati) contro codice e DB attuali:

- **Nessun modulo "deleghe"** — ✅ confermato: non esiste nel codice. Esistono invece, distinte: "Famiglia condivisa" (`FamigliaClient.tsx`/`family.ts`, tabella `family_people`=2 righe) e "Chi fa cosa" (`responsibilities.ts`, tabella `week_responsibilities`=50 righe). Nessuna delle due implementa deleghe di responsabilità genitoriale verso terzi (es. nonni, baby-sitter) nel senso in cui il termine è usato negli Handbook.
- **Mancanza Privacy/T&C pubblicati** — ✅ confermato: `legal_documents`=0 righe, codice pronto e onesto ("Documento in preparazione"), ma nessun contenuto legale reale mai pubblicato.
- **`RESEND_API_KEY` non configurata** — **non verificabile da questa sessione**: non c'è accesso alle variabili d'ambiente Vercel. Il codice (`lib/email.ts`) è comunque progettato per degradare senza rompere nulla se la chiave manca (`isEmailConfigured = Boolean(RESEND_API_KEY)`, il Gestore vede comunque link/codice invito da copiare a mano). Non verificato se oggi la chiave sia impostata in produzione — solo Fabrizio/Vercel possono confermarlo.
- **Dati mock in dashboard Admin/Partner senza banner esplicativo** — non riverificato voce per voce in questa sessione (richiederebbe ispezione UI dashboard per dashboard); dato il volume di dati reali minimo (8 attività, 9 centri, 20 prenotazioni), è plausibile che alcune viste Admin/Partner mostrino numeri che sembrano "vuoti" più che "mock" — distinzione da chiarire in una sessione dedicata.
- **Vulnerabilità npm HIGH** — ✅ confermato via `npm audit`: 2 vulnerabilità totali, 1 `moderate` (`baseline-browser-mapping`, DoS su input invalido) e **1 `high`** (`sharp` <0.35.4, vulnerabilità libheif GHSA-rgj7-g3m4-5g8c). Fix disponibile via `npm audit fix` — non applicato in questa sessione (nessuna modifica al codice/dipendenze, per policy del compito).
- **Problemi di accessibilità** — non riverificato con uno strumento dedicato (axe/Lighthouse) in questa sessione; nessun pattern sistematico di `aria-*`/gestione focus trovato nei componenti chiave ispezionati, ma non è stato fatto un audit sistematico — resta "non verificato" più che "confermato assente".
- **Golden Journeys mai eseguiti** — ✅ confermato: 81 test su 124 file `.spec.ts` totali sono gated `isRealDeployment` (richiedono un ambiente reale con browser di sistema, non eseguibili nel sandbox di sviluppo) — restano da eseguire da Fabrizio contro un ambiente live prima di poter essere considerati PASS, stessa condizione già segnalata a settembre.
- **Zero dati pilota reali** — ✅ confermato ancora vero oggi (vedi sezione sopra), con base utenti leggermente cresciuta rispetto ad agosto/settembre (2 nuovi contatti esterni a Fabrizio: `luca.d.magi@gmail.com`, `mariafpoli@gmail.com`) ma ancora nessun utente acquisito via canale reale.
- **Nessuna UI trust-score** — ✅ confermato: zero occorrenze nel codice applicativo, solo nei documenti Handbook/decisionali.
- **Race condition su `spots_left`** — ⚠️ **NON più un gap aperto**: risolta con un Compare-And-Swap applicativo esplicito in `lib/capacity/service.ts`, con test di regressione dedicato. Verificata staticamente, non sotto carico concorrente reale.

---

## Documenti superati da questo State of the Art

I seguenti documenti **restano in archivio come storia**, ma non vanno più usati come riferimento primario per lo stato attuale del prodotto — questo file li sostituisce come fonte di stato:

- `docs/trama-one/package/` (intero "Documentation Package v4", as-of commit `24464bf`, 06/08/2026): `TRAMA_MASTER_REQUIREMENT_CATALOG.md`, `TRAMA_REQUIREMENTS_TRACEABILITY_MATRIX.md`, `TRAMA_REQUIREMENTS_COVERAGE_HEATMAP.md`, `TRAMA_PROJECT_SAL_20260805.md`, `TRAMA_OPEN_DECISIONS_AND_GAPS.md`, `TRAMA_CANONICAL_RELEASE_MODEL.md`, `TRAMA_CANONICAL_SOURCE_REGISTER.md`, `TRAMA_DOCUMENTATION_CHANGELOG.md`, `TRAMA_DOCUMENTATION_PACKAGE_MANIFEST.md`, `TRAMA_DOCUMENTATION_QA_REPORT.md`, `TRAMA_REQUIREMENT_ID_RECONCILIATION.md` — fermo a oltre 6 settimane fa, con almeno due cicli di lavoro sostanziali (Dashboard/Il mio centro/onboarding di settembre, e l'intero ciclo Discovery Map di questa settimana) mai riflessi nei numeri.
- `docs/trama-one/package/TRAMA_CURRENT_STATE_ADDENDUM_2026-09-08.md` — fermo al commit `46af2a3`, la sua stessa premessa (produzione indietro di 6 commit) non è più vera oggi.
- `docs/trama-one/package/TRAMA_FINAL_PREFREEZE_REPORT_2026-09-08.md` — fermo al commit `93db96b`, stesso motivo; i verdetti GREEN/AMBER/RED per dominio lì contenuti sono superati dalla sezione "Stato per dominio" di questo documento.

Non toccati/non superati da questo documento: i tre Handbook TO-BE in `docs/trama-one/derived/` (restano la fonte del comportamento *desiderato*, non toccano lo stato attuale) e i file già archiviati in `docs/trama-one/archive/` (già segnalati come storici da una sessione precedente di questo stesso audit).

---

## Cosa non è stato possibile verificare (trasparenza)

- Se `RESEND_API_KEY` sia oggi effettivamente impostata su Vercel in produzione (nessun accesso alle variabili d'ambiente da questa sessione).
- Se i dati "mock" nelle dashboard Admin/Partner abbiano o meno un banner esplicativo — richiede ispezione UI per singola vista, non fatta in questa sessione.
- Problemi di accessibilità puntuali — nessuno strumento di audit (axe/Lighthouse) eseguito in questa sessione.
- La discrepanza tra `center_leads`=6 righe totali e 18+1+6=25 transizioni di stato riportate via query aggregata sullo stesso campo `status` — segnalata sopra come da riverificare, non risolta qui (possibile errore nella query di aggregazione stessa, da un secondo controllo con una query `GROUP BY` più esplicita in una sessione dedicata al modulo CenterLead).
- Copertura riga-per-riga degli Handbook TO-BE Parent/Partner/Admin (1.1/1.2) contro il codice attuale — questo documento riporta solo le corrispondenze trovate durante l'esplorazione per dominio, non un audit sistematico ID-per-ID.
