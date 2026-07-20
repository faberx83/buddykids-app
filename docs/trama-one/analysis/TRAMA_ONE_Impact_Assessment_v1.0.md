> **CONSOLIDATO — APPROVATO**
> Consolida: Impact Assessment originale (Fase A, Master Prompt) + Addendum 1 (correzioni operative) + Addendum tecnico finale (chiarimenti di sicurezza/architettura).
> Stato: **GO WITH CONDITIONS**, approvato da Fabrizio.
> Documento di lavoro: non sostituisce i 7 documenti canonici in `../` né le copie derivate in `../derived/`. Fa fede la gerarchia definita in `../README.md`.
> Versione: 1.0 — consolidamento del 20 luglio 2026.

# TRAMA ONE — Impact Assessment consolidato (v1.0)

## 1. Executive summary

Il repository `buddykids-app_v1` copre già gran parte delle entità canoniche richieste da TRAMA ONE (profiles, kids, centers, activities, activity_weeks/days, bookings, favorites, beta_feedback, families) con RLS estesa (156 policy in `schema.sql`) e un pattern di tenant-routing multi-dominio maturo (`proxy.ts`). Mancano tre pezzi strutturali richiesti esplicitamente dal Master Prompt: un **Feature Flag Engine** generico (oggi solo un cookie ad hoc `bk_version`), un **sistema di eventi analytics/telemetria** (oggi solo aggregati statici), e una **persistenza Planner dedicata** (oggi calcolato al volo). Il dominio "Offering" (attività+sede+periodo+prezzo+capienza pubblicabile separatamente da un template Activity) non esiste come entità propria.

Decisione finale: **GO WITH CONDITIONS** (dettaglio §9).

## 2. Convenzione Sprint ufficiale (Decisione approvata — vedi anche DECISION_LOG.md)

| Nome ufficiale | Contenuto |
|---|---|
| TRAMA ONE Build Sprint 0 — Foundation | Route shell `/one`, Feature Flag Engine, telemetry minima, Transition Register, Assumption Log |
| TRAMA ONE Build Sprint 1 — Partner onboarding, Admin Review e Walkthrough foundation | State machine Center, verifica identità, checklist, Admin review cards, **motore Walkthrough generico** |
| TRAMA ONE Build Sprint 2 — Catalogo, prezzo, capacità, Giorni spot e Walkthrough attività | Stato Offering (decisione finale qui), wizard attività, disponibilità/prezzo, Giorni spot lato Partner, step Walkthrough attività |
| TRAMA ONE Build Sprint 3 — Parent discovery e selezione giorni | Context object, ricerca/dettaglio, richiesta, selezione giorni lato Parent |
| TRAMA ONE Build Sprint 4 — Partner response, Booking e Planner Sync | Risposta Partner, sync Planner, accettazione completa/parziale per giorno, decisione finale persistenza PlannerItem |
| TRAMA ONE Build Sprint 5 — CenterLead, referral e incentivi | Suggerimento centro, dedupe, shadow reward |
| TRAMA ONE Build Sprint 6 — Beta, analytics e hardening | Command center Admin, feedback industrializzato, analytics, hardening walkthrough |

Gli sprint storici già eseguiti su questo repository (Legacy/Next Gen, commit già in git) sono denominati **Historical Legacy/NextGen Sprint** in ogni comunicazione futura, per non collidere con questa numerazione né con la numerazione S6-S12 del backlog interno dell'Handbook Parent né con il piano a 5 fasi luglio-settembre del documento MVP (tre numerazioni "Sprint" distinte esistono nei documenti ufficiali — vedi `../derived/INDEX.md` §7).

## 3. Mappa del repository (AS-IS)

**Framework**: Next.js 16 (canary) App Router, React 19, TypeScript strict. `proxy.ts` sostituisce `middleware.ts`.

