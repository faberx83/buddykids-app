# TRAMA — EVOLUTION LAB
## Architecture, Staging Strategy & Development Estimate — Post-Beta Product Evolution

Documento di sola analisi. Nessun codice modificato, nessun commit, nessuna migrazione applicata, nessun deploy, nessuna configurazione Vercel/Supabase toccata. Prodotto leggendo repository (`buddykids-app_v1`, branch `main`, HEAD `a487f4d`), `vercel.json`, `deploy.sh`, `supabase/*.sql` (48 file), e verificando lo schema **live** su Supabase (progetto `buddykids`, `eagsgfxunwyyxwwilldy`) in sola lettura.

Convenzione usata ovunque in questo report: **NEW** = da costruire da zero · **REUSE** = esiste già ed è riusabile così com'è · **EXTEND** = esiste, va esteso in modo additivo · **AVOID** = esiste qualcosa di simile ma NON va riusato/esteso (rischio semantico) · **IPOTESI DA VALIDARE** = non verificabile da codice/DB, richiede conferma di Fabrizio.

---

## 1. Executive Recommendation

TRAMA oggi vive interamente su **un solo ambiente**: un solo progetto Vercel (`buddykids-app`, 3 alias `.vercel.app` sullo stesso deployment, distinti solo da hostname via `proxy.ts`), un solo progetto Supabase (`buddykids`), un solo branch git vivo (`main`). Non esiste alcun ambiente di staging funzionante oggi — due branch che sembrerebbero candidati (`feature/trama-one-foundation`, `backup/pre-trama-one`) sono in realtà **snapshot morti**, rispettivamente 572 e 595 commit indietro rispetto a `main`: non sono mai stati mantenuti allineati e non vanno considerati riusabili senza un rebase pesante.

La raccomandazione preliminare di Fabrizio (main=prod, evolution branch=staging, Vercel Staging separato, Supabase Staging separato) **è sostanzialmente corretta e viene confermata**, con una variante tecnica importante: **Supabase Branching** (feature nativa Supabase, non un secondo progetto pieno) è probabilmente la scelta migliore per il database di staging, non un secondo progetto Supabase standalone — vedi §6.

Le 8 capability richieste (school calendar, external activities, personal calendar sync, deleghe, smart departure, location, handover, delay notification) **condividono davvero un modello unico** (Family Operating Layer, vedi §19), ma con eterogeneità di rischio enorme: si va da capability quasi pronte (School Calendar Intelligence ha già lo schema DB applicato e un design doc completo, mai collegato al codice) a capability che partono da zero assoluto e richiedono provider esterni a pagamento con implicazioni privacy serie (Smart Departure, Location, Delay Notification).

---

## 2. Current Architecture Findings

- **Repo**: singolo remote GitHub (`faberx83/buddykids-app`), 707 commit su `main` dal 07/07/2026, nessun tag di release. Next.js 16.3.3 (App Router, Turbopack), Supabase (Postgres + Auth + Storage), deploy su Vercel.
- **Multi-tenant a 3 alias** (`buddykids-app`/`-partner`/`-admin`.vercel.app): stesso identico deployment fisico, `proxy.ts` decide il tenant leggendo l'header Host e riscrive internamente verso `/center` o `/admin`. Cookie di sessione **non condivisi** tra i 3 alias (non sono sottodomini di un dominio comune) — login separato per ognuno, limite noto e documentato nel codice.
- **Deploy**: `deploy.sh` è uno script bash locale (non CI/CD, gira dalla macchina di Fabrizio), con preflight di sicurezza reali: blocca se branch ≠ `main`, blocca se working tree sporco, blocca se `git push origin main` fallisce — tutti aggirabili con override espliciti (`ALLOW_*`). Pubblica con `npx vercel --prod`, che pubblica il **working tree corrente**, non necessariamente ciò che risulta pushato — un rischio già riconosciuto esplicitamente nei commenti dello script stesso.
- **Nessun CI/CD**: nessuna GitHub Action, nessun workflow automatico. Tutta la disciplina di sicurezza vive in `deploy.sh` lato client.
- **Migration**: 48 file SQL numerati progressivamente in `supabase/*.sql` (no `supabase/config.toml`, no cartella `migrations/` con timestamp, no Supabase CLI in uso). Ogni file dichiara nel proprio header se è già stato applicato o no; **l'applicazione è sempre manuale, un file alla volta, da Fabrizio nello SQL Editor di Supabase** (governance: Claude non applica mai migrazioni). Ho verificato dal vivo (query read-only) che almeno 3 migration recenti (`family_people`, `travel_reminders`, `school_calendar_*`) **sono già state applicate** nonostante l'header dei file dica ancora "non applicata" — gli header non sono affidabili come stato, solo il DB reale lo è (coerente con la regola che hai posto: codice+DB > documentazione).
- **`schema.sql` non è affidabile come stato attuale**: è la baseline iniziale, non viene mai risincronizzata con le migration numerate successive. Caso reale documentato nel codice: la tabella `activity_certifications` era definita in `schema.sql` ma non fu mai consegnata come migrazione — bug scoperto solo in produzione (TC-200, "Could not find the table"). **Fonte di verità reale = query dirette sul DB live, mai `schema.sql` da solo.**
- **Feature flag**: sistema già esistente e maturo — registry versionato nel codice (`lib/feature-flags/registry.ts`) + override runtime in tabella `feature_flag_overrides` (scope: global/environment/user/role/tenant/cohort). Oggi solo 2 flag definiti. Riusabile direttamente per il rollout progressivo delle nuove capability.
- **Push notification**: infrastruttura reale e già in produzione (VAPID web-push, `migration_31_push_subscriptions`, un solo service worker condiviso `public/sw.js` per tutti e 3 i tenant, routing via `deepLink`). Riusabile per handover/delay notification.
- **Nessuna integrazione esterna a pagamento oggi**: zero Maps/Directions/Geocoding, zero WhatsApp Business API/Twilio/SMS, zero Google/Outlook Calendar OAuth. Un solo generatore `.ics` client-side minimale (vedi §12).

---

## 3. Evolution Lab Recommendation

### Confronto opzioni

| Criterio | A — branch + Preview + Supabase prod condiviso | B — branch + Vercel Staging + Supabase Staging separato | C — secondo progetto/app separata | D — Vercel Staging + **Supabase Branching** (raccomandato) |
|---|---|---|---|---|
| Isolamento codice | Alto (deploy separato) | Alto | Massimo (repo/progetto proprio) | Alto |
| Isolamento database | **Nullo — rischio reale** | Alto | Massimo | Alto (branch = DB fisicamente separato, effimero) |
| Auth | Condivisa con prod (utenti reali) | Separata | Separata | Separata (branch ha il proprio schema `auth`) |
| Storage | Condiviso con prod | Separato (bucket da ricreare) | Separato | Separato (branch include storage) |
| Env var | Stesse di prod (rischio) | Set dedicato | Set dedicato | Set dedicato |
| Costo | ~Zero extra | Vercel: 1 environment extra incluso in Pro; Supabase: 2° progetto Pro ≈ $25/mese pieno (il credito free si consuma sul primo) | Il più alto (doppia infra, doppia manutenzione) | Vercel: come B; Supabase branching ≈ $0.0134/h per branch attivo (~$9-10/mese se tenuto sempre acceso, molto meno se acceso solo nelle sessioni di lavoro) |
| Semplicità | Alta (nessun nuovo servizio) | Media | Bassa | Media |
| Rischio contaminazione prod | **Alto** (query/side-effect reali su dati veri: prenotazioni, push, email) | Basso | Minimo | Basso |
| Rischio drift | Basso (stesso DB, per definizione) | Medio (va tenuto sincronizzato manualmente) | Alto (due codebase possono divergere nel tempo) | Basso (branch nasce da uno snapshot di prod, si "rebasa" a comando) |
| Gestione migration | Applicate direttamente in prod, nessun test prima | Migration duplicata a mano su 2 DB (rischio disallineamento) | Migration duplicata su 3 DB (prod, staging, secondo progetto) | La stessa migration si applica prima sul branch, si valida, poi si promuove — **workflow nativo Supabase per esattamente questo scopo** |
| Test | Realistici (dati veri) ma pericolosi | Serve seed sintetico dedicato | Serve seed sintetico dedicato | Serve seed sintetico dedicato, ma il branch può clonare la STRUTTURA di prod senza i dati reali |
| Porting verso prod | Immediato (già lì) | PR + deploy separato | Richiede un "merge" applicativo esplicito | PR + deploy, migration promossa 1:1 |
| Rollback | Rischioso (è prod) | Pulito (staging isolato) | Pulito | Pulito |
| Manutenzione nel tempo | Bassa (niente da mantenere) | Media (2 ambienti da tenere vivi) | Alta (rischio "fork ingestibile", esplicitamente quello che vuoi evitare) | Media, ma il branch è pensato per essere effimero (si ricrea da zero quando serve, non si "mantiene")|

### Raccomandazione

**Opzione D**: Vercel Preview/Staging Environment dedicato (Vercel Pro, 1 environment extra incluso) + **Supabase Database Branching** invece di un secondo progetto Supabase pieno. Motivazione: Supabase Branching è letteralmente progettato per il workflow che hai descritto tu stesso in §C ("migration nuova → staging → test → approvazione → produzione"), costa una frazione di un secondo progetto Pro standalone, e un branch nasce clonando lo *schema* di produzione (non i dati sensibili reali) — riducendo di molto il rischio privacy del punto §C ("dati reali mai copiati indiscriminatamente nello staging"). **Nota**: Supabase Branching richiede il piano Supabase Pro (oggi il progetto sembra sul piano Free/Free-tier compatibile — verificare piano attuale, IPOTESI DA VALIDARE) e richiede l'uso della Supabase CLI/`config.toml`, che oggi il progetto non usa affatto: è un cambio di tooling reale, non solo di infrastruttura, e va messo in conto nell'effort di setup.

