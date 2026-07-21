# TRAMA ONE — Audit Checkpoint — Build Sprint 2 (Catalogo, prezzo, capacità, Giorni spot e Walkthrough attività)

Documento autosufficiente per chi non ha seguito la conversazione. Per decisione di governance (DEC-29/30, integrazione post-audit Sprint 1), Sprint 2 **non richiede un audit esterno**: questo è un checkpoint interno di continuità. Il primo audit esterno obbligatorio successivo resta `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md`, a chiusura di Build Sprint 4.

## 1. Executive Status

**Scope di Sprint 2** (`SPRINT_GOVERNANCE.md`): decisione finale Offering (DEC-05); wizard attività; disponibilità/prezzo; Giorni spot lato Partner (modalità settimana/giornaliera/mista, giorni, capacità, prezzo, minimo giorni, servizi, regole di cancellazione); step Walkthrough attività (crea attività/configura settimane/prezzi/Giorni spot/pubblica/dashboard). Preview Parent esplicitamente fuori scope (differita a Sprint 3).

**Risultato**: tutti gli elementi di scope sono implementati, testati staticamente/via unit test e documentati.

1. **Decisione Offering (DEC-05)**: chiusa — nessuna nuova entità, estensione additiva di `activities`/`activity_weeks`/`activity_days` (DEC-32). Nessuna migrazione richiesta per questa parte (il modello esisteva già).
2. **Giorni spot Partner — modalità/minimo giorni**: colmata l'unica lacuna reale identificata dalla riconciliazione AS-IS (`SPRINT_2_FEATURE_PRESERVATION_MATRIX.md`) con 2 colonne additive (`booking_mode`, `min_days_per_booking`) su `activities`, UI wizard corrispondente, test Playwright (TC-414), riga xlsx.
3. **Walkthrough attività (Partner)**: chiusa riusando il motore generico costruito in Sprint 1 senza modifiche — una nuova voce di registry (`activity_creation_partner`) e una riga di wiring in `app/center/one/page.tsx` (DEC-35), test Playwright (TC-N414/TC-N415), righe xlsx.

**Stato**: **READY FOR CONTINUATION a livello di codice/test statici/documentazione. Un gate manuale resta aperto, con un rischio concreto già in corso in produzione — vedi §11, priorità massima**: `supabase/migration_11_activity_booking_mode.sql` non è ancora stata applicata in produzione da Fabrizio (applicazione di migrazione SQL è uno dei gate manuali espliciti, DEC-31 — non eseguibile da Claude), MA `lib/data/activities.ts::SELECT_COLUMNS` include già esplicitamente `booking_mode, min_days_per_booking` nella query verso Supabase, e questa modifica (commit `a7e4cf1`) risulta committata PRIMA dell'ultimo deploy noto in produzione (commit `b5842ca`, eseguito da Fabrizio con `SKIP_TESTS=1 bash deploy.sh`). Se `a7e4cf1` era già incluso in quel deploy, la query verso `activities` sta fallendo in produzione in questo momento (colonne inesistenti lato Postgres) — con degrado silenzioso, non crash, perché ogni funzione chiamante ha un fallback (vedi §11). I 3 nuovi test (TC-414, TC-N414, TC-N415) restano non eseguibili dal vivo (`test.skip(!isRealDeployment, ...)`), quindi ancora classificati "DA TESTARE" in xlsx, onestamente non "OK".

## 2. Repository State

- **Branch**: `main`.
- **Commit di partenza di questo sprint**: `a5e81ec` (riconciliazione + DEC-32).
- **Ultimi commit di questo sprint**: `a7e4cf1` (migrazione+tipi+data layer booking_mode), `eb859f7` (UI wizard), `d429d83` (xlsx TC-414) — più i commit di questa chiusura (Walkthrough attività, xlsx, documentazione, vedi §14).
- **Working tree**: pulito subito dopo ogni commit di questo batch.
- **Push/deploy**: nessun deploy eseguito da Claude in questo sprint (deploy resta gate manuale di Fabrizio). L'ultimo deploy noto in produzione resta quello della remediation Sprint 1 (commit `b5842ca`).

## 3. Scope

