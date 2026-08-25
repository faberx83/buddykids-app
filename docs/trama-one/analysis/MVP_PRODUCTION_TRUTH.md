# TRAMA ONE — MVP Production Truth (05/08/2026)

Sezione 1 di "TRAMA ONE — Final MVP September Readiness e Admin Feature Control Center". Riconciliazione dal vivo di repository, produzione e database prima di qualunque modifica di codice, come richiesto esplicitamente. Nessuna assunzione: ogni riga di questo documento è stata verificata leggendo git, GitHub o eseguendo query di sola lettura su Supabase (progetto `eagsgfxunwyyxwwilldy`, autorizzato in piena autonomia in sola lettura).

## 1. Stato repository

| Elemento | Valore | Verifica |
|---|---|---|
| HEAD locale | `ed1ddc7` — "fix(dashboard): safe-area-inset-bottom nel cassetto mobile (Android gesture bar)" | `git log -1` |
| origin/main (GitHub, `faberx83/buddykids-app`) | `ed1ddc7` (identico a HEAD locale) | `git ls-remote origin main` (chiamata di rete reale, non cache) |
| Working tree | Pulito | `git status --short` vuoto |
| Commit testato con TEST_SCOPE=critical (Fabrizio, 05/08 12:45) | `3248621` — "docs(trama-one): DEC-77 - Candidati come centro + xlsx TC-512..514" | log deploy allegato da Fabrizio |
| Commit deployato in produzione (Vercel) | **Presumibilmente `3248621`, NON confermabile da qui** | Vedi nota sotto |
| Commit repository più recente (non ancora ri-deployato) | `ed1ddc7` (+ `28b9560` fix locator password) | 2 commit dopo `3248621`: fix strict-mode `getByLabel(/password/i)` e fix safe-area cassetto mobile |

**Nota sul commit deployato**: questo sandbox non ha credenziali Vercel (`vercel whoami` → "No existing credentials found"), quindi non posso interrogare l'API Vercel per il commit realmente servito in produzione. Il repository GitHub (`origin/main`) è già a `ed1ddc7` — più avanti del deploy testato da Fabrizio alle 12:45 (`3248621`) — ma **push su GitHub non implica deploy su Vercel**: `deploy.sh` esegue i due passi separatamente (`git push` poi `vercel --prod`). Fino a un nuovo `bash deploy.sh`, i due fix più recenti (locator test password, safe-area cassetto mobile) sono nel repository ma verosimilmente non ancora live. Il candidato "Candidati come centro" (fino a `3248621`) **è confermato live**, perché Fabrizio lo ha testato in produzione stamattina (screenshot con errore "candidate_email ... schema cache").

## 2. Ambiente Supabase

- Progetto: `eagsgfxunwyyxwwilldy` (nome "buddykids", org `whwboypinreqvmucvriu`, regione `eu-west-3`, stato `ACTIVE_HEALTHY`, Postgres 17.6).
- `list_migrations` (tracking CLI Supabase) → **vuoto**. Atteso e coerente con la convenzione del progetto: le migrazioni non passano mai da `supabase migration up`, ma da SQL incollato manualmente da Fabrizio nell'SQL Editor (governance permanente). Questo tool non è quindi una fonte attendibile per lo stato reale — da qui la verifica diretta sotto.

## 3. Migrazioni 15-21 — verifica diretta degli oggetti attesi (non dalla documentazione)

Contraddizione da risolvere, come richiesto: alcuni checkpoint dichiaravano 15-20 applicate, il documento di coerenza più recente dichiarava 15-21 **non** applicate. Verificato dal vivo con query di sola lettura su `information_schema` / `pg_policies` / `storage.buckets` / `information_schema.table_constraints`:

| Migrazione | Oggetti attesi | Presente DB | Verifica | Da applicare |
|---|---|---|---|---|
| migration_15 | bucket `buddykids-identity-verifications` (storage, privato) + 4 policy RLS su `storage.objects` | **Sì** | `exists(select 1 from storage.buckets where id=...)` = true; policy "Verifica identita: lettura..." presente in `pg_policies` | No |
| migration_16 | tabella `public.activity_certifications` + RLS | **Sì** | `information_schema.tables` = true | No |
| migration_17 | tabella `public.center_leads` + RLS | **Sì** | `information_schema.tables` = true | No |
| migration_18 | colonna `public.booking_weeks.capacity_decremented` | **Sì** | `information_schema.columns` = true | No |
| migration_19 | colonne `public.bookings.email_delivery_status` / `email_delivery_error` / `email_delivery_attempted_at` | **Sì** (tutte e 3) | `information_schema.columns` = true | No |
| migration_20 | tabella `public.product_events` + RLS | **Sì** | `information_schema.tables` = true | No |
| migration_21 | colonne `center_leads.lead_type` / `candidate_email` / `candidate_phone` + constraint `center_leads_type_suggested_by_chk` | **Sì** (tutte e 4) | `information_schema.columns` + `information_schema.table_constraints` = true | No |

