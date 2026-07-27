# CORE DOMAIN — Source of Truth (AS-IS)

Integration Stabilization Sprint 1–4, Gate E. Mappa AS-IS (solo lettura, nessuna modifica di codice o schema in questo documento) dei 10 domini indicati da Fabrizio: Center, Onboarding, Activity/Offering, Availability, Capacity, Request, Partner Response, Booking, Planner, Payment/Refund. Per ciascuno: tabella canonica, write path, read path, adapter, sincronizzazione, idempotenza, feature flag, rollback, debito/duplicazione. Ogni doppia fonte di verità è segnalata esplicitamente, non nascosta in prosa.

Verificato: 27/07/2026, su `supabase/schema.sql` + `migration_01`…`migration_15`, `app/actions/*.ts`, `lib/data/*.ts`.

## 1. Center

- **Tabella canonica**: `public.centers` (schema.sql).
- **Write path**: `app/actions/center.ts` (creazione, aggiornamento profilo/sconti/flag `has_bar`/`accessible`/`cancellation_window_days`).
- **Read path**: `lib/data/center-admin.ts`.
- **Adapter/sync**: nessuno, tabella unica.
- **Idempotenza**: n/a (CRUD diretto).
- **Feature flag**: nessuno.
- **Rollback**: n/a.
- **Debito/duplicazione**: nessuna trovata.

## 2. Onboarding

- **Tabelle canoniche**: `center_onboarding_state` (migration_09, stato LEAD→CLAIMED→SUBMITTED→CHANGES_REQUESTED→APPROVED→SUSPENDED), `center_onboarding_checklist_completions`, `center_identity_verifications`, `center_onboarding_audit_log`.
- **Write path**: RPC SECURITY DEFINER in `app/actions/onboarding.ts` (`center_claim_onboarding`, `center_submit_onboarding`, `admin_review_center_onboarding`); upsert diretto per checklist e verifica identità. migration_10 crea automaticamente la riga LEAD alla creazione del centro (trigger AFTER INSERT).
- **Read path**: `lib/onboarding/resolve.ts`, `lib/onboarding/data.ts`.
- **Adapter/sync**: nessuno.
- **Idempotenza**: garantita dal trigger (`on conflict do nothing` implicito, verificato da TC-N408).
- **Feature flag**: le route `/one` sono dietro `TRAMA_ONE_ENABLED`, ma le tabelle e le RPC sono scritte anche se il flag è spento (il flag gate solo la UI, non i dati).
- **Rollback**: migration_09/10 hanno sezione rollback dedicata.
- **⚠️ Debito segnalato**: una riga assente in `center_onboarding_state` viene interpretata come stato implicito `APPROVED` (per i centri legacy pre-migration_10, mai passati dal trigger) — è una scelta esplicita e documentata nel commento di migration_09, non un bug, ma è una **seconda rappresentazione implicita dello stato** (riga esplicita vs. assenza-come-default) che chiunque tocchi questo codice in futuro deve conoscere. Rischio Beta: BASSO (comportamento intenzionale, documentato), ma da tenere d'occhio se il numero di centri legacy senza riga cresce.

## 3. Activity/Offering

- **Tabelle canoniche**: `public.activities`, `activity_tags`, `promotions`, `activity_certifications`.
- **Write path**: `app/actions/center.ts` (creazione/modifica attività, tag).
- **Read path**: `lib/data/activities.ts`.
- **Adapter/sync**: nessuno.
- **Feature flag**: nessuno.
- **Debito/duplicazione**: vedi #5 Capacity — `activities.spots_left` è un campo "editoriale" separato dalla disponibilità reale.

## 4. Availability

