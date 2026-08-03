
# TRAMA ONE — Controlled Beta Operating Model (§18)

Copre §18 del gate "Controlled Beta Experience, Publication and Readiness Gate": come si gestisce operativamente il pilot una volta pubblicato (§16-17), riusando ESCLUSIVAMENTE strumenti già costruiti (Command Center Admin, Feature Flags Admin, Segnalazioni BETA, Walkthrough/Spotlight) — nessuna nuova capability, nessun nuovo dashboard.

Stato verificato in sola lettura via Supabase MCP il 2026-08-03 (progetto `eagsgfxunwyyxwwilldy`), riportato qui perché determina cosa questo modello operativo può realisticamente promettere.

## 1. Perimetro e durata

Coorte `trama-one-controlled-beta`: **60 giorni, scade il 2026-10-02** (DEC-57). Verificato oggi: l'override `scope=cohort` è `enabled=true` con quella scadenza esatta, l'override `scope=global` storico è disattivato e scaduto (`enabled=false`), l'override `scope=role='platform_admin'` è permanente (`expires_at=null`, DEC-57 punto 2 — accesso team interno, non parte del pilot). 2 membership in `beta_cohort_memberships` (i soli 2 account di test, Parent/Partner) — nessun centro o famiglia pilota reale ancora arruolato, coerente con `TRAMA_ONE_CONTROLLED_PUBLICATION.md` §3 punto 5.

## 2. Ruoli e responsabilità

Invariati rispetto alla governance permanente del programma:

- **Fabrizio**: decide CHI arruolare nel pilot (compilando `supabase/script_controlled_beta_expand_cohort.sql`), applica ogni script/migrazione, esegue i deploy, esegue i test browser reali, decide se/quando rinnovare o interrompere la coorte, comunica con i centri/famiglie pilota.
- **Claude**: monitora in sola lettura (Supabase MCP, progetto `eagsgfxunwyyxwwilldy`, autorizzato in autonomia), triagia segnalazioni tecniche, propone fix di codice, mantiene la documentazione, prepara script SQL non applicati quando serve un'azione sul database.

## 3. Cadenza di monitoraggio

Nessun nuovo strumento: tre superfici Admin già esistenti, da controllare con questa cadenza durante la finestra di 60 giorni.

| Cosa | Dove | Cadenza consigliata | Cosa cercare |
|---|---|---|---|
| Code operative aggregate | `/admin/one` (Command Center, DEC-51) | Settimanale | Priorità "alta" su una qualunque delle 7 code (elemento più vecchio oltre 3 giorni, `QUEUE_STALE_THRESHOLD_DAYS`) |
| Stato flag/coorte | `/admin/feature-flags` (DEC-48) | Settimanale, **giornaliera dopo il giorno 50** | Badge `expiring_soon`/`expired` sulla riga `cohort=trama-one-controlled-beta` |
| Segnalazioni pilota | `/admin/segnalazioni-beta` (CR-050, DEC-53, riuso puro) | Settimanale, o su notifica | Nuove segnalazioni dalla floating CTA BETA, owner/SLA già presenti |
| Avanzamento Walkthrough/Spotlight | `/admin/one`, sezione Walkthrough (DEC-54) | Settimanale | Funnel/drop-off per step, calcolato da `tutorial_progress` (sempre disponibile, non dipende da `product_events`) |

## 4. Telemetria: entrambe le migrazioni risultano già applicate

