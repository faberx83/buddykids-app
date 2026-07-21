# TRAMA ONE Build Sprint 3 — Matrice pagina-per-pagina / route-per-route

Artefatto obbligatorio prerequisito richiesto da `SPRINT_GOVERNANCE.md` (Sprint 3: "matrice pagina-per-pagina/route-per-route estesa alle route coinvolte in questo sprint") prima dell'implementazione. Copre Parent discovery e selezione giorni.

## Riconciliazione AS-IS — verificata leggendo il codice, non assunta

**Scope Sprint 3** (`SPRINT_GOVERNANCE.md`): context object (source/week/child/filters/correlationId); ricerca/dettaglio Next Gen adattati a Offering; richiesta; filtro Parent per disponibilità giornaliera; selezione giorni nel dettaglio; calcolo costo dinamico; selezione servizi per giorno; mantenimento del context durante la navigazione. Fuori scope: risposta Partner e Booking (Sprint 4).

| Requisito Sprint 3 | Stato AS-IS (verificato nel codice) | Evidenza |
|---|---|---|
| Ricerca (località, età, periodo, categoria, prezzo) | **Già funzionante** | `app/(main)/search/SearchClient.tsx`, `app/nextgen/search/SearchDiscoveryClient.tsx` |
| Dettaglio attività standard (contenuto, prezzo, servizi, CTA) | **Già funzionante** | `app/activity/[id]/DetailClient.tsx` — route unica condivisa da Legacy e NextGen |
| Richiesta/booking leggero (selezione bambino+periodo, invio, stato) | **Già funzionante, solo a livello settimana** | `app/booking/[id]/BookingClient.tsx`, `app/booking/[id]/actions.ts` |
| **Filtro Parent per disponibilità giornaliera (Giorni spot)** | **MANCANTE — verificato, non un'assunzione** | `lib/data/activity-days.ts::getActivityDays()` esiste ma **zero riferimenti** in `DetailClient.tsx`, `SearchClient.tsx`, `SearchDiscoveryClient.tsx`, `BookingClient.tsx` (grep su tutti e 4 i file, nessun match). Unico consumo reale: lato Gestore (`app/center/activities/[id]/calendar/page.tsx`, `app/actions/center.ts`) |
| **Selezione giorni nel dettaglio** | **MANCANTE** | Stessa evidenza sopra: nessuna UI Parent legge `activity_days`/`booking_mode`/`min_days_per_booking` oggi |
| **Calcolo costo dinamico (giorni + servizi)** | **MANCANTE** | `BookingClient.tsx` calcola solo su base settimanale (`price_per_week`), nessuna logica per giorni singoli |
| **Selezione servizi per giorno** | **MANCANTE** | I servizi (`pre_service`/`post_service`/`meal_option`) sono letti a livello attività, non per singolo giorno |
| **Context object (source/week/child/filters/correlationId)** | **PARZIALE — solo query param sciolti, nessun oggetto unico** | `BookingClient.tsx` legge `?week=` da query string (funzionalità Segment C); nessun `correlationId` propagato; nessuna struttura dati unica che sopravviva alla navigazione multi-pagina (confermato: nessun riferimento a "correlationId"/"context" in `BookingClient.tsx`) |
| `lib/telemetry/correlation.ts` (già esistente da Sprint 0) | **Riusabile, non ancora collegato al journey Parent discovery→richiesta** | File creato in Sprint 0 per la telemetria `/one`, integrabile per il context object senza duplicazione |

## Decisione di riuso

**ADAPT, non REPLACE**: nessuna nuova pagina di ricerca/dettaglio/richiesta. Le route esistenti (`/search`, `/nextgen/search`, `/activity/[id]`, `/booking/[id]`) restano gli stessi file, estesi con: lettura di `getActivityDays()` (già scritta, Sprint 2) nel dettaglio; UI di selezione giorno quando `activity.bookingMode !== "week_only"`; calcolo prezzo dinamico basato sui giorni scelti + eventuale sconto/minimo giorni (`min_days_per_booking`); un context object leggero (probabile estensione di `lib/telemetry/correlation.ts` o un nuovo modulo dedicato, da decidere in fase di design) propagato via query param/sessionStorage-equivalente lato server tra ricerca→dettaglio→richiesta.