- **Tabelle canoniche**: `activity_weeks` (settimana intera), `activity_days` (Giorni spot, migration_12).
- **Write path**: `app/actions/center.ts` (creazione slot settimana/giorno).
- **Read path**: `lib/data/activity-days.ts`, `lib/data/weeks.ts`.
- **Adapter/sync**: `lib/day-pricing.ts` calcola il prezzo dinamico dei Giorni spot a partire da `activity_days` — puro, nessuno stato proprio.
- **Feature flag**: nessuno (Giorni spot è sempre attivo dopo il rilascio Sprint 3).
- **Debito/duplicazione**: nessuna, ma vedi #5 per l'intreccio con la capacità.

## 5. Capacity — ⚠️ DOPPIA FONTE DI VERITÀ (rischio Beta)

Tre campi "posti disponibili" indipendenti per la stessa attività, decrementati da percorsi di codice diversi e non sincronizzati tra loro:

1. `activities.spots_left` — "posti in evidenza" mostrato sulla card, per commento di schema.sql è "separato dal dettaglio giorno-per-giorno di activity_days": **editoriale/manuale**, mai decrementato da una prenotazione reale. Letto in `lib/data/activities.ts` per il filtro "solo posti disponibili".
2. `activity_weeks.spots_left` — decrementato in `app/actions/booking-response.ts` (~riga 157-163) **solo quando il Partner accetta** una prenotazione a settimana intera. Nessun guard di idempotenza esplicito qui (il controllo è su `booking.partner_decision !== "accepted"` a monte).
3. `activity_days.spots_left` — decrementato in `booking-response.ts` (~riga 214-225) solo su accettazione Partner di un giorno, protetto da un flag di idempotenza dedicato `booking_days.capacity_decremented` (booleano, evita doppio decremento su retry/doppio click), reincrementato su cancellazione (~riga 297-306).

Nessuno dei tre viene decrementato al momento della richiesta (`bookings` con `status='pending'`) — la capacità si muove solo all'accettazione del Partner. `activities.spots_left` non viene mai toccato dal flusso di prenotazione: se un centro lo aggiorna manualmente, resta scollegato dalla disponibilità reale di `activity_weeks`/`activity_days`.

- **Feature flag**: nessuno.
- **Rischio Beta**: **MEDIO** — non è un bug che causa dati errati oggi (i tre campi hanno scopi diversi e documentati), ma è un'architettura fragile: un futuro sviluppatore che "aggiorna la capacità" toccando solo uno dei tre campi crea un'incoerenza silenziosa. Raccomandazione: consolidare `activities.spots_left` come campo derivato/sola-lettura (somma di `activity_weeks`/`activity_days`) invece di editabile a mano, in un prossimo sprint — non bloccante per questo gate.

## 6. Request

Non esiste una tabella "Request" dedicata — decisione esplicita DEC-15 (WRAP, non REPLACE): la richiesta di prenotazione È la riga `bookings` con `status='pending'` (stato pre-risposta Partner). Confermato dal commento di migration_13: *"non esiste alcun concetto di 'richiesta' separato: bookings.status resta 'pending' finché il Partner non risponde."*

- **⚠️ Collisione di naming (non di dati)**: `activity_inquiries` (tabella separata, thread messaggio/risposta per il ticketing "Contatta il gestore") è anch'essa etichettata "Richieste" in UI (`/center/richieste`). Sono due concetti distinti con tabelle distinte — nessuna duplicazione di dati, ma il nome condiviso in italiano può generare confusione in triage futuri (un fallimento su "richieste" va disambiguato: booking pending o inquiry?).

## 7. Booking (state machine unificata Request/Booking, Sprint 4)