**Portali**:
- Parent legacy: `app/(main)/` (calendar, groups, preferiti, prenotazioni, presenze, profile, richieste, search) + `app/booking/[id]`, `app/activity/[id]`.
- Partner/Gestore: `app/center/` (account, activities, attendance, group-requests, invites, profile, promotions, report-presenze, richieste, servizi-consigliati).
- Admin: `app/admin/` (activities, analytics, bookings, centers, certifications, group-requests, partner-offers, preferiti, presenze, richieste, segnalazioni-beta, tags).
- Next Gen: `app/nextgen/` (admin, center, community, planner, profile, search).
- Trasversali: `app/auth`, `app/actions` (19 server action file), `app/internal/beta-pipeline`, `app/share/planner`.

**Routing/tenant**: `proxy.ts` determina tenant da hostname (`lib/tenant.ts`), gestisce gate di ruolo (`profiles.role`: `parent`/`center_admin`/`platform_admin`), rewrite trasparente `partner.*→/center`, `admin.*→/admin`. Bypass condiviso: `/auth`, `/api`, `/internal`, `/_next`, `/manifest*`, `/sw.js`. Host reali (alias `.vercel.app`): `buddykids-app.vercel.app` (family, default), `buddykids-partner.vercel.app` (partner, via `NEXT_PUBLIC_PARTNER_HOSTS`), `buddykids-admin.vercel.app` (admin, via `NEXT_PUBLIC_ADMIN_HOSTS`).

**Auth/RLS**: Supabase Auth, client in `lib/supabase/{client,server,service,env,middleware}.ts`. `service.ts` = client service_role (bypassa RLS, mai esposto al browser, chiave solo in env Vercel senza prefisso `NEXT_PUBLIC_`) — pattern introdotto in Sprint storico 8 per `/internal/beta-pipeline`, riusato per il Feature Flag Engine (§6). Isolamento `center_admin` per `profiles.center_id`. Famiglia modellata con `families`/`family_members`/`family_invites`.

**Data layer**: 33 file `lib/data/*.ts` (query), 19 file `app/actions/*.ts` (mutazioni), corrispondenza quasi 1:1 per dominio.

**Schema DB**: nessuna cartella `supabase/migrations/`, file SQL sciolti (`schema.sql` 2049 righe/40 tabelle + `migration_02`…`06` + `migration_gruppi_avanzati.sql` + `seed*.sql`).

**Test**: `playwright.config.ts` (`testDir: ./tests`, progetti chromium+mobile-chrome, trace/screenshot/video su fallimento). 53 file spec: 12 genitori, 10 gestore, 6 admin, 21 nextgen, più setup/sitemap/manuale/fixtures/cleanup. `tests/nextgen/smoke.spec.ts` già esistente, riusabile come ancora per lo scope `smoke`.

**Feature flag**: assente come sistema generico (solo cookie `bk_version`).

**Analytics**: assente come tracking eventi (solo `lib/analytics.ts`, aggregati statici).

## 4. Mappa delle journey AS-IS

| Journey | Stato AS-IS |
|---|---|
| Onboarding/approvazione Partner | Parziale: `centers` senza state machine esplicita LEAD→CLAIMED→SUBMITTED→APPROVED |
| Creazione/pubblicazione attività | Funzionante, senza gate qualità/stato Offering formale |
| Disponibilità/prezzo | Funzionante (`activity_days`, `activities.price_per_week`) |
| Planner→ricerca→dettaglio | Funzionante (Legacy e NextGen) |
| Richiesta/prenotazione | Funzionante ma doppio modello: `activity_inquiries` (richieste) + `bookings` (prenotazione), non un'unica state machine Request |
| Risposta Partner/aggiornamento Parent | Funzionante lato booking, più leggero lato inquiries |
| Segnalazione/invito centro | Diverso: `invites` è referral cliente con sconto, non CenterLead B2B verso Admin (assente) |
| Feedback beta contestuale | **Già production-ready**: `beta_feedback`, pipeline automatica ogni 15 minuti |
| Gestione Admin/audit | Parziale: code per dominio separate, `activity_log` copre solo un sottoinsieme, nessun Audit Log generico |
| Servizi extra | Fuori scope MVP TRAMA ONE |

## 5. Reuse matrix definitiva

