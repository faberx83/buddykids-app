# TRAMA ONE — Audit Checkpoint — Build Sprint 1

Documento autosufficiente per un auditor esterno che non ha seguito la conversazione. Copre l'intero arco di lavoro di Build Sprint 1 — Partner Onboarding, Admin Review e Walkthrough foundation — dal primo commit fino alla verifica post-deploy in produzione.

## 1. Executive Status

**Obiettivo sprint**: state machine di onboarding del Centro (LEAD→CLAIMED→SUBMITTED→CHANGES_REQUESTED→APPROVED→SUSPENDED), checklist onboarding, verifica identità, coda di revisione Admin con audit log, motore Walkthrough generico — tutto interno alle shell `/one` già create in Sprint 0, dietro `TRAMA_ONE_ENABLED`, senza toccare alcuna capability Legacy/NextGen.

**Risultato**: obiettivo raggiunto. Matrice di preservazione prodotta prima dell'implementazione (prerequisito V5 di `ASSUMPTION_LOG.md`); migrazione applicata e verificata in produzione da Fabrizio; flusso reale testato end-to-end da Fabrizio (reclama centro → checklist → verifica identità → invio → approvazione Admin → stato "Approvato"; percorso Walkthrough Parent completato); un bug reale trovato durante il test (coda Admin che escludeva i centri approvati) e corretto; i 5 test di fallback (TC-N302/303/304/401/402) confermati 10/10 passed contro produzione, in isolamento (`--workers=1`, per escludere flakiness da carico parallelo).

