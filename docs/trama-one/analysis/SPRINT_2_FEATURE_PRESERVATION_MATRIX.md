# TRAMA ONE Build Sprint 2 — Matrice pagina-per-pagina / route-per-route

Artefatto obbligatorio prerequisito richiesto da `SPRINT_GOVERNANCE.md` (Sprint 2: "matrice pagina-per-pagina/route-per-route estesa alle route coinvolte in questo sprint") prima dell'implementazione. Copre catalogo/prezzo/capacità/Giorni spot Partner.

## Riconciliazione AS-IS — scoperta chiave

Prima di decidere l'entità Offering (DEC-05, obbligatoria in questo sprint), è stata verificata l'estensione reale del modello dati esistente. Risultato: **la capability "Giorni spot" richiesta dallo scope Sprint 2 esiste già, quasi per intero, in Legacy/NextGen**:

| Requisito Sprint 2 (da `SPRINT_GOVERNANCE.md`) | Stato AS-IS | Evidenza |
|---|---|---|
| Disponibilità settimanale, capacità, prezzo | **Già funzionante** | `public.activity_weeks` (`capacity`, `spots_left`, `label`, `start_date`/`end_date`), `activities.price_per_week` |
| Disponibilità giorno-per-giorno ("Giorni spot"), capacità, sconto, last-minute, prenotabilità singola | **Già funzionante** | `public.activity_days` (`is_open`, `capacity`, `spots_left`, `single_day_bookable`, `discount_percent`, `last_minute`, `special_label`/`special_emoji`) |
| Scrittura lato Partner (wizard/calendario) | **Già funzionante** | `app/actions/center.ts::saveActivityDaysAction()` (upsert su `activity_days`), pagina `/center/activities/[id]/calendar` |
| Lettura per Parent/booking | **Già funzionante** | `lib/data/activity-days.ts::getActivityDays()` |
| Servizi (pre/post assistenza, pasto, diete, accesso disabili) | **Già funzionante** | `activities.pre_service`/`post_service` (jsonb), `meal_option`, `dietary_options`, più i campi Accesso disabili/Diete aggiunti in uno sprint precedente |
| Regole di cancellazione | **Già funzionante** | `public.centers.cancellation_window_days` (per centro, si applica a tutte le sue attività) |
| Modalità settimana/giornaliera/mista | **MANCANTE** | Nessuna colonna `activities` distingue se un'attività è prenotabile solo a settimana, solo a giorno, o entrambe — oggi è implicitamente "mista" per ogni attività con righe in `activity_days` |
| Minimo giorni per prenotazione singola | **MANCANTE** | Nessun vincolo di "minimo N giorni" per una prenotazione a giorni; oggi ogni giorno aperto è prenotabile singolarmente senza minimo |

## Decisione Offering (DEC-05)

**ADAPT — nessuna nuova entità Offering.** Il modello esistente (`activities` + `activity_weeks` + `activity_days`) copre già la quasi totalità della capability richiesta. Creare un'entità Offering separata duplicherebbe uno schema già funzionante e già scritto/letto da Legacy, NextGen e dai flussi di prenotazione — violerebbe DEC-15 (nessuna dismissione senza le 5 condizioni) senza alcun beneficio. Le due sole lacune reali (modalità di prenotazione, minimo giorni) sono colmabili con 2 colonne additive su `activities`, non con una nuova entità. Decisione registrata in `DECISION_LOG.md` (DEC-32).

## Route/oggetti AS-IS nel perimetro (verificati, nessuno da modificare strutturalmente)

| Route/oggetto AS-IS | File | Sprint 2 lo tocca? | Note di preservazione |
|---|---|---|---|
| `/center/activities`, `/center/activities/new`, `/center/activities/[id]` | Wizard attività (`ActivityEditForm.tsx`) | Sì, in AGGIUNTA (2 nuovi campi opzionali) | Nessun campo esistente rimosso o rinominato |
| `/center/activities/[id]/calendar` | Calendario Giorni spot (`activity_days`) | No (in questa prima fetta) | Logica di apertura/capacità/sconto giorno invariata |
| `public.activities` | `supabase/schema.sql` | Sì, in AGGIUNTA (`booking_mode`, `min_days_per_booking`, entrambe con default che preserva il comportamento AS-IS) | Nessuna colonna esistente alterata/rimossa |
| `public.activity_weeks`, `public.activity_days` | `supabase/schema.sql` | No | Invariate |
| `public.bookings`, `public.activity_inquiries` | `supabase/schema.sql` | No (fuori scope Sprint 2, Request unificata è Sprint 4) | Invariate |
| `/search`, `/nextgen/search`, `/activity/[id]` (lettura Parent) | Ricerca e dettaglio | No in questa prima fetta | I 2 nuovi campi sono letti ma non ancora usati per filtrare la ricerca — capability Sprint 3 |
| `lib/types.ts::Activity` | Tipo condiviso | Sì, esteso con 2 campi opzionali | Nessun campo esistente rimosso |

## Esito

Nessuna capability AS-IS a rischio. Le due colonne additive (`booking_mode` default `'mixed'`, `min_days_per_booking` default `null`) preservano esattamente il comportamento attuale per ogni attività esistente (nessun backfill necessario: `'mixed'` è il comportamento oggi implicito per tutte le attività con `activity_days` popolate). Prerequisito Sprint 2 soddisfatto prima dell'implementazione.