Correzione rispetto a una prima verifica di questo stesso giorno (errore di metodo: una query con più statement in una sola chiamata `execute_sql` restituisce solo il risultato dell'ultimo statement, non di tutti — le query successive, eseguite singolarmente, hanno dato un esito diverso e più accurato). Verificato singolarmente:

- **`public.product_events` esiste ed è già popolata**: 46 righe, `event_name` distinti trovati oggi: `one_route_access` (44) e `walkthrough_step_started` (2) — `migration_20_product_events.sql` (DEC-52) risulta applicata. Nessun evento `spotlight_*` (DEC-60) ancora presente, atteso: il codice Spotlight di questa sessione non è ancora stato deployato in produzione al momento di questa verifica.
- **Le colonne `bookings.email_delivery_status`/`email_delivery_error`/`email_delivery_attempted_at` esistono**: `migration_19_bookings_email_delivery_status.sql` (DEC-49) risulta applicata — 1 prenotazione ha già uno stato `not_configured` registrato, 15 restano `null` (prenotazioni che non sono ancora passate per un accetta/rifiuta Partner, atteso).

Conseguenza pratica per questo modello operativo: il quadro di monitoraggio descritto in §3 è **già utilizzabile oggi**, non condizionato a un'azione futura di Fabrizio. Unica cosa da tenere d'occhio dopo il deploy dello Spotlight: verificare che gli eventi `spotlight_shown`/`spotlight_target_not_found`/`spotlight_dismissed` comincino effettivamente a comparire in `product_events` (una query `select event_name, count(*) from public.product_events group by event_name` post-deploy è sufficiente).

## 5. Triage delle segnalazioni

Nessun processo nuovo: `/admin/segnalazioni-beta` ha già owner/SLA per ogni segnalazione (CR-050). Per il pilot, un solo criterio aggiuntivo di priorità: una segnalazione che menziona esplicitamente "Spotlight"/"percorso guidato"/"tour" va trattata come priorità alta indipendentemente dall'SLA calcolato, perché tocca l'unica superficie interamente nuova di questo gate (§7-14) — non ancora osservata da nessun utente reale prima di questo pilot.

## 6. Trigger di incidente e rollback

Rimanda a `TRAMA_ONE_CONTROLLED_PUBLICATION.md` §4 per la procedura tecnica. Criteri per DECIDERE di attivarla (proposti, da confermare/adattare — è una decisione di prodotto di Fabrizio):

- Un bug che espone dati di un centro/famiglia ad un altro (violazione di isolamento) → rollback immediato, non negoziabile.
- Un errore applicativo (pagina bianca/"Application error") su una delle route `/one*` per più di un utente pilota → rollback della sola coorte (non serve toccare l'override `role=platform_admin`, che resta per il team interno).
- Segnalazioni multiple e concordanti sullo stesso punto dello Spotlight (es. popover che non si chiude, target mai trovato) → non necessariamente rollback, ma priorità di fix immediata (vedi §5).

## 7. Punto di decisione al giorno ~50 (rinnovo/espansione/stop)

Circa 10 giorni prima della scadenza (2026-10-02), tre opzioni, nessuna delle quali eseguibile da Claude senza istruzione esplicita:

1. **Rinnovare** la coorte esistente (estendere `expires_at` sull'override `scope=cohort` — azione SQL, un semplice `UPDATE`, da preparare come script non applicato quando richiesto).
2. **Espandere** il pilot ad altri centri/famiglie (`supabase/script_controlled_beta_expand_cohort.sql`, già pronto come template).
3. **Interrompere** (lasciare scadere naturalmente, o rollback anticipato se già deciso per un incidente — §6).

## 8. Criteri di successo del pilot (proposti)

Nessun dato storico di riferimento esiste ancora (è il primo pilot di questa funzionalità), quindi questi sono criteri PROPOSTI da confermare con Fabrizio, non soglie già validate:

- Nessun incidente da rollback immediato (§6) durante la finestra.
- Almeno un centro pilota completa l'intero percorso `activity_creation_partner` (6 step, dashboard incluso) tramite il vero Spotlight.
- Il volume di segnalazioni relative allo Spotlight non supera quello delle altre superfici NEXTGEN già in produzione, a parità di utenti attivi (nessuna soglia assoluta senza un denominatore).

## 9. Cosa NON è incluso in questo modello

- Materiale di comunicazione/onboarding per i centri e le famiglie pilota (email di invito, guide) — fuori dal perimetro tecnico di questo documento.
- Automazione del rinnovo o dell'espansione della coorte — resta sempre un'azione SQL manuale di Fabrizio, per costruzione (nessuna scrittura di produzione da Claude).
- Modifiche al dominio funzionale Sprint 1-6 — invariato, coerente con il perimetro dell'intero gate.
