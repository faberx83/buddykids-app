# Iniziativa — Admin Beta Cockpit

**Chat:** TRAMA ADMIN · **Aperta il:** 20/10/2026 · **Ultimo aggiornamento:** 20/10/2026 sera
**Stato:** sviluppo concluso, in attesa di deploy e migration 46 (ramo `claude/admin-beta-cockpit`)

## Obiettivo
Uno strumento operativo, leggibile in 5 minuti, per capire durante la beta del 20/11 chi è entrato, chi si è attivato, chi è tornato, dove si è fermato, cosa usa, quali frizioni emergono e quali centri ricorrono tra più famiglie. Una riga per **famiglia**, non per utente. Solo dati first-party.

## Perimetro
- Dentro: Overview, Famiglie (+ dettaglio), Funnel, Utilizzo, Frizioni, Centri/domanda, Feedback, Survey, Report navigabile con periodo e frequenza, Decision log.
- Fuori: analytics di terze parti, tracciamento click, punteggi predittivi, AI, CRM centri, nuove funzioni famiglia oltre alla survey.

---

## Pre-apply review (20/10/2026)

Analisi in sola lettura di codice (`main` @ `34cc06c`) e database di produzione. Nessuna scrittura.

### Premessa sui dati di oggi
- Account: 8 genitori, 2 gestori, 1 admin. Tutti del founder o di persone vicine.
- Coorte beta `trama-one-controlled-beta`: 10 membri; `internal-preview`: 2.
- Codice invito: uno solo (`Beta test amici`, 3 utilizzi, scade il 01/12).
- Lista d'attesa: 0. Feedback: 59.
- Il cockpit sarà quasi vuoto fino alla prova generale (28/10) e vero solo dal 18–20/11. Gli account del founder vanno esclusi dai conteggi (vedi D5).

### A. Cosa esiste già