**Verdetto sulla contraddizione**: il documento di coerenza che dichiarava 15-21 "non applicate" era **stale/errato**. Tutte e 7 le migrazioni (15-21) sono realmente presenti nel database di produzione, verificato oggetto per oggetto, non per deduzione documentale. **Nessuna migrazione va applicata di nuovo** — nessun gate SQL necessario per questa sezione.

## 4. Il bug "candidate_email ... schema cache" (screenshot di Fabrizio) — causa reale

Non è un problema di migrazione mancante (la colonna esiste, verificato sopra). È lo scenario classico di **cache di schema di PostgREST non aggiornata**: PostgREST (l'API REST auto-generata che il client Supabase usa) mantiene una cache dello schema Postgres e non la ricarica automaticamente subito dopo un `ALTER TABLE` eseguito fuori dal proprio ciclo di vita normale (es. SQL Editor manuale, come da convenzione di questo progetto). Il risultato: la colonna esiste in Postgres, ma l'API continua a rispondere "could not find column in schema cache" finché la cache non viene invalidata.

**Gate manuale per Fabrizio (unico blocco operativo di questa sezione):**

1. **Motivo**: la candidatura centro fallisce con "candidate_email ... schema cache" anche se la colonna esiste davvero (verificato) — la cache API di Supabase è disallineata dallo schema reale.
2. **Blocco operativo — una delle due, la prima è la più rapida**:
   - Supabase Dashboard → Project Settings → API → pulsante **"Reload schema cache"**; oppure
   - SQL Editor → esegui: `NOTIFY pgrst, 'reload schema';`
3. **Luogo esatto**: dashboard Supabase del progetto `buddykids` (`eagsgfxunwyyxwwilldy`), sezione Settings → API, oppure SQL Editor dello stesso progetto.
4. **Risultato atteso**: il form `/auth/candidati` invia la candidatura senza errori "schema cache"; il record compare nella coda Admin (`/admin/center-leads`).
5. **Cosa riportarmi**: se dopo il reload il form funziona (basta un tentativo con un centro di test, poi lo classifichiamo come `TECHNICAL_TEST` nel catalogo pilot — sezione 9).
6. **Rollback**: nessuno necessario — l'operazione non modifica dati, solo invalida una cache in lettura.

## 5. Feature flag attivi (letti dal vivo, `feature_flag_overrides`)

| Flag | Scope | Valore | Enabled | Scadenza | Stato |
|---|---|---|---|---|---|
| `TRAMA_ONE_ENABLED` | `global` | — | `false` | scaduta 2026-08-03 | Corretto: nessun override globale permanente attivo (coerente con DEC-57 e con il requisito di §13 di non abilitare mai TRAMA ONE globalmente) |
| `TRAMA_ONE_ENABLED` | `cohort` = `trama-one-controlled-beta` | — | `true` | **2026-10-02** | Attivo, con scadenza esplicita (finestra di 60 giorni, coerente con DEC-57) |
| `TRAMA_ONE_ENABLED` | `role` = `platform_admin` | — | `true` | **nessuna scadenza** | Attivo, accesso permanente per l'account interno — **da rivedere in sezione 13**: §13 richiede "tutte le scadenze siano esplicite"; qui la scadenza è assente per lo scope `role`. Non è uno scope globale (quindi non viola il divieto di override globale permanente), ma segnalo la mancanza di `expires_at` come item aperto, non come blocker — è la modalità con cui il team interno mantiene accesso, verosimilmente intenzionale ma non documentata come eccezione esplicita. |

Nessun override attivo per altri flag oltre `TRAMA_ONE_ENABLED` — coerente con l'attesa (feature MVP core sono sempre-on, non dietro flag; solo TRAMA ONE Sprint 0-6 lo è).

## 6. Stato email transazionali (RESEND_API_KEY) — evidenza indiretta

Non posso leggere variabili d'ambiente Vercel da questo sandbox (nessun accesso). Ho verificato per via indiretta sul DB: **tutte le 16 prenotazioni esistenti hanno `email_delivery_status = NULL`** (nessuna riga con `sent`/`failed`/`skipped`). Questo da solo non prova che `RESEND_API_KEY` sia assente in produzione — potrebbe anche significare che nessuna prenotazione reale è stata creata dopo il deploy del codice che scrive questo campo (Sprint 6, "email fire-and-forget"). Il codice (`app/actions/booking-response.ts`) registra esplicitamente anche il caso "email disattivata perché manca la chiave" con uno stato dedicato (non NULL) — quindi **il NULL uniforme più probabile indica che nessuna booking-response reale è ancora passata da quel codice in produzione**, non necessariamente che la chiave manchi. Questo punto resta aperto e va chiuso in sezione 7.2 con un test end-to-end reale (richiesta → risposta Partner) dopo il prossimo deploy.

## 7. Riepilogo esecutivo

- **Nessuna migrazione da applicare**: 15-21 tutte confermate presenti nel DB reale, contraddizione documentale risolta a favore di "tutte applicate".
- **Un solo gate manuale aperto in questa sezione**: reload della cache schema PostgREST (istruzioni sopra) — sblocca immediatamente il flusso Candidati.
- **Nessun override globale permanente** su TRAMA_ONE_ENABLED — coerente con il vincolo di programma.
- **2 commit non ancora ri-deployati** (`28b9560`, `ed1ddc7`) — da includere nel prossimo `bash deploy.sh`.
- **Stato invio email booking-response non ancora osservabile** dai dati esistenti — da chiudere con un test reale in sezione 7.2.

Prossimo passo: Sezione 2 (MVP September Readiness Matrix).

## 8. Addendum 25/08/2026 — migration_27 (PRE-MICRO-PILOT CLOSURE GATE, Privacy & Terms)

Sezione aggiunta senza alterare le sezioni 1-7 (fotografia del 05/08/2026), per tracciare la migrazione applicata da Fabrizio dopo tale data.

| Migrazione | Oggetti attesi | Presente DB | Verifica | Da applicare |
|---|---|---|---|---|
| migration_27 v2 (`migration_27_privacy_terms_consent.sql`) | 4 tabelle: `legal_documents`, `legal_acceptances`, `consent_events`, `parental_declarations` + colonne cache su `profiles` (`tos_version`, `tos_accepted_at`, `privacy_notice_version`, `privacy_notice_accepted_at`, `marketing_consent_updated_at`) + RLS su tutte e 4 le tabelle | **Sì** — applicata manualmente da Fabrizio in SQL Editor | POST-CHECK di sola lettura: `information_schema.tables`/`columns` = presenti; `pg_policies` = 8 policy live corrispondenti esattamente alla migrazione; `relrowsecurity=true` su tutte e 4 le tabelle; 0 righe in `legal_documents` (nessun testo legale pubblicato) | **No — non riapplicare** (vincolo esplicito di Fabrizio: nessuna riapplicazione, nessuna migration sostitutiva salvo evidenza di errore reale) |

**Gap noto, non un blocco oggi**: la policy SELECT di `legal_documents` è `to authenticated` (nessuna policy `to anon`) — innocuo con 0 righe pubblicate, diventerà un blocco reale per le route pubbliche `/privacy` e `/terms` solo quando esisterà un documento PUBLISHED. Workaround applicativo già in uso (`resolvePublishedDocumentForPublicRoute()` in `lib/legal/gate.ts`, service-client); fix di policy documentato in `lib/feature-registry/catalog.ts#legal_public_routes`, non implementato come nuova migration per rispetto del vincolo "nessuna migration salvo errore reale".

**Stato flusso tecnico costruito sopra questa migrazione (task #566-574, 25/08/2026)**: TECHNICAL IMPLEMENTATION: BUILT/STATIC_TESTED; DATABASE: LIVE; LEGAL CONTENT: PENDING EXTERNAL REVIEW; LEGAL GATE (`LEGAL_TERMS_GATE`): OFF (nessun override globale scritto); PILOT READINESS: BLOCKED BY LEGAL CONTENT. Non è uno stato "CLOSED" — resta un gate manuale reale aperto (validazione/redazione del testo legale, poi pubblicazione da parte di Fabrizio) prima di qualunque abilitazione, anche solo su coorte di test. Dettaglio completo in `PRIVACY_TERMS_TECHNICAL_DESIGN.md` e in `PRE_MICRO_PILOT_GATE_STATUS.md`.
