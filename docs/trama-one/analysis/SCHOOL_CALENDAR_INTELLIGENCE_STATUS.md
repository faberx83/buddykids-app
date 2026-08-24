# SCHOOL CALENDAR FEATURE STATUS

Task #529-532. Prodotto secondo il mandato di Fabrizio (24/08/2026) sulla feature
"TRAMA — School Calendar Intelligence". Copre i passi A-F della sequenza
richiesta (§23 della spec); si ferma al gate G (SQL/migrazione), come da
governance permanente (Claude non applica mai migrazioni).

## 1. Requirement mapping

Nessuna riga esistente nel `TRAMA_MASTER_REQUIREMENT_CATALOG.md` copre questa
capability (grep su "scuola|school|calendario scolastico" — solo 2 righe di
competitive intelligence, 0 requisiti prodotto). È un **nuovo requisito**, non
un gap su uno già specificato:

- **Epic proposto**: E13 — School Calendar Intelligence (nuovo; il più vicino
  per dominio è E07 "Planner & My Activities sync", ma qui c'è un nuovo modello
  dati di dominio scuola, non solo UI Planner — merita un Epic proprio)
- **Requirement proposto**: **P-MVP-10** — "Planner sa quando le scuole dei
  bambini sono chiuse" (prossimo ID libero dopo P-MVP-09)
- Assegnazione definitiva dell'ID nel catalogo ufficiale è compito del passo K
  (documentazione), dopo tua conferma.

## 2. AS-IS (sintesi — dettaglio completo nel report di discovery)

- **Planner**: 13 settimane fisse per stagione (`lib/season-weeks.ts`), stato
  per settimana calcolato in `lib/nextgen/planner-insights.ts`
  (`WeekStatus = dismissed|covered|partial|conflict|priority|uncovered|awaiting|past`),
  copertura family-level (`SeasonWeek.covered`) e per-bambino
  (`SeasonWeek.coveredKids`). Nessun concetto di "scuola aperta/chiusa" esiste.
- **Booking**: copertura = esistenza di una `bookings` reale che overlappa la
  settimana (via `booking_weeks→activity_weeks` o `booking_days→activity_days`).
  Nessuna dipendenza da calendari esterni.