| Area | Cosa esiste | Dati reali/mock | Riutilizzabile? | Limiti |
|---|---|---|---|---|
| Admin, struttura | `app/admin/layout.tsx` (nav, controllo ruolo), `DashboardLayout` variante admin | Reale | **REUSE** (nuova voce di menu) | Il controllo nel layout è lato client: ogni lettura deve rifare il controllo `platform_admin` lato server (come fa già `lib/data/pilot-users.ts`) |
| Admin → Dashboard (`/admin`) | KPI e grafico occupazione | **Mock** (banner "dati di esempio") | No | Da non confondere col cockpit |
| Admin → Analisi (`/admin/analytics`) | Grafici occupazione/tag/età/cross-selling + tabella attività gestori | **Mock**, tranne la tabella gestori (`activity_log`) | No | `lib/analytics.ts` lavora su `mock-data` |
| Admin → TRAMA ONE (`/admin/one`) | Command Center: code operative prioritarie + funnel walkthrough | Reale | **REUSE** per gli alert (stesso schema di priorità) | Funnel del walkthrough `welcome_parent`, non del nuovo onboarding |
| **Admin → Pilota** (`/admin/one/pilot`, `/[id]`) | Una riga per **utente** in coorte: onboarding, prima/ultima azione (solo figli, prenotazioni, gruppi), ultimo login, stato (`lib/pilot/status.ts`), timeline | Reale | **ADAPT**: è il seme del cockpit (stesso controllo admin, letture batched, service client solo dove la RLS non ha bypass admin) | Per utente e non per famiglia; solo 3 tipi di azione; "ritorno" basato su `last_sign_in_at`, che con sessioni lunghe non si aggiorna |
| Inviti beta (`/admin/beta-invites`) | `beta_invite_codes` (codice, etichetta, utilizzi, scadenza); `profiles.beta_invited_by_code` | Reale | **REUSE** (chi è entrato con quale codice) | Con un codice condiviso via WhatsApp non si sa **chi** è stato invitato e non si è registrato |
| Lista d'attesa (`/admin/lista-attesa`) | `beta_waitlist` con stato `nuovo/invitato/archiviato` e `invited_at` | Reale (0 righe) | **ADAPT** per "Famiglie invitate" (vedi D4) | Le righe nascono solo dalla pagina pubblica |
| Coorti beta | `beta_cohort_memberships` | Reale | **REUSE** per definire la popolazione beta | Include gli account del founder |
| Product events | `product_events` + whitelist `lib/telemetry/known-events.ts`, ~50 eventi | Reale (3.966 righe) | **Solo aggregati** (es. aperture Scopri, errori sottoviste Planner, esecuzioni cron) | **Nessun identificativo utente** (scelta di privacy voluta): inutilizzabile per famiglia |
| `activity_log` | Azioni dei gestori (attività, inviti centro, tag) | Reale | No per le famiglie | Solo lato gestori |
| Feedback | `beta_feedback` (categoria idea/problema/manca/altro, stato `nuovo/in_gestione/risolto`, `pipeline_status`, nota admin, contesto client), coda `/admin/segnalazioni-beta`, pulsante in Profilo e riga in Home | Reale (59) | **ADAPT** (non un sistema parallelo) | 3 stati invece di 5; niente tag; `pipeline_status` è già usato dall'automazione `internal/beta-pipeline` e non va riusato per altro |
| Survey | Nessuna. Componenti vicini: pannello feedback (`BetaFeedbackButton`), Novità con voti (`announcement_receipts`, `announcement_votes`) | — | **ADAPT**: risposte in `beta_feedback`, "già vista/più tardi" in `announcement_receipts` | — |
| Feature flag / Release | Registro, catalogo, card Release a livelli | Reale | **REUSE** per accendere la survey alle famiglie | Il cockpit è solo Admin: nessun flag necessario |
| Famiglia | `families` + `family_members` (ruolo creatore/admin/membro), `family_invites` (email), `family_people` (nonni, tata: non sono account) | Reale | **REUSE** per raggruppare gli adulti in famiglie | 37 righe `families` da 3 creatori ma solo 2 con membri: famiglie orfane create più volte (da pulire, non da Claude). Figli, impegni e assegnazioni restano per singolo genitore (`parent_id`) |
| Figli, scuola | `kids`, `kid_school_profiles` (regione, comune, calendario) | Reale | **REUSE** | Nessun nome della scuola: la "zona" è il comune; la classe esiste solo se la famiglia è in un gruppo "Classe e scuola" (`communities`) |
| Onboarding | `tutorial_progress` chiave `family_onboarding_v2` (completed/skipped con data) | Reale | **REUSE** | — |
| Impegni (Planner) | `external_planner_items` (manual / curated_discovery / community_discovery, created/updated/deleted) | Reale (10) | **REUSE** | Gli impegni manuali non hanno un campo "centro": il nome è nel titolo o nel luogo, testo libero |
| Chi accompagna | `week_responsibilities` (giorno, andata/ritorno, chi) | Reale (70) | **REUSE** | Solo `updated_at`: di ogni assegnazione si vede l'ultima modifica, non la storia |
| Condivisione | `plan_shares` (link al piano, creato/revocato) | Reale (86) | **REUSE** | — |
| Salvati | `favorites` (centri Partner), `curated_favorites` (Scoperte TRAMA) | Reale | **REUSE** | Nessun salvataggio senza data |
| Prenotazioni e richieste | `bookings` (stato, decisione del centro, `responded_at`), `activity_inquiries` (aperta/risposta) | Reale (di prova) | **REUSE** | 112 richieste "aperte" storiche di prova |
| Centri suggeriti | `center_leads` (nome suggerito, località, `dedupe_key`, contesto) + `normalizeDedupeKey()` | Reale (25) | **REUSE**, anche la normalizzazione per la densità | — |
| Radar | `discovery_submissions`, `community_discoveries` (organizzatore, comune, `dedupe_key`), `interest_signals` | Reale (quasi vuoto) | **REUSE** | AI simulata |
| Gruppi, Classe e scuola | `groups`, `group_members`, `group_invites`, `communities`, `community_members`, proposte e interessi | Reale | **REUSE** | — |
| Push | `push_subscriptions` (`created_at`, `last_seen_at` aggiornato a ogni invio riuscito), `profiles.notify_push` | Reale (3 utenti) | **REUSE** | — |
| Cron | `vercel.json`: promemoria serali, check-in, buongiorno (due orari per l'ora legale); autenticazione `CRON_SECRET`; email via Resend (`lib/email.ts`) | Reale | **REUSE**: l'eventuale avviso "report pronto" si appoggia al cron del buongiorno | Piano Vercel con cron giornalieri: niente orari a piacere |
| Sessioni (schema `auth`) | `auth.refresh_tokens`: una riga a ogni rinnovo della sessione, conservate da luglio | Reale | **Sì, ma solo con una funzione SQL** (D3) | Lo schema `auth` non è leggibile dall'app senza una funzione dedicata |

### B. Cosa possiamo derivare senza nuovi eventi

| Misura | Fonte |
|---|---|
| Registrazione | `profiles.created_at` (+ codice usato) |
| Onboarding completato | `tutorial_progress` `family_onboarding_v2` completed/skipped |
| Figli inseriti | `kids` |
| Scuola inserita | `kid_school_profiles` |
| Numero impegni | `external_planner_items` non cancellati (+ prenotazioni/richieste non annullate, se si decide di contarle) |
| Attività aggiunte dal discovery | `external_planner_items` con `source_type` curated/community |
| Secondo adulto collegato | `family_members` ≥ 2 nella stessa famiglia |
| Invito all'altro genitore in attesa | `family_invites` pending/sent (solo invito per email; l'invito col codice famiglia non lascia traccia finché non viene usato) |
| Coordinamento usato | `week_responsibilities` (e offerte/richieste carpool) |
| Salvataggi | `favorites`, `curated_favorites` |
| Salvato ma mai collocato | salvataggio senza impegno/prenotazione sullo stesso oggetto |
| Condivisioni | `plan_shares` |
| Richieste ai centri e risposte | `bookings`, `activity_inquiries` (+ tempi di risposta) |
| Gruppi e Classe e scuola | `groups`, `group_members`, `group_invites`, `community_*` |
| Radar | `discovery_submissions`, `community_discoveries` |
| Feedback | `beta_feedback` (+ famiglia tramite `parent_id`) |
| Push attive | `push_subscriptions` |
| Giorni con almeno un'azione significativa | unione delle date di tutte le tabelle sopra (fuso Europe/Rome) |
| Ultima azione significativa, time-to-value, ritorno settimana 1/2 **per azioni** | stesse date |
| Domanda verso i centri | `favorites`/`bookings`/`inquiries` → centro; `curated_favorites` e impegni da Scoperte → dataset curato; `center_leads`; Radar; impegni manuali (titolo/luogo normalizzati, marcati "testo libero") |
| Chiusure scolastiche non organizzate | stessa logica dei promemoria serali (`lib/data/family-reminders.ts`) |
| Errori tecnici | solo aggregati da `product_events` (`planner_subview_error`); nessun legame con la famiglia |

