# TRAMA ONE — Audit Checkpoint — Build Sprint 2 (Catalogo, prezzo, capacità, Giorni spot e Walkthrough attività)

Documento autosufficiente per chi non ha seguito la conversazione. Per decisione di governance (DEC-29/30, integrazione post-audit Sprint 1), Sprint 2 **non richiede un audit esterno**: questo è un checkpoint interno di continuità. Il primo audit esterno obbligatorio successivo resta `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md`, a chiusura di Build Sprint 4.

## 1. Executive Status

**Scope di Sprint 2** (`SPRINT_GOVERNANCE.md`): decisione finale Offering (DEC-05); wizard attività; disponibilità/prezzo; Giorni spot lato Partner (modalità settimana/giornaliera/mista, giorni, capacità, prezzo, minimo giorni, servizi, regole di cancellazione); step Walkthrough attività (crea attività/configura settimane/prezzi/Giorni spot/pubblica/dashboard). Preview Parent esplicitamente fuori scope (differita a Sprint 3).

**Risultato**: tutti gli elementi di scope sono implementati, testati staticamente/via unit test e documentati.

1. **Decisione Offering (DEC-05)**: chiusa — nessuna nuova entità, estensione additiva di `activities`/`activity_weeks`/`activity_days` (DEC-32). Nessuna migrazione richiesta per questa parte (il modello esisteva già).
2. **Giorni spot Partner — modalità/minimo giorni**: colmata l'unica lacuna reale identificata dalla riconciliazione AS-IS (`SPRINT_2_FEATURE_PRESERVATION_MATRIX.md`) con 2 colonne additive (`booking_mode`, `min_days_per_booking`) su `activities`, UI wizard corrispondente, test Playwright (TC-414), riga xlsx.
3. **Walkthrough attività (Partner)**: chiusa riusando il motore generico costruito in Sprint 1 senza modifiche — una nuova voce di registry (`activity_creation_partner`) e una riga di wiring in `app/center/one/page.tsx` (DEC-35), test Playwright (TC-N414/TC-N415), righe xlsx.

**Stato**: **READY FOR CONTINUATION.** Il rischio segnalato in questa sezione (vedi cronologia sotto) si è confermato reale ed è stato chiuso da Fabrizio nella stessa sessione.

**Incidente reale confermato e chiuso** (vedi anche DEC-36, `DECISION_LOG.md`): prima dell'applicazione di `migration_11`, la dashboard Gestore `/center/activities` mostrava "Nessuna attività trovata per il tuo centro" con l'account di test — screenshot fornito da Fabrizio, coerente esattamente con la previsione di questo checkpoint (`getActivitiesForCenter()` che ricade su `[]` perché `SELECT_COLUMNS` chiede colonne inesistenti). Causa: `lib/data/activities.ts::SELECT_COLUMNS` (commit `a7e4cf1`) richiedeva già `booking_mode, min_days_per_booking`, committato prima dell'ultimo deploy noto (`b5842ca`), mentre `migration_11_activity_booking_mode.sql` non era ancora stata applicata in produzione — un ordine invertito rispetto a quanto sarebbe stato sicuro (migrazione prima del deploy, non dopo).