- **Tabella canonica**: `bookings` — `status` (`pending|confirmed|cancelled`, ciclo di vita dell'intera prenotazione) + `partner_decision` (`pending|accepted|rejected|proposed`, asse ortogonale: la risposta del centro). Le due colonne sono volutamente **non fuse** nello stesso check constraint (motivato nel commento migration_13): un `status='pending'` può avere `partner_decision` in qualunque stato finché non si arriva a `confirmed`/`cancelled`.
- `booking_days` (migration_12/13) replica lo stesso schema `partner_decision`/`partner_note`/`capacity_decremented` a livello di singolo giorno, indipendente dal `partner_decision` di livello settimana.
- **Write path**: `app/actions/bookings.ts` (creazione, cancellazione genitore), `app/actions/booking-response.ts` (risposta Partner, per settimana e per giorno).
- **Read path**: `lib/data/center-bookings.ts`, `lib/data/admin-bookings.ts`, `lib/data/bookings.ts`.
- **Migrazione storica**: migration_14 (DEC-43) ha fatto un backfill una tantum di `partner_decision='accepted'` per tutte le righe pre-esistenti con `status='confirmed'` — riparazione dati storica, non un doppio-write in corso.
- **Feature flag**: nessuno.
- **Debito**: nessuna doppia fonte oltre a quanto già segnalato in Capacity (#5).

## 8. Partner Response

- **Campi**: `bookings.partner_decision/partner_proposal_note/partner_proposed_at/responded_at/cancelled_by/read_by_parent/read_by_center` + equivalenti per-giorno in `booking_days`.
- **Write path**: `app/actions/booking-response.ts`.
- **Read path**: `lib/data/center-bookings.ts` (inbox Partner), `lib/data/admin-bookings.ts` (coda Admin, Gap P0 #362).
- **Notifiche**: email Partner su accettazione/rifiuto (Gap P0 #360, già implementato) — write path separato in `lib/email.ts`/azione dedicata, letto da nessuna tabella (fire-and-forget, nessuno stato persistito sull'invio email stesso — se l'invio fallisce silenziosamente non c'è modo di saperlo dal DB: **debito minore**, non bloccante).
- **Feature flag**: nessuno.

## 9. Planner

- **Nessuna tabella propria, nessuna vista materializzata.** `lib/data/planner.ts` e `lib/data/planner-map.ts` interrogano `bookings`/`booking_weeks`/`activity_weeks` **live** ad ogni richiesta, calcolando la copertura per famiglia/settimana al volo.
- Commento esplicito in `planner.ts` (DEC-06/DEC-42): "una proiezione in sola lettura, nessuno stato mutabile proprio".
- **Sincronizzazione**: automatica per costruzione (query live) — non può disallinearsi da `bookings`, perché non ha copia propria dei dati.
- **Feature flag**: nessuno.
- **Debito/duplicazione**: nessuna — è l'esempio più pulito di "single source of truth by design" tra i 10 domini.

## 10. Payment/Refund

**Nessuna tabella di pagamento o rimborso esiste.** `bookings.payment_method` (enum `card|apple_pay|bank_transfer`) e `total_amount`/`discount_amount` sono campi informativi persistiti sulla prenotazione, ma non c'è alcuna tabella `payments`/`charges`/`refunds`, nessuna integrazione gateway (nessun riferimento a Stripe o simili nello schema o nel codice applicativo cercato).

- **Conclusione**: il prodotto è oggi un marketplace di disponibilità (matching richiesta↔centro), non un processore di pagamenti. Non è un gap di questo sprint — è lo stato di fatto del dominio, da tenere presente per qualunque futura roadmap Payment.

## Riepilogo rischi Beta (solo quelli con evidenza concreta sopra)

- **Capacity (#5)**: rischio MEDIO — tre campi "posti disponibili" scollegati, nessun bug oggi ma architettura fragile per manutenzione futura. Raccomandazione: derivare `activities.spots_left`, non bloccante per questo gate.
- **Onboarding (#2)**: rischio BASSO — stato implicito per centri legacy senza riga, comportamento intenzionale e documentato.
- **Request/Inquiries naming (#6)**: rischio BASSO — solo confusione terminologica in triage, nessuna duplicazione di dati.
- **Notifiche email Partner (#8)**: rischio BASSO — nessuno stato di invio persistito, fire-and-forget.

Nessuna delle quattro voci sopra blocca da sola una decisione READY in Gate F: nessuna tocca correttezza dei dati oggi, tutte sono debito conosciuto e circoscritto.