Se questo cambio di tooling risultasse troppo grande da introdurre subito, l'**Opzione B classica** (secondo progetto Supabase standalone, Free tier — il primo dei 2 progetti gratuiti disponibili per organizzazione) resta un fallback valido, più semplice concettualmente, leggermente più costoso da mantenere sincronizzato a mano.

**Opzione A è sconsigliata** per qualsiasi capability che tocchi dati reali (push notification, email, deleghe, posizione) proprio per le capability che stai per costruire — l'isolamento del DB non è negoziabile quando si parla di documenti d'identità e posizione di minori, anche in fase di sviluppo.

**Opzione C è sconsigliata**: è esattamente il "fork ingestibile fra 2 mesi" che vuoi evitare, e duplica la superficie di manutenzione (deploy.sh, feature flag, RLS, tutto va mantenuto due volte).

---

## 4. Git Strategy

Branch model raccomandato, minimale (non GitFlow):

```
main                    → produzione (frozen, solo bugfix approvati)
evolution                → integration/staging, vive per mesi, non si elimina mai
feature/<nome>          → una capability alla volta, nasce da evolution, muore dopo il merge
hotfix/<nome>           → nasce da main, per bugfix urgenti su prod
```

- **PR model**: `feature/*` → PR verso `evolution` (mai direttamente verso `main`). `evolution` → PR verso `main` solo quando un blocco di capability è validato su staging ed esplicitamente approvato da Fabrizio.
- **Quando aggiornare `evolution` da `main`**: subito dopo ogni hotfix mergiato in `main` (vedi sotto) — mai lasciare `evolution` più di qualche giorno indietro rispetto a `main`, altrimenti il rischio di conflitti massicci al merge finale cresce esponenzialmente (è esattamente il meccanismo che ha reso morti `feature/trama-one-foundation` e `backup/pre-trama-one`: nessuno li ha mai riallineati, ora sono a 500+ commit di distanza, irrecuperabili).
- **Come evitare divergenze**: regola fissa, non opzionale — `evolution` si aggiorna da `main` **entro 24-48h da ogni deploy di produzione**, non "quando si ricorda qualcuno". Se questo repository avesse CI, sarebbe un job automatico; senza CI, va disciplinato come lo sono oggi i preflight di `deploy.sh` (blocco esplicito, non promemoria).
- **Hotfix su `main`**: si fa un branch `hotfix/*` da `main`, si deploya in prod (stesso `deploy.sh` di oggi, invariato), poi si **cherry-pick immediatamente** il commit dell'hotfix su `evolution` (non un merge di `main` intero, per non trascinare dentro `evolution` prematuramente tutto lo storico di produzione se `evolution` ha già divergenze locali non ancora pronte).
- **Quando eliminare un `feature/*`**: subito dopo il merge (squash) in `evolution`, mai tenerli vivi "per sicurezza" — è la fonte primaria di degrado nel tempo.
- **Release tagging**: un tag leggero su `main` ad ogni deploy di produzione (`git tag prod-YYYYMMDD-HHMM`, coerente col naming già usato per i log di `deploy.sh`), utile per il rollback manuale già previsto (`npx vercel ls buddykids-app --prod`) e per correlare un deploy a `deploy_events` senza dover cercare a mano l'SHA.

### Merge / Squash / Rebase / Cherry-pick

- **`feature/*` → `evolution`**: **SQUASH**. Ogni feature entra come UN commit leggibile nella storia di `evolution` — evita di sporcare la storia condivisa con i "wip"/"fix typo" interni a una feature.
- **`main` → `evolution`** (riallineamento periodico): **MERGE** (non rebase). `evolution` è un branch condiviso e a lunga vita: rebasarlo riscriverebbe la storia che altri potrebbero aver già basato sopra, esattamente il tipo di caos che vuoi evitare.
- **`evolution` → `main`** (promozione finale): **MERGE** con `--no-ff` (crea un commit di merge esplicito), non squash — a differenza di una singola feature, qui vuoi *preservare* la granularità dei commit delle singole capability nella storia di `main`, per poter fare bisect/audit in futuro.
- **Hotfix `main` → `evolution`**: **CHERRY-PICK** del singolo commit, come detto sopra — mai un merge completo in questa direzione specifica.
- **MAI rebase su `main`** in nessun caso: `main` è produzione, la sua storia deve restare esattamente ciò che è stato effettivamente deployato, punto.

### Rollback

Deploy: già gestito (`npx vercel ls buddykids-app --prod` + redeploy di una versione precedente, meccanismo esistente, invariato). Codice: `git revert` su `main` (mai `reset --hard` su un branch condiviso). Migration: vedi §5 (additive-only rende il rollback quasi sempre "non applicare la parte successiva", raramente un vero DROP).

---

## 5. Vercel Strategy

- **Oggi**: 1 progetto Vercel (`buddykids-app`), 3 alias sullo stesso deployment, piano probabilmente **Hobby** (evidenza indiretta nei commenti del codice: limite di 1 esecuzione/giorno per i cron job, quota "Active CPU" citata come vincolo per non far girare l'intera suite Playwright ad ogni deploy).
- **Setup richiesto per lo staging**: se si resta su Hobby, un secondo progetto Vercel separato è comunque possibile gratuitamente, ma **niente Preview Deployment collaborativi avanzati, niente Environment multipli con env var dedicate per environment** — quelle sono funzionalità Pro. Per il workflow richiesto (env var separate per staging, più utenti, deploy da branch diverso da `main` in sicurezza) **serve il piano Pro** ($20/seat/mese, include 1 environment custom oltre a Production/Preview/Development; pacchetti aggiuntivi da 5 environment a $50/mese se mai servissero più ambienti).
- **3 alias anche per staging**: stesso pattern di oggi (`*-app`/`*-partner`/`*-admin`), ma su hostname/alias diversi e — punto critico — con **proprie variabili d'ambiente** che puntano al progetto Supabase di staging, mai a quello di produzione (vedi §7 per la matrice completa).
- **`deploy.sh`**: va **duplicato/parametrizzato**, non riusato as-is. Oggi ha hardcoded: URL di produzione (`https://buddykids-app.vercel.app`), nome alias `buddykids-partner`/`buddykids-admin`, e il preflight blocca esplicitamente ogni deploy da branch ≠ `main`. Serve uno script gemello (`deploy-staging.sh`) con lo stesso preflight ma puntato su `evolution` e sugli alias di staging — non una modifica in-place dello script di produzione (rischio di errore umano troppo alto altrimenti: un flag sbagliato e si deploya `evolution` in produzione).

---

## 6. Supabase Strategy

- **Oggi**: 1 progetto (`buddykids`, `eagsgfxunwyyxwwilldy`, regione eu-west-3, Postgres 17), nessun secondo progetto attivo nell'organizzazione (verificato: altri 2 progetti nell'org esistono ma sono `INACTIVE`, relativi ad altri lavori, non collegati a TRAMA).
- **Raccomandazione**: **Supabase Branching** (vedi §3) se il piano è/diventa Pro. Un branch è un ambiente Postgres realmente separato (proprio `auth`, proprio storage, proprio schema pubblico), pensato per nascere da uno snapshot dello *schema* di produzione, vivere per la durata di una feature/sprint, ed essere buttato via — è concettualmente il gemello del branch git `evolution`/`feature/*`, e li si può far corrispondere 1:1 se si vuole (un branch Supabase per `evolution`, effimeri per singole `feature/*` se servisse isolamento ancora più fine).
- **Fallback**: secondo progetto Supabase standalone (Free tier, uno dei 2 progetti gratuiti per organizzazione) se non si vuole introdurre da subito la Supabase CLI. Più semplice da capire, ma migration/seed vanno duplicati a mano su 2 progetti invece che promossi via branching nativo.
- **Auth**: separata per costruzione in entrambe le opzioni — nessun utente reale finisce mai in staging per errore.
- **Storage**: i bucket privati (`buddykids-certifications`, `buddykids-identity-verifications`, `buddykids-kids-avatars`) vanno ricreati in staging con le stesse policy — non c'è modo di "condividerli" in sicurezza, e non avrebbe senso farlo (soprattutto per documenti d'identità, vedi §22).
- **Edge Functions**: **nessuna in uso oggi** (tutta la logica server vive in Next.js Route Handlers/Server Actions su Vercel, non in Supabase Edge Functions) — nessun impatto aggiuntivo da isolare su questo fronte.
- **Service role key**: oggi usata solo lato server (cron routes, `lib/supabase/service.ts`) — in staging serve una service role key **diversa**, mai quella di produzione, ovviamente scoped al progetto/branch di staging.

---

## 7. Migration Strategy

Processo raccomandato, coerente con quanto già fa il progetto (numerazione progressiva, mai applicazione automatica) ma con un passaggio in più prima della produzione:

```
1. Migration scritta (additiva, come oggi: create table if not exists / add column if not exists)
2. Applicata sul branch/progetto di STAGING (mai in prod per prima)
3. Codice applicativo che la usa sviluppato/testato su staging, dietro feature flag OFF di default
4. Approvazione esplicita di Fabrizio (stesso principio già in vigore: nessuna migrazione auto-applicata da Claude, in nessun ambiente)
5. La STESSA identica migration (stesso file, stesso hash) viene applicata in produzione
6. Feature flag acceso in prod solo per cohort/utenti di test, poi globale
```

Regole esplicite (tutte già coerenti con lo stile visto nelle 48 migration esistenti, da formalizzare):