| Asset | Decisione | Note |
|---|---|---|
| Tenant routing (`proxy.ts`, `lib/tenant.ts`) | REUSE_AS_IS | Solo estensione liste bypass/gate per `/one` |
| Auth/RLS (`lib/supabase/*`, `profiles.role`) | REUSE_AS_IS | Nessuna nuova tabella ruolo |
| `profiles`, `kids`, `families`/`family_members` | REUSE_AS_IS | Mappano Household/Child MVP |
| `centers` | ADAPT | Aggiungere stato pubblicazione (enum) |
| Location/Sede | **DEFER** | Sede unica per centro nel pilot, `centers.address` riusato, nessuna tabella `locations` in Sprint 0-1, nessun vincolo tecnico che impedisca l'introduzione futura |
| `activities`, `activity_weeks`, `activity_days` | ADAPT | Base per Offering/Availability |
| Offering | **ADAPT / DEFER DECISION** | Nessuna nuova entità in Sprint 0; decisione strutturale finale in Sprint 2 dopo analisi Giorni spot |
| Prezzo | REUSE_AS_IS (Price come entità: DEFER) | Colonna diretta sufficiente per MVP |
| `activity_inquiries` + `bookings`/`booking_weeks`/`booking_kids` | WRAP_WITH_ADAPTER | Convergenza concettuale in state machine Request, senza merge distruttivo — **rischio Alto**, priorità test di regressione |
| PlannerItem | **ADAPT / DEFER DECISION** | Planner resta proiezione calcolata fino a Sprint 4; rivalutazione persistenza dedicata a Sprint 4 |
| `beta_feedback` + `/internal/beta-pipeline` | REUSE_AS_IS | Già più maturo del necessario per CR-050 |
| CenterLead/referral | NEW | Nuova tabella `center_leads`, additiva, nessun impatto su `invites` |
| Feature flag generico | **NEW — obbligatorio Sprint 0** | Motore proprio, registry+override (§6) |
| Audit Log generico | ADAPT | Estensione di `activity_log`, non riscrittura |
| Suite Playwright | REUSE_AS_IS + ADAPT incrementale | Nuova cartella `tests/one/`, tag `@smoke`/`@journey` su spec esistenti |
| `deploy.sh`/`test-deploy.sh` | **ADAPT** (corretto da REUSE_AS_IS) | Vedi §7 — difetto reale già presente (`\|\| true` incondizionato) da correggere comunque |
| Motore Walkthrough | NEW — anticipato a Build Sprint 1 | Generico, configurabile, non hardcoded (vincolo Master Prompt #12) |

## 6. Feature Flag Engine — disegno approvato (solo design, non implementato)

**Alternativa scelta**: A — registry TypeScript versionato (`lib/feature-flags/registry.ts`) + override persistiti in tabella (`feature_flag_overrides`). Motivazione: rollback via `git revert`, nessun rischio di flag "orfano" attivabile per typo, minore complessità dell'Alternativa B (definizioni e override entrambi persistiti).

**Sicurezza (vincolante)**:
- `lib/feature-flags/resolve.ts` con `import "server-only"` in testa (stesso pattern già usato in 7 file del repository) — la build fallisce se importato da un Client Component.
- Client Supabase: `createServiceClient()` (`lib/supabase/service.ts`, service_role, bypassa RLS, chiave mai `NEXT_PUBLIC_`) — non il client anon (`server.ts`), non il client browser (`client.ts`).
- RLS su `feature_flag_overrides`: SELECT/INSERT/UPDATE/DELETE riservate a `platform_admin` — la tabella **non è leggibile da nessun altro ruolo**, nemmeno via client anon lato server, per difesa in profondità.
- Nessuna variabile `NEXT_PUBLIC_*` contiene override o regole di rollout.
- Fallback: flag sconosciuto, errore DB, timeout → `false` incondizionato (kill switch), mai eccezione propagata, log solo server-side.
- Unit test: risoluzione pura con client Supabase mockato (successo/errore/timeout/flag sconosciuto), eseguibile senza browser.

**Flusso di gating** (route `/one`):
```
request → proxy.ts (tenant/auth/ruolo/rewrite, INVARIATO, nessuna query flag)
  → route fisica: app/one/*, app/center/one/*, app/admin/one/*
  → layout server-side del portale → resolve.ts (server-only, service client)
  → TRAMA_ONE_ENABLED=true  → pagina /one
  → TRAMA_ONE_ENABLED=false → fallback: redirect a Home Legacy/NextGen secondo cookie bk_version esistente
```
`proxy.ts` resta scope invariato: tenant, autenticazione, ruolo, rewrite — nessuna interrogazione a `feature_flag_overrides` al suo interno.

**Route fisiche necessarie sui tre host** (verificato da `proxy.ts`/`lib/tenant.ts`, non assunto): `app/one/` (Parent, nessun prefisso), `app/center/one/` (Partner — il rewrite di `proxy.ts` antepone sempre `/center`), `app/admin/one/` (Admin, stesso motivo) — tre cartelle fisiche distinte, non un'unica route condivisa.

## 7. Deploy/test impact

**Correzione classificazione**: `deploy.sh` e `test-deploy.sh` = **ADAPT**, non REUSE_AS_IS. Motivo: `test-deploy.sh` usa oggi `|| true` incondizionato su ogni comando Playwright (righe 44/49/55) — comportamento sempre permissivo, mai esplicito, in violazione di CLAUDE.md §3 ancora prima di qualunque modifica TRAMA ONE.

| Variabile/evento | AS-IS | TO-BE |
|---|---|---|
| `bash deploy.sh` | push→deploy→alias→test (salvo SKIP_TESTS) | Invariato + pass-through nuove variabili |
| `SKIP_TESTS=1` | Salta test-deploy.sh | Invariato |
| `ONLY_SITEMAP=1` | Solo sitemap, ma **dopo** che push/deploy/alias sono già avvenuti (perché è dentro test-deploy.sh, chiamato da deploy.sh dopo il deploy) | Deve essere intercettato **prima** di push/deploy/alias/cleanup/suite ordinaria: solo validazione variabili, sitemap contro target configurato, output, apertura opzionale, exit code coerente — nessun nuovo deploy |
| `SITEMAP_OPEN_BROWSER=1` | **Non esiste** — `open` è hardcoded incondizionato (macOS-only, nessun fallback) | Condizionale alla variabile + `command -v open`; se assente, stampa il percorso invece di fallire silenziosamente |
| `ALLOW_TEST_FAILURES=1` | **Non esiste** — comportamento permissivo sempre attivo (bug) | Rimuovere `|| true` di default; exit code reale propagato; con la variabile impostata, avviso esplicito visibile |
| `TEST_SCOPE=smoke\|journeys\|all` | **Non esiste** — sempre suite intera | `smoke`→`--grep @smoke`, `journeys`→`--grep @journey`, `all` (default)→invariato |
| Exit code | `test-deploy.sh` sempre 0 | Reale salvo `ALLOW_TEST_FAILURES=1` |
| Alias set | Due comandi senza error handling esplicito; con `set -e`, un fallimento del secondo alias lascia stato incoerente silenzioso | Verifica esplicita per singolo alias, stampa OK/FALLITO per ciascuno |
| Deployment precedente | Non registrato | Da acquisire/stampare prima del deploy (per rollback manuale) |
| Rollback | Manuale, non automatizzato (confermato, nessuna modifica proposta) | Invariato — istruzioni precise fornite (§8) |
| `open` non disponibile | Fallimento silenzioso possibile (nessun `set -e` in questo script) | Check `command -v open` esplicito |

**Test Scope Matrix**: `smoke` = Smoke Parent Legacy + Parent NextGen (`tests/nextgen/smoke.spec.ts` già esistente) + Partner + Admin + TRAMA ONE Parent/Partner/Admin, via tag `@smoke` su spec esistenti rappresentativi (nessuna duplicazione) più nuovi `tests/one/*.spec.ts`. `journeys` = processi cross-portale approvati, tag `@journey`. `all` = suite intera invariata + nuovi test — comportamento di default.

## 8. Rollback manuale (deploy TRAMA ONE)

1. Recuperare URL/ID del deployment precedente (registrato prima del deploy corrente o da `vercel ls`/dashboard).
2. `npx vercel alias set <url-precedente> buddykids-app.vercel.app` (e partner/admin se necessario).
3. Nessuna cancellazione del deployment nuovo — resta disponibile per roll-forward.
4. Rieseguire `TEST_SCOPE=smoke bash test-deploy.sh` contro produzione per confermare il ripristino.

## 9. Feature Preservation e Non-Regression Gate

TRAMA ONE non deve causare perdita di capability disponibili in Legacy, NextGen, Partner o Admin. Inventario completo e Feature Parity Matrix: vedi `FEATURE_PARITY_MATRIX.md` (documento dedicato, stessa cartella).

Regole vincolanti confermate: nessuna route Legacy/NextGen eliminata in Sprint 0; nessun test esistente eliminato/disattivato/indebolito; ogni nuova capability protetta da `TRAMA_ONE_ENABLED` con comportamento AS-IS invariato a flag disattivato; nessuna classificazione REMOVE ammessa — solo RETAIN_AS_IS, REUSE, ADAPT, WRAP, REPLACE_AFTER_PARITY, DEFERRED_MIGRATION; una dismissione (REPLACE_AFTER_PARITY) richiede: duplicazione dimostrata, parità funzionale raggiunta, test di regressione Legacy/NextGen verdi, rollback verificato, approvazione esplicita di Fabrizio; qualunque perdita anche temporanea di funzionalità è classificata BLOCKER.

La Feature Parity Matrix per capability è sufficiente per Sprint 0 (Sprint 0 non modifica processi di business). Prima di Build Sprint 1 va prodotta una matrice pagina-per-pagina/route-per-route per le capability coinvolte in quello sprint; prima di ogni Build Sprint successivo la matrice va estesa alle route/journey coinvolte. Nessuna capability va omessa perché non rappresentata nei mockup TO-BE.

## 10. Rischi residui

- **Alto**: unificazione Request/Booking (E06) — rischio di rompere booking Legacy/NextGen in produzione. Mitigazione: adapter non distruttivo, suite di regressione booking obbligatoria e verde prima di ogni merge su questo epic.
- **Medio**: assenza feature flag oggi — mitigato rendendolo prerequisito hard di Sprint 0.
- **Medio**: sandbox Claude non esegue browser Playwright (limite ambientale già noto, non TRAMA ONE-specifico) — mitigato da classificazione esplicita "pending local verification" e comandi completi per Fabrizio.
- **Medio**: quattro numerazioni "Sprint" storicamente coesistenti — mitigato dalla convenzione unica adottata (§2).
- **Basso**: Location a sede singola assunta — da confermare prima di Build Sprint 2 se un centro reale del pilot ha più sedi.
- **Basso**: alias set parzialmente fallito resta possibile anche con verifica esplicita — richiede comunque intervento manuale immediato.
- **Basso**: anticipazione del motore Walkthrough a Build Sprint 1 aumenta lo scope di quello sprint rispetto alla sequenza Implementation Pack originale.
- **Aperto**: la matrice pagina-per-pagina/route-per-route richiesta prima di Build Sprint 1 non è stata ancora prodotta — prerequisito separato, non incluso nello scope di Sprint 0.

## 11. GO decision

**GO WITH CONDITIONS.**

Condizioni per procedere a Sprint 0:
1. Feature Flag Engine con RLS `platform_admin`-only e resolver server-only/service-role come prerequisito hard, non placeholder.
2. Correzione del comportamento permissivo di `test-deploy.sh` (rimozione `|| true` di default) nello stesso Sprint 0.
3. Nessun lavoro su E06 (Request/booking lifecycle) prima che la suite di regressione booking Legacy/NextGen sia verde.
4. `ONLY_SITEMAP=1` intercettato prima di qualunque azione di deploy/alias/cleanup/suite ordinaria.
5. Motore Walkthrough generico consegnato in Build Sprint 1, non differibile a Sprint 6.
6. Prima di Build Sprint 1: matrice pagina-per-pagina/route-per-route per le capability coinvolte in quello sprint.

In attesa del comando esplicito **"AVVIA TRAMA ONE — SPRINT 0"**.