### C. Cosa non possiamo misurare oggi (verificato)

1. **Aperture dell'app senza azioni.** Una famiglia che apre la Home ogni mattina per vedere "Oggi" e chi accompagna, senza modificare nulla, oggi risulta **dormiente**. Per un planner è il comportamento di valore più frequente. `last_sign_in_at` non aiuta (le sessioni durano settimane); `product_events` non ha l'utente. Il dato esiste in `auth.refresh_tokens` (verificato: 4 utenti attivi negli ultimi 14 giorni, da 1 a 8 giorni ciascuno), ma serve una funzione SQL per leggerlo → D3.
2. **Storia delle modifiche.** Di un impegno modificato tre volte, o di un'assegnazione di "chi accompagna" cambiata, si vede solo l'ultima data. I giorni attivi sono quindi un **minimo**, non un conteggio esatto.
3. **Uso "di sola lettura" per area** (Home, Planner, Scopri aperti). Coerente con la richiesta (le page view non sono uso); per Scopri esiste solo un conteggio aggregato di aperture.
4. **Famiglie invitate che non si sono mai registrate**, finché l'invito passa da un codice condiviso. → D4.
5. **Errori tecnici per famiglia**: i log di Vercel non sono collegati agli utenti e oggi durano un'ora (piano gratuito).
6. **Feedback a 5 stati e tag; decision log; impostazioni del report e delle soglie**: non c'è dove salvarli. → D1, D2.

### D. Gap dati

