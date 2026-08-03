# TRAMA ONE — Transition Register

Registro degli adapter/ponti tra AS-IS (Legacy, Next Gen, modelli dati esistenti) e TRAMA ONE, richiesto come output esplicito di TRAMA ONE Build Sprint 0 dal Master Prompt ("aggiungi Transition Register e Assumption Log nel repository"). Ogni riga documenta un punto in cui TRAMA ONE si appoggia temporaneamente o permanentemente a un meccanismo AS-IS invece di sostituirlo.

**Stato in Build Sprint 0**: nessun vero adapter creato in questo sprint — nessuna capability di business (Request lifecycle, Booking, Offering, PlannerItem) è nello scope Sprint 0, quindi non c'è ancora nulla da "adattare". Questo registro era predisposto vuoto/scaffolded, in attesa di essere popolato a partire da Build Sprint 1.

**Stato in Build Sprint 1**: la state machine di onboarding Center (`center_onboarding_state` e tabelle satellite, `supabase/migration_09_center_onboarding.sql`) NON è un adapter nel senso Master Prompt (non traduce uno stato di business preesistente): prima di Sprint 1 non esisteva alcun concetto di stato onboarding per un Centro, quindi non c'è nulla da "tradurre" — è una capability puramente NEW. L'unico collegamento con l'AS-IS è la lettura in sola lettura di `centers.id`/`profiles.center_id` via chiave esterna (per sapere a quale centro appartiene una riga), mai una scrittura o traduzione di stato su quelle tabelle. Registrato comunque qui sotto per completezza, seguendo la stessa convenzione.

## Convenzione per le righe future