- **Migration additive quando possibile**: già lo standard di fatto in questo progetto — ogni migration letta usa `create table if not exists`/`add column if not exists`, mai `alter`/`drop` distruttivo su tabelle esistenti. Continuare così.
- **Mai modificare manualmente la produzione per "allinearla"**: nessuna query ad-hoc di fix schema direttamente in prod fuori da un file di migration versionato — oggi già rispettato (i vari `script_*.sql` sono comunque file versionati, non query eseguite a mano e perse).
- **Stessa migration promossa fra ambienti**: letteralmente lo stesso file SQL, mai riscritto per l'ambiente successivo — altrimenti si perde la garanzia che "ciò che è stato testato è ciò che va in prod".
- **Nessuna migration di staging deve finire automaticamente in prod**: nessuna automazione di sync schema esiste oggi (bene così) — l'unico canale è manuale, e resta manuale.
- **Nessuna dipendenza da ID generati diversi fra ambienti**: già rispettato ovunque — tutte le PK sono `uuid default gen_random_uuid()`, nessun riferimento hardcoded a un ID specifico nel codice applicativo verificato.
- **Seed staging separato**: esiste già un precedente diretto — `supabase/seed.sql` e `supabase/seed-test-data.sql` sono file separati dal seed di produzione. Lo stesso principio si applica 1:1 allo staging.
- **Dati reali mai copiati indiscriminatamente**: con Supabase Branching (§6) questo è quasi automatico (il branch clona lo schema, non forza una copia dati) — con un secondo progetto standalone va invece disciplinato esplicitamente (mai un `pg_dump` di produzione verso staging senza anonimizzazione).

**Schema drift**: il caso reale `activity_certifications` (§2) è l'esempio da non ripetere — la causa non era il processo di migration in sé, ma il fatto che `schema.sql` sia stato trattato come se fosse la fonte di verità quando non lo è più da tempo. Raccomandazione: aggiungere una riga di stato ("APPLICATA IN PROD: sì/no, verificato il ___") in testa a ogni futura migration, così lo stato smette di essere solo nella testa di Fabrizio.

**Migration history**: oggi non esiste una tabella di tracking dedicata (niente `supabase_migrations.schema_migrations`, essendo fuori dal workflow CLI) — l'unico registro è la numerazione progressiva dei file + la memoria di Fabrizio. Con Supabase Branching questo migliorerebbe automaticamente (la CLI tiene il proprio registro).

**Rollback/backfill**: pattern già visto (`travel_reminders` include un blocco ROLLBACK esplicito con `drop table if exists`) — buona pratica da rendere sistematica su ogni nuova migration, non solo su alcune.

**Feature flag / capability parzialmente deployate**: già coperto strutturalmente dal registry esistente (§2) — ogni nuova capability grande va dietro un proprio flag `defaultValue: false`, esattamente come già pianificato (e mai completato) per `SCHOOL_CALENDAR_INTELLIGENCE_ENABLED`.

---

## 8. Environment / Secrets Matrix

| Variabile | Produzione (oggi) | Staging (da creare) | Note |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | progetto `buddykids` | progetto/branch Supabase staging | **il cuore dell'isolamento** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod | staging | separata per costruzione |
| `SUPABASE_SERVICE_ROLE_KEY` | prod | staging | mai condivisa fra ambienti |
| `NEXT_PUBLIC_MAIN_HOST` / `_PARTNER_HOSTS` / `_ADMIN_HOSTS` | alias `.vercel.app` di prod | nuovi alias di staging | determina il routing tenant, deve puntare ai domini giusti |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | dominio prod (se impostato) | dominio staging | evita leak di sessione fra ambienti |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | coppia prod | **coppia VAPID separata** | se condivise, una subscription creata in staging potrebbe teoricamente ricevere push destinate a prod o viceversa — da generare ex novo |
| `RESEND_API_KEY` | account email prod | stesso account ma dominio/mittente distinto, o account separato | evita email di test inviate a famiglie/centri reali per errore |
| `CRON_SECRET` | prod | valore diverso | isola i cron job dei due ambienti |
| `DEPLOY_NOTIFY_SECRET` | prod | valore diverso | isola le notifiche di deploy |
| `PIPELINE_AUTOMATION_SECRET` | prod | valore diverso | stesso principio |
| `INVITE_FROM_EMAIL` | mittente prod | mittente chiaramente marcato "STAGING" | per non confondere chi riceve un invito di test |
| *(nuove, per le capability D.1-D.9)* | — | — | vedi §21, matrice provider esterni: ogni nuova integrazione porta la propria coppia di credenziali, sempre separate per ambiente fin dal giorno 1 |

---

## 9. Product Model

Il principio guida ("TRAMA non deve organizzare solo le attività acquistate tramite TRAMA, ma diventare il Family Operating Layer") è coerente con una direzione già visibile nel codice esistente: il Planner calcola già la copertura settimanale in modo aggregato (`lib/nextgen/planner-insights.ts`, `computeWeekStatus`), la responsabilità Andata/Ritorno è già disaccoppiata dalla prenotazione stessa (`week_responsibilities`), e il concetto di "settimana scoperta" è già indipendente da quale specifica prenotazione la copre. L'infrastruttura concettuale per accogliere fonti di copertura non-TRAMA **esiste già in nuce**, anche se il codice attuale assume implicitamente che l'unica fonte sia `bookings`.

---

## 10. School Calendar

**Stato reale (verificato in sessione, non ipotizzato)**: esiste già un design doc completo (`docs/trama-one/analysis/SCHOOL_CALENDAR_INTELLIGENCE_STATUS.md`, 24/08/2026) e le **4 tabelle sono già applicate in produzione** (`school_calendars`, `school_calendar_events`, `kid_school_profiles`, `school_calendar_overrides` — verificato via query diretta, 0 righe in tutte: schema pronto, zero dati). **Nessun codice applicativo esiste** (zero riferimenti nel codice a queste tabelle) e il feature flag previsto (`SCHOOL_CALENDAR_INTELLIGENCE_ENABLED`) non è mai stato registrato. Questa è quindi la capability **più vicina al traguardo** delle 8 — manca "solo" la parte applicativa (badge Planner, override UI, popolamento dati).