| # | Gap | Perché serve | Evitabile? | Soluzione minima | Migration | Privacy |
|---|---|---|---|---|---|---|
| D1 | Decision log (osservazione, ipotesi, decisione, azione, owner, data) | È il punto del report: trasformare dati in decisioni | No in modo pulito (riusare `beta_feedback` mescolerebbe note del founder e segnalazioni delle famiglie) | Tabella `beta_decisions`, solo admin | Sì | Note del founder, nessun dato delle famiglie |
| D2 | Impostazioni: frequenza/giorno/ora del report, data di inizio beta, soglie, account esclusi, survey accese | "Configurabile da Admin" | Sì, con valori fissi nel codice (cambiarli = un commit) | Una riga in `beta_cockpit_settings`, solo admin | Sì (oppure niente, se si accettano valori nel codice) | Nessuna |
| D3 | Giorni con app aperta | Senza, "Ritorno" e "Dormiente" sottostimano chi legge senza scrivere | Sì, se si accetta di misurare solo le azioni | Funzione `admin_beta_open_days()` in sola lettura su `auth.refresh_tokens`, utilizzabile solo da `platform_admin`; restituisce solo **utente + giorno** | Sì (solo una funzione, nessuna tabella, nessun dato nuovo raccolto) | Granularità giornaliera. Da citare nell'informativa ("dati tecnici di accesso usati per statistiche interne") |
| D4 | Famiglie invitate | "Invitate" e "Data invito" nel funnel | Sì, senza migration | Riusare `beta_waitlist`: azione Admin "Aggiungi invitato" (email + etichetta famiglia, stato `invitato`); la registrazione si collega per email. In alternativa un codice invito per grappolo | No | Email di amici inserite dal founder: solo admin, cancellabili; da citare nell'informativa |
| D5 | Account del founder e di prova nei conteggi | Con 15–20 famiglie, 3 account interni falsano tutto | Sì | Esclusione automatica di `platform_admin`, gestori e coorte `internal-preview` + lista esclusi nelle impostazioni (D2) | No (oppure dentro D2) | — |
| D6 | Feedback: 5 stati e tag | Triage richiesto | Parzialmente: si possono mappare 5 stati sui 3 esistenti e usare `#tag` nella nota admin | Allargare il vincolo degli stati (`da_capire`, `non_ora`) e aggiungere `admin_tags` | Sì (additiva) | Nessuna |
| D7 | Risposte alle survey | Survey 1 e 2 | Sì, senza migration | Righe di `beta_feedback` con `area = survey_1/survey_2`, risposte strutturate nel contesto; "più tardi/già vista" in `announcement_receipts` | No | Testo libero delle famiglie, come per il feedback |
| D8 | Snapshot del report | Navigare i report precedenti | Sì | Report **ricostruito dinamicamente** dall'intervallo; si salvano solo le decisioni (D1). Unica eccezione: lo stato "push attive" e lo stato dei feedback sono quelli di oggi, non della settimana passata | No | — |

### Migration proposta (unica): `migration_46_beta_cockpit.sql`

Approvata per intero il 20/10/2026. Il testo completo, con rollback e post-check, è nel repository: `supabase/migration_46_beta_cockpit.sql` (PREPARATA, NON APPLICATA). Additiva e idempotente, una transazione: tabella `beta_cockpit_settings` (una riga; default settimanale il venerdì alle 9, inizio beta 18/11), tabella `beta_decisions`, due stati in più e `admin_tags` su `beta_feedback`, funzione `admin_beta_open_days()` in sola lettura. Tutto leggibile e scrivibile solo da `platform_admin`.

**Mappa dei 5 stati feedback:** Nuovo = `nuovo` · Da capire = `da_capire` · Da fare = `in_gestione` · Fatto = `risolto` · Non ora = `non_ora`. Le righe esistenti non cambiano; la pagina "Le mie segnalazioni" del genitore mostrerà `da_capire` come "In gestione" e `non_ora` come "Ricevuta".

**Dati raccolti:** nessun dato nuovo sulle famiglie. Le due tabelle contengono solo impostazioni e note del founder; la funzione legge dati di sessione già esistenti e restituisce solo utente e giorno.

**Alternative valutate:** (a) nessuna migration: soglie e frequenza nel codice, 5 stati mappati sui 3 esistenti con `#tag` nella nota, niente decision log nel database (resterebbe in un documento del Project), solo azioni per "ritorno"; (b) solo la funzione D3; (c) tabella eventi per utente (`family_activity_days` scritta a ogni apertura): **scartata**, raccoglierebbe dati nuovi e duplicherebbe ciò che `auth.refresh_tokens` già ha.

**Codice tollerante:** il cockpit funziona anche prima della migration. Senza tabelle usa i valori di default, nasconde il decision log e il triage a 5 stati, e calcola il ritorno solo dalle azioni, dicendolo in pagina.

---

## Definizioni (confermate il 20/10/2026)

**Famiglia.** Gli account genitore della stessa riga `families` tramite `family_members`; un genitore senza famiglia è una famiglia da solo. Nome mostrato: nome della famiglia o iniziali del genitore, mai i nomi dei figli.

**Popolazione beta.** Genitori della coorte `trama-one-controlled-beta`, esclusi `platform_admin`, gestori, coorte `internal-preview` e la lista esclusi.

**Azione significativa.** Figlio aggiunto · scuola impostata · impegno creato o modificato · attività aggiunta al Planner da Scopri/Radar · assegnazione di chi porta/ritira · altro genitore invitato o collegato · persona di aiuto aggiunta · attività salvata · piano condiviso · richiesta o prenotazione a un centro · centro suggerito · scoperta Radar inviata · gruppo creato, invito o adesione · proposta o interesse in Classe e scuola · feedback o survey inviata · notifiche attivate. **Non** lo sono: login, aperture di pagina, cambi di scheda, onboarding visto.