- **In scope**: DEC-05 (Offering), `booking_mode`/`min_days_per_booking` (Giorni spot Partner), Walkthrough attività Partner.
- **Esplicitamente fuori scope, rispettato**: nessuna preview Parent (Sprint 3); nessuna modifica a fulfilment/accettazione (Sprint 4); nessuna modifica al motore Walkthrough generico (solo una nuova voce di registry).
- **Deviazioni**: nessuna.

## 4. Feature Preservation

- **Nessuna colonna esistente alterata/rimossa**: `booking_mode` e `min_days_per_booking` sono `add column if not exists`, la prima con `default 'mixed'` (comportamento oggi implicito per ogni attività con `activity_days` popolate, quindi zero impatto sulle attività esistenti), la seconda nullable.
- **Nessuna riga esistente toccata**: nessun `UPDATE`/backfill nella migrazione.
- **Motore Walkthrough invariato**: `lib/walkthrough/data.ts`, `app/actions/walkthrough.ts`, `app/one/WalkthroughCard.tsx` — zero righe modificate, solo importati/riusati. Unica aggiunta: una voce nel dizionario `WALKTHROUGH_REGISTRY` (`lib/walkthrough/registry.ts`) e la riga di wiring in `app/center/one/page.tsx` (nuova, la pagina prima era un semplice link).
- **Nessuna capability Legacy/NextGen toccata**: diff di questo sprint limitato a `supabase/migration_11_*.sql`, `lib/types.ts`, `lib/data/activities.ts`, `app/actions/center.ts`, `app/center/activities/[id]/ActivityEditForm.tsx`, `lib/walkthrough/registry.ts`, `app/center/one/page.tsx`, `tests/gestore/attivita.spec.ts`, `tests/one/walkthrough-partner.spec.ts`, `BuddyKids_Test_Case.xlsx`, `docs/trama-one/*`.
- **Feature eliminate**: zero.

## 5. Architecture and Reuse

| Classificazione | Elementi di questo sprint |
|---|---|
| **NEW** | `supabase/migration_11_activity_booking_mode.sql`; `tests/one/walkthrough-partner.spec.ts`; voce `activity_creation_partner` in `lib/walkthrough/registry.ts` |
| **ADAPT** | `lib/types.ts` (`Activity.bookingMode`/`minDaysPerBooking`, opzionali); `lib/data/activities.ts` (`mapRow` con fallback `?? "mixed"`); `app/actions/center.ts` (`updateActivityAction`, aggiornamento condizionale); `app/center/activities/[id]/ActivityEditForm.tsx` (nuova sezione UI); `app/center/one/page.tsx` (da stub a pagina con Walkthrough); `tests/gestore/attivita.spec.ts` (TC-414); `BuddyKids_Test_Case.xlsx` |
| **REUSE** | Motore Walkthrough generico (Sprint 1) invariato: `data.ts`, `app/actions/walkthrough.ts`, `WalkthroughCard.tsx`; modello `activities`/`activity_weeks`/`activity_days` (DEC-32) |
| **WRAP / REPLACE_AFTER_PARITY** | Nessuno |

## 6. Database

- **Migrazione**: `supabase/migration_11_activity_booking_mode.sql`.
- **Contenuto**: `alter table public.activities add column if not exists booking_mode text not null default 'mixed' check (booking_mode in ('week_only','day_only','mixed'))`; `alter table public.activities add column if not exists min_days_per_booking integer`; commenti descrittivi sulle colonne.
- **Stato di applicazione**: **NON ANCORA APPLICATA in produzione.** File pronto, pre-check/post-check/rollback documentati nel file stesso come query SQL commentate, stesso schema già usato per `migration_09`/`migration_10`. Nessuna connessione diretta a Supabase da parte di Claude: l'applicazione resta un gate manuale (DEC-31).
- **Impatto dell'attesa — verificato nel codice, non solo teorico**: `lib/data/activities.ts::SELECT_COLUMNS` include esplicitamente `booking_mode, min_days_per_booking` nella stringa passata a `.select()` verso Supabase/PostgREST. Se queste colonne non esistono ancora (migrazione non applicata), la query stessa fallisce con un errore Postgres (`column "booking_mode" of relation "activities" does not exist`), non con un valore null silenzioso — l'errore avviene PRIMA che `mapRow()` (con i suoi fallback `?? "mixed"`/`?? undefined`) venga mai chiamato. Ogni funzione che usa `SELECT_COLUMNS` ha però un proprio fallback che intercetta l'errore, quindi il sito NON va in crash visibile, ma degrada silenziosamente:
  - `getActivities()` → ricade sui dati mock/demo (lista attività reali invisibile).
  - `getActivitiesForCenter()` → ritorna `[]` (la dashboard Gestore "Le tue attività" risulterebbe vuota per un centro con attività reali in Supabase).
  - `getActivityBySlug()` → ricade sul lookup nei dati mock per slug (una vera attività reale risulterebbe introvabile/404), con un `console.error` loggato (visibile nei log Vercel).
  - **Verificare l'ordine dei commit**: `a7e4cf1` (che introduce questa query) precede `b5842ca` (l'ultimo deploy noto, eseguito da Fabrizio) nel log Git lineare di `main` — se quel deploy ha effettivamente incluso `a7e4cf1`, questo degrado è **già in corso in produzione ora**, non solo un rischio futuro. Segnalato esplicitamente a Fabrizio in chat con priorità massima, prima di qualunque altro lavoro.

