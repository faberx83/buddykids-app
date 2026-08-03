
# TRAMA ONE — Controlled Publication procedure (§16-17)

Copre §16-17 del gate "Controlled Beta Experience, Publication and Readiness Gate": la procedura per pubblicare il Controlled Beta — dai gate di readiness già chiusi (§1-15) fino all'arruolamento di centri/famiglie pilota reali — restando dentro la governance permanente del progetto (nessun deploy, nessuna migrazione, nessuna scrittura in produzione eseguita da Claude: solo codice, test, documentazione e script SQL non applicati).

## 1. Readiness checklist (§16) — stato di ciascun gate a monte

| Gate | Stato | Riferimento |
|---|---|---|
| §1 Fonti di verità lette | Chiuso | Task #421 |
| §2 Route Release Matrix | Chiuso | `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md`, task #422 |
| §3 Information Architecture | Chiuso | DEC-58, task #423 |
| §4-6 Visual Conformance | Chiuso | `TRAMA_ONE_VISUAL_CONFORMANCE.md`, DEC-59, task #424 |
| Fase E — wiring navigazione | Chiuso in questo giro | `/admin/one` ora in `PRIMARY_NAV` (menu Admin), condizionato al flag — vedi §2 sotto |
| §7-14 Product Walkthrough Spotlight reale | Chiuso | DEC-60, task #425 |
| §15 Visual Acceptance Gate | Instrumentato, esecuzione riservata a Fabrizio | `TRAMA_ONE_VISUAL_ACCEPTANCE.md`, DEC-61, task #426 |
| Flag/coorte scoping (blocker originario) | Chiuso e verificato live | DEC-57 |

**Condizione bloccante esplicita**: questa procedura può essere ESEGUITA da Fabrizio solo dopo che la matrice PASS/FIX/N-A di `TRAMA_ONE_VISUAL_ACCEPTANCE.md` (§15) risulta interamente PASS/N-A motivato — nessuna riga FIX aperta. Claude non può verificarlo autonomamente (richiede browser reale), quindi questo documento descrive la procedura ma non dichiara il gate GO da solo.

## 2. Fase E chiusa in questo giro: wiring `/admin/one`

`app/admin/layout.tsx` aveva un gap noto e documentato (DEC-58): `/admin/one` era raggiungibile solo digitando l'URL direttamente (verificato da TC-N304/TC-N611), mai da una voce di menu — bloccato esplicitamente fino al restyle (§4-6). Il restyle è chiuso da DEC-59, quindi la voce "Command Center" è stata aggiunta al menu Admin, **condizionata a `TRAMA_ONE_ENABLED`** risolto server-side per l'utente corrente (stesso resolver già usato da `app/admin/one/layout.tsx` e da `app/center/layout.tsx` per lo Spotlight) — additiva, nessun'altra voce del menu Admin è mai stata gated, se il flag risolve a `false` la voce semplicemente non compare. Verificato con `tsc`/`eslint` puliti e un nuovo test (`TC-N418`, `tests/one/command-center.spec.ts`) che il link è visibile con l'href corretto e naviga senza redirect.

**Deliberatamente NON toccato in questo giro** (fuori perimetro, riapre il dominio funzionale Sprint 1, vietato esplicitamente dal gate): `app/center/page.tsx` non controlla mai lo stato di approvazione del centro per reindirizzare un `center_admin` non ancora `APPROVED` verso `/center/one/onboarding` — gap reale, già noto da DEC-58, che resta deferred. Toccarlo significherebbe modificare la state machine di onboarding Centro (Sprint 1), non un wiring di navigazione additivo.

## 3. Procedura di pubblicazione (§17)

Ordine consigliato, ciascun passo eseguito da Fabrizio salvo indicazione contraria:

1. **Chiudere §15** eseguendo `TRAMA_ONE_VISUAL_ACCEPTANCE.md` (screenshot ai 3 breakpoint, PASS/FIX/N-A). Riportare eventuali FIX a Claude con screenshot prima di proseguire.
2. **Eseguire `TEST_SCOPE=critical bash test-deploy.sh`** (le 18 journey critiche Sprint 1-4, Gate D, `chromium` — già lo scope minimo richiesto dopo ogni sprint, DEC-29) più, specificamente per questo gate, i file `tests/one/*.spec.ts` (smoke, onboarding, feature-flags, command-center, walkthrough-partner, spotlight-position) contro il deploy target — questi ultimi non sono ancora nello scope `critical` di default e vanno lanciati esplicitamente:
   ```
   TEST_BASE_URL=<url deploy> npx playwright test tests/one/ --reporter=list
   ```
3. **Deploy** con la procedura invariata già in uso (`bash deploy.sh`, nessuna modifica introdotta da questo gate al processo di deploy stesso — la sequenza push/build/alias/cleanup resta quella hardened in Sprint 0).
4. **Verifica live post-deploy**: ripetere un run mirato di `tests/one/*.spec.ts` contro l'URL di produzione (non solo di anteprima), e navigare manualmente `/admin` per confermare che "Command Center" compare nel menu con l'account platform_admin.
5. **Decidere se espandere la coorte** oltre i 2 account di test + accesso platform_admin permanente (stato attuale, DEC-57): se sì, compilare ed eseguire `supabase/script_controlled_beta_expand_cohort.sql` (template, non applicato — sostituire i placeholder con gli id/email reali dei centri/famiglie pilota scelti, PRE-CHECK/POST-CHECK inclusi). Nessun centro o famiglia pilota reale è stato scelto da questo documento: la selezione di CHI arruolare è una decisione di prodotto/business che spetta a Fabrizio, non a Claude.
6. **Monitoraggio nella finestra di 60 giorni** (scadenza coorte, DEC-57, 2026-10-02): usare `/admin/feature-flags` per verificare lo stato dell'override di coorte (giorni alla scadenza, badge `expiring_soon`/`expired` già esistenti da Sprint 6/DEC-48) e `/admin/one` (Command Center) per il funnel Walkthrough/Spotlight (eventi `spotlight_shown`/`spotlight_target_not_found`/`spotlight_dismissed`, DEC-60) e le code operative aggregate.

## 4. Rollback

Due livelli, entrambi già preparati come file SQL non applicati:

- **Disattivare l'intera Controlled Beta** (torna tutto a `INTERNAL_ONLY` invisibile): sezione ROLLBACK SICURO di `supabase/script_controlled_beta_flag_cohort.sql` — disattiva l'override di coorte, non riapre mai l'override globale storico.
- **Rimuovere solo alcuni pilota** (mantenendo la coorte attiva per gli altri): sezione ROLLBACK di `supabase/script_controlled_beta_expand_cohort.sql` — disattiva (`active=false`) solo le righe `beta_cohort_memberships` indicate, senza toccare l'override di coorte né gli account di test originari.

In entrambi i casi: nessun dato applicativo (attività, prenotazioni, profili) viene toccato — solo la visibilità delle route `/one*` e dello Spotlight, coerente con l'intera architettura feature-flag di questo programma (DEC-07/DEC-09).

## 5. Cosa NON è incluso in questa procedura

- Comunicazione ai centri/famiglie pilota (email di invito, materiale di onboarding) — non richiesta esplicitamente dal gate, fuori dal perimetro tecnico di questo documento.
- Qualunque modifica al dominio funzionale Sprint 1-6 (comportamento booking/onboarding/prezzi/ecc.) — vietato esplicitamente dal gate ("explicitly not reopening Sprint 1-6 functional domain").
- L'esecuzione stessa dei passi 1-6 sopra: questo documento è la procedura, non il log di un'esecuzione già avvenuta.