**Stato**: **READY WITH CONDITIONS**. Unica condizione aperta: la correzione del bug della coda Admin (DEC-23) è verificata via revisione statica del codice (tsc/lint/build puliti) ma non ri-confermata visivamente in produzione dopo il fix (l'ultima schermata mostrata da Fabrizio era precedente alla correzione). Nessun altro blocco.

## 2. Repository State

- **Branch**: `main`.
- **Commit iniziale di questo sprint**: `1ea9b3e` ("feat(trama-one): add Sprint 1 center onboarding state machine (migration_09, not applied)"), subito dopo la chiusura dell'audit Sprint 0 (`4a9543d`).
- **Commit finale (HEAD)**: `329ef7f` ("chore(deploy): sitemap generation now opt-in (RUN_SITEMAP=1) instead of every deploy").
- **Working tree**: pulito.
- **Diff rispetto all'inizio dello sprint** (`4a9543d...HEAD`): 24 file, +2119/-27 righe, **zero file eliminati** (verificato con `git diff --diff-filter=D`).
- **Push/deploy**: tutti gli 8 commit di questo sprint sono stati pubblicati e deployati in produzione da Fabrizio (`TEST_SCOPE=smoke bash deploy.sh`, push `3e1ebef..329ef7f`, poi correzioni successive fino a `329ef7f` incluso).

## 3. Scope

- **Scope approvato e implementato**: state machine Center (5 tabelle additive + 3 funzioni SECURITY DEFINER); checklist onboarding (registry TypeScript + tabella completamenti); verifica identità (nota testuale + decisione Admin, upload documento differito per decisione esplicita — DEC-22); Admin review cards con decisione (approva/richiedi modifiche/sospendi) e audit log; motore Walkthrough generico (`tutorial_progress`, riusabile per qualunque `tutorial_key` futuro) con una prima applicazione dimostrativa (`welcome_parent`) sulla shell `/one` esistente; Admin visibility minima sul Walkthrough (conteggio aggregato per step, nessun dettaglio per utente).
- **Fuori scope rispettato**: nessuna pubblicazione catalogo/attività (Sprint 2); nessun Giorno spot; nessuna capability Parent-facing oltre la demo Walkthrough; nessun upload reale di documenti identità (differito, DEC-22).
- **Prerequisito obbligatorio soddisfatto prima dell'implementazione**: `SPRINT_1_FEATURE_PRESERVATION_MATRIX.md`, prodotta e verificata (nessuna capability AS-IS a rischio) prima di scrivere qualunque riga di codice, chiudendo V5 di `ASSUMPTION_LOG.md`.
- **Deviazioni**: nessuna non autorizzata. Due correzioni aggiuntive richieste esplicitamente da Fabrizio durante la verifica post-deploy (fix coda Admin, sitemap opt-in) sono state implementate nello stesso sprint, coerentemente con lo scope di chiusura.

## 4. Feature Preservation

- **Feature Legacy/NextGen coinvolte**: nessuna modificata. Nessuna route/tabella esistente toccata (confermato dalla matrice §prerequisito e da zero file eliminati in questo sprint).
- **`/center/profile`, wizard attività, `/admin/centers`, coda certificazioni**: invariati, verificato in `SPRINT_1_FEATURE_PRESERVATION_MATRIX.md`.
- **`public.centers`/`public.profiles`**: nessuna colonna aggiunta o alterata — tutte le nuove tabelle sono satelliti additivi con FK verso `centers`/`profiles`, mai scritture su quelle tabelle.
- **Regressioni**: nessuna introdotta dal codice di questo sprint. Durante la verifica post-deploy sono riemersi gli stessi 7 fallimenti preesistenti e indipendenti già noti da Sprint 0 (login header, sfondo login, nav Gestore "Gestione", badge/logo NextGen) — non toccati, non nel perimetro.
- **Feature eliminate**: zero, confermato da `git diff --diff-filter=D`.

## 5. Architecture and Reuse

| Classificazione | Elementi |
|---|---|
| **NEW** | `supabase/migration_09_center_onboarding.sql` (5 tabelle, 3 funzioni SECURITY DEFINER); `lib/onboarding/{types,checklist-registry,data}.ts`; `app/actions/onboarding.ts`; `app/center/one/onboarding/`, `app/admin/one/onboarding/`; `lib/walkthrough/{registry,data}.ts`; `app/actions/walkthrough.ts`; `app/one/WalkthroughCard.tsx`; `tests/one/onboarding.spec.ts`; `docs/trama-one/analysis/SPRINT_1_FEATURE_PRESERVATION_MATRIX.md` |
| **REUSE** | `public.is_platform_admin()`, `public.current_center_id()` (helper esistenti, riusati nelle nuove RLS/funzioni, mai ridefiniti — reuse-first, coerente con DEC-21 di Sprint 0) |
| **ADAPT** | `app/one/page.tsx`, `app/center/one/page.tsx`, `app/admin/one/page.tsx` (da placeholder Sprint 0 a shell con link/demo reali); `test-deploy.sh` (sitemap opt-in) |
| **WRAP** | nessuno in questo sprint |
| **REPLACE_AFTER_PARITY** | nessuno |

## 6. Routes and UI

- **Route create**: `/center/one/onboarding` (Partner), `/admin/one/onboarding` (Admin) — entrambe dietro lo stesso gate `TRAMA_ONE_ENABLED` ereditato dai layout padre (`app/center/one/layout.tsx`, `app/admin/one/layout.tsx`, non modificati in questo sprint).
- **Route modificate**: nessuna route esistente al di fuori delle shell `/one` già create in Sprint 0.
- **Fallback verificato in produzione**: TC-N302 (`/one`→`/`), TC-N303 (`/center/one`→`/center`), TC-N304 (`/admin/one`→`/admin`), TC-N401 (`/center/one/onboarding`→`/center`), TC-N402 (`/admin/one/onboarding`→`/admin`) — **10/10 passed**, eseguiti da Fabrizio in isolamento (`--workers=1`) contro produzione dopo la rimozione degli override di test temporanei.
- **Nota per l'audit**: un primo run di questi stessi test era risultato con 24 fallimenti (5 TC × 2 browser + 14 dei 7 fallimenti preesistenti); causa identificata: gli override `TRAMA_ONE_ENABLED=true` predisposti per il test manuale erano ancora attivi sulle stesse utenze di test (`TEST_PARENT_EMAIL`/`TEST_CENTER_ADMIN_EMAIL`/`TEST_PLATFORM_ADMIN_EMAIL`) usate anche dagli smoke test — non un difetto applicativo, un artefatto dei dati di test non ancora ripuliti. Rimossi con `delete from feature_flag_overrides where flag_name='TRAMA_ONE_ENABLED'`, poi riverificato verde.

## 7. Database

- **Migrazione**: `migration_09_center_onboarding.sql`, hash SHA-256 corrente: `90133b54f57e8fc189b14251c9848d55f5fa97f7c199d7029624dd1286fd634c`.
- **Tabelle**: `center_onboarding_state`, `center_onboarding_checklist_completions`, `center_identity_verifications`, `center_onboarding_audit_log`, `tutorial_progress`.
- **Funzioni SECURITY DEFINER**: `center_claim_onboarding()`, `center_submit_onboarding()`, `admin_review_center_onboarding()` — unico punto di scrittura per le transizioni di stato, nessuna policy RLS UPDATE aperta lato client su `center_onboarding_state`.
- **RLS**: abilitata su tutte le 5 tabelle, verificato via query strutturale post-applicazione (`relrowsecurity=true` su tutte e 5, eseguita da Fabrizio) e via screenshot con tutte le righe a `true`.
- **Funzioni verificate esistenti**: `admin_review_center_onboarding`, `center_claim_onboarding`, `center_submit_onboarding` — confermate via query `pg_proc`, screenshot fornito da Fabrizio.
- **Applicazione ambiente**: **applicata da Fabrizio** in produzione ("Success. No rows returned"), non eseguita né osservabile direttamente da Claude — nessuna connessione a Supabase in nessun momento di questo sprint.
- **Dati inseriti**: dati di test reali generati durante la verifica manuale di Fabrizio (un centro reale portato a stato APPROVED, righe di audit, override feature flag temporanei — questi ultimi già rimossi). Nessun dato di test lasciato permanentemente salvo lo stato di onboarding del centro di test usato per la verifica, comportamento equivalente a quanto già accade per gli altri dati demo del pilota.
- **Rollback**: documentato nel file di migrazione (blocco separato, drop funzioni→trigger→tabelle, ordine corretto).

## 8. Security and Privacy

- **Access control**: SELECT su tutte le tabelle limitata a proprietario (center_admin del proprio centro / utente proprietario per `tutorial_progress`) o `platform_admin`; nessuna policy UPDATE aperta su `center_onboarding_state` (solo le 3 funzioni SECURITY DEFINER scrivono); `center_identity_verifications` ha una policy UPDATE dedicata che impedisce al center_admin di auto-approvarsi (verificata via `using`/`with check` che richiedono `status='pending'` sia prima che dopo la scrittura).
- **Secret/PII**: nessun secret nel repository. Verifica identità limitata a nota testuale (nessun documento reale caricato in questo sprint, DEC-22) — nessun nuovo dato sensibile persistito oltre a quanto già gestito per i centri.
- **Rischi**: nessuno nuovo identificato.

## 9. Tests

| Categoria | Esito |
|---|---|
| `npx tsc --noEmit` | **Eseguito ripetutamente, sempre pulito** (ultima esecuzione dopo il fix DEC-23) |
| `npm run lint` | **Eseguito, 0 errori**, 128 warning preesistenti invariati |
| `npm run build` | **Eseguito, pulito**, tutte le route confermate `ƒ Dynamic`, incluse le 2 nuove `/onboarding` |
| Unit (`tests/one/onboarding.spec.ts`) | **Eseguito, 27/27 passed × 2 browser = 54 passed** (checklist registry + walkthrough registry, funzioni pure) |
| `bash -n test-deploy.sh` / `deploy.sh` | **Eseguito, sintassi OK** |
| Verifica strutturale DB (post-migrazione) | **Eseguita da Fabrizio**: 5 tabelle con RLS attiva, 3 funzioni presenti — screenshot fornito |
| Smoke fallback produzione (TC-N302/303/304/401/402) | **Eseguito da Fabrizio, 10/10 passed**, in isolamento (`--workers=1`) dopo pulizia degli override di test |
| Flusso reale end-to-end (claim→checklist→identità→submit→approve; Walkthrough Parent) | **Eseguito da Fabrizio manualmente in produzione** — esito positivo (stato "Approvato" raggiunto, Walkthrough Parent completato); ha rivelato il bug DEC-23, poi corretto |
| Ri-verifica visiva del fix DEC-23 (coda Admin con centro approvato + bottone Sospendi) | **NON ri-confermata visivamente dopo il fix** — verificata solo via revisione statica del codice e tsc/lint/build puliti. Unica condizione aperta di questo checkpoint |
| Suite completa (`TEST_SCOPE=all`) | Non eseguita in questo sprint (solo `smoke`, come da scope) |

Nessuna affermazione di test/migrazione/deploy eseguito senza riscontro reale.

## 10. Deploy

- **Eseguito**: sì, da Fabrizio, più volte durante lo sprint (per pubblicare il codice, poi per pubblicare le due correzioni DEC-23/DEC-24).
- **Commit pubblicato**: `329ef7f` (HEAD), push confermato su `origin/main`.
- **Alias**: `buddykids-partner.vercel.app`/`buddykids-admin.vercel.app` riallineati con successo ad ogni deploy.
- **Smoke**: eseguito più volte, esito finale verde per i TC di questo sprint (vedi §9); i 7 fallimenti preesistenti restano, non correlati.
- **Sitemap**: non generata negli ultimi deploy (comportamento nuovo, DEC-24, confermato dal log "Sitemap NON generata (skip di default...)").
- **Rollback**: `npx vercel ls buddykids-app --prod` + redeploy versione precedente; rollback di codice = revert dei commit additivi di questo sprint; rollback database documentato nel file di migrazione.

## 11. Commits and Files

**8 commit** da `1ea9b3e` a `329ef7f`:
```
1ea9b3e feat(trama-one): add Sprint 1 center onboarding state machine (migration_09, not applied)
b1e5fe3 feat(trama-one): Partner onboarding UI + Admin review UI (Sprint 1)
f0d246e feat(trama-one): generic Walkthrough engine + welcome_parent demo (Sprint 1)
828cede test(trama-one): unit tests for onboarding checklist + walkthrough registry, smoke coverage for new /one sub-routes
4017934 test(trama-one): add TC-N302..N406 to test matrix (Sprint 0 backfill + Sprint 1)
3e1ebef docs(trama-one): update Transition Register for Sprint 1 (onboarding state additive, RLS reuse)
0e6d926 fix(trama-one): admin onboarding queue was excluding APPROVED centers
329ef7f chore(deploy): sitemap generation now opt-in (RUN_SITEMAP=1) instead of every deploy
```

**File creati** (principali): `supabase/migration_09_center_onboarding.sql`; `lib/onboarding/{types,checklist-registry,data}.ts`; `app/actions/onboarding.ts`; `app/center/one/onboarding/{page,OnboardingClient}.tsx`; `app/admin/one/onboarding/{page,AdminOnboardingReviewClient}.tsx`; `lib/walkthrough/{registry,data}.ts`; `app/actions/walkthrough.ts`; `app/one/WalkthroughCard.tsx`; `tests/one/onboarding.spec.ts`; `docs/trama-one/analysis/SPRINT_1_FEATURE_PRESERVATION_MATRIX.md`.

**File modificati**: `app/one/page.tsx`, `app/center/one/page.tsx`, `app/admin/one/page.tsx`; `tests/one/smoke.spec.ts` (+TC-N401/N402); `BuddyKids_Test_Case.xlsx` (+TC-N302..N406); `docs/trama-one/TRANSITION_REGISTER.md`, `docs/trama-one/analysis/{ASSUMPTION_LOG,DECISION_LOG}.md`; `test-deploy.sh`.

**File intenzionalmente invariati**: i 3 layout `/one` (`app/one/layout.tsx`, `app/center/one/layout.tsx`, `app/admin/one/layout.tsx`); `proxy.ts`; `supabase/schema.sql`; tutte le route Legacy/NextGen.

## 12. Decisions and Assumptions

**Decisioni chiuse in questo sprint**: DEC-22 (verifica identità: nota testuale, upload differito), DEC-23 (fix coda Admin esclusione APPROVED), DEC-24 (sitemap opt-in). V5 di `ASSUMPTION_LOG.md` chiusa (matrice prodotta prima dell'avvio). V4 (schema `TutorialProgress` sufficiente senza colonne aggiuntive) confermata dall'implementazione reale.

**Decisioni differite**: wiring upload reale documenti identità (DEC-22, quando servirà).

## 13. Risks

- **Blocker**: nessuno.
- **Rischio medio**: la correzione DEC-23 non è stata ri-verificata visivamente in produzione dopo il fix (solo staticamente) — vedi §9, condizione di questo checkpoint.
- **Rischio basso**: i 7 fallimenti preesistenti (login/dashboard/badge/logo) restano non diagnosticati in questo sprint, indipendenti da TRAMA ONE.

## 14. Rollback

- **Funzionale**: `TRAMA_ONE_ENABLED=false` (default) → comportamento AS-IS invariato per ogni utente, confermato dai 10/10 test di fallback.
- **Codice**: revert dei commit additivi di questo sprint.
- **Database**: blocco di rollback documentato in `migration_09_center_onboarding.sql` (drop funzioni→trigger→tabelle).
- **Dati**: il centro di test portato ad APPROVED durante la verifica manuale può essere riportato a stato pulito reimpostando/eliminando la sua riga in `center_onboarding_state`, se necessario (non bloccante per l'MVP).

## 15. Next Sprint Readiness

- **Prerequisiti per Build Sprint 2** (Offering/Giorni spot, da `SPRINT_GOVERNANCE.md`): Sprint 1 chiuso con Definition of Done soddisfatta; matrice pagina-per-pagina estesa alle route coinvolte in Sprint 2 (da produrre prima dell'avvio, non ancora fatta — correttamente, non è compito di Sprint 1); decisione Offering (DEC-05, ancora da prendere in Sprint 2).
- **Blocker**: nessuno per l'avvio di Sprint 2, salvo la ri-verifica visiva raccomandata in §9/§13.
- **Raccomandazione**: eseguire un rapido controllo visivo di `/admin/one/onboarding` per il centro di test (deve mostrare "Approvato" in "Altri stati" con bottone "Sospendi") prima di considerare chiuso al 100% anche l'ultimo dettaglio.

## 16. Audit Conclusion

**AUDIT STATUS: READY WITH CONDITIONS**

Condizione: conferma visiva del fix DEC-23 (coda Admin) in produzione, non ancora fornita — verificata solo staticamente. Nessun blocker strutturale, di sicurezza o di regressione rilevato. Tutte le altre verifiche hanno riscontro reale documentato.