## Route/oggetti AS-IS nel perimetro (verificati, nessuno da modificare strutturalmente)

| Route/oggetto AS-IS | File | Sprint 3 lo tocca? | Note di preservazione |
|---|---|---|---|
| `/search`, `/nextgen/search` | `SearchClient.tsx`, `SearchDiscoveryClient.tsx` | Sì, in AGGIUNTA (filtro disponibilità giornaliera, propagazione context) | Nessun filtro esistente rimosso |
| `/activity/[id]` | `DetailClient.tsx` | Sì, in AGGIUNTA (sezione selezione giorni quando pertinente) | Contenuto standard esistente invariato per attività `week_only`/`mixed` senza Giorni spot configurati |
| `/booking/[id]` | `BookingClient.tsx`, `actions.ts` | Sì, in AGGIUNTA (calcolo dinamico giorni+servizi, quando l'attività li supporta) | Flusso settimanale esistente invariato come default |
| `lib/data/activity-days.ts::getActivityDays()` | Data layer | Riusata, nessuna modifica alla funzione | Già scritta in Sprint 2, semplicemente collegata a una UI Parent per la prima volta |
| `public.activity_days`, `public.activities.booking_mode/min_days_per_booking` | `supabase/schema.sql` + `migration_11` | No (lettura, non schema) | Nessuna nuova colonna prevista per Sprint 3 allo stato attuale dell'analisi |
| `public.bookings`, `public.activity_inquiries` | `supabase/schema.sql` | No (fuori scope, unificazione Request è Sprint 4) | Invariate |
| `lib/telemetry/correlation.ts` | Sprint 0 | Probabile riuso per il context object | Da confermare in fase di design, nessuna decisione presa qui |

## Esito

Nessuna capability AS-IS a rischio: tutte le estensioni previste sono additive (nuove sezioni UI condizionali, nuova logica di calcolo attivata solo quando `bookingMode !== "week_only"`), il flusso esistente a settimana intera resta il comportamento di default per ogni attività non ancora configurata a Giorni spot lato Partner. Prerequisito Sprint 3 soddisfatto: matrice prodotta, V2 di `ASSUMPTION_LOG.md` verificata per l'epic E06 (vedi voce dedicata).

## Precondizione esplicita ancora aperta (blocca l'implementazione, non l'analisi)

Per `SPRINT_GOVERNANCE.md` §Sprint 3, "Artefatti obbligatori" richiede: **suite di regressione booking Legacy/NextGen eseguita e verde come precondizione esplicita (condizione GO WITH CONDITIONS #3)**, prima di scrivere qualunque codice di Sprint 3. Questo è un test locale con browser reale — non eseguibile nel sandbox Claude (stessa limitazione già documentata per Gate 2 di Sprint 1/2). Comando da eseguire sul Mac di Fabrizio, PRIMA che Claude inizi a scrivere codice di Sprint 3:

```
npx playwright test tests/genitori/prenotazione.spec.ts --reporter=list
```

(Copre il flusso booking Legacy, condiviso da NextGen: `/nextgen/search` instrada alla stessa `/activity/[id]`/`/booking/[id]` di Legacy, nessuna route booking separata esiste oggi.) Se la suite risulta verde (o con soli fallimenti già noti e documentati in `PRE_EXISTING_TEST_FAILURE_BASELINE.md`), la precondizione è soddisfatta e l'implementazione di Sprint 3 può iniziare senza ulteriori conferme, per l'istruzione permanente di procedere autonomamente. Se emergono fallimenti NUOVI, vanno segnalati e non silenziati.