**Fix applicato da Fabrizio** (SQL Editor Supabase, produzione): eseguito il blocco DDL di `migration_11_activity_booking_mode.sql`. Post-check reale confermato: colonna `booking_mode` presente con `column_default = 'mixed'::text`; `select booking_mode, count(*) from public.activities group by booking_mode` → 1 riga, `booking_mode = 'mixed'`, count = 11 (tutte le 11 attività esistenti, nessuna eccezione — comportamento AS-IS preservato esattamente come previsto). Dopo il fix, `/center/activities` mostra di nuovo le attività reali. `min_days_per_booking` non è stata verificata con una query indipendente da Fabrizio, ma fa parte dello stesso blocco `begin;...commit;` di `booking_mode` — se una colonna è stata creata, anche l'altra lo è per costruzione (stessa transazione atomica).

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
- **Stato di applicazione**: **APPLICATA in produzione da Fabrizio (SQL Editor Supabase) e verificata funzionante.** Pre-check/post-check/rollback erano documentati nel file stesso come query SQL commentate, stesso schema già usato per `migration_09`/`migration_10`. Nessuna connessione diretta a Supabase da parte di Claude in nessun momento: applicazione ed esecuzione sempre e solo da parte di Fabrizio.
- **Evidenza reale del post-check** (riportata da Fabrizio): colonna `booking_mode` presente in `information_schema.columns` con `column_default = 'mixed'::text`; `select booking_mode, count(*) from public.activities group by booking_mode` → 1 riga, `booking_mode = 'mixed'`, count = 11 — tutte le 11 attività esistenti in produzione risultano `mixed`, zero eccezioni, comportamento AS-IS preservato esattamente come da disegno della migrazione. `min_days_per_booking` non interrogata indipendentemente, ma creata nella stessa transazione `begin;...commit;` di `booking_mode`.
- **Incidente reale confermato prima del fix**: `lib/data/activities.ts::SELECT_COLUMNS` (commit `a7e4cf1`, precedente al deploy noto `b5842ca`) richiedeva già `booking_mode, min_days_per_booking` in produzione mentre la migrazione non era ancora applicata — `getActivitiesForCenter()` ricadeva sul suo fallback `[]`, mostrando "Nessuna attività trovata per il tuo centro" nella dashboard Gestore (screenshot confermato da Fabrizio con l'account di test). Dopo l'applicazione della migrazione, le attività reali sono tornate visibili (confermato da Fabrizio). Vedi DEC-36.

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
| `tests/gestore/attivita.spec.ts` (TC-414) | Scritto, gated `test.skip(!isRealDeployment, ...)` — precondizione (migration_11 applicata) ora soddisfatta, ma **il test Playwright stesso non è ancora stato rieseguito dal vivo** dopo il fix |
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

**Nuove decisioni**: DEC-32 (Offering, riconciliazione), DEC-35 (Walkthrough attività riusa il motore Sprint 1 senza modifiche, chiude lo scope Sprint 2), DEC-36 (incidente reale: dashboard Gestore vuota per ordine invertito codice/migrazione, causa confermata e chiusa da Fabrizio con evidenza reale).

## 11. Risks

- **Chiuso, era un blocker reale, non solo teorico**: `migration_11_activity_booking_mode.sql` non era applicata mentre il codice già richiedeva le sue colonne (ordine invertito rispetto a quanto sarebbe stato sicuro). Confermato dal vivo (dashboard Gestore vuota) e risolto da Fabrizio applicando la migrazione in produzione — vedi §1/§6/DEC-36. **Lezione operativa per i prossimi sprint**: quando una migrazione introduce colonne già lette da una `SELECT` esplicita (non solo scritte), va segnalato come precondizione al deploy, non solo come nota a margine — questo checkpoint lo segnalava già in §11 della bozza precedente, ma il deploy era già avvenuto prima che la segnalazione potesse essere utile. Da questo momento, ogni migrazione che introduce colonne lette da una query esistente va verificata contro l'ordine reale dei commit/deploy PRIMA di scrivere il checkpoint, non durante.
- **Rischio basso, ancora aperto**: i 3 nuovi test (TC-414, TC-N414, TC-N415) non sono ancora stati rieseguiti dal vivo dopo il fix — la precondizione (migration_11 applicata) è ora soddisfatta, manca solo il run Playwright reale.

## 12. Rollback

- **Funzionale**: nessun impatto su `TRAMA_ONE_ENABLED` (il wizard booking_mode non dipende dal flag; il Walkthrough Partner sì, eredita il gate del layout `/center/one` esistente).
- **Codice**: revert dei commit di questo sprint.
- **Database**: rollback di `migration_11` documentato nel file stesso (drop delle 2 colonne, nessun impatto su dati diversi da booking_mode/min_days).

## 13. Sprint 3 Readiness / Gate rimanenti

**Gate migrazione — `migration_11`**: **CHIUSO.** Applicata da Fabrizio in produzione via SQL Editor Supabase, post-check confermato (booking_mode presente, default 'mixed', 11/11 attività esistenti invariate). Incidente reale (dashboard Gestore vuota) confermato e risolto — vedi §1/§6/DEC-36.

**Gate test browser**: **APERTO.** Precondizione ora soddisfatta (migration_11 applicata); manca il run Playwright reale. Comando suggerito (stesso pattern Gate 2 di Sprint 1):
```
source .env.test
TEST_BASE_URL=<url produzione> npx playwright test tests/gestore/attivita.spec.ts tests/one/walkthrough-partner.spec.ts --reporter=list --workers=1
```

**Gate merge/deploy**: nessun merge multi-branch in corso (lavoro su `main`); il deploy resta gate manuale esplicito.

## 14. Audit Conclusion

**AUDIT STATUS: READY FOR CONTINUATION**

Tutto lo scope di Build Sprint 2 (`SPRINT_GOVERNANCE.md`) è implementato, staticamente verificato (`tsc`/`lint`/`build` puliti) e documentato (`DECISION_LOG.md` DEC-32/DEC-35/DEC-36, `SPRINT_2_FEATURE_PRESERVATION_MATRIX.md`, xlsx TC-414/TC-N414/TC-N415). Nessuna capability AS-IS a rischio, nessuna feature eliminata. L'incidente reale scoperto durante questa chiusura (dashboard Gestore vuota per ordine invertito codice/migrazione) è stato confermato e risolto da Fabrizio con evidenza reale (post-check SQL, verifica visiva del sito). Unico residuo non bloccante: i 3 test nuovi (TC-414, TC-N414, TC-N415) non sono ancora stati rieseguiti dal vivo dopo il fix — la precondizione tecnica è ora soddisfatta. Nessun blocker per iniziare in parallelo l'analisi di Build Sprint 3 (Parent discovery/selezione giorni), che comunque richiede la propria Feature Preservation Matrix estesa e la chiusura di V2 di `ASSUMPTION_LOG.md` (CR↔capability epic E06) prima dell'implementazione, per governance invariata.