**Stati (soglie configurabili, default):**
- **Non partita:** registrata, nessuna azione significativa.
- **Attivata** (proposta): almeno 1 figlio e almeno 3 impegni reali (impegni nel Planner + richieste/prenotazioni non annullate). La scuola è mostrata a parte e non è obbligatoria, perché il passo si può saltare ("Lo faccio dopo") e il calendario esiste solo per Lombardia/Milano e Puglia/Rutigliano. In alternativa, la definizione del brief (figlio + scuola + 3 impegni).
- **Attiva:** attivata e almeno un'azione significativa negli ultimi 4 giorni.
- **A rischio:** attivata, ultima azione da 4 a 6 giorni fa.
- **Dormiente:** nessuna azione significativa da almeno 7 giorni.
- Con D3 approvata: una famiglia con app aperta ma senza azioni viene mostrata come **"Legge"** accanto allo stato, non promossa ad Attiva.

**Funnel:** Invitata → Registrata → Onboarding completato → Primo impegno → 3 impegni → Secondo adulto **o** coordinamento usato → Ritorno settimana 1 (azione in un giorno diverso dalla registrazione, entro i giorni 1–7) → Ritorno settimana 2 (giorni 8–14). Numeri prima delle percentuali ("7 su 15").

**Demand density.** Chiave = `normalizeDedupeKey(nome, comune)` già usata dai centri suggeriti. Fonti: centri Partner (salvati, richieste, prenotazioni), Scoperte TRAMA (salvate o nel Planner), community/Radar, centri suggeriti, impegni manuali (titolo/luogo, marcati "testo libero"). Evidenza a ≥2, ≥3, ≥5 famiglie distinte.

## Piano di implementazione (dopo l'approvazione)

| Slice | Contenuto | Riuso |
|---|---|---|
| 1 | Overview + "Richiede attenzione" + tabella Famiglie + dettaglio con timeline + Funnel + time-to-value | ADAPT `pilot-users` (controllo admin, letture batched); logica pura in `lib/beta-cockpit/*` |
| 2 | Utilizzo per area, Frizioni, Centri/domanda | REUSE `normalizeDedupeKey`, dataset Scoperte, logica chiusure dei promemoria |
| 3 | Feedback a 5 stati, tag, viste per categoria, collegamento alla famiglia; Survey 1 e 2 in Home dietro flag `BETA_SURVEY_ENABLED` (card Release) | ADAPT `segnalazioni-beta`; risposte in `beta_feedback`; "più tardi" in `announcement_receipts` |
| 4 | Beta → Report: periodo (Oggi…Custom, vs precedente solo da 5 famiglie in su), sintesi deterministica, segnali da guardare, elenco report passati calcolati dalla frequenza, decision log, impostazioni | Cron del buongiorno per l'eventuale email "report pronto" al founder (nessun nuovo scheduler) |

Pagine: `/admin/beta` (Overview, Famiglie, Funnel, Utilizzo, Frizioni, Centri, Feedback in schede) e `/admin/beta/report`. Voce di menu "Beta Famiglie" in cima.

Test (`tests/one/beta-cockpit*.spec.ts`): stato famiglia, attivazione, giorni attivi, azioni significative, funnel, densità centri, intervalli di date e fuso, finestre del report settimanale, filtri, accesso admin (controllo sul sorgente: ogni lettura passa dal controllo `platform_admin`).

## Decisioni prese
| Data | Decisione | Chi | Motivo |
|---|---|---|---|
| 20/10/2026 | Migration 46 approvata per intero (impostazioni, decision log, feedback a 5 stati con tag, giorni con app aperta) | Fabrizio | Cockpit completo come da brief |
| 20/10/2026 | "Attivata" = almeno un figlio + 3 impegni reali; la scuola si mostra a parte | Fabrizio | La scuola si può saltare e il calendario copre solo Milano e Rutigliano |
| 20/10/2026 | Famiglie invitate registrate dalla Lista d'attesa ("+ Famiglia invitata"), collegate per email | Fabrizio | Si vede anche chi non si è mai registrato |
| 20/10/2026 | Attivazione = traguardo con data; stato = situazione attuale (aggiunto "In avvio") | Claude | Evita una famiglia "attivata" e "dormiente" nello stesso campo |