- **JourneyContext** (`lib/journey-context.ts`, Sprint 3 #332): tipo e helper
  `{source, correlationId, week, childId, filters}` esistono ma **non sono
  ancora agganciati** al flusso reale Riempi→Ricerca→Dettaglio→Prenotazione,
  che oggi usa parametri flat scritti a mano (`?week=`, `?kid=`). Gap
  pre-esistente, non introdotto da questa feature.
- **Bambino**: `kids(id, parent_id, name, birth_date, avatar_emoji, interests,
  gender, avatar_url)`. Nessuna colonna scuola/regione/comune. Creazione via
  `addKidAction` (`app/actions/kids.ts`); nessuna action di modifica su
  name/birth_date/gender dopo la creazione.
- **Famiglia**: `families/family_members/family_invites` (Sprint 5.5) — un
  bambino appartiene a un solo genitore proprietario (`kids.parent_id`), i
  membri famiglia vedono/gestiscono la famiglia ma non risulta un modello
  "il bambino è condiviso" a livello di riga `kids` — il multi-tenant
  Famiglia è già in backlog come task #522, non toccato qui.
- **Feature flag registry** (`lib/feature-flags/registry.ts`): un solo flag
  oggi (`TRAMA_ONE_ENABLED`); aggiungere un flag è additivo, una riga in un
  oggetto TS, nessuna migrazione richiesta per il flag stesso.
- **Documentazione esistente**: nessuna menzione di questa capability in
  `docs/trama-one/` in alcuna forma.

## 3. Gap

Il Planner oggi promette "la timeline completa della tua famiglia" ma ignora
completamente se le scuole dei bambini sono aperte o chiuse: una settimana
"scoperta" e una settimana "scuola chiusa e nessuno l'ha organizzata" hanno
oggi la stessa UI. Non esiste alcun modello dati, tabella, o UI per colmarlo.

## 4. Soluzione proposta (minima)

**Catena di risoluzione**: `Bambino → Profilo scolastico (regione/comune) →
Calendario scolastico → Eventi calendario (chiusure)`.

Ogni bambino ha il proprio calendario (mai uno unico di famiglia), come
richiesto. Nessun nome scuola/classe/sezione richiesto — solo Regione (e
opzionalmente Comune per i ponti locali), per minimizzazione privacy.

**Planner**: per ogni settimana/giorno, se esiste una chiusura scolastica per
quel bambino che overlappa e la settimana non è già `covered`/`dismissed`/
overridata → mostra badge informativo "Scuola chiusa · da organizzare?" con
CTA che riusa lo stesso pattern "Riempi" già esistente verso Ricerca
(preservando childId/week/source). Puramente assistivo: nessun blocco, nessun
cambio di stato automatico della settimana.

**Override manuale**: "Già organizzato" / "Non devo organizzare" per
bambino+settimana, persistente, indipendente dal dismiss generico esistente
(per non toccare la logica Planner attuale — zero rischio di regressione lì).

**Fallback**: se il bambino non ha profilo scolastico o non esiste calendario
per la sua regione/anno, Planner/Booking/Ricerca funzionano esattamente come
oggi — nessun badge, nessun errore, nessun blocco. Il flag
`SCHOOL_CALENDAR_INTELLIGENCE_ENABLED` (default `false`) copre l'intera
feature: a flag spento, comportamento Planner identico a oggi (garanzia
formale del "no regression" oltre al fallback dati).

## 5. Modello dati proposto (additivo, in bozza — vedi §7)

- `school_calendars` — riferimento pubblico: country, region, school_year,
  valid_from/to, source, source_url, source_updated_at, status
  (draft/published), version. Sola lettura per gli utenti; scritta solo da
  service role/Admin (popolamento manuale in avvio, non scraping automatico —
  fuori scope MVP).
- `school_calendar_events` — chiusure: calendar_id, start_date, end_date,
  event_type (school_year_start/end, christmas_break, easter_break,
  public_holiday, regional_closure, bridge, other_closure), label,
  source_level, source, notes.
- `kid_school_profiles` — nuova tabella dedicata (NON si tocca `kids`): kid_id
  (univoco), parent_id (per RLS semplice e coerente col resto dello schema),
  region, comune (nullable), school_calendar_id (nullable, risolto per
  regione+anno), created_at/updated_at. Tenere separata da `kids` = zero
  rischio sulle query esistenti che leggono `kids`.
- `school_calendar_overrides` — override manuale: parent_id, kid_id
  (nullable = tutta la famiglia), week_start_date, override_type
  (`already_organized`|`not_needed`), created_at.

RLS coerente con lo standard esistente: `school_calendars`/
`school_calendar_events` leggibili da chiunque sia autenticato (dato non
personale); `kid_school_profiles`/`school_calendar_overrides` con
`auth.uid() = parent_id`, identico al pattern già usato su `kids`.

## 6. Impatto Planner / Impatto Ricerca

- **Planner**: additivo — nuovo badge/CTA, nessuna modifica alla logica
  `computeWeekStatus`/`WeekStatus` esistente (il badge scuola è un layer
  informativo sopra lo stato attuale, non un nuovo `WeekStatus`).
- **Ricerca**: riuso della CTA "Riempi" esistente — stesso pattern già usato
  da Planner→Ricerca oggi, nessuna nuova rotta.
- **Booking**: nessun impatto — la copertura resta definita solo da
  prenotazioni reali, il calendario scuola non altera mai lo stato
  `covered`/`awaiting`/ecc.

## 7. Migration richiesta: **SÌ**

4 tabelle nuove, tutte additive (`create table if not exists`), nessun `alter`
su tabelle esistenti. File bozza pronto (non applicato):
`supabase/migration_XX_school_calendar.sql` — vedi messaggio separato, in
attesa di numero progressivo e di tua applicazione manuale (standing
governance: Claude non esegue mai migrazioni).

## 8. Feature flag

`SCHOOL_CALENDAR_INTELLIGENCE_ENABLED` — nuova riga in
`lib/feature-flags/registry.ts`, `defaultValue: false`, scope
`["global","cohort"]` (per poterla attivare solo per la coorte Beta a
Settembre). Nessuna migrazione richiesta per il flag in sé.

## 9. Privacy

Solo regione (+ comune opzionale) per bambino — mai nome scuola/classe/sezione.
`school_calendars`/`school_calendar_events` sono dati pubblici non personali
(calendari regionali, di fonte pubblica). `kid_school_profiles` segue
esattamente la stessa RLS di `kids` (solo il genitore proprietario). Visibilità
Admin minima: solo sul DATASET calendari (pubblicare/validare un calendario
regionale), mai sui profili scolastici dei singoli bambini.

## 10. Migration required: **YES** — vedi §7

## 11. Effort: **MEDIUM**

Non SMALL perché richiede 4 tabelle nuove + RLS + logica di risoluzione
regione→calendario→eventi + nuova UI Planner. Non LARGE/rischioso perché è
interamente additivo, dietro feature flag spento di default, con fallback
totale, e non tocca la logica di calcolo copertura/prenotazione esistente.

## 12. Rischio

Basso-medio. Il rischio principale non è tecnico ma di **contenuto**: i
calendari scolastici regionali italiani vanno popolati/mantenuti a mano (fonte
= siti Regione/USR), non esiste una fonte gratuita strutturata univoca a
livello nazionale — per Settembre serve realisticamente solo 1-2 regioni pilota
popolate a mano (quelle dei centri Beta), non copertura nazionale. Questo va
deciso esplicitamente (vedi raccomandazione).

## 13. Test previsti (TC-SCHOOL-01..12)

Come da convenzione richiesta: persistenza calendario, fallback senza
calendario, evidenziazione chiusure, bambini con calendari diversi,
preservazione contesto CTA Riempi, copertura transizione booking completa,
distinzione pending/coperto, override manuale, persistenza tra sessioni,
isolamento RLS cross-parent, invarianza a flag spento, mobile 390×844 senza
overflow.

## 14. Raccomandazione

**MVP SLICE FOR SEPTEMBER**: costruire l'intero modello dati e la logica
Planner/override (effort reale, non rimandabile), ma limitare i dati reali a
1-2 regioni pilota popolate manualmente per la Beta, dietro flag attivabile
solo per la coorte Beta. Evita sia di forzare una copertura nazionale
irrealistica in 5 settimane, sia di rimandare una feature P1 ad alto valore
percepito da Fabrizio. Non è un rischio per Planner/Booking (additivo, flag
off = invarianza totale).

---

**Prossimo passo**: attendo revisione/applicazione del file di migrazione
(§7) per procedere con l'implementazione (passo H). Nessun'altra decisione di
scope bloccante identificata: se confermi la raccomandazione MVP SLICE e le
2 regioni pilota, procedo autonomamente su implementazione/test/commit non
appena la migrazione è applicata.
