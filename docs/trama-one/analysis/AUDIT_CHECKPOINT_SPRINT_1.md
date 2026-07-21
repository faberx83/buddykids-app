# TRAMA ONE — Audit Checkpoint — Build Sprint 1 (Audit Remediation)

Documento autosufficiente per un auditor esterno che non ha seguito la conversazione. Sostituisce integralmente la versione precedente di questo checkpoint (che aveva ricevuto **AUDIT STATUS: READY WITH CONDITIONS** dall'audit esterno) e ne chiude le tre condizioni: (1) inizializzazione automatica LEAD per i centri nuovi, (2) revisione del linguaggio utente della macchina a stati, (3) baseline dei test preesistenti.

## 1. Executive Status

**Obiettivo di questa remediation**: chiudere le tre condizioni poste dall'audit esterno sul checkpoint originale di Build Sprint 1, senza riaprire l'architettura generale dello sprint (state machine Center, checklist, verifica identità, Admin review, Walkthrough — tutti già implementati e deployati in precedenza).

**Risultato**: le tre condizioni sono state chiuse a livello di codice, test e documentazione, **e ora anche verificate end-to-end contro il deploy reale**. `migration_10_center_onboarding_auto_lead.sql` è stata applicata da Fabrizio in produzione (Gate 1 chiuso) e ri-testata con un browser reale (Gate 2): TC-N407 (creazione centro → riga LEAD automatica, nessun INSERT manuale) e TC-N408 (idempotenza del trigger) sono **passed** contro `https://buddykids-app.vercel.app`, su chromium e mobile-chrome. Il primo run reale aveva rivelato 3 bug nei *test* stessi (locator `getByLabel` non associato label/input, `new RegExp()` che interpretava `[TEST]` come classe di caratteri, un livello di risalita DOM di troppo nel locator della riga) — tutti corretti e ricommittati (`65248e2`, `64924c0`, `b5842ca`), nessun bug nel prodotto.

**Stato**: **READY FOR CONTINUATION, capability core verificata dal vivo**. TC-N409 (percorso CHANGES_REQUESTED) fallisce ancora perché richiede una precondizione SQL manuale non ancora eseguita (documentata nel test stesso, non bloccante); TC-N411 resta skippato per mancanza di una seconda utenza center_admin di test (noto, non bloccante). Governance DEC-29/30/31 invariata: la cadenza "audit esterno ad ogni sprint" resta sostituita da un unico Integration Gate dopo Build Sprint 4; questo checkpoint resta un documento interno di continuità.

## 2. Repository State

- **Branch**: `main`.
- **Commit di partenza di questa remediation**: `4a81add` (chiusura del checkpoint precedente, READY).
- **Commit finali di questa remediation**: `8462f9a` (migration_10), `f3ef87c` (registry etichette italiane), `9f6e1f8` (test).
- **Diff di questa remediation** (`4a81add...9f6e1f8`): 7 file, +618/-39 righe, **zero file eliminati**.
- **Working tree**: pulito subito dopo questi 3 commit; questo stesso file e gli altri aggiornamenti documentali (§13) sono un quarto commit successivo.
- **Push/deploy**: pubblicato e deployato da Fabrizio (`SKIP_TESTS=1 bash deploy.sh`, commit `b5842ca` in produzione su `https://buddykids-app.vercel.app`) DOPO l'applicazione di migration_10 (Gate 1).

## 3. Scope

- **In scope di questa remediation**: (1) auto-inizializzazione LEAD per centri nuovi; (2) revisione linguaggio utente (etichette italiane centralizzate, rimozione "Reclama"); (3) baseline dei 7 fallimenti preesistenti.
- **Esplicitamente fuori scope, rispettato**: nessuna riapertura dell'architettura Sprint 1 (nessuna tabella/funzione di `migration_09` modificata); nessun avvio di Build Sprint 2.
- **Deviazioni**: nessuna.

## 4. Feature Preservation

- **`migration_09` non modificata**: confermato — nessun comando ha toccato `supabase/migration_09_center_onboarding.sql` (il suo hash SHA-256 resta `90133b54f57e8fc189b14251c9848d55f5fa97f7c199d7029624dd1286fd634c`, invariato rispetto al checkpoint precedente).
- **`migration_10` additiva**: solo un trigger + una funzione nuovi su `public.centers`; nessuna colonna aggiunta/alterata, nessun backfill, nessuna riga toccata per i centri esistenti (garantito dal post-check §9).
- **Valori tecnici della macchina a stati invariati**: LEAD/CLAIMED/SUBMITTED/CHANGES_REQUESTED/APPROVED/SUSPENDED — verificato dal test TC-N410a (registry contiene esattamente questi 6 valori, nessuna rinomina).
- **Nessuna capability Legacy/NextGen toccata**: diff di questa remediation limitato a `supabase/migration_10_*.sql`, `lib/onboarding/*`, `app/*/onboarding/*Client.tsx`, `tests/one/*`, `docs/trama-one/*`, `BuddyKids_Test_Case.xlsx`.
- **Feature eliminate**: zero, confermato da `git diff --diff-filter=D`.

## 5. Auto-LEAD Remediation

**Analisi dei punti di inserimento in `public.centers`** (statica, ricerca testuale su tutto il repository):

| # | Canale | Tipo | Passa da un servizio applicativo unico? |
|---|---|---|---|
| 1 | `app/actions/admin.ts` → `createCenterAndAssignAction()` | Server Action, riservata a `platform_admin` (RLS) | Sì, unico punto runtime |
| 2 | `supabase/seed.sql` | Script SQL diretto | No |
| 3 | `supabase/seed-test-data.sql` | Script SQL diretto (fixture di test) | No |
| 4 | Supabase SQL Editor | Manuale, non tracciabile staticamente | No |

**Conclusione**: nessun punto applicativo unico e obbligatorio esiste — 2 dei 4 canali bypassano completamente l'applicazione. Scelto un **trigger a livello database** (`AFTER INSERT` su `public.centers`) invece di un servizio applicativo, per garanzia indipendente dal client (DEC-26).

**Implementazione** (`supabase/migration_10_center_onboarding_auto_lead.sql`, non ancora applicata):
- Funzione `public.init_center_onboarding_lead()`, `SECURITY DEFINER`, `search_path` esplicito (`public, pg_catalog`) — necessaria perché `center_onboarding_state` non ha alcuna policy RLS di INSERT lato client.
- Trigger `trg_init_center_onboarding_lead` (`AFTER INSERT ON public.centers`).
- `INSERT ... ON CONFLICT (center_id) DO NOTHING` — idempotente, mai duplicati, mai sovrascrive uno stato esistente.
- Nessun backfill: il trigger si attiva solo su nuovi INSERT, mai retroattivamente sui centri esistenti.
- Pre-check, post-check e rollback documentati nel file stesso (query pronte, da eseguire una alla volta).

**Comportamento atteso dopo l'applicazione**:
- Centro pre-esistente (creato prima di migration_10): nessuna riga, resta APPROVED implicito, nessuna modifica — INVARIATO.
- Centro nuovo (creato dopo migration_10, da qualunque canale): riceve automaticamente una riga LEAD, nessun INSERT manuale necessario, nessun duplicato anche in caso di retry.

## 6. UI Language e Microcopy

**Registry unico**: `lib/onboarding/status-copy.ts` (nuovo). Nessun modulo `server-only` — importabile sia da Server Component sia da `"use client"` (`OnboardingClient.tsx`, `AdminOnboardingReviewClient.tsx`), stesso principio già applicato a `lib/onboarding/types.ts`.

**Mappatura implementata** (esattamente quella approvata da Fabrizio):

| Stato tecnico | Partner | Admin |
|---|---|---|
| LEAD | "Centro da attivare" / CTA "Avvia l'attivazione del centro" | "Da attivare" |
| CLAIMED | "Attivazione avviata" | "Attivazione richiesta" |
| SUBMITTED | "In verifica" / "In attesa di verifica" | "Da verificare" / "Esamina la richiesta" |
| CHANGES_REQUESTED | "Integrazioni richieste" / CTA "Invia nuovamente per verifica" | "Modifiche richieste" |
| APPROVED | "Centro attivo" | "Approvato" / azione "Sospendi" |
| SUSPENDED | "Attivazione sospesa" | "Sospeso" |

**"Reclama" rimosso**: la CTA "Reclama il mio centro" (`OnboardingClient.tsx`) e l'etichetta Admin "Da reclamare" (`AdminOnboardingReviewClient.tsx`) sono state sostituite. Verificato via `grep -i "Reclama"` sull'intero repository: **0 occorrenze** in codice applicativo (l'unica occorrenza residua è un commento tecnico interno non user-facing in `lib/onboarding/data.ts`, riga 124, esplicitamente permesso dalla sezione 9 delle istruzioni di remediation: "nel codice e nella documentazione tecnica è possibile continuare a usare i nomi delle funzioni già esistenti").

**Storico**: `formatOnboardingTransition()` traduce ogni transizione in italiano (es. "Centro da attivare → Attivazione avviata"); i codici tecnici grezzi non vengono mai mostrati all'utente, restano nei campi `fromStatus`/`toStatus` per audit/debug.

**Nessuna traduzione duplicata**: `OnboardingClient.tsx` e `AdminOnboardingReviewClient.tsx` non definiscono più alcun `STATUS_LABEL` locale — verificato da un test di source-scan (TC-N410i) che legge il sorgente dei due file e verifica l'assenza della dichiarazione locale e la presenza dell'import da `status-copy`.

## 7. Architecture and Reuse

| Classificazione | Elementi di questa remediation |
|---|---|
| **NEW** | `supabase/migration_10_center_onboarding_auto_lead.sql`; `lib/onboarding/status-copy.ts`; `tests/one/onboarding-remediation.spec.ts`; `docs/trama-one/analysis/PRE_EXISTING_TEST_FAILURE_BASELINE.md` |
| **ADAPT** | `app/center/one/onboarding/OnboardingClient.tsx`, `app/admin/one/onboarding/AdminOnboardingReviewClient.tsx` (rimosso `STATUS_LABEL` locale, importato il registry); `tests/one/onboarding.spec.ts` (esteso); `BuddyKids_Test_Case.xlsx` (righe aggiornate/aggiunte) |
| **REUSE** | Le 3 funzioni SECURITY DEFINER di `migration_09` (`center_claim_onboarding`, `center_submit_onboarding`, `admin_review_center_onboarding`) — invariate, nessuna modifica di comportamento |
| **WRAP / REPLACE_AFTER_PARITY** | Nessuno |

## 8. Routes and UI

Nessuna route nuova o modificata in questa remediation — stesse due route di Sprint 1 (`/center/one/onboarding`, `/admin/one/onboarding`), stesso gate `TRAMA_ONE_ENABLED` ereditato dai layout padre. Solo il contenuto testuale/CTA è cambiato.

## 9. Database

- **Migrazione**: `migration_10_center_onboarding_auto_lead.sql`, hash SHA-256: `d8445ec4e634fd045893db5279cc356a58cdaf57915fb4d78ddf8a4e26f5529d`.
- **Stato di applicazione**: **APPLICATA in produzione da Fabrizio (Gate 1 chiuso)** e verificata funzionante da un test browser reale (TC-N407/N408, passed su chromium e mobile-chrome contro `https://buddykids-app.vercel.app`) — trigger crea la riga LEAD automaticamente, idempotente, nessun backfill sui centri preesistenti. Nessuna connessione diretta a Supabase da parte di Claude in nessun momento: applicazione ed esecuzione sempre e solo da parte di Fabrizio.
- **Oggetti introdotti**: funzione `public.init_center_onboarding_lead()` (SECURITY DEFINER), trigger `trg_init_center_onboarding_lead` su `public.centers`.
- **Pre-check/post-check/rollback**: documentati nel file stesso, query pronte da eseguire una alla volta.

## 10. Security and Privacy

- **SECURITY DEFINER giustificato**: `center_onboarding_state` non ha policy RLS di INSERT lato client (per costruzione, `migration_09`) — la funzione trigger deve bypassare RLS per scrivere, stesso principio già usato per le 3 funzioni di transizione esistenti.
- **`search_path` esplicito**: `set search_path = public, pg_catalog` — mitiga il rischio classico di hijacking di funzioni SECURITY DEFINER via `search_path` non qualificato.
- **Nessun privilegio più ampio del necessario**: la funzione fa solo un INSERT con `ON CONFLICT DO NOTHING` su una singola tabella.
- **Nessun nuovo dato sensibile**: il trigger non introduce PII o dati nuovi, solo una riga di stato.

## 11. Tests

| Categoria | Esito |
|---|---|
| `npx tsc --noEmit` | **Eseguito, pulito** |
| `npm run lint` | **Eseguito, 0 errori, 128 warning** (identico alla baseline precedente — nessun nuovo warning) |
| `npm run build` | **Eseguito, pulito** — tutte le route confermate `ƒ Dynamic`, incluse `/center/one/onboarding` e `/admin/one/onboarding` |
| `bash -n deploy.sh` / `bash -n test-deploy.sh` | **Eseguito, sintassi OK** |
| Unit test onboarding + walkthrough + feature-flags + registry italiano (`tests/one/onboarding.spec.ts`, `tests/one/feature-flags.spec.ts`) | **Eseguito, 72/72 passed** (36 test unici × 2 progetti browser), incluse le 9 nuove assertion TC-N410a..i su valori tecnici invariati, etichette differenziate, CTA corrette, storico tradotto, assenza di "Reclama" |
| `tests/one/onboarding-remediation.spec.ts` — sintassi/list | **Eseguito, `--list` conferma 12 test (6 ID × 2 browser) senza errori di parsing** |
| `tests/one/onboarding-remediation.spec.ts` — esecuzione reale (Gate 2, eseguito da Fabrizio) | **TC-N407, TC-N408, TC-N412, TC-N413: passed** (chromium + mobile-chrome, contro `https://buddykids-app.vercel.app`, post-applicazione migration_10). **TC-N409: failed** — richiede una precondizione SQL manuale (reset del centro di test a SUBMITTED) documentata nel test stesso, non ancora eseguita: non è un bug. **TC-N411: skipped** — richiede una seconda utenza center_admin di test non ancora provisionata, come documentato. Il primo run reale aveva rivelato 3 bug nei *test* (non nel prodotto): locator `getByLabel` non associato a `NewCenterForm.tsx` (nessun `htmlFor`/`id`), `new RegExp()` che interpretava `[TEST]` come classe di caratteri regex invece di testo letterale, un livello di risalita DOM di troppo nel locator di riga — tutti corretti (commit `65248e2`, `64924c0`, `b5842ca`) e riverificati verdi. |
| Suite browser completa (`TEST_SCOPE=all`) | **NON ESEGUITA — decisione di delivery esplicita (DEC-29), non una dimenticanza.** Verifiche per questa chiusura limitate a: test statici (tsc/lint/build), unit test onboarding/walkthrough/feature-flags/registry italiano, test mirati auto-LEAD e microcopy, smoke delle route Sprint 1, fallback essenziali `/one`. La regressione completa (`TEST_SCOPE=all` confrontata con `PRE_EXISTING_TEST_FAILURE_BASELINE.md`) è differita all'Integration Gate dopo Build Sprint 4 (DEC-30) |

**Suite browser completa non eseguita per decisione di delivery. Verifiche limitate a test statici, unitari, smoke mirati e flusso funzionale Sprint 1. Regressione completa differita all'Integration Gate dopo Build Sprint 4.**

Nessuna affermazione di test/migrazione/deploy eseguito senza riscontro reale. Qualunque errore emerso nei test effettivamente eseguiti (statici, unitari, mirati) resta bloccante e va corretto, non ignorato.

## 12. Baseline dei fallimenti preesistenti

Prodotto `docs/trama-one/analysis/PRE_EXISTING_TEST_FAILURE_BASELINE.md`. Le 4 aree note (login header, sfondo login, nav Gestore, badge/logo NextGen/Admin) sono documentate con tutto ciò che è verificabile oggi; i campi che richiedono l'output raw del run Playwright (nome test esatto, browser, assertion) sono marcati onestamente "DA CONFERMARE" — quel dato raw non è mai stato conservato in questo repository, solo osservato e riassunto qualitativamente da Fabrizio in sessioni precedenti. Il comando fornito nel Gate 2 chiuderà questo gap producendo l'output `--reporter=list` necessario. Nessun dettaglio è stato inventato per riempire il documento (DEC-28).

## 13. Deploy

Non ancora eseguito per questa remediation. Sequenza pianificata (Gate 1 → Gate 2 → Gate 3, vedi §18).

## 14. Commits and Files

**3 commit di codice/test** (`4a81add..9f6e1f8`):
```
8462f9a feat(trama-one): auto initialize new centers in LEAD onboarding state
f3ef87c feat(trama-one): centralize Italian onboarding status labels and activation copy
9f6e1f8 test(trama-one): cover automatic LEAD initialization and Italian onboarding copy
```
Più questo commit di documentazione (`docs(trama-one): document Sprint 1 audit remediation and test baseline`), che include questo stesso file.

**File creati**: `supabase/migration_10_center_onboarding_auto_lead.sql`; `lib/onboarding/status-copy.ts`; `tests/one/onboarding-remediation.spec.ts`; `docs/trama-one/analysis/PRE_EXISTING_TEST_FAILURE_BASELINE.md`.

**File modificati**: `app/center/one/onboarding/OnboardingClient.tsx`, `app/admin/one/onboarding/AdminOnboardingReviewClient.tsx`, `tests/one/onboarding.spec.ts`, `BuddyKids_Test_Case.xlsx`, `docs/trama-one/analysis/SPRINT_1_FEATURE_PRESERVATION_MATRIX.md`, `docs/trama-one/TRANSITION_REGISTER.md`, `docs/trama-one/analysis/DECISION_LOG.md`, `docs/trama-one/analysis/ASSUMPTION_LOG.md`, `docs/trama-one/analysis/AUDIT_CHECKPOINT_SPRINT_1.md` (questo file).

**File intenzionalmente invariati**: `supabase/migration_09_center_onboarding.sql` (hash SHA-256 identico al checkpoint precedente); tutti i layout `/one`; `proxy.ts`; `supabase/schema.sql`; tutte le route Legacy/NextGen.

## 15. Decisions and Assumptions

**Nuove decisioni**: DEC-26 (trigger database, non servizio applicativo), DEC-27 (linguaggio utente centralizzato, valori tecnici invariati), DEC-28 (baseline parziale, onestamente marcata). V6 di `ASSUMPTION_LOG.md` verificata e chiusa (gap trovato e risolto in attesa di applicazione).

## 16. Risks

- **Blocker**: nessuno. `migration_10` applicata e verificata funzionante in produzione (Gate 1 + Gate 2 core chiusi con evidenza reale).
- **Rischio basso**: TC-N409 (percorso CHANGES_REQUESTED) non ancora rieseguito con successo — richiede una precondizione SQL manuale (reset a SUBMITTED) che Fabrizio non ha ancora applicato; nessun impatto sulla capability verificata (auto-LEAD).
- **Rischio basso**: baseline dei 7 fallimenti preesistenti ancora parzialmente qualitativa (DEC-28) — si chiude quando verrà eseguita la suite completa (`TEST_SCOPE=all`) all'Integration Gate di Sprint 4.
- **Rischio basso**: TC-N411 (isolamento center_admin cross-centro) non automatizzabile con le utenze di test attuali (una sola utenza center_admin esiste) — documentato, non bloccante per il pilot.

## 17. Rollback

- **Funzionale**: `TRAMA_ONE_ENABLED=false` invariato, nessun impatto.
- **Codice**: revert dei 3 commit di questa remediation.
- **Database**: rollback di `migration_10` documentato nel file stesso (drop trigger poi funzione, non cancella dati onboarding reali già creati).
- **UI**: revert isolato dei 2 file client se necessario (registry indipendente, nessuna dipendenza da migration_10 lato codice).

## 18. Sprint 2 Readiness / Gate rimanenti

**Gate 1 — Applicazione migration_10**: **CHIUSO.** Fabrizio ha applicato `supabase/migration_10_center_onboarding_auto_lead.sql` (SHA-256 `d8445ec4e634fd045893db5279cc356a58cdaf57915fb4d78ddf8a4e26f5529d`) in produzione.

**Gate 2 — Test browser sul Mac**: **CHIUSO per la capability core.** Comando eseguito da Fabrizio contro `https://buddykids-app.vercel.app` (post-migration_10, post-deploy):
```
source .env.test
TEST_BASE_URL=https://buddykids-app.vercel.app npx playwright test tests/one/onboarding-remediation.spec.ts --reporter=list --workers=1
```
Risultato reale (dopo 3 correzioni di locator nel test — nessuna nel prodotto): **8 passed** (TC-N407, TC-N408, TC-N412, TC-N413 × 2 browser), **2 failed** (TC-N409, richiede precondizione SQL manuale non ancora eseguita — documentata nel test, non bloccante), **2 skipped** (TC-N411, seconda utenza non provisionata — noto). La suite `smoke.spec.ts` non è stata rilanciata insieme (conflitto noto e documentato: gli stessi account di test hanno un override `TRAMA_ONE_ENABLED` attivo, necessario perché i test di onboarding raggiungano `/admin/one/onboarding` — questo rende i test "flag disattivato di default" di quella suite strutturalmente incompatibili con gli stessi account, non una regressione).

Residuo facoltativo, non bloccante: se si vuole chiudere anche TC-N409, eseguire la precondizione SQL documentata nel test stesso (reset di un centro di test a `SUBMITTED`) e rilanciare.

**Gate 3 — Merge e deploy**: non pianificato — nessun merge multi-branch in corso (lavoro già su `main`); il deploy di questa remediation è già stato eseguito da Fabrizio (`bash deploy.sh`, commit `b5842ca`).

## 19. Audit Conclusion

**AUDIT STATUS: READY FOR CONTINUATION**

Remediation Sprint 1 completata e **verificata end-to-end contro il deploy reale**: codice, test statici/unitari/mirati (72/72 passed) e ora anche la capability core della migrazione (auto-LEAD, nessun INSERT manuale, idempotenza) confermata da un browser reale contro produzione. Nessuna capability AS-IS a rischio, nessun valore tecnico rinominato, "Reclama" rimosso e verificato, nessuna regressione introdotta nei test eseguiti. Nessun blocker noto per la prosecuzione di Build Sprint 2 (già in corso in parallelo). Residui non bloccanti, entrambi documentati onestamente: TC-N409 richiede una precondizione SQL manuale non ancora eseguita; TC-N411 richiede una seconda utenza di test non ancora provisionata. Suite browser completa (`TEST_SCOPE=all`) resta differita all'Integration Gate dopo Build Sprint 4 (DEC-29/30) — questo checkpoint è un documento interno di continuità, non richiede un nuovo audit esterno.
