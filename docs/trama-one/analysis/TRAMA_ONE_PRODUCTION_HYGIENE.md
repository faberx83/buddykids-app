
# TRAMA ONE — Production Hygiene (§19)

Copre §19 del gate "Controlled Beta Experience, Publication and Readiness Gate": un controllo di igiene dei dati di produzione prima della pubblicazione, in sola lettura via Supabase MCP (progetto `eagsgfxunwyyxwwilldy`), più uno script di pulizia separato per ciò che è risultato inequivocabilmente debris di test — mai un'azione applicata da Claude, coerente con la governance permanente del programma.

## 1. Correzione di un errore di questa stessa giornata (telemetria, §18)

Durante la stesura del Pilot Operating Model (§18, DEC-63) un controllo aveva concluso erroneamente che `public.product_events` (migration_20, DEC-52) e le colonne `bookings.email_delivery_status`/`email_delivery_error`/`email_delivery_attempted_at` (migration_19, DEC-49) non fossero applicate. Causa: una chiamata `execute_sql` con più statement separati da `;` restituisce solo il risultato dell'ULTIMO statement, non di tutti — le prime due query di quel gruppo sono state lette come "nessun risultato" invece che come "non eseguite". Ripetendo ogni query singolarmente durante questo stesso controllo di igiene: entrambe le migrazioni risultano applicate — `product_events` esiste con 46 righe reali (`one_route_access`×44, `walkthrough_step_started`×2), le 3 colonne email_delivery esistono su `bookings` (1 riga `not_configured`, 15 `null`). Corretti sia `CONTROLLED_BETA_OPERATING_MODEL.md` §4 sia `DECISION_LOG.md` DEC-63 (vedi DEC-64). Nessuna azione richiesta da Fabrizio su questo punto: era un errore di metodo di Claude, non un problema del database.

## 2. Debris di test trovato: 2 centri orfani + 7 center_leads

Verificato in sola lettura il 2026-08-03 (query individuali, non multi-statement — lezione applicata da subito):

| Tabella | Righe di test trovate | Creazione | Impatto |
|---|---|---|---|
| `centers` | 2 (`[TEST] Centro Auto LEAD 1785752525740` id `9e284123-cfac-424d-8fe9-e55d9d7a4d4f`; `[TEST] Centro Idempotenza 1785752529922` id `e8fd53eb-2020-446f-93c7-1f695140149f`) | Entrambi 2026-08-03, 0 attività, 0 righe di audit onboarding | Visibili in `/admin/onboarding-centri` e in qualunque ricerca centri, indistinguibili a colpo d'occhio da un centro reale appena creato |
| `center_leads` | 7 (tutte `[TEST] Centro Segnalato <timestamp>`) | Tutte 2026-08-03, tra le 09:33 e le 10:22 UTC — 6 `status='suggested'`, 1 `status='claimed'` con `claimed_center_id` = `[TEST] Centro BuddyKids` | Visibili in `/admin/center-leads` e nella coda "Segnalazioni centro non iscritto da qualificare" del Command Center (`/admin/one`, DEC-51) |

Entrambe le tabelle sono al 100% popolate da run di test automatici (nomi con prefisso `[TEST]`/timestamp epoch nel nome, creazione concentrata in una finestra di minuti/ore lo stesso giorno) — non c'è ambiguità su questi 9 record specifici.

## 3. Cosa NON è debris (fixture legittimi, esclusi esplicitamente dalla pulizia)

- **`[TEST] Centro BuddyKids`** (id `40a64d60-3d45-4851-bac4-1761915ad92e`): fixture reale e permanente, collegato all'account `TEST_CENTER_ADMIN_EMAIL` usato dalla suite Playwright — ha 2 attività reali e 14 righe di audit onboarding. Una delle 7 righe `center_leads` da rimuovere punta a questo centro come `claimed_center_id`: rimuovere quella riga non tocca il centro (si cancella il lead, non il centro).
- **`Test centro estivo`** (id `3a240835-6412-402c-9c63-2c8cf0944fca`): predata TRAMA ONE (creato 2026-07-07), ha 1 attività reale. Ambiguo se sia debris residuo o contenuto demo intenzionale — **non incluso** nello script di pulizia, per decisione esplicita di lasciare a Fabrizio l'ultima parola su questo specifico record (unico nel dataset senza una firma chiara né di "fixture di test noto" né di "debris di run automatico").

## 4. Altri controlli eseguiti, esito pulito

- `feature_flag_overrides` per `TRAMA_ONE_ENABLED`: esattamente 3 righe, coerenti con DEC-57 (cohort attiva fino al 2026-10-02, global storico disattivato/scaduto, role=platform_admin permanente) — nessuna riga spuria.
- `beta_cohort_memberships`: esattamente 2 righe, entrambe i 2 account di test designati, nessuna membership orfana (es. residuo del `FAKE_TEST_USER_ID` di TC-N609) — la logica di cleanup di quel test funziona correttamente.
- FK delle tabelle coinvolte nella pulizia proposta (letta da `information_schema`, non assunta): `centers` → `center_onboarding_state`/`center_onboarding_audit_log`/`center_onboarding_checklist_completions`/`center_identity_verifications`/`activities`/`activity_log`/`group_requests`/`invites`/`activity_certifications` tutte `ON DELETE CASCADE`; `profiles.center_id` e `center_leads.claimed_center_id` `ON DELETE SET NULL` — nessuna riga reale dipende dai 2 centri target (verificato in PRE-CHECK dello script di pulizia).

## 5. Deliverable prodotti in questo giro

- `supabase/script_production_hygiene_audit.sql` — **sola lettura**, riutilizzabile ad ogni ciclo di monitoraggio (proposto: stessa cadenza settimanale di §18): flag/coorte, membership, centri con "test" nel nome, center_leads con "[TEST]" nel nome, distribuzione giornaliera dei lead, censimento profili.
- `supabase/script_production_hygiene_cleanup.sql` — **non applicato**, perimetro chiuso ai 9 record identificati sopra (2 centri + 7 lead), PRE-CHECK/transazione/POST-CHECK, esclusione esplicita per nome e id dei 2 fixture legittimi, nessun rollback SQL possibile dopo il commit (solo Point-in-Time Recovery nativo Supabase, da usare solo se il PRE-CHECK viene bypassato per errore).

## 6. Cosa richiede una decisione di Fabrizio, non eseguibile da Claude

- Se e quando eseguire `script_production_hygiene_cleanup.sql` (azione di produzione, per governance permanente non eseguibile da Claude).
- Cosa fare di `Test centro estivo` — debris da includere in un futuro script di pulizia, o contenuto demo da conservare intenzionalmente.
- Se adottare `script_production_hygiene_audit.sql` come controllo ricorrente (es. stesso script rilanciato ogni settimana insieme alle altre superfici di monitoraggio di §18) o come controllo una tantum pre-pubblicazione.