## Stato tecnico
- Cockpit: solo Admin, nessun flag. Survey: `BETA_SURVEY_ENABLED`, release "TRAMA — Survey della beta" (card Release).
- Migration: `supabase/migration_46_beta_cockpit.sql` — PREPARATA, NON APPLICATA (la applica `bash deploy.sh` con `APPLICA`).
- Ramo: `claude/admin-beta-cockpit`.
- Test: `tests/one/beta-cockpit.spec.ts`, 34 test, tutti verdi nel sandbox; nessuna regressione nei test caricabili (stesse 7 failure preesistenti di `main`).

## Aspetta Fabrizio
- [ ] `bash deploy.sh` (porta il ramo su main, controllo tipi completo, migration 46 con `APPLICA`, deploy).
- [ ] Prima del 18/11: escludere dal cockpit i propri account e quelli di prova (dettaglio famiglia → "Escludi dai conteggi").
- [ ] Inserire le famiglie invitate (Admin → Beta Famiglie → "+ Famiglia invitata").
- [ ] Accendere la release "Survey della beta" quando parte la beta (Pilot).
- [ ] Facoltativo: `node scripts/screenshots-beta-cockpit.mjs` per gli screenshot.
- [ ] Informativa privacy: citare "dati tecnici di accesso (giorni di utilizzo) per statistiche interne".

## Problemi e rischi aperti
- 37 righe `families` per 3 creatori, solo 2 con membri: famiglie orfane. Il cockpit le ignora, ma vanno capite (possibile bug nella creazione della famiglia).
- Figli e impegni restano per genitore: se due genitori della stessa famiglia inseriscono lo stesso figlio, il cockpit li conta due volte.
- Con piano Vercel gratuito i log durano un'ora: "errori tecnici" resta un dato aggregato.

## Da riportare nello stato
- Cruscotto beta (I2 di `LANCIO_BETA_20NOV.md`): costruito (Admin → Beta Famiglie e Beta → Report), sul ramo `claude/admin-beta-cockpit`, con migration 46 da applicare.
- Survey beta in Home dietro `BETA_SURVEY_ENABLED`.

---

## Output finale (20/10/2026)

### 1. Cosa esisteva prima
Vedi la tabella A della pre-apply review. In sintesi: Admin con Dashboard e Analisi su dati finti; pagina Pilota per **utente** (3 tipi di azione, ritorno dal solo ultimo login); `product_events` senza utente; coda feedback a 3 stati; lista d'attesa; inviti beta; cron giornalieri.

### 2. Cosa ho riusato
| Elemento | Come |
|---|---|
| Layout e controllo Admin | Nuova voce "Beta Famiglie"; controllo `platform_admin` lato server come in `lib/data/pilot-users.ts` |
| Tabelle operative (figli, scuola, impegni, chi accompagna, famiglia, salvati, condivisioni, prenotazioni, richieste, centri suggeriti, Radar, gruppi, Classe e scuola, push, onboarding) | Lette in sola lettura: sono le "azioni significative" |
| `beta_feedback` | Triage a 5 stati e tag; risposte alle survey (area `survey_1`/`survey_2`) |
| `beta_waitlist` | Famiglie invitate (stato "invitato") |
| `announcement_receipts` | "Più tardi" della survey |
| `normalizeDedupeKey` (centri suggeriti) | Stessa regola per la densità dei centri |
| `loadFamily` dei promemoria serali | Chiusure della scuola non organizzate |
| Cron del Buongiorno | Avviso "report pronto" al founder |
| Feature flag e card Release | Survey dietro `BETA_SURVEY_ENABLED` |

### 3. Cosa ho aggiunto
- `lib/beta-cockpit/` (logica pura): `definitions.ts`, `dates.ts`, `model.ts`, `demand.ts`, `feedback.ts`, `survey.ts`, `view.ts`.
- `lib/data/beta-cockpit.ts` (lettura), `lib/data/beta-survey.ts`, `lib/data/beta-report-notice.ts`.
- `app/actions/beta-cockpit.ts` (impostazioni, esclusioni, invitati, triage, decisioni, survey).
- Pagine: `/admin/beta` (Overview, Famiglie, Funnel, Utilizzo, Frizioni, Centri, Feedback), `/admin/beta/famiglia/[key]`, `/admin/beta/report`.
- `components/nextgen/BetaSurveyCard.tsx` in Home V2 (dopo "Da fare").
- `supabase/migration_46_beta_cockpit.sql`, `tests/one/beta-cockpit.spec.ts`, `scripts/screenshots-beta-cockpit.mjs`.
- Modifiche piccole: voce di menu Admin; `lib/data/beta-feedback.ts` mostra alle famiglie e nella coda storica i 3 stati di sempre; evento `beta_report_notice_sent`; flag, catalogo e release della survey.