## 7. Security and Privacy

- Nessun nuovo dato sensibile introdotto (booking_mode/min_days sono metadata di prezzo/disponibilità, non PII).
- Nessuna nuova policy RLS necessaria: le colonne si aggiungono a `public.activities`, già coperta dalle policy esistenti (lettura pubblica, scrittura solo dal centro proprietario via `updateActivityAction`, invariata).
- Walkthrough: nessun nuovo dato sensibile, stessa tabella `tutorial_progress` già in uso, stesso RLS già verificato in Sprint 1.

## 8. Tests

| Categoria | Esito |
|---|---|
| `npx tsc --noEmit` | **Eseguito, pulito** (incluso dopo l'aggiunta della voce Walkthrough e del wiring in `app/center/one/page.tsx`) |
| `npm run lint` | **Eseguito, 0 errori** (128 warning pre-esistenti invariati, nessun nuovo warning) |
| `npm run build` | **Eseguito, pulito** — `/center/one` confermata `ƒ Dynamic` insieme a tutte le altre route |
| `tests/gestore/attivita.spec.ts` (TC-414) | Scritto, gated `test.skip(!isRealDeployment, ...)` — **non ancora eseguito dal vivo**, richiede migration_11 applicata |
| `tests/one/walkthrough-partner.spec.ts` (TC-N414, TC-N415) | Scritto, gated `test.skip(!isRealDeployment, ...)` — **non ancora eseguito dal vivo**, richiede un browser reale contro un deploy con l'account center_admin di test (override TRAMA_ONE_ENABLED, DEC-34) |
| Suite browser completa (`TEST_SCOPE=all`) | **NON ESEGUITA — decisione di delivery esplicita (DEC-29)**, differita all'Integration Gate dopo Build Sprint 4 |

**Nessuna affermazione di test/migrazione/deploy eseguito senza riscontro reale.** I 3 test nuovi di questo sprint (TC-414, TC-N414, TC-N415) sono scritti e verificati solo per sintassi/tipo (`tsc`, `playwright --list` implicito nel build dei test), non ancora eseguiti contro un deploy reale — restano "DA TESTARE" in `BuddyKids_Test_Case.xlsx`, non "OK".

## 9. Commits and Files

**Commit di questo sprint** (oltre a quelli di riconciliazione già in `a5e81ec`):
```
a7e4cf1 feat(trama-one): add booking_mode and min_days_per_booking to activities (Sprint 2, additive)
eb859f7 feat(trama-one): UI Partner per booking_mode/min_days_per_booking (Sprint 2)
d429d83 test(trama-one): aggiungere TC-414 (booking_mode/min_days_per_booking) a xlsx test matrix
```
Più i commit di questa chiusura (Walkthrough attività + test + xlsx + documentazione, vedi commit successivi a questo file nel log).

**File creati**: `supabase/migration_11_activity_booking_mode.sql`; `tests/one/walkthrough-partner.spec.ts`; questo file.

**File modificati**: `lib/types.ts`, `lib/data/activities.ts`, `app/actions/center.ts`, `app/center/activities/[id]/ActivityEditForm.tsx`, `lib/walkthrough/registry.ts`, `app/center/one/page.tsx`, `tests/gestore/attivita.spec.ts`, `BuddyKids_Test_Case.xlsx`, `docs/trama-one/analysis/DECISION_LOG.md`.

**File intenzionalmente invariati**: `lib/walkthrough/data.ts`, `app/actions/walkthrough.ts`, `app/one/WalkthroughCard.tsx`, `app/one/page.tsx` (motore Walkthrough generico, riusato senza modifiche); `supabase/migration_09_*.sql`, `supabase/migration_10_*.sql`; tutte le route Legacy/NextGen.

## 10. Decisions and Assumptions

**Nuove decisioni**: DEC-32 (Offering, riconciliazione), DEC-35 (Walkthrough attività riusa il motore Sprint 1 senza modifiche, chiude lo scope Sprint 2).

## 11. Risks

- **Gate aperto (non blocker per il codice, ma blocker per l'uso reale della capability)**: `migration_11_activity_booking_mode.sql` non applicata in produzione. Finché non lo è, ogni lettura di `activities` che passa da `lib/data/activities.ts::mapRow()` fallirebbe con `column does not exist`, perché `SELECT_COLUMNS` ora richiede esplicitamente `booking_mode, min_days_per_booking`. **Questo significa che il deploy di questo sprint in produzione NON deve avvenire prima dell'applicazione della migrazione** — a differenza di Sprint 1 (dove il codice applicativo era già tollerante all'assenza della tabella), qui l'ordine è invertito: prima migration_11, poi deploy. Segnalare esplicitamente a Fabrizio prima di qualunque deploy di questo batch.
- **Rischio basso**: i 3 nuovi test (TC-414, TC-N414, TC-N415) restano non verificati dal vivo fino al prossimo ciclo Gate 1+Gate 2 (stesso pattern già seguito per la remediation Sprint 1).

## 12. Rollback

- **Funzionale**: nessun impatto su `TRAMA_ONE_ENABLED` (il wizard booking_mode non dipende dal flag; il Walkthrough Partner sì, eredita il gate del layout `/center/one` esistente).
- **Codice**: revert dei commit di questo sprint.
- **Database**: rollback di `migration_11` documentato nel file stesso (drop delle 2 colonne, nessun impatto su dati diversi da booking_mode/min_days).

## 13. Sprint 3 Readiness / Gate rimanenti

**Gate migrazione — `migration_11`**: **APERTO.** Da applicare da Fabrizio in produzione **prima** di qualunque deploy che includa questo batch (vedi §11 — a differenza delle remediation precedenti, qui l'ordine è invertito: la migrazione deve precedere il deploy, non seguirlo).

**Gate test browser**: **APERTO**, dipende dal gate precedente. Dopo l'applicazione di migration_11 e il deploy, comando suggerito (stesso pattern Gate 2 di Sprint 1):
```
source .env.test
TEST_BASE_URL=<url produzione> npx playwright test tests/gestore/attivita.spec.ts tests/one/walkthrough-partner.spec.ts --reporter=list --workers=1
```

**Gate merge/deploy**: nessun merge multi-branch in corso (lavoro su `main`); il deploy resta gate manuale esplicito.

## 14. Audit Conclusion

**AUDIT STATUS: READY FOR CONTINUATION (codice/test statici/documentazione), GATE MIGRAZIONE APERTO (verifica reale pendente)**

Tutto lo scope di Build Sprint 2 (`SPRINT_GOVERNANCE.md`) è implementato, staticamente verificato (`tsc`/`lint`/`build` puliti) e documentato (`DECISION_LOG.md` DEC-32/DEC-35, `SPRINT_2_FEATURE_PRESERVATION_MATRIX.md`, xlsx TC-414/TC-N414/TC-N415). Nessuna capability AS-IS a rischio, nessuna feature eliminata. A differenza di Sprint 1, qui il gate di migrazione è più stringente: applicare `migration_11` **prima** di ogni deploy di questo batch, non dopo — segnalato esplicitamente a Fabrizio. Nessun blocker per iniziare in parallelo l'analisi di Build Sprint 3 (Parent discovery/selezione giorni), che comunque richiede la propria Feature Preservation Matrix estesa e la chiusura di V2 di `ASSUMPTION_LOG.md` (CR↔capability epic E06) prima dell'implementazione, per governance invariata.