- **Fonti dati**: nessuna API pubblica italiana strutturata e affidabile a livello nazionale per i calendari scolastici regionali — è la conclusione già raggiunta nel design doc esistente, confermata: fonti reali sono i siti dei singoli USR/Regione, in formati eterogenei (PDF, pagine HTML non strutturate). **Scraping esplicitamente escluso da questo report** (per tua istruzione) e comunque sconsigliato come fonte primaria per un dato che cambia poco (una volta l'anno) — meglio un **import amministrativo manuale** (Admin carica/valida un calendario per regione+anno scolastico), esattamente come già disegnato.
- **Regione vs Comune vs Istituto**: la scelta già fatta (regione + comune opzionale, mai nome scuola/classe/sezione) è quella corretta per minimizzazione privacy — un calendario per istituto specifico richiederebbe un dataset enormemente più granulare (migliaia di istituti) senza un beneficio proporzionale (le chiusure "grandi" — Natale, Pasqua, inizio/fine anno — sono quasi sempre regionali; solo i ponti locali variano per comune).
- **Aggiornamento annuale**: manuale, un evento a bassa frequenza (1 volta/anno per regione) — non serve automazione, serve un processo Admin semplice (già previsto: policy RLS "solo platform_admin scrive").
- **Cache**: non necessaria a questa scala (poche righe, lette raramente rispetto al Planner che le userebbe) — nessuna preoccupazione di performance realistica.
- **Algoritmo Planner need-periods**: già progettato nel documento esistente — layer *informativo* sopra `computeWeekStatus`, mai una riscrittura dello stato `WeekStatus` esistente. Badge assistivo, non un nuovo stato bloccante.
- **UX**: badge "Scuola chiusa · da organizzare?" con CTA che riusa il pattern "Riempi" già esistente (Planner→Ricerca) — zero nuova navigazione da costruire.

**Classificazione**: schema **REUSE** (già applicato) · design **REUSE** (già completo) · UI/logica Planner **NEW** · popolamento dati **NEW** (processo, non solo codice) · feature flag entry **NEW** (una riga).

---

## 11. External Activities

**Stato reale**: **AVOID** riusare/estendere `bookings` per questo scopo — verificato via query diretta sullo schema: `bookings.activity_id` è `NOT NULL` con FK verso `activities` (un'attività reale pubblicata da un centro Partner reale), e la tabella porta con sé semantica commerciale/transazionale pesante (`partner_decision`, `payment_method`, `total_amount`, capacità/posti). Forzare un'attività esterna dentro `bookings` significherebbe o violare il vincolo NOT NULL con un'attività "fittizia" (inquinando le statistiche/revenue dei centri reali) o riscrivere pesantemente il modello — nessuna delle due è accettabile.

**Modello proposto**: nuova tabella `external_planner_items` (NEW, nome indicativo — vedi §20), con owner = genitore (stesso pattern RLS `parent_id = auth.uid()` già usato ovunque), campi minimi (bambino, periodo/giorni, nome libero, luogo/orari opzionali) + `source` esplicito (`'trama'` implicito per `bookings`, `'external'` per queste righe — mai un campo ambiguo).

**Punto di integrazione critico**: `lib/nextgen/planner-insights.ts` (`computeWeekStatus`) va **esteso** (non riscritto) per considerare anche `external_planner_items` come fonte di copertura, accanto a `bookings`. Questo è il vero cuore tecnico della capability — tutto il resto (form "+ Aggiungi", card nel Planner) è UI relativamente semplice una volta che l'aggregazione è corretta.

- **Chi fa cosa / Share / Calendario / Reminder / Smart Departure**: tutti questi sistemi leggono oggi identificatori legati a `bookings`/`kids`/settimane — vanno verificati punto per punto quali assumono implicitamente "esiste una riga in bookings" (es. `week_responsibilities` è già disaccoppiata per settimana/bambino, quindi probabilmente riusabile subito; Smart Departure dipenderebbe da un indirizzo/orario che un'attività esterna dovrebbe fornire allo stesso modo di una TRAMA).
- **Deduplica**: rischio reale se un genitore aggiunge manualmente un'attività che poi prenota anche su TRAMA per errore — mitigazione: nessuna deduplica automatica nel MVP (troppo rischiosa/euristica), solo un avviso soft se le date si sovrappongono.
- **Editing**: pieno CRUD sulle righe esterne (a differenza di `bookings`, dove l'editing passa per flussi Partner) — è dati del genitore, sotto suo controllo esclusivo.
- **Booking state**: nessuno — un'attività esterna non ha `partner_decision`, non ha "conferma parziale", è per definizione già "decisa" (il genitore l'ha già organizzata altrove).
- **Coverage/coordination/analytics**: coverage sì (via l'estensione a `computeWeekStatus`); analytics aggregate lato Admin **non** dovrebbero mai contare attività esterne come fatturato/prenotazioni reali — serve un filtro esplicito ovunque si sommano ricavi.

**Classificazione**: `external_planner_items` **NEW** · estensione `computeWeekStatus` **EXTEND** · `bookings` **AVOID**.

---

## 12. Personal Calendar Sync

Livello per livello, rispetto allo stato reale trovato nel codice:

| Livello | Cosa | Stato reale | Complessità | OAuth | Privacy | Raccomandazione |
|---|---|---|---|---|---|---|
| **1 — Download .ics** | Un file scaricabile per singolo evento | **PARZIALMENTE ESISTENTE**: `lib/ics.ts` genera già un `.ics` client-side, oggi usato solo per il "Aggiungi al calendario" dopo una prenotazione (`BookingSuccessActions.tsx`) | XS — estendere il generatore esistente a qualunque evento Planner (incluse attività esterne) | Nessuno | Minima — nessun dato lascia il device dell'utente | **Fare subito**, è quasi gratis: estendere un pattern già scritto e testato |
| **2 — Feed ICS sottoscrivibile** | URL personale che Google/Apple Calendar possono "seguire" e aggiornare da soli | **NON esiste** | S/M — serve una route pubblica ma autenticata-per-token (non login, un token opaco lungo per utente, revocabile), che genera un `.ics` aggregato al volo | Nessuno (il token nell'URL fa da autenticazione debole) | Media — il token, se trapelato, espone gli orari/luoghi dei bambini a chi lo ha. Serve rotazione/revoca facile | Passo naturale dopo il Livello 1 |
| **3 — Google Calendar / Outlook** | Sync vera con OAuth | **NON esiste, nessuna dipendenza presente** | L — richiede consenso OAuth, refresh token persistiti in modo sicuro, gestione scadenza/revoca, webhook o polling per gli aggiornamenti | Sì, completo | Alta — token OAuth lato server sono un asset sensibile (accesso al calendario personale intero dell'utente, non solo TRAMA) | Solo se il Livello 2 non basta all'uso reale osservato |
| **4 — Apple Calendar / CalDAV** | Sync via protocollo CalDAV | **NON esiste** | L — CalDAV è un protocollo più "artigianale" di Google/Microsoft OAuth, meno librerie mature in Node/Next.js | Variabile (spesso credenziali app-specific, non OAuth classico) | Alta, stesse considerazioni del Livello 3 | Bassa priorità — Apple Calendar è comunque raggiungibile via feed ICS sottoscritto (Livello 2), senza bisogno di CalDAV dedicato |
| **5 — Sync bidirezionale** | Un evento creato in Google finisce anche in TRAMA | **NON esiste** | XL — richiede webhook, gestione conflitti, e soprattutto una decisione prodotto su COSA sincronizzare all'indietro (rischio di inondare TRAMA di eventi irrilevanti) | Sì, avanzato | Alta | **Non raccomandato per ora** — valore incerto, complessità e rischio sproporzionati |

**Percorso raccomandato**: 1 → 2 → (valutare 3 solo se richiesto esplicitamente dagli utenti Beta) → 4/5 fuori scope per ora.

---

## 13. Delegations

Distinzione concettuale confermata e importante: "Chi fa cosa" (`week_responsibilities`/`family_people`, **REUSE come base ma AVOID come autorizzazione**) è oggi solo un'etichetta organizzativa — `family_people` ha solo `display_name` + `emoji`, **zero concetto di autorizzazione, identità verificata, o scadenza**. Serve un livello semantico completamente nuovo sopra.

**Un dettaglio architetturale trovato, rilevante**: esistono **due** concetti di "famiglia" nel codice, tenuti deliberatamente separati (documentato esplicitamente in `migration_32`): (1) `family_people`/`week_responsibilities`, scoped al singolo account genitore (`parent_id = auth.uid()`, nessuna condivisione cross-account); (2) `families`/`family_members` (`supabase/schema.sql`), un gruppo di account con inviti e ruoli, oggi usato **solo** per una pagina "i membri della mia famiglia", mai collegato a bambini/prenotazioni/responsabilità. Per le Deleghe, il modello (2) è concettualmente più vicino a "chi è autorizzato" (è già un concetto di gruppo/permesso fra account), ma andrebbe esteso con cautela — è un cambio di scope più grande di quanto sembri, perché introdurrebbe per la prima volta visibilità cross-account su dati oggi rigidamente single-owner.

**Modello proposto** (NEW): entità `authorized_people` (persona, anche non-utente TRAMA) + `pickup_authorizations` (delega: chi, per chi, quando, come verificata) — deliberatamente **non** un'estensione di `family_people` (che resta "chi organizza"), per non mischiare due concetti con implicazioni legali molto diverse.

- **Delega permanente vs temporanea vs per attività vs per giorno**: modellabile con `valid_from`/`valid_to` nullable + scoping opzionale (`kid_id`, `activity_id`, `weekday`) sulla stessa tabella — pattern già visto altrove nel progetto (es. `plan_shares.expiry`), niente di concettualmente nuovo per lo schema.
- **Revoca**: soft (colonna `revoked_at`), mai delete fisico — stesso principio già usato per `plan_shares`/`family_people.active` ("la storia non si nasconde").

### Oltre il "carica PDF" — alternative moderne (come richiesto)

| Meccanismo | Come funziona | Verifica identità reale? | Complessità | Note |
|---|---|---|---|---|
| Documento d'identità caricato | PDF/foto, revisionato da un umano lato Partner o Admin | Sì, ma manuale e lenta | M | Precedente diretto nel codice: `migration_15`, bucket privato `buddykids-identity-verifications`, path `<center_id>/<file>`, oggi usato per la KYC del **centro** (non del genitore/caregiver) — pattern di storage/RLS riusabile, dato/dominio no |
| QR dinamico / pickup pass | Un codice che cambia periodicamente, mostrato dal caregiver al ritiro | No (verifica "possesso del telefono del genitore che l'ha generato", non identità) | S | Buon compromesso rischio/valore per il Beta: nessun documento sensibile da gestire, il centro vede "questo QR è stato generato dal genitore autorizzato, per questo bambino, oggi" |
| Link verificabile con scadenza | URL con token, valido solo per la finestra del ritiro | No | XS | Il più semplice, riusa l'infrastruttura di token già pensata per il feed ICS (§12) |
| OTP (codice temporaneo via SMS/push) | Il centro chiede un codice, il caregiver lo riceve al momento | No (ma prova "il genitore ha approvato in tempo reale") | S/M | Richiede un canale di invio (SMS = costo/provider nuovo; push = già disponibile ma richiede che il caregiver abbia l'app) |
| Identità verificata una tantum + delegato persistente | Il genitore verifica se stesso una volta (KYC leggero), poi delega "a nome proprio" senza mai chiedere documenti al delegato | Sì (della persona che verifica, non di ogni delegato) | M | Concettualmente il più solido, ma la verifica "una tantum" del genitore stesso è comunque un pezzo di lavoro (provider terzo o processo manuale) |

**Raccomandazione**: **non** partire dal documento d'identità. Per il Beta, QR dinamico o link con scadenza (bassa complessità, nessun dato sensibile permanente da custodire) coprono il caso reale ("nonna autorizzata") senza il carico di compliance di gestire documenti d'identità di terzi. Il documento d'identità resta un'opzione per una fase successiva se un centro lo richiede esplicitamente come requisito operativo.

**LEGAL REVIEW REQUIRED**: la questione di *chi* può legalmente autorizzare il ritiro di un minore (è un genitore/tutore che delega, non TRAMA che "certifica" nulla), la responsabilità in caso di consegna a persona non autorizzata, e la retention di eventuali documenti caricati — tutti punti che richiedono parere legale prima di qualunque implementazione, non solo tecnico.

---

## 14. Smart Departure

**Stato reale**: **zero infrastruttura reale**. Trovato un precedente diretto ed esplicito: `lib/nextgen/planner-map-estimate.ts` calcola oggi una distanza/tempo **completamente finto** (hash deterministico dell'id attività, sempre etichettato "stimato", mai usato per calcoli reali) — scelta deliberata di Fabrizio ("la configuriamo dopo, inserisci un dato stubbato"). Gli indirizzi salvati (`parent_addresses`, 4 slot fissi Casa/Lavoro1/Lavoro2/Altro) sono **testo libero senza coordinate**, zero geocodifica. `travel_reminders` (già in produzione) usa un orario **impostato manualmente dal genitore**, esplicitamente non calcolato, per lo stesso motivo (nessuna API instradamento configurata).

Questo significa che Smart Departure reale richiede, in ordine: (1) geocodifica degli indirizzi esistenti (prerequisito tecnico non ancora fatto), poi (2) un provider di traffico/ETA.

| Provider | Free tier | Costo dopo free tier (indicativo, verificato via ricerca web 09/2026) | Note |
|---|---|---|---|
| Google Maps Platform (Routes API + Geocoding) | Geocoding: 10.000 eventi/mese gratuiti (SKU Essentials). Routes API traffic-aware: 5.000 eventi/mese gratuiti (SKU Pro) | $2-7 per 1.000 richieste oltre free tier (Essentials); Pro (routing con traffico) più caro | Il più completo/affidabile per l'Italia, ma il più caro a scala; piani a pacchetto da $100-1.200/mese per volumi maggiori |
| Mapbox | Free tier tipicamente generoso per Directions/Matrix (ordine di grandezza 100k richieste/mese, **verificare a parte, non confermato in questa ricerca**) | Storicamente più economico di Google a parità di volume | Alternativa valida, copertura Italia buona ma da validare qualità dati locali |
| HERE | Free tier esistente, ordini di grandezza simili a Mapbox | Piani a consumo | Meno diffuso nell'ecosistema Next.js/JS rispetto ai primi due |
| Apple Maps (MapKit JS) | Gratuito entro quote generose | — | Solo se serve integrazione nativa iOS in futuro; poco senso come provider server-side oggi |

**Logica raccomandata**: `recommended_departure_time = event_time - live_travel_time - personal_buffer`, calcolata **on-demand** (quando l'utente apre la card, o al massimo con un refresh periodico non troppo frequente — mai a ogni minuto), con **caching aggressivo** per centro+orario (il tragitto casa→stesso centro non cambia ogni minuto, il traffico stimato può essere cachato per finestre di 10-15 minuti senza perdita di utilità reale) per contenere sia costi che rate limit.

**Rate limit/costi**: con caching per centro+fascia oraria, il volume reale di chiamate API scala con "numero di centri distinti × fasce orarie", non con "numero di famiglie" — un dettaglio che rende il costo molto più contenuto di quanto sembri a prima vista, ma va validato con numeri reali di adozione.

---

## 15. Location Strategy

Come richiesto, **non si assume tracking continuo**. Percorso a livelli, valutato per superficie:

| Livello | Cosa | Web/PWA | Android (via browser) | iOS (via browser) | App nativa futura |
|---|---|---|---|---|---|
| V1 — origine abituale (Casa/Ufficio) | Nessuna API di localizzazione, solo l'indirizzo già salvato (`parent_addresses`, esistente) | **Facile** — zero permessi, già tecnicamente pronto (manca solo la geocodifica, §14) | Facile | Facile | Facile |
| V2 — "Usa la mia posizione per questo viaggio" | `navigator.geolocation.getCurrentPosition()`, on-demand, un singolo permesso puntuale | **Facile, standard PWA** | Facile, prompt nativo del browser | Facile, stesso prompt | Facile |
| V3 — posizione corrente autorizzata (persistente per sessione) | Stesso permesso ma "ricordato" per la sessione | **Possibile con limiti** — il permesso browser è per-origine, non per "sessione TRAMA"; l'utente può revocarlo in ogni momento dalle impostazioni del browser senza che l'app lo sappia finché non riprova | Possibile con gli stessi limiti | Possibile con gli stessi limiti, **Safari iOS è storicamente più restrittivo** su quanto a lungo un permesso resta valido senza nuova interazione utente | Più affidabile (permessi di sistema, non per-tab) |
| V4 — background location | Tracking anche ad app chiusa/minimizzata | **Non consigliato / inaffidabile in PWA** — non esiste un vero "background geolocation" affidabile per PWA su iOS (Safari non lo supporta in pratica fuori da un'app nativa); su Android è tecnicamente più permissivo ma comunque fragile per una PWA (il browser può sospendere il service worker) | Inaffidabile | **Non disponibile in pratica** | Unico livello dove background location è realmente affidabile — richiederebbe un'app nativa vera (Capacitor/React Native o equivalente), fuori scope PWA |

**Battery/permessi/privacy**: V1/V2 hanno impatto batteria trascurabile (un fix puntuale, non polling continuo). V3 ha un impatto medio se implementato con polling periodico invece che on-demand. V4 è l'unico con impatto batteria reale, ed è anche l'unico che richiede un vero consenso "always allow" — la combinazione battery+privacy+inaffidabilità PWA lo rende **sconsigliato** per questo prodotto, almeno finché non esiste un'app nativa.

**Raccomandazione**: V1 come default (zero permessi, già quasi pronto), V2 come miglioramento opt-in esplicito ("Usa la mia posizione per questo viaggio", un bottone, un permesso puntuale, mai automatico). V3/V4 fuori scope per la PWA attuale.

---

## 16. Caregiver Without App

Nessuna integrazione WhatsApp/SMS esiste oggi (confermato via ricerca nel codice: l'unico riferimento storico a WhatsApp è un commento che descrive un approccio *abbandonato* — "generiamo un'immagine riepilogo invece che testo per WhatsApp" — sostituito da un semplice share di immagine, non da un'integrazione API).

| Canale | Meccanismo | Costo | Privacy/sicurezza | Scadenza/revoca | Raccomandazione |
|---|---|---|---|---|---|
| WhatsApp deep-link (`wa.me/?text=...`) | Apre WhatsApp con un messaggio pre-compilato (incluso un link al pickup pass) — **nessuna API a pagamento, lato client puro** | **Zero costo** | Il link condiviso è pubblico per chiunque lo riceva/inoltri — va protetto con token a scadenza breve, non con l'assunzione che "solo chi doveva riceverlo lo apre" | Gestita interamente lato TRAMA (il link scade, non WhatsApp) | **Raccomandato per il Beta** — riusa esattamente il pattern di share già presente nel codice (solo cambia il contenuto condiviso) |
| WhatsApp Business API (Twilio o Meta diretto) | Invio automatico (non richiede che il genitore prema "condividi") | Costo per conversazione/messaggio, tipicamente da pochi centesimi a poche decine di centesimi per conversazione a seconda del paese/categoria (**verificare prezzi aggiornati specifici Italia prima di ogni decisione di budget, non confermato in dettaglio in questa ricerca**) | Richiede approvazione template messaggi da Meta, gestione opt-in esplicito del destinatario | Gestibile lato provider | Solo se il deep-link manuale si rivela insufficiente in adozione reale |
| SMS (Twilio o simile) | Invio diretto, funziona ovunque anche senza WhatsApp | Costo per SMS, tipicamente centesimi per messaggio in Italia (**verificare prezzo aggiornato**) | Nessun requisito di approvazione template, ma nessuna funzionalità ricca (solo testo) | Gestibile lato provider | Fallback se il caregiver non usa WhatsApp |
| Email | Link nel corpo email | **Già disponibile** (Resend, `RESEND_API_KEY`, già in uso in produzione per altre notifiche) | Standard | Gestibile lato TRAMA | Buon secondo canale, zero nuovo provider |
| Link web temporaneo (token) | Pagina pubblica-per-token, mostra bambino/centro/indirizzo/orario/navigazione | **Zero costo aggiuntivo** oltre l'hosting esistente | Stesso principio del token già proposto per il feed ICS (§12) e per il pickup pass (§13) — **stesso meccanismo riusato in 3 punti diversi**, buon segno di coerenza architetturale | Scadenza breve (finestra del ritiro + margine), revocabile lato TRAMA in ogni momento | **Base di tutti gli altri canali** — WhatsApp/SMS/email sono solo il "trasporto" del link, non alternative fra loro |

**Raccomandazione**: costruire **un solo** meccanismo di link temporaneo verificabile (token opaco, scadenza breve, contenuto minimo necessario — bambino, centro, indirizzo, orario, eventuale pickup pass), e distribuirlo inizialmente solo via **deep-link WhatsApp manuale + email** (zero provider nuovo, zero costo). L'automazione via Business API/SMS è un'ottimizzazione successiva, non un prerequisito.

---

## 17. Smart Handover

Nessuna infrastruttura dedicata esiste oggi, ma i pezzi riusabili ci sono già: `family_people`/deleghe (§13, una volta costruite) per "chi è disponibile/autorizzato", push notification (`lib/push/send.ts`, già in produzione) per notificare il nuovo responsabile, `week_responsibilities` per aggiornare il Planner.

- **UX**: proposta assistiva ("Marco rischia di arrivare tardi. Vuoi chiedere a Nonna?"), mai un cambio automatico non richiesto — coerente con il tono "assistivo, mai prescrittivo" già usato per School Calendar.
- **Business rules**: il nuovo responsabile deve essere (a) nella lista `family_people`/deleghe della famiglia, (b) se il pickup richiede autorizzazione formale (§13), avere una delega valida per quel bambino/giorno — altrimenti l'handover propone solo persone "Chi fa cosa" generiche, non autorizzate al ritiro fisico, e la UI deve essere onesta su questa distinzione.
- **Consenso**: il nuovo responsabile deve confermare esplicitamente (push con azione "Accetto"/"Non posso"), mai un trasferimento silenzioso — stesso pattern già visto per le proposte di prenotazione Partner→genitore (`partner_proposed_at`/risposta esplicita).
- **Audit**: ogni trasferimento va loggato (chi, quando, da chi a chi) — riusa il pattern `product_events` già esistente per telemetria aggregata, non-PII.
- **Race condition**: due notifiche di handover in parallelo per lo stesso bambino/giorno (es. Marco propone Nonna, contemporaneamente il sistema propone anche Papà) — serve un lock applicativo semplice (un solo handover "in proposta" attivo per bambino+giorno alla volta, il secondo tentativo viene bloccato con un messaggio chiaro, non silenziosamente sovrascritto).

---

## 18. Delay Notification to Center

| Modello | Come funziona | Automazione | Rischio |
|---|---|---|---|
| **A — Assisted** | TRAMA rileva/stima il ritardo, propone "Vuoi avvisare il centro?", il genitore preme un bottone | Nessuna — ogni invio è un'azione umana esplicita | Minimo — nessun falso allarme automatico possibile |
| **B — Semi-automatic** | "Se il ritardo previsto supera 10 minuti, chiedimi conferma" — un passo di conferma resta, ma proattivo (TRAMA chiede, non aspetta che il genitore se ne accorga) | Parziale | Medio — richiede una stima di ritardo affidabile (dipende da Smart Departure, §14, che oggi non esiste ancora realmente) |
| **C — Automatic opt-in** | Il genitore attiva a monte "avvisa sempre se il ritardo supera X minuti" | Piena, nessuna conferma per singolo evento | Più alto — un falso positivo (stima ETA sbagliata) genera un avviso falso al centro, con impatto su fiducia/operatività del centro stesso |

**Raccomandazione**: **Modello A per primo**, senza eccezioni — è l'unico che non richiede una stima di ritardo affidabile (che a sua volta dipende da Smart Departure/traffico reale, non ancora costruito) e che non rischia di "gridare al lupo" con un centro reale. B e C diventano ragionevoli solo *dopo* che Smart Departure ha dati reali e non stub.

**Notifica Partner proposta** (coerente con quanto richiesto): nome bambino, responsabile, orario di arrivo previsto, ritardo stimato — **mai** posizione GPS precisa, percorso, o altre informazioni non necessarie. Riusa `lib/push/send.ts` esistente, stesso pattern deepLink già in uso per le notifiche Partner (`/center/attendance`, coerente con `notifications-partner.ts` esistente).

**Caso responsabile cambia dopo l'invio**: se un avviso è già stato mandato al centro e nel frattempo scatta un handover (§17), l'avviso precedente deve **aggiornarsi o essere esplicitamente ritirato** ("Marco non arriva più in ritardo, ora arriva Nonna in orario") — altrimenti il centro resta con un'informazione stale, peggio che non avere l'informazione affatto. Questo richiede che ogni "avviso di ritardo" sia un record con stato (non un semplice fire-and-forget), coerente col pattern già visto altrove nel progetto (stati espliciti, mai solo eventi persi).

---

## 19. Modello Unificato — Family Operating Layer

**Sì, queste capability costituiscono un sistema unico**, ma **non tutte allo stesso livello di accoppiamento**. La catena richiesta è corretta come sequenza di dipendenze *logiche*, ma tecnicamente si divide in due gruppi con caratteristiche molto diverse:

**Gruppo 1 — "Cosa deve essere organizzato" (dati, quasi tutto server-side, rischio contenuto)**: Calendario scolastico → Periodi da organizzare → Attività TRAMA + esterne → Family Planner → Chi fa cosa. Queste 5 capability condividono davvero un solo modello dati (il Planner aggregato) e vanno pensate, testate e rilasciate come un blocco coeso — è la stessa `computeWeekStatus` estesa progressivamente.

**Gruppo 2 — "Come si esegue nel mondo reale" (integrazioni esterne, privacy/costo alti, rischio più alto)**: Delega/Autorizzazione → Calendario personale → Smart Departure → Traffico/ETA → Handover → Avviso ritardo. Queste condividono infrastruttura trasversale (token temporanei, push, provider esterni) ma sono **funzionalmente indipendenti fra loro** — si può avere Smart Departure senza Handover, si può avere Delega senza Smart Departure. Vanno progettate con un modello dati coerente (stesso concetto di "persona"/"delega" riusato ovunque, non reinventato capability per capability) ma **rilasciate una alla volta**, ognuna dietro il proprio feature flag, con un proprio criterio di successo misurabile prima di passare alla successiva.

In sintesi: **un solo Family Operating Layer concettuale, due velocità di rilascio molto diverse**. Trattarle come 8 feature isolate perderebbe la coerenza del modello dati; trattarle come un unico rilascio monolitico sarebbe un rischio ingiustificato dato quanto sono diverse in complessità e dipendenze esterne.

---

## 20. Data Model Impact

| Entità | Stato | Note |
|---|---|---|
| `school_calendars`, `school_calendar_events`, `kid_school_profiles`, `school_calendar_overrides` | **REUSE** (schema già applicato, 0 righe) | Manca solo popolamento + codice applicativo |
| `external_planner_items` | **NEW** | Owner `parent_id`, mai dentro `bookings` (§11) |
| `computeWeekStatus` (`lib/nextgen/planner-insights.ts`) | **EXTEND** | Deve accettare fonti multiple di copertura |
| `calendar_connections`, `calendar_sync_items` (per Livelli 3+) | **NEW** | Solo se si supera il Livello 2 (§12); per il Livello 1-2 non servono nuove tabelle, solo un token per utente |
| `authorized_people`, `pickup_authorizations` | **NEW** | Deliberatamente separate da `family_people` (§13) |
| `identity_verification`/documenti equivalenti | **NEW, probabilmente evitabile** | Solo se si sceglie l'opzione "documento caricato" invece di QR/link (sconsigliata come primo passo, §13) |
| `family_people`, `week_responsibilities` | **REUSE** | Base per "chi fa cosa", non per autorizzazione |
| `families`, `family_members` | **REUSE con cautela** | Modello più vicino a "gruppo autorizzato" ma oggi isolato da bambini/prenotazioni — estenderlo è un cambio di scope, non un dettaglio |
| `parent_addresses` | **EXTEND** | Serve aggiungere coordinate (lat/lng) per abilitare Smart Departure — oggi solo testo libero |
| `travel_preferences`, `travel_context` | **NEW** (probabilmente estensione di `travel_reminders` esistente, non tabelle separate) | `travel_reminders` già copre "un orario di partenza per genitore" — estenderla con `personal_buffer`/collegamento a un'attività specifica è più naturale che duplicare il concetto |
| `departure_alerts` | **NEW** | Stato del singolo consiglio di partenza calcolato, se si vuole storicizzarlo (non solo mostrarlo live) |
| `delay_notifications` | **NEW** | Con stato esplicito (inviato/aggiornato/ritirato), vedi §18 |
| `push_subscriptions`, `lib/push/send.ts`, `public/sw.js` | **REUSE** | Infrastruttura già pronta per handover/delay notification |
| `lib/ics.ts` | **EXTEND** | Da singolo evento booking a generatore generico Planner |
| `feature_flag_overrides` + registry | **REUSE** | Meccanismo di rollout già pronto per ogni nuova capability |

---

## 21. External Provider Matrix

| Capability | Provider possibile | Free tier | Costo iniziale | Costo a scala | Lock-in | Privacy | Complessità | Raccomandazione |
|---|---|---|---|---|---|---|---|---|
| Traffico/ETA | Google Maps Platform (Routes+Geocoding) | 5-10k eventi/mese a seconda della SKU | Basso (pay-as-you-go) | Medio-alto oltre free tier ($2-7/1k) | Medio (API proprietaria, ma migrabile) | Dati posizione trattati da terzi | Media | Valido, verificare volumi attesi prima di impegnarsi |
| Traffico/ETA (alternativa) | Mapbox | Storicamente generoso (verificare cifre aggiornate) | Basso | Tendenzialmente inferiore a Google a parità di volume | Medio | Stesse considerazioni | Media | Da valutare in parallelo a Google prima della scelta finale |
| Calendar sync | Google Calendar API | Gratuito per uso standard (quote generose) | Zero | Zero salvo abuso quote | Basso (standard OAuth) | Alta — accesso a calendario personale intero | Alta (OAuth completo) | Solo Livello 3+ (§12) |
| Caregiver senza app | WhatsApp deep-link (`wa.me`) | Illimitato, gratuito | Zero | Zero | Nessuno | Bassa (nessun dato lato provider, solo client) | Bassa | **Raccomandato primo passo** |
| Caregiver senza app | WhatsApp Business API / Twilio | Variabile per provider | Basso | Per conversazione/messaggio (verificare tariffe Italia aggiornate) | Alto (integrazione provider-specifica) | Media | Media-alta | Solo se il deep-link risulta insufficiente |
| Caregiver senza app | SMS (Twilio o simile) | Nessuno tipicamente | Basso | Per SMS (centesimi, verificare) | Medio | Media | Bassa-media | Fallback |
| Identity/pickup verification | Nessun provider terzo necessario per QR/link (§13) | — | Zero | Zero | Nessuno | Bassa (nessun documento gestito) | Bassa | **Raccomandato** |
| Identity/pickup verification | Provider KYC terzo (se si sceglie il percorso documento) | Variabile | Medio-alto | Per verifica | Alto | Alta | Alta | Sconsigliato come primo passo |
| School calendar source | Nessun provider — import manuale Admin | — | Zero (costo umano, non tecnico) | Zero | Nessuno | Bassa (dato pubblico) | Bassa | **Confermato, già la scelta del design doc esistente** |

---

## 22. Privacy/Security Review

| Dato | Necessità | Base funzionale | Minimizzazione | Retention | Accesso | Audit | Cifratura | Parere legale |
|---|---|---|---|---|---|---|---|---|
| Posizione (V2, on-demand) | Solo per calcolare ETA al momento della richiesta | Esecuzione del servizio richiesto dall'utente | Mai persistita oltre il calcolo immediato (raccomandato: non salvare mai lat/lng puntuali in una tabella) | Nessuna (effimera) | Solo il calcolo server-side, mai esposta al Partner (§14/18) | Non necessario se mai persistita | N/A se non persistita | **LEGAL REVIEW REQUIRED** se in futuro si valutasse di persistere anche solo aggregati |
| Calendario personale (Livello 3+) | Solo se l'utente attiva esplicitamente la sync | Consenso esplicito OAuth | Solo i campi necessari (data/ora/titolo evento TRAMA), mai leggere l'intero calendario per scriverci sopra se evitabile | Token finché l'utente non revoca | Solo server-side, mai esposto ad altri utenti/Partner | Sì (log di connessione/disconnessione) | Token cifrati at-rest (standard Supabase, verificare configurazione) | **LEGAL REVIEW REQUIRED** — accesso a dati personali extra-TRAMA |
| Dati minori (bambino coinvolto in delega/pickup) | Nome, non altro, per il pickup pass | Necessità operativa del ritiro | Mai includere data di nascita/altri dati sensibili nel link/QR condiviso | Scadenza breve del token (§13/16) | Solo chi riceve il link legittimo (rischio: link inoltrato — mitigare con scadenza breve, non con l'assunzione di riservatezza) | Sì, ogni generazione/uso loggato | Token opaco, non un ID prevedibile | **LEGAL REVIEW REQUIRED** — trattamento dati minori, anche minimo, richiede base giuridica esplicita (consenso genitoriale già previsto nel `LEGAL_TERMS_GATE` esistente, da verificare se copre anche questo nuovo trattamento) |
| Documenti identità (se si sceglie quel percorso) | Solo se un centro lo richiede esplicitamente | Necessità operativa specifica, non di default | Non applicabile al percorso raccomandato (§13) | Se implementato: retention minima, cancellazione automatica post-verifica | Bucket privato + RLS, pattern già esistente (`migration_15`) | Sì | Storage privato Supabase (verificare se serve cifratura applicativa aggiuntiva oltre a quella di storage) | **LEGAL REVIEW REQUIRED, obbligatorio** — documenti d'identità di terzi (non l'utente stesso) sono categoria particolarmente sensibile |
| Deleghe/autorizzazioni | Chi è autorizzato a ritirare chi | Necessità operativa/sicurezza dei minori | Solo i campi di scoping necessari (bambino, periodo), non narrativa libera non necessaria | Fino a revoca esplicita | Genitore che delega + Partner che verifica, mai altri genitori | Sì, ogni delega/revoca | Standard RLS | **LEGAL REVIEW REQUIRED** — chi ha titolo legale per delegare (un genitore può sempre farlo? serve consenso dell'altro genitore in famiglie separate?) è una domanda legale, non tecnica |
| Informazioni caregiver (nome, contatto) | Necessaria per identificarlo al centro | Necessità operativa | Solo nome + eventuale contatto, mai altro | Fino a revoca delega | Genitore + Partner coinvolto | Sì | Standard RLS | Basso rischio se il caregiver non è mai obbligato a creare un account/fornire documenti (§13) |
| Comunicazioni Partner (avviso ritardo) | Orario/ritardo stimato, mai posizione precisa | Necessità operativa (§18) | Già minimizzato per disegno (§18) | Effimero, aggiornabile/ritirabile | Solo il Partner del centro coinvolto | Sì (già pattern esistente, `product_events`) | Standard | Rischio contenuto se la minimizzazione (§18) è rispettata rigorosamente in implementazione |

---

## 23. Development Estimate by Capability

Nessuna falsa precisione: range ampi, non singoli numeri.

### 1. School Calendar Intelligence
- **Complexity**: M
- Backend/data model: **0 giorni** (schema già applicato) — solo verifica post-hoc
- Frontend (badge Planner + override UI): 4-7 giorni
- Data population (1-2 regioni pilota, processo Admin): 2-4 giorni
- Testing: 2-3 giorni
- DevOps: 0 (nessuna nuova infra)
- Privacy/security: 0-1 giorni (già disegnato)
- **Totale**: **8-15 giorni**
- Dependencies: nessuna esterna. Risks: contenuto reale dei calendari (accuratezza dato pubblico, non tecnico). Unknowns: quante regioni servono davvero per il Beta.

### 2. External Activities
- **Complexity**: M
- Backend/data model (`external_planner_items` + RLS): 3-5 giorni
- Estensione `computeWeekStatus`: 3-5 giorni (delicato, tocca logica centrale del Planner)
- Frontend (form "+ Aggiungi", card Planner): 5-8 giorni
- Testing (incluso non-regressione su copertura esistente): 4-6 giorni
- DevOps: 0
- Privacy/security: 1 giorno
- **Totale**: **16-25 giorni**
- Dependencies: nessuna. Risks: **il più alto rischio di regressione del gruppo 1** — tocca la logica di copertura usata ovunque nel Planner. Unknowns: comportamento con dati storici già coperti da booking reali.

### 3. Personal Calendar Sync — Livello 1-2
- **Complexity**: S (Livello 1) / M (Livello 2)
- Livello 1 (estendere `.ics` esistente): 2-4 giorni
- Livello 2 (feed sottoscrivibile + token): 6-10 giorni
- Testing: 2-4 giorni
- DevOps: 1 giorno (nuova route pubblica-per-token)
- Privacy/security: 1-2 giorni (gestione token/revoca)
- **Totale Livello 1+2**: **12-21 giorni**
- Livello 3 (Google/Outlook OAuth), separato: **20-35 giorni** aggiuntivi — solo se richiesto dopo validazione di 1-2.
- Dependencies: nessuna per 1-2. Risks: bassi. Unknowns: adozione reale (vale la pena costruire il Livello 2 se pochi utenti lo useranno?).

### 4. Delegations (QR/link, percorso raccomandato)
- **Complexity**: M/L
- Backend/data model (`authorized_people`, `pickup_authorizations`): 5-8 giorni
- Generazione/verifica QR o link temporaneo: 4-6 giorni
- Frontend (gestione deleghe genitore + vista Partner verifica): 6-10 giorni
- Testing: 4-6 giorni
- DevOps: 1-2 giorni
- Privacy/security: 3-5 giorni (incluso tempo per revisione legale, non solo tecnico)
- **Totale**: **23-37 giorni**
- Dependencies: **LEGAL REVIEW** (§22) prima di iniziare il frontend. Risks: modello di autorizzazione sbagliato è costoso da correggere dopo (dati reali coinvolti). Unknowns: se un centro richiederà comunque documento d'identità come requisito proprio (fuori dal controllo TRAMA).

### 5. Smart Departure
- **Complexity**: L
- Prerequisito: geocodifica `parent_addresses` (EXTEND): 3-5 giorni
- Backend (integrazione provider traffico + caching): 6-10 giorni
- Frontend (card "parti entro le..."): 3-5 giorni
- Testing: 3-5 giorni
- DevOps (secrets, monitoraggio costi API): 2-3 giorni
- Privacy/security: 2-3 giorni
- **Totale**: **19-31 giorni**
- Dependencies: scelta provider (§21), account/fatturazione attivata. Risks: costo a scala non ancora validato con numeri reali di adozione. Unknowns: qualità/copertura del provider scelto per indirizzi italiani periferici.

### 6. Location Strategy (V1-V2)
- **Complexity**: S
- V1 (nessuna nuova API, solo UI su indirizzi esistenti): 1-2 giorni
- V2 (permesso geolocalizzazione on-demand): 3-5 giorni
- Testing (incluso comportamento permessi negati): 2-3 giorni
- DevOps: 0
- Privacy/security: 1-2 giorni
- **Totale**: **7-12 giorni**
- Dependencies: nessuna. Risks: bassi. Unknowns: comportamento reale dei permessi su iOS Safari (va validato su device reale, non solo in teoria).

### 7. Smart Handover
- **Complexity**: M
- Backend (logica proposta + lock race condition): 5-8 giorni
- Frontend (UX proposta/conferma): 4-6 giorni
- Push notification (riuso infra esistente): 1-2 giorni
- Testing: 3-5 giorni
- DevOps: 0
- Privacy/security: 1 giorno
- **Totale**: **14-22 giorni**
- Dependencies: **Delegations** (§13) se si vuole distinguere "chi fa cosa" da "chi è autorizzato al ritiro fisico". Risks: race condition reali con più notifiche in parallelo. Unknowns: quanto spesso serve davvero nella pratica (rischio over-engineering se raro).

### 8. Caregiver Without App
- **Complexity**: S/M
- Backend (token temporaneo + pagina pubblica-per-token): 5-8 giorni
- Frontend (pagina caregiver + generazione link/QR lato genitore): 4-6 giorni
- Testing: 2-4 giorni
- DevOps: 1 giorno
- Privacy/security: 2-3 giorni
- **Totale**: **14-22 giorni**
- Dependencies: **Delegations** (riusa lo stesso meccanismo token). Risks: bassi se limitato a deep-link/email (no provider a pagamento). Unknowns: nessuno rilevante.

### 9. Delay Notification to Center (Modello A)
- **Complexity**: S
- Backend (record stato avviso + invio): 3-5 giorni
- Frontend (CTA "Avvisa il centro" + vista Partner): 3-5 giorni
- Testing: 2-3 giorni
- DevOps: 0
- Privacy/security: 1 giorno
- **Totale**: **9-14 giorni**
- Dependencies: **Smart Departure** per un ETA affidabile (altrimenti il "ritardo stimato" mostrato al genitore è poco utile) — tecnicamente costruibile prima ma di scarso valore reale senza. Risks: bassi (Modello A, nessuna automazione rischiosa). Unknowns: nessuno rilevante.

---

## 24. Total Estimate by Phase

| Phase | Capability incluse | Estimate (giorni-persona) |
|---|---|---|
| **Phase 0** — Evolution Lab infrastructure | Vercel Staging, Supabase Branching/2° progetto, `deploy-staging.sh`, branch `evolution`, env var matrix | **8-15 giorni** (vedi §26) |
| **Phase 1** — Planner independence | School Calendar (8-15) + External Activities (16-25) + ICS Livello 1-2 (12-21) | **36-61 giorni** |
| **Phase 2** — Operational identity | Delegations (23-37) | **23-37 giorni** |
| **Phase 3** — Calendar integration | Personal Calendar Livello 3 (Google/Outlook, se confermato dopo Phase 1) | **20-35 giorni** |
| **Phase 4** — Smart mobility | Smart Departure (19-31) + Location V1-V2 (7-12) | **26-43 giorni** |
| **Phase 5** — Proactive coordination | Smart Handover (14-22) + Caregiver Without App (14-22) + Delay Notification (9-14) | **37-58 giorni** |
| **Phase 6** — Native/background | Solo se validato — non stimato (dipende da decisioni non ancora prese, vedi §15) | Non stimabile ora |

**Totale Phase 0-5 (senza Phase 3 Google/Outlook, senza Phase 6)**: **~152-244 giorni-persona** — un range ampio di proposito, coerente con l'istruzione di non fare falsa precisione.

---

## 25. Recommended Sequencing

La sequenza proposta da Fabrizio (Phase 0→6 come da spec) **viene confermata con una modifica**: **Phase 3 (Google/Outlook Calendar) va resa esplicitamente condizionale**, non un passo fisso — va costruita solo se il Livello 1-2 (già dentro Phase 1) mostra adozione reale che giustifica il salto di complessità/rischio OAuth. Inserirla come "Phase 3 fissa" rischia di costruire una capability costosa (20-35 giorni) senza validazione preventiva.

Tutto il resto della sequenza è confermato: è coerente con le dipendenze tecniche reali trovate nel codice (Delegations prima di Handover/Caregiver-without-app, che la riusano; Smart Departure prima di Delay Notification, che ne ha bisogno per essere utile).

---

## 26. Minimum Valuable Evolution

L'ipotesi di Fabrizio (città/scuola → calendario scolastico, Planner generato, attività esterne, ICS export, deleghe semplici, poi Smart Departure) **è il taglio corretto**, con una precisazione: **le "deleghe semplici" andrebbero scorporate dall'MVE** e trattate come primo item della Phase 2 separata, non dentro l'MVE stesso — motivo: Delegations è l'unica capability nell'MVE proposto che richiede **LEGAL REVIEW** prima ancora di iniziare (§13/§22), e mescolarla con capability puramente tecniche (calendario scolastico, attività esterne, ICS) rischia di far slittare l'intero MVE in attesa di un parere legale che riguarda solo una sua parte.

**MVE raccomandato**: School Calendar Intelligence (§10) + External Activities (§11) + Personal Calendar Livello 1-2 (§12). Le prime due condividono lo stesso punto di integrazione tecnico (`computeWeekStatus`), quindi ha senso costruirle in sequenza ravvicinata; ICS Livello 1-2 è quasi indipendente e a basso rischio, buon "quick win" percepibile da Fabrizio/Beta cohort mentre le altre due sono in corso.

**ESTIMATED MVE EFFORT**: **36-61 giorni-persona** (somma di §23.1, §23.2, §23.3 — coincide con Phase 1 di §24).

Deleghe semplici seguono immediatamente dopo (Phase 2, 23-37 giorni), non prima.

---

## 27. Risks / Unknowns

- **Rischio tecnico più grande**: l'estensione di `computeWeekStatus` per le attività esterne (§11) — è il punto dove il rischio di regressione sul Planner esistente (già molto stratificato, molte wave di fix successive documentate nella storia commit) è più alto. Va trattato con la stessa disciplina di test già vista nel progetto (non solo test nuovi, ma verifica esplicita di non-regressione sulle settimane già coperte da booking reali).
- **Rischio prodotto più grande**: costruire Smart Departure/Location/Handover (Gruppo 2, §19) **prima** di aver validato che gli utenti Beta usano davvero le funzionalità del Gruppo 1 — il rischio è investire settimane in mobilità intelligente per un prodotto la cui adozione reale della parte "organizzativa" di base non è ancora confermata a questa scala.
- **Rischio privacy più grande**: Delegations, se implementato con documenti d'identità invece del percorso QR/link raccomandato — è l'unica capability dell'intero pacchetto dove un errore di design espone dati di terzi (non solo dell'utente TRAMA) particolarmente sensibili.
- **Unknown non tecnico**: il piano Vercel/Supabase attuali (Hobby/Free vs Pro) non è verificabile da codice/repository — condiziona direttamente quale opzione di Evolution Lab (§3) è realisticamente disponibile subito vs quale richiede prima un upgrade di piano.
- **Unknown di adozione**: nessuno dei dati sulle capability del Gruppo 2 (§19) ha oggi un segnale reale di domanda dagli utenti Beta — le stime di effort sono valide, ma la priorità relativa fra capability andrebbe confermata con feedback reale prima di Phase 4-5, non solo con la logica a priori di questo report.

---

## 28. Decisions Required from Fabrizio

1. Confermare/scartare **Opzione D** (Vercel Staging + Supabase Branching) vs **Opzione B fallback** (secondo progetto Supabase standalone) — dipende dal piano Supabase attuale (Free vs Pro), da verificare.
2. Confermare il piano Vercel attuale (Hobby vs Pro) — condiziona se serve un upgrade prima di Phase 0.
3. Confermare la modifica proposta a Phase 3 (Google/Outlook Calendar reso condizionale, non fisso).
4. Confermare lo scorporo delle Deleghe dall'MVE (§26) in una Phase 2 separata, successiva.
5. Decidere il meccanismo di delega raccomandato (QR/link, §13) vs documento d'identità — **prima** di qualunque lavoro tecnico su Delegations, dato il coinvolgimento legale.
6. Individuare 1-2 regioni pilota per il popolamento reale di School Calendar (già una decisione pendente dal design doc esistente, mai chiusa).
7. Scegliere il provider traffico/ETA per Smart Departure (Google Maps Platform vs Mapbox vs altro) — dopo aver validato volumi/costi attesi con numeri più concreti.
8. Confermare se procedere subito con un **parere legale esterno** (obbligatorio per Delegations, §13/§22) o rimandarlo a ridosso di Phase 2.

---

## 29. Final Recommendation

Costruire l'Evolution Lab (Phase 0) **prima** di toccare qualunque capability prodotto — non è overhead evitabile, è la condizione che rende sicuro tutto il resto, soprattutto capability come Delegations che toccano dati di minori/terzi. Procedere poi con l'MVE (School Calendar + External Activities + ICS Livello 1-2, §26), che è tecnicamente il blocco più pronto (School Calendar ha già lo schema applicato) e a più basso rischio privacy/legale dell'intero programma. Trattare il Gruppo 2 (§19) come un secondo programma distinto, da avviare solo dopo aver validato l'adozione reale del Gruppo 1 e dopo aver chiuso la revisione legale sulle Deleghe.

---

## Tabella riepilogativa

| PHASE | CAPABILITY | ESTIMATE | DEPENDENCY | RISK | RECOMMENDATION |
|---|---|---|---|---|---|
| 0 | Evolution Lab infrastructure | 8-15 gg | Piano Vercel/Supabase da verificare | Basso (solo setup) | GO |
| 1 | School Calendar Intelligence | 8-15 gg | Nessuna | Basso (contenuto dati, non tecnico) | GO |
| 1 | External Activities | 16-25 gg | Nessuna | Medio-alto (regressione Planner) | GO CON ATTENZIONE |
| 1 | Personal Calendar Livello 1-2 | 12-21 gg | Nessuna | Basso | GO |
| 2 | Delegations (QR/link) | 23-37 gg | LEGAL REVIEW | Alto (privacy/legale) | GO SOLO DOPO REVISIONE LEGALE |
| 3 | Personal Calendar Livello 3 (Google/Outlook) | 20-35 gg | Adozione Livello 1-2 validata | Medio | CONDIZIONALE |
| 4 | Smart Departure | 19-31 gg | Geocodifica indirizzi, provider scelto | Medio (costo a scala) | GO CON VALIDAZIONE COSTI |
| 4 | Location V1-V2 | 7-12 gg | Nessuna | Basso | GO |
| 5 | Smart Handover | 14-22 gg | Delegations | Medio | GO DOPO PHASE 2 |
| 5 | Caregiver Without App | 14-22 gg | Delegations | Basso | GO DOPO PHASE 2 |
| 5 | Delay Notification (Modello A) | 9-14 gg | Smart Departure (per valore reale) | Basso | GO DOPO PHASE 4 |
| 6 | Native/background | Non stimato | Tutto il resto validato | Alto | NO-GO PER ORA |

---

**EVOLUTION LAB: GO WITH CONDITIONS** — condizionato a verificare piano Vercel/Supabase attuale prima di scegliere fra Opzione D e B.

**RECOMMENDED ARCHITECTURE**: Vercel Staging Environment (Pro) + Supabase Branching (fallback: secondo progetto Supabase standalone) + branch git `evolution` a vita lunga + `feature/*` effimeri, squash-merge in `evolution`, merge `--no-ff` in `main`.

**ESTIMATED SETUP EFFORT**: 8-15 giorni-persona.

**MINIMUM VALUABLE EVOLUTION**: School Calendar Intelligence + External Activities + Personal Calendar Sync (Livello 1-2).

**ESTIMATED MVE EFFORT**: 36-61 giorni-persona.

**SMART MOBILITY ESTIMATE** (Smart Departure + Location V1-V2 + Delay Notification Modello A): 35-57 giorni-persona.

**BIGGEST TECHNICAL RISK**: estensione di `computeWeekStatus` per far coesistere copertura TRAMA ed esterna senza regressioni sul Planner esistente.

**BIGGEST PRODUCT RISK**: investire nel Gruppo 2 (mobilità/coordinamento proattivo) prima di aver validato l'adozione reale del Gruppo 1 (organizzazione di base).

**BIGGEST PRIVACY RISK**: Delegations implementata con documenti d'identità di terzi invece del percorso QR/link a basso rischio raccomandato in questo report.

---

*Fine report. Nessuna azione eseguita oltre a lettura di repository/configurazione e query di sola lettura su Supabase. In attesa delle decisioni elencate al §28.*