### 4. Definizione delle metriche
| Metrica | Definizione |
|---|---|
| Famiglia | Account genitore della stessa `families` (via `family_members`); senza famiglia = famiglia da sola. Una famiglia entra se almeno un adulto è nella coorte `trama-one-controlled-beta`; esclusi Admin, gestori, coorte `internal-preview` e la lista esclusi |
| Invitata | Riga "invitato" in Lista d'attesa, oppure registrata con un codice beta |
| Registrata | Almeno un adulto con account |
| Impegni reali | Impegni nel Planner (anche da Scopri) non cancellati + richieste di prenotazione non annullate |
| Attivata | Almeno un figlio e N impegni reali (N = 3, configurabile). Data = il più tardo dei due momenti |
| Giorni attivi 7/14 | Giorni (Europe/Rome) con almeno un'azione significativa negli ultimi 7/14 |
| App aperta | Giorni con sessione rinnovata (`admin_beta_open_days`), mostrati a parte, mai contati come azioni |
| Attive nel periodo | Almeno un'azione significativa nel periodo |
| Ritorno settimana 1/2 | Un giorno con azioni o app aperta tra i giorni 1–7 / 8–14 dopo la registrazione; "troppo recente" finché non sono passati 7/14 giorni |
| Tempo al valore | Ore da registrazione a prima azione e ad attivazione; mediana + 3 più lente + chi non ci è arrivato |
| Utilizzo per area | Famiglie con azioni nell'area nel periodo, azioni, famiglie con azioni in ≥2 giorni diversi |
| Confronto | "vs periodo precedente" solo da 5 famiglie registrate in su e se il periodo precedente è dentro la beta |
| Percentuali | "7 su 15"; la percentuale compare solo da 20 in su |

### 5. Azione significativa
Figlio aggiunto · scuola impostata · impegno inserito o modificato · attività da Scopri/Radar nel Planner · chi porta/ritira assegnato · altro genitore invitato o collegato · nonni/tata aggiunti · attività salvata · piano condiviso · richiesta o messaggio a un centro · centro suggerito · scoperta Radar · gruppo creato, invito o adesione · passaggio offerto/chiesto · Classe e scuola (adesione, proposta, interesse) · feedback · survey.
**Non** contano: login, aperture di pagina, cambi di scheda, onboarding visto. Elenco nel codice: `lib/beta-cockpit/definitions.ts#ACTION_DEF`.

### 6. Stati famiglia (soglie configurabili)
| Stato | Regola (default) |
|---|---|
| Invitata | Nessun account registrato |
| Non partita | Registrata, nessuna azione significativa |
| In avvio | Qualche azione, non attivata, ultima azione da meno di 7 giorni |
| Attiva | Attivata, ultima azione da meno di 4 giorni |
| A rischio | Attivata, ultima azione da 4 a 6 giorni |
| Dormiente | Ultima azione da almeno 7 giorni |
Più il segno **"legge"**: apre l'app negli ultimi 7 giorni ma non fa azioni. Nessun punteggio.

### 7. Funnel
Invitata → Registrata → Onboarding concluso (completato o saltato) → Primo impegno → 3 impegni → Secondo adulto o coordinamento → Ritorno settimana 1 → Ritorno settimana 2. Sequenziale; per ogni passo: arrivate ("7 su 15"), ferme qui (clic = tabella filtrata), di cui troppo recenti.

### 8. Densità dei centri
Segnali per famiglia da: centri TRAMA salvati, richieste e prenotazioni; Scoperte salvate o nel Planner; scoperte community nel Planner; centri suggeriti; Radar; impegni scritti a mano (luogo o titolo, marcati "testo libero", parole generiche escluse). Chiave = nome normalizzato + comune (stessa regola dei centri suggeriti); un nome senza comune si aggancia all'unica variante con comune. Si contano **famiglie distinte**; fasce ≥2, ≥3, ≥5; "Top opportunità" = ≥2 famiglie e non solo testo libero. Zone = comuni della scuola delle famiglie.

### 9. Survey
Due survey fisse nel codice (`lib/beta-cockpit/survey.ts`), dietro `BETA_SURVEY_ENABLED`: la 1 dal giorno 3 (4 domande del brief), la 2 dal giorno 14 (5 domande; dal giorno 14 vale la 2). Card in Home V2, domande a scelta obbligatorie, testi facoltativi (600 caratteri), "Più tardi" = di nuovo dopo 2 giorni. Risposte in `beta_feedback` (area `survey_1`/`survey_2`), visibili in Admin → Beta Famiglie → Feedback (vista "Survey" e riepilogo per domanda). Giorni e accensione per survey in Report → Impostazioni.