Ogni adapter registrato qui deve indicare: nome/scopo, sprint di introduzione, asset AS-IS coinvolti (tabelle/servizi), asset TRAMA ONE coinvolti, tipo di ponte (sola lettura / scrittura duale / traduzione di stato), condizione di rimozione (quando l'adapter potrà essere eliminato, non prima della parità dimostrata — vedi `analysis/DECISION_LOG.md` DEC-15), rischio residuo.

| Nome adapter | Sprint di introduzione | AS-IS coinvolto | TRAMA ONE coinvolto | Tipo di ponte | Condizione di rimozione | Rischio |
|---|---|---|---|---|---|---|
| Onboarding state ↔ Center | Build Sprint 1 | `public.centers` (id), `public.profiles` (center_id, role) | `center_onboarding_state`, `center_onboarding_checklist_completions`, `center_identity_verifications`, `center_onboarding_audit_log` | Sola lettura (FK verso centers/profiles, nessuna scrittura su quelle tabelle) — non è una traduzione di stato preesistente, è una capability nuova | Non applicabile (non c'è uno stato AS-IS da cui migrare via — nessuna rimozione prevista) | Basso — nessuna riga esistente in `centers`/`profiles` è mai scritta da questo adapter |
| Risposta Partner ↔ Booking/booking_days | Build Sprint 4 | `public.bookings`, `public.booking_days` (righe già esistenti, create da `createBookingAction` con `status: "confirmed"` incondizionato) | Colonne additive: `partner_decision`/`partner_proposal_note`/`partner_proposed_at`/`responded_at`/`cancelled_by`/`read_by_parent`/`read_by_center` su `bookings`; `partner_decision`/`partner_note`/`capacity_decremented` su `booking_days` (`migration_13_booking_partner_response.sql`) | WRAP additivo (colonne nuove su tabelle esistenti, che riusano letteralmente il pattern `read_by_parent`/`read_by_center` già validato in `activity_inquiries`) — **non** un merge/unificazione di `activity_inquiries` in un'unica tabella "Request": restano due entità distinte (DEC-42) | Non applicabile nel breve termine: sono colonne permanenti del modello booking, non un ponte temporaneo da rimuovere. Da riaprire solo se in futuro si decide davvero di unificare `activity_inquiries` e `bookings` in un'unica entità Request (oggi esplicitamente NON deciso) | Medio — gap noti non ancora chiusi: capacità/accettazione parziale per giorno mancante, SLA engine (ACR-022) attivo solo su `activity_inquiries` non su `bookings`/`booking_days` |
| Backfill `partner_decision` prenotazioni storiche | Build Sprint 4 — correttivo post-deploy | `public.bookings`, `public.booking_days` con `status = 'confirmed'` create prima di `migration_13` | `migration_14_bookings_backfill_partner_decision.sql` (solo DML, un `UPDATE` una tantum, idempotente) | Riconciliazione una tantum tra un comportamento AS-IS mai cambiato (`createBookingAction` scrive sempre `status: "confirmed"`, non è mai esistito un flusso "pending") e la nuova assunzione introdotta da `migration_13` (`partner_decision` di default `pending` per ogni riga, anche storica) | Già eseguita e chiusa (DEC-43); nessuna azione futura prevista, a meno di nuove migrazioni che tocchino di nuovo il default di `partner_decision` | Basso — idempotente, non tocca prenotazioni realmente ancora in attesa (`status != 'confirmed'`) |

## Collegamenti già stabiliti in Build Sprint 0 (non adapter di business, solo riuso infrastrutturale)

Questi non sono "adapter" nel senso Master Prompt (non traducono uno stato di business), ma sono i punti di riuso diretto dell'infrastruttura AS-IS su cui il Feature Flag Engine e le route `/one` si appoggiano, per completezza di riferimento:

- **Auth/sessione**: `lib/supabase/server.ts` (client anon, RLS-bound) riusato as-is nei tre layout `/one` per identificare utente/ruolo — nessuna traduzione, stesso meccanismo di Legacy/NextGen.
- **Tenant/rewrite**: `proxy.ts`/`lib/tenant.ts` riusati as-is, non modificati — le route `/one` ereditano gate tenant/ruolo esistente senza alcun ponte dedicato.
- **Toggle Legacy/NextGen** (`bk_version`, `lib/version-preference.ts`): resta un meccanismo indipendente dal Feature Flag Engine (`TRAMA_ONE_ENABLED`) — nessun collegamento tra i due in questo sprint (Assumption Log D3).

Aggiunti in Build Sprint 1:

- **RLS reuse**: le nuove tabelle di `migration_09_center_onboarding.sql` riusano `public.is_platform_admin()` e `public.current_center_id()` (helper esistenti, non ridefiniti) nelle proprie policy — stesso principio "reuse-first" già applicato in Sprint 0 (DEC-21/DECISION_LOG.md).
- **Checklist onboarding**: `lib/onboarding/checklist-registry.ts` linka `/center/profile` (pagina AS-IS) per l'item "Profilo centro completo" — solo un link di navigazione, nessuna lettura/scrittura diretta di quella pagina da parte del nuovo codice.

Aggiunti in Sprint 1 Audit Remediation:

- **Auto-inizializzazione LEAD**: `migration_10_center_onboarding_auto_lead.sql` introduce un trigger `AFTER INSERT` su `public.centers` che crea automaticamente una riga `LEAD` in `center_onboarding_state` per ogni centro nuovo — chiude il gap per cui nessun centro creato dopo Sprint 1 poteva mai raggiungere via UI il percorso di attivazione (DEC-25). Non è un ponte verso uno stato di business preesistente (nessun centro aveva uno stato onboarding prima di Sprint 1): resta una capability NEW, non un adapter — registrato qui solo per completezza di riferimento sul punto di innesto (`public.centers`).
- **Linguaggio utente centralizzato**: `lib/onboarding/status-copy.ts` è l'unico punto di verità per le etichette italiane Partner/Admin della macchina a stati onboarding. I valori tecnici persistiti (LEAD, CLAIMED, SUBMITTED, CHANGES_REQUESTED, APPROVED, SUSPENDED) restano invariati nel database — solo la presentazione UI è cambiata (DEC-26).

## Build Sprint 2-3: nessun nuovo adapter di business

Sprint 2 (Offering/Giorni spot Partner) e Sprint 3 (Parent discovery/selezione giorni) non hanno introdotto ponti verso `activities`/`activity_weeks` di tipo diverso da un semplice ADAPT: la decisione D1 (Offering come entità separata) è stata chiusa con "NO, nessuna nuova entità" (DEC-32), quindi non c'è uno stato AS-IS/TO-BE da tradurre — `activities`/`activity_weeks` restano estese con colonne additive (`booking_mode`, `min_days_per_booking`, `activity_days`), non sostituite né affiancate da un modello parallelo. Registrato qui solo per completezza, non è un vero adapter nel senso Master Prompt.

## Aggiunti in Build Sprint 4

- **Risposta Partner ↔ Booking/booking_days** e **Backfill `partner_decision`**: vedi le due righe aggiunte alla tabella sopra. È il primo vero adapter WRAP della sequenza (colonne additive su tabelle di business esistenti, non solo su tabelle di supporto onboarding come in Sprint 1) — coerente con la nota della Feature Parity Matrix che segnalava la riga #12 (richieste/ticketing) come rischio di regressione più alto.

## Integration Gate (Sprint 1-4) — completato

`AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` (dovuto da DEC-30) è stato prodotto e chiuso (Gate A→F, poi evidence patch §16, stato finale READY WITH CONDITIONS — vedi il documento per il dettaglio). Nessun ponte aggiuntivo emerso durante il gate oltre a quelli già registrati sopra.

## Aggiunti in Build Sprint 5 (CenterLead, referral e incentivi)

Nessun vero adapter di business verso `invites`/`profiles`: `center_leads` (migration_17) è una tabella NUOVA e indipendente, non un ponte verso uno stato AS-IS preesistente. `public.invites` (codice promo Partner→Genitore, esistente) e `public.family_invites` (inviti Famiglia, Sprint 5.5 NextGen) restano intatti e non referenziati in alcun modo — confermato in `SPRINT_5_FEATURE_PRESERVATION_MATRIX.md`. Gli unici collegamenti sono FK ordinarie verso `profiles(id)` (`suggested_by`, `reward_marked_by`) e verso `centers(id)` (`claimed_center_id`, valorizzato solo a posteriori quando un lead viene collegato a un centro che ha già completato l'onboarding esistente, DEC-46) — stesso pattern di riuso già visto per le altre tabelle additive del progetto (es. `activity_certifications`), non un adapter nel senso Master Prompt.

## Aggiunti in Build Sprint 6 (in corso) — Capacity

Nessun vero adapter di business: `lib/capacity/service.ts` centralizza logica già esistente (decremento/incremento `activity_weeks`/`activity_days.spots_left`), non introduce un ponte verso uno stato AS-IS preesistente — è un refactoring additivo di codice già scritto in Sprint 2-4, non un adapter nel senso Master Prompt. L'unica colonna nuova è `booking_weeks.capacity_decremented` (migration_18), simmetrica a `booking_days.capacity_decremented` già esistente. Vedi DEC-47 per il dettaglio del bug reale chiuso (rilascio capacità mancante su `cancelBookingAction`).

## Aggiunti in Build Sprint 6 (in corso) — Feature flag override expiry

Nessun adapter di business: `/admin/feature-flags` (nuova pagina) e `lib/data/feature-flag-overrides.ts`/`app/actions/feature-flag-overrides.ts` (nuovi) sono un normale CRUD Admin su `feature_flag_overrides`, tabella già esistente da Sprint 0 — nessuna nuova tabella, nessuna colonna nuova. `lib/feature-flags/evaluate.ts`/`resolve.ts` estesi (non sostituiti) con `findRecentlyExpiredMatchingOverride` e un evento di telemetria aggiuntivo. Vedi DEC-48.

## Aggiunti in Build Sprint 6 (in corso) — Email fire-and-forget

Nessun adapter di business: chiusura del debito P2 già registrato in `CORE_DOMAIN_SOURCE_OF_TRUTH.md` §8 (notifiche email Partner accetta/rifiuta senza stato di consegna). `lib/email.ts` estesa (non sostituita) con retry minimo (un secondo tentativo automatico) e logging esplicito; 3 colonne additive su `public.bookings` (`email_delivery_status`/`email_delivery_error`/`email_delivery_attempted_at`, `migration_19_bookings_email_delivery_status.sql`) per persistere l'esito dell'ultimo tentativo. Vedi DEC-49.

## Aggiunti in Build Sprint 6 (in corso) — Fix bug reale TC-N414/N415 (Walkthrough Partner)

Nessun adapter di business: correzione di una race condition client-side in `app/one/WalkthroughCard.tsx` (i tre handler del motore Walkthrough generico aggiornavano lo stato locale prima di attendere la conferma della Server Action) più un'inconsistenza minore in `app/actions/walkthrough.ts` (revalidava solo `/one`, mai `/center/one`/`/admin/one`). Nessuna tabella o colonna nuova. Vedi DEC-50.

## Aggiunti in Build Sprint 6 (in corso) — Command Center Admin (E08)

Nessun adapter di business: `lib/data/command-center.ts` aggrega SOLO letture già esistenti dei sette domini Admin (onboarding, prenotazioni, richieste, centri-lead, certificazioni, feedback BETA, feature flag) in `/admin/one` — nessuna nuova tabella, nessuna colonna, nessuna query SQL nuova. Le pagine per dominio restano invariate e sono l'unico punto d'azione reale (rollback gate esplicito). Vedi DEC-51.

## Aggiunti in Build Sprint 6 (in corso) — Eventi analytics con correlationId (E11)

Nessun adapter verso `lib/analytics.ts` (esplicitamente invariato, "affianca senza sostituire" per mandato di `SPRINT_GOVERNANCE.md`). Nuova tabella additiva `public.product_events` (`migration_20_product_events.sql`, non applicata) e nuovo modulo `lib/telemetry/events.ts::persistProductEvent()`, che estende — senza sostituire — `lib/telemetry/correlation.ts::logTelemetryEvent()` (Sprint 0, invariato, resta solo console). Whitelist `KNOWN_PRODUCT_EVENTS` isolata in `lib/telemetry/known-events.ts` (nessuna dipendenza I/O). Wiring: i tre layout `/one` (`one_route_access`/`one_route_fallback`), l'evento critico DEC-48 (`feature_flag_silent_fallback_expired_override`), e quattro nuovi eventi Walkthrough (`app/actions/walkthrough.ts`: started/completed/skipped/restarted). Vedi DEC-52.

## Aggiunti in Build Sprint 6 (in corso) — Hardening Walkthrough (funnel, microcopy, accessibilità, performance)

Nessun adapter di business: `lib/walkthrough/funnel.ts` (pura) e `getWalkthroughRestartCount` (in `lib/walkthrough/data.ts`, primo consumatore reale di `product_events`, best-effort/"N/D" finché migration_20 non è applicata) estendono la vista Admin già esistente (`/admin/one`, DEC-51) con due colonne aggiuntive — nessuna nuova tabella, nessuna pagina nuova. `WalkthroughCard.tsx` riceve hardening di accessibilità (`aria-live`, `aria-describedby`, `role="region"`) e microcopy più chiara, nessun cambio di logica. `persistProductEvent()` accetta ora un `context` opzionale per riuso client/sessione (performance), retro-compatibile. Vedi DEC-54.

## Prossimo aggiornamento previsto

Alla chiusura di TRAMA ONE Build Sprint 6 (task #419-420, test finali e verifica statica) — se emergesse la necessità di una pagina Admin dedicata allo stream `product_events` (finora deliberatamente non costruita, vedi DEC-52), va registrata qui.