### 10. Report navigabile
`/admin/beta/report`: Executive summary (con "Richiede attenzione" se il periodo arriva a oggi) → Funnel → Famiglie → Utilizzo → Frizioni → Centri → Feedback → Survey → Decisioni → Impostazioni. Ogni sezione si apre e chiude; ogni numero porta a `/admin/beta?tab=famiglie&filtro=…` e da lì alla famiglia. Periodi: Oggi, 3, 7, 14, 30 giorni, Beta completa, Personalizzato. Sintesi deterministica e "Segnali da guardare" senza cause.

### 11. Frequenza configurabile
Manuale / Giornaliero / Settimanale (giorno, ora, Europe/Rome), default settimanale il venerdì alle 9, inizio beta 18/11. Le finestre si calcolano dalle impostazioni ("20–26 nov") e il report si ricalcola dai dati: niente metriche copiate nel database, si salvano solo le decisioni.

### 12. Cron
Nessun nuovo scheduler: il cron del Buongiorno (8:00 a Roma) chiama `sendBetaReportNoticeIfDue`, che a finestra chiusa manda al founder un'email con i numeri e il link al report, una volta per finestra (`product_events` `beta_report_notice_sent`). Destinatario: `BETA_REPORT_EMAIL` se impostata, altrimenti l'email dell'Admin. Con un'ora dopo le 8 l'email arriva il giorno dopo.

### 13. Test
`tests/one/beta-cockpit.spec.ts` (34, tutti verdi): stato famiglia, attivazione, giorni attivi, azioni significative, funnel, densità centri, intervalli di date e fuso, report settimanale e giornaliero, filtri, feedback, survey, vista completa; controlli sul sorgente per l'accesso Admin (pagine e azioni), la migration e l'assenza di analytics di terze parti. Regressione: nessuna differenza con `main` nei 76 file caricabili nel sandbox. **Pending local verification:** controllo dei tipi completo, build e test browser (le dipendenze non si possono installare nel sandbox di questa sessione; li esegue `deploy.sh`).

### 14. Screenshot
Non producibili nel sandbox (nessun accesso all'app e niente dipendenze). Sul Mac: `node scripts/screenshots-beta-cockpit.mjs` (sola lettura, login Admin una volta, output in `logs/screens-beta-…/`).

### 15. Limiti ancora presenti
- Figli, impegni e assegnazioni restano per genitore: se due genitori inseriscono lo stesso figlio, conta due volte.
- Di impegni e assegnazioni si vede solo l'ultima modifica: i giorni attivi sono un minimo.
- Prenotazioni annullate: lo stato è quello di oggi anche nei report passati; push, inviti in attesa, salvati non collocati e chiusure sono sempre "a oggi".
- Gli impegni a mano non hanno un campo "centro": la densità usa luogo o titolo (testo libero da verificare).
- Errori tecnici solo aggregati e solo quelli del Planner; i log di Vercel non sono collegati alle famiglie.
- "App aperta" conta i rinnovi di sessione: un'app lasciata aperta in background può contare come giorno aperto.
- Le 37 righe `families` orfane (3 creatori) non entrano nel cockpit ma andrebbero capite.
- Oggi il cockpit mostra 7 "famiglie" (account di prova e vicini): vanno escluse prima del 18/11.

### 16. Cosa guardare ogni settimana (10 minuti, il venerdì)
1. **Richiede attenzione**: scrivi oggi alle famiglie non attivate da 48h e a chi aspetta un centro.
2. **Overview**: attive nel periodo e a rischio; il confronto col periodo prima.
3. **Funnel**: dove si ferma il numero più alto di famiglie. Scegli **un** passo da capire.
4. **Frizioni**: le prime tre; chiedi alle famiglie coinvolte (non cambiare la UI prima).
5. **Utilizzo**: quali aree tornano in ≥2 giorni (abitudine) e quali nessuno usa.
6. **Centri**: i nomi con ≥3 famiglie sono i primi da contattare a gennaio.
7. **Feedback e survey**: triage dei nuovi; leggi "Se TRAMA sparisse domani" e "Cosa fai ancora su WhatsApp".
8. **Decisioni**: una o due righe nel decision log (osservazione → ipotesi → decisione → azione, owner, data) e chiudi quelle fatte.
