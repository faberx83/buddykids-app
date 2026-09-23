# TRAMA — Documento di Analisi Tecnico-Funzionale

**23/09/2026.** Fotografia **AS-IS** verificata contro il codice del repository al commit HEAD (branch `main`, vedi `docs/trama-one/STATE_OF_THE_ART.md` per l'hash esatto e i dettagli di verifica DB) e contro `supabase/schema.sql` + le migration incrementali in `supabase/migration_*.sql`. Distingue sempre l'**AS-IS verificato** (letto nel codice sorgente, percorso file citato) dal **TO-BE dichiarato** nei tre Handbook normativi (`docs/trama-one/derived/TRAMA_*_Product_Architecture_CX_Handbook_*`), che restano la fonte del comportamento *desiderato* ma non descrivono automaticamente ciò che esiste oggi. Dove un requisito Handbook non ha corrispondenza nel codice, questo documento lo dice esplicitamente nel §5 — non lo presenta come implementato.

Questo documento è pensato per due pubblici insieme: chi lavora sul codice (percorsi file precisi, pattern tecnici ricorrenti) e chi deve capire come funziona il prodotto senza leggerlo (flussi passo-passo per dominio). Non è uno changelog né un audit di completezza — per quelli vedi `STATE_OF_THE_ART.md` (stato verificato dominio per dominio, incluse le query dirette sul DB di produzione) e `ROADMAP.md` (cosa manca e perché).

---

## 1. Architettura applicativa

### Stack

- **Next.js (App Router)**, React Server Components + Client Components, TypeScript.
- **Supabase** (Postgres) come backend dati: autenticazione (`auth.users`), storage (bucket `buddykids-images` pubblico, `buddykids-certifications` privato), Row Level Security su praticamente ogni tabella applicativa.
- **Server Actions** (`app/actions/*.ts`) come meccanismo primario di scrittura: niente livello API REST/GraphQL separato per le mutazioni interne — i componenti client chiamano direttamente funzioni server-side marcate `"use server"`, che a loro volta usano il client Supabase server-side (`lib/supabase/server.ts`) autenticato con la sessione dell'utente (RLS applicata normalmente, nessun bypass salvo dove esplicitamente usato `service_role`, vedi §4).
- Alcune route API HTTP vere e proprie esistono comunque sotto `app/api/` e `app/internal/` per casi che non possono passare da una Server Action invocata dal client (es. `app/internal/deploy-notify/route.ts`, chiamato da `deploy.sh` a fine deploy; `app/api/internal/beta-pipeline/route.ts`, endpoint interno con secret condiviso che usa la `service_role` key per bypassare la RLS di proposito).
- Mappe: **Leaflet** (`react-leaflet`) con tile OpenStreetMap standard (`components/ActivityMap.tsx`).

### Struttura cartelle principali

- **`app/`** — routing App Router. Convivono **due generazioni di UI genitore/gestore**, entrambe attive in produzione:
  - **LEGACY**: route storiche non sotto `/nextgen`, es. `app/(main)/`, `app/booking/`, `app/prenotazioni/`.
  - **NEXTGEN** ("V2"): sotto `app/nextgen/` (area genitore) e in gran parte già confluita in `app/center/` (area Partner) e `app/admin/` (area Admin), che non hanno un prefisso `/legacy` separato — sono la versione corrente unica per quei due ruoli.
  - **TRAMA ONE**: shell aggiuntive `/one`, `/center/one`, `/admin/one` — gestite dal feature flag `TRAMA_ONE_ENABLED` (vedi sotto), visibili solo alla Controlled Beta Cohort e a `platform_admin`.
  - `app/actions/` — tutte le Server Actions, un file per dominio funzionale (es. `bookings.ts`, `family.ts`, `responsibilities.ts`, `center-leads.ts`, `feature-flag-overrides.ts`).
  - `app/api/` e `app/internal/` — route HTTP vere, per integrazioni/automazioni che non possono passare da una Server Action client-invocata.
- **`components/`** — componenti React condivisi. Sotto-cartelle per dominio/area (`components/nextgen/`, `components/center/`, `components/admin/`, `components/spotlight/`, `components/dashboard/`) più componenti trasversali alla radice (es. `ActivityMap.tsx`, `GlobalActionProgress.tsx`, `PhoneShell.tsx`).
- **`lib/`** — logica applicativa non-UI, organizzata per dominio:
  - `lib/data/` — funzioni di lettura dati (query verso Supabase), un file per entità/dominio (es. `lib/data/center-leads.ts`, `lib/data/bookings.ts`, `lib/data/family-people.ts`).
  - `lib/capacity/service.ts` — servizio canonico di gestione posti disponibili (vedi §4).
  - `lib/feature-flags/` — registry + risoluzione flag (vedi sotto).
  - `lib/supabase/` — client Supabase (`server.ts` per Server Components/Actions, `middleware.ts` per il refresh sessione, `env.ts` per `isSupabaseConfigured`).
  - `lib/discovery/`, `lib/releases/`, `lib/nextgen/`, `lib/school-calendar/`, `lib/notifications/`, `lib/telemetry/` — logica di dominio specifica, in molti casi funzioni pure testabili isolatamente (es. `clampSpotsLeft` in `lib/capacity/service.ts`).

### Sistema di feature flag

Definito in `lib/feature-flags/registry.ts` (`FEATURE_FLAG_REGISTRY`, oggetto versionato nel codice — solo le *definizioni* vivono qui) e risolto a runtime da `lib/feature-flags/resolve.ts`, che legge gli **override** dalla tabella `feature_flag_overrides` (persistiti in Supabase, mai nel codice). Un flag non presente nel registry risolve sempre a `false` per costruzione (`lib/feature-flags/evaluate.ts`), indipendentemente da righe orfane in tabella.

Ogni flag dichiara:
- `defaultValue` (sempre `false` per i flag osservati in questo registry — "dark release" per default),
- `allowedScopes`: combinazione di `global | environment | user | role | tenant | cohort`.

Pattern di rilascio osservato in ogni voce del registry: **INTERNAL (cohort `internal-preview`) → PILOT (cohort `trama-one-controlled-beta`) → GLOBAL (`scope: global`)**, con la possibilità di tornare indietro rapidamente (kill switch) rimuovendo/disattivando l'override senza toccare il codice. Esempio concreto verificato via query DB (`STATE_OF_THE_ART.md`): `TRAMA_ONE_ENABLED` ha uno scope `global` con `enabled=false` (scaduto e mai riattivato) e uno scope `cohort: trama-one-controlled-beta` con `enabled=true` fino al 31/12/2026 — il flag è quindi visibile solo a quella coorte, mai al pubblico.

Il registry contiene anche flag esplicitamente **PLACEHOLDER/inerti** (es. `EXTERNAL_PLANNER_ITEMS_ENABLED`), registrati solo per esercitare l'infrastruttura di promotion/kill-switch del Release Catalog (`lib/releases/catalog.ts`, sezione "Release" di `/admin/feature-flags`) senza che nessun codice applicativo li risolva — per costruzione zero superficie raggiungibile finché la capability reale non viene costruita.

### Pattern di autenticazione/autorizzazione

- Autenticazione via Supabase Auth (`auth.users`), un trigger (`handle_new_user()`, in `schema.sql` e sovrascritto da migration successive) crea automaticamente una riga `profiles` alla registrazione, con ruolo di default `parent`.
- **Nessun middleware globale di route-guard basato su ruolo**: ogni layout di sezione (`app/center/layout.tsx`, `app/admin/layout.tsx`, guardie equivalenti in `app/nextgen/`) fa da solo, lato server, `supabase.auth.getUser()` + lettura di `profiles.role`, e chiama `redirect("/auth/login")` se non autenticato. Non è stato trovato un controllo esplicito e centralizzato "se ruolo ≠ atteso, reindirizza" in ogni layout ispezionato (es. `app/admin/layout.tsx` verifica l'utente ma il redirect per ruolo errato — se presente — è delegato più a valle/alla RLS che a un gate esplicito uniforme); il vero backstop di sicurezza sui dati resta la **RLS di Postgres**, non il routing lato app.
- `lib/supabase/middleware.ts` esiste ma serve al refresh della sessione (cookie), non è un gate di autorizzazione per-route.
- **RLS come livello di sicurezza primario**: quasi ogni tabella ha `enable row level security` più policy dedicate (vedi §2). Funzioni helper `security definer` (`current_role()`, `current_center_id()`, `is_platform_admin()`, `is_group_member()`, `is_family_member()`, ecc.) evitano ricorsione infinita quando una policy deve leggere la stessa tabella su cui è definita — pattern ripetuto identico per ogni nuovo dominio con membership (Gruppi → Community → Famiglie, in ordine cronologico, con lo stesso "fallback `or created_by = auth.uid()`" per evitare che l'`INSERT ... RETURNING` fallisca perché la riga di membership non esiste ancora nello stesso istante).
- Alcune scritture sensibili passano da funzioni `security definer` dedicate invece che da policy generiche, per limitare esplicitamente cosa un utente può modificare (es. `redeem_invite_discount()`, `accept_family_invite()`, le transizioni di stato di `center_onboarding_state` — mai un `UPDATE` diretto client-side su quella tabella).

---

## 2. Modello dati

Fonte: `supabase/schema.sql` (schema iniziale "bootstrap da zero") + le migration incrementali `supabase/migration_07..37_*.sql` che aggiungono le tabelle più recenti (schema.sql non viene riscritto ad ogni migration — vedi nota esplicita nel file stesso). Elenco per dominio, non colonna per colonna.

### Identità e centri

- **`profiles`** — estende `auth.users`. Colonna `role` (`parent | center_admin | platform_admin`), `center_id` (solo per `center_admin`, un centro per gestore — nessun multi-sede oggi, vedi §5). Estesa nel tempo con profilo esteso (`phone`, `business_role` solo lato gestore, preferenze notifiche, `account_status`), `season_budget_target` (Planner), `dismissed_weeks`.
- **`centers`** — un centro/organizzatore. Attributi business: sconti personalizzabili (`multiweek_discount_percent`, `family_discount_tiers`, `group_discount_tiers`), `cancellation_window_days` per-centro, `accessible`/`accessible_note` (accesso disabili, badge visibile al genitore).
- **`activities`** — appartiene a un centro (`center_id`). Prezzo, età, geolocalizzazione (`latitude`/`longitude`), `spots_left` "editoriale" (separato dal dettaglio giorno/settimana — vedi nota in `lib/capacity/service.ts`), opzioni pasto/dietetiche, pre/post servizio, `pills`/`badges` per la UI.
- **`tags`** / **`activity_tags`** — tassonomia gestita dall'Admin, N:N con le attività.

### Disponibilità e prenotazioni

- **`activity_weeks`** — disponibilità a settimana intera (`capacity`, `spots_left`).
- **`activity_days`** — disponibilità giorno-per-giorno, stile booking (apertura/chiusura, sconto sul giorno, last-minute, `special_label`).
- **`promotions`** — sconti su giorno della settimana o last-minute, per attività.
- **`bookings`** — prenotazione di un genitore su un'attività (`status: pending|confirmed|cancelled`). Relazioni N:N: **`booking_weeks`** (settimane scelte, con `capacity_decremented` per l'idempotenza del rilascio capacità) e **`booking_kids`** (bambini iscritti). **`booking_days`** (migration 12) copre lo stesso pattern per le prenotazioni a giorno singolo.
- **`kids`** — bambini di un genitore (`parent_id`).

### Community, gruppi e coordinamento famiglia

- **`groups`** ("Andiamo Insieme", legati a UNA attività) con **`group_members`**, **`group_kids`** (preferenza/tag per bambino), **`group_subgroups`**/**`group_subgroup_kids`** (aggregazioni per preferenza), **`group_requests`** (richiesta sconto proporzionale al centro), **`carpool_offers`**/**`carpool_requests`** (car pooling, abbinamento calcolato in lettura, non persistito).
- **`communities`** (multi-attività, persistenti) con **`community_members`** (ruoli creatore/admin/membro), **`community_activity_proposals`**, **`community_activity_interest`** — concettualmente distinte dai Gruppi ma collegabili (`groups.community_id` nullable: una proposta community può generare un Gruppo sconto vero e proprio).
- **`families`**/**`family_members`** — modello "famiglia multi-genitore" con invito via codice, **verificato a 0 righe in produzione** (probabile percorso legacy/mai adottato). Il percorso realmente in uso oggi è **`family_people`** (migration 32, "Famiglia condivisa" — 2 righe in produzione), **distinto** concettualmente da `families`/`family_members` nello schema, entrambi coesistenti nel codice.
- **`family_invites`** — invito nominale via email per aggiungere un secondo genitore a `families` (token, stato, funzioni `security definer` `get_family_invite_preview()`/`accept_family_invite()`).
- **`week_responsibilities`** ("Chi fa cosa?") — responsabile per bambino/settimana/giorno feriale/momento (andata o ritorno), NON legato alla frequenza reale al centro. **Non** un modulo "deleghe": è etichettatura di coordinamento interno alla famiglia, senza deleghe verso terzi in senso legale.
- **`plan_shares`** — link pubblico di sola lettura del piano familiare per un periodo, senza login, accessibile solo tramite funzioni `security definer` (`get_shared_plan()`/`get_shared_plan_meta()`) che restituiscono solo campi non sensibili (mai importi/indirizzi/contatti).
- **`parent_addresses`** — indirizzi salvati (Logistica leggera), testo libero, nessuna geocodifica reale.

### Partner / onboarding / qualità

- **`activity_certifications`** — richiesta di badge "certificazione servizio" da parte del centro (es. istruttori certificati), approvata/rifiutata da un Admin, con documento opzionale su bucket privato.
- **`center_onboarding_state`**, **`center_onboarding_checklist_completions`**, **`center_onboarding_audit_log`** (migration_09) — stato di avanzamento onboarding Partner, transizioni sempre via funzioni `security definer`, mai `UPDATE` diretto lato client. `center_onboarding_audit_log` verificata a 142 righe in produzione (append-only).
- **`center_identity_verifications`** (migration_15) — schema pronto per verifica identità Partner, ma `document_url` **non collegato a un upload reale** per decisione esplicita (DEC-22); verificata a 0 righe in produzione (nessuna verifica mai sottomessa).
- **`center_leads`** (migration_17) — coda "Segnalazioni centri" per la supply acquisition (centro non ancora iscritto, suggerito/qualificato/reclamato). 6 righe totali in produzione con uno storico di stato che, secondo `STATE_OF_THE_ART.md`, non torna 1:1 con una query aggregata sul campo `status` (18+1+6=25 transizioni riportate contro 6 righe attuali — segnalato come da riverificare, non un bug confermato).
- **`invites`** — il gestore invita potenziali genitori con un codice promo, sconto applicato una sola volta (`redeem_invite_discount()`).
- **`activity_inquiries`** — ticketing "Contatta il gestore": un messaggio, una risposta (non una chat multi-turno), con flag `read_by_parent`/`read_by_center` per i pallini di non-letto.
- **`activity_log`** — audit delle modifiche del gestore (prezzo, calendario, promozioni), popolato da `app/actions/center.ts`/`app/actions/tags.ts`.
- **`attendance_records`** — presenze giornaliere, con check-in lato genitore (`checked_in_by`, stato transitorio `in_ritardo`) oltre al registro lato centro.

### Piattaforma / governance / compliance

- **`feature_flag_overrides`** — override runtime dei flag (vedi §1), 9 righe verificate in produzione.
- **`beta_cohort_memberships`** (migration_08) — appartenenza a coorti beta (`internal-preview`, `trama-one-controlled-beta`, …), 8 righe verificate.
- **`beta_invite_codes`** (migration_30) — auto-iscrizione a una coorte beta via `?beta=CODICE` in fase di signup.
- **`beta_feedback`** — coda "segnala un problema" (CTA mobile in area genitore NEXTGEN), con `app_source` (solo `genitori` popolato oggi, `gestore` predisposto), `status` (dialogo Admin↔genitore) **distinto** da `pipeline_status` (pipeline verso un'automazione interna, letta/scritta da un endpoint con `service_role` key + secret — non dalla RLS normale).
- **`legal_documents`**/**`legal_acceptances`**/**`consent_events`**/**`parental_declarations`** (migration_27/28/29) — infrastruttura Privacy/Termini. **`legal_documents` verificata a 0 righe in produzione**: nessun testo legale mai pubblicato, nonostante il codice sia pronto (vedi §5).
- **`deploy_events`** (migration_33) — log dei deploy (esito, timestamp), letto da `DeployStatusBanner` in Admin.
- **`product_events`** — telemetria/analytics generale, 2530 righe verificate (volume plausibile solo includendo sessioni di test).
- **`partner_offers`** — lista curata di "Servizi consigliati" per i gestori, pubblicata solo dall'Admin (non un marketplace self-service).
- **`favorites`** — attività salvate da un genitore; nota storica: la policy RLS iniziale non aveva un bypass `is_platform_admin()`, bug corretto (vedi commento nello schema).
- **`reviews`** — recensioni, lettura pubblica, scrittura solo dall'autore.

### Note RLS generali

Quasi ogni tabella applicativa ha RLS abilitata con policy esplicite; il pattern ricorrente è: lettura pubblica dove il dato è comunque mostrato pubblicamente (es. `activities`, `centers`, `tags`), scrittura ristretta al proprietario (`parent_id = auth.uid()` o `center_id = current_center_id()`) con bypass `is_platform_admin()` quasi ovunque. Alcuni bug RLS storici sono documentati **nei commenti dello schema stesso** come "BUG TROVATO+CORRETTO" (es. mancava una policy di update per il genitore su `activity_inquiries`; mancava il bypass admin su `favorites`) — segno di un processo che corregge le policy quando un caso reale le espone, non di un audit RLS sistematico pianificato in anticipo.

---

## 3. Flussi principali per dominio

### 3.1 Genitore (Parent)

1. **Onboarding**: carousel + walkthrough motore comune (`lib/nextgen/onboarding-slides.ts`), rigiocabile da `/nextgen/profile/impostazioni/preferenze`. Il flusso completo (dati figli, preferenze) porta alla creazione della riga `profiles`/`kids`.
2. **Planner** (`app/nextgen/planner/*`): vista per settimana/famiglia/indirizzi/logistica/promemoria. I promemoria (`PromemoriaClient`) hanno persistenza reale su `travel_reminders` (migration_36) — non più stato locale come in versioni precedenti. "Famiglia condivisa" (`app/nextgen/planner/famiglia/FamigliaClient.tsx`, azioni in `app/actions/family.ts`, tabella `family_people`) e "Chi fa cosa" (`app/actions/responsibilities.ts`, tabella `week_responsibilities`) sono **due feature distinte** nel codice, non un unico modulo "deleghe".
3. **Ricerca/Discovery** (`app/nextgen/search/SearchDiscoveryClient.tsx`): vedi §3.4 dedicata (dominio più aggiornato).
4. **Richiesta prenotazione**: wizard in `app/prenotazioni/`/`app/nextgen/prenotazioni/`, include uno step "Servizi extra" reale (non placeholder). Genera righe `bookings` + `booking_weeks`/`booking_days` + `booking_kids`; la capacità viene riservata via `lib/capacity/service.ts` (§4), non con una scrittura diretta sparsa nel flusso di prenotazione.
5. **Risposta del centro**: il centro accetta/rifiuta/propone alternativa dalla propria inbox — lo stato applicativo (`partnerDecision`) è distinto dallo stato di pagamento demo `bookings.status`; l'UI mostra la decisione operativa reale, non il campo grezzo.
6. **Gestione prenotazioni**: cancellazione (con rilascio capacità simmetrico, `releaseWeekCapacity`/`releaseDayCapacity`), entro la finestra `cancellation_window_days` del centro.
7. **Community/Gruppi**: due percorsi paralleli — Gruppi legati a una attività (sconto + car pooling) in `app/nextgen/groups/`/`app/(main)/groups/`, Community multi-attività persistenti in `app/nextgen/community/`.
8. **Condivisione piano**: link pubblico senza login (`app/share/planner/[token]/`), backend via `get_shared_plan()`/`get_shared_plan_meta()`.
9. **Segnalazioni**: CTA floating "segnala un problema" (`app/nextgen/profile/segnalazioni/`, tabella `beta_feedback`), visibile su ogni pagina genitore NEXTGEN.

**Gap noto verificato**: nessuna route pubblica dedicata a un profilo "centro" navigabile fuori da una singola attività pubblicata (nessun `/centro/[slug]` trovato nel codice).

### 3.2 Partner (Gestore)

1. **Candidatura**: `app/auth/candidati/` + conferma in `app/auth/candidati/conferma/` — flusso assistito, non self-service completo.
2. **Verifica identità**: schema pronto (`center_identity_verifications`), ma upload documento non collegato (DEC-22) — non un gap accidentale, una scelta di scope esplicita.
3. **Onboarding**: `app/center/one/onboarding/`, stato/checklist/audit su `center_onboarding_state`/`center_onboarding_checklist_completions`/`center_onboarding_audit_log`, transizioni sempre via funzioni `security definer` — mai `UPDATE` diretto.
4. **Gestione attività/calendario/prezzi/capacità**: `app/center/activities/`, `app/calendar-center/`. Ogni riserva/rilascio di posto passa dal servizio canonico `lib/capacity/service.ts` (§4), con Compare-And-Swap contro race condition.
5. **Inbox richieste**: `app/center/richieste/`, ticketing su `activity_inquiries`.
6. **Risposta prenotazioni**: `app/actions/booking-response.ts`, UI in `app/center/prenotazioni/` — risposta intera/per-giorno/alternativa.
7. **Cancellazioni/rimborsi**: stessa area, per-giorno.
8. **Assistenza diretta TRAMA**: alcune operazioni (spegnimento attività, cancellazione account) restano assistite manualmente da TRAMA, non self-service nel prodotto.

**Gap confermato**: nessuna UI trust-score nel codice applicativo (`app/`, `components/`) — il concetto esiste solo nei documenti Handbook/decisionali, mai in un componente reale (vedi §5).

### 3.3 Admin

1. **Approvazioni**: `app/admin/centers/[id]/`, `app/admin/certifications/`.
2. **Qualità catalogo**: `app/admin/activities/`, `app/admin/tags/`.
3. **Anomalie booking**: `app/admin/bookings/`.
4. **Supply acquisition / CenterLead**: `app/admin/center-leads/`, dati in `lib/data/center-leads.ts`.
5. **Audit log**: `center_onboarding_audit_log`, append-only, mai insert diretto client-side.
6. **Feature flags**: `app/admin/feature-flags/`, dati in `lib/data/feature-flag-overrides.ts` — UI reale con calcolo stato (`active`/`expiring_soon`/`expired`/`no_expiry`) e badge di allarme, non solo query manuale.
7. **Governance pilota TRAMA ONE**: `app/admin/one/` e `app/admin/one/pilot/[id]/`, dedicata al monitoraggio della Controlled Beta Cohort.
8. **Pannelli cross-centro aggiuntivi**: SLA Richieste (`app/admin/richieste/`), confronto Presenze (`app/admin/presenze/`), Preferiti come segnale di domanda (`app/admin/preferiti/`).

**Gap confermato**: `legal_documents` a 0 righe in produzione — il codice (`app/privacy/page.tsx`, `app/terms/page.tsx`) mostra onestamente "Documento in preparazione" invece di un testo fittizio, ma non c'è alcun contenuto legale pubblicato (vedi §5).

### 3.4 Discovery Map

Dominio con il ciclo di verifica più recente e diretto (bugfix live 23/09/2026, commit `fa121ca` → `1f0e0ea`, deployato con successo secondo `deploy_events`). Componenti chiave: `app/nextgen/search/SearchDiscoveryClient.tsx` (1721 righe — orchestrazione filtri/stato/URL) e `components/ActivityMap.tsx` (rendering Leaflet).

Flusso AS-IS:
1. L'utente apre **Scopri/Ricerca** (`/nextgen/search`); lo stato di filtri e vista mappa/lista è sincronizzato nell'URL via `router.replace` (mai `push`, per non intasare la history), **debounced 300ms** per evitare che ogni singolo cambio di filtro generi una navigazione visibile con progress bar attiva (`SearchDiscoveryClient.tsx`, righe ~490-556).
2. **3 tipologie di marker** sulla mappa, ciascuna con popup dedicato: TRAMA (Partner reale, dati da `activities`/`activity_weeks`/`activity_days`), Da invitare (Curated invitabile) e Fonte pubblica (Curated non invitabile) — dataset curato code-based in `lib/discovery/real-dataset.ts`, **non** in una tabella Supabase interrogabile.
3. **Filtro Copertura** (Settimana intera / Giorni singoli), single-select, con conteggio a 3 vie (attività totali / marker totali / mappabili) — la semantica "mixed" è compatibile con entrambi i filtri (non esclusa erroneamente, come in una versione precedente).
4. **"Proponi invito"**: dialog estratto dal ciclo di vita del popup Leaflet (`SearchDiscoveryClient.tsx`, righe ~56, ~458, ~1710) — non più agganciato all'apertura/chiusura del popup stesso, per evitare i bug di z-index/doppio tap risolti in questo ciclo (vedi §4).
5. **Stato mappa preservato** al ritorno da un dettaglio attività (pan/zoom/filtri non si resettano navigando avanti e indietro).
6. **Basemap**: OpenStreetMap standard (tile provider), sostituito dopo il fix del "basemap grigio" da un provider precedente.

**Gap noto per costruzione**: 3 idee evolutive aggiunte alla roadmap POST-BETA (filtro per tipo marker interattivo, scelta stile mappa, zoom automatico su "Usa la mia posizione") — non implementate, fuori perimetro di questo ciclo.

---

## 4. Pattern tecnici ricorrenti degni di nota

- **URL state sync debounced**: lo stato di ricerca/filtri/vista mappa vive nell'URL (`router.replace`, `{ scroll: false }`), con un debounce di 300ms per non generare una navigazione (e relativa progress bar) ad ogni singolo cambio filtro, mantenendo comunque link condivisibili/bookmarkabili (`SearchDiscoveryClient.tsx`).
- **Compare-And-Swap applicativo per `spots_left`**: `lib/capacity/service.ts` legge `spots_left` e scrive con `.eq("spots_left", row.spots_left)` sull'`UPDATE`, verificando le righe effettivamente aggiornate (Postgres/PostgREST non garantisce un "affected rows" affidabile lato client altrimenti). Retry fino a `MAX_CAS_ATTEMPTS = 5`; oltre quella soglia, rifiuto sicuro (mai un doppio decremento) invece di un errore o un tentativo "alla cieca". Le invarianti (`spots_left` mai sotto 0, mai sopra `capacity`) sono isolate in una funzione pura `clampSpotsLeft()`, testata separatamente (`tests/one/capacity-concurrency.spec.ts`).
- **Idempotenza reserve/release**: `booking_weeks.capacity_decremented`/`booking_days.capacity_decremented` tracciano se QUESTA specifica riga ha già decrementato la capacità, per evitare doppio decremento/rilascio su retry o su cancellazioni multiple.
- **Notifica "posto tornato disponibile"** event-driven: `wasZeroBeforeRelease` nel risultato di `releaseSpot()` è `true` solo per la mutazione che vince la transizione esatta 0→disponibile (garantita unica dal CAS), trigger della push `notifyAvailabilityBackInStock()` — mai per ogni incremento generico.
- **Funzioni `security definer` per evitare ricorsione RLS**: pattern ripetuto identico per ogni dominio con membership (`is_group_member()`, `is_community_member()`, `is_family_member()`), con lo stesso fallback `or created_by = auth.uid()` per evitare che l'`INSERT ... RETURNING` fallisca perché la riga di membership non esiste ancora nello stesso istante.
- **Dark release / feature flag come default**: ogni flag nuovo nasce `defaultValue: false`, senza override `global` scritto dal programma — visibile solo attivando manualmente una cohort da Admin → Feature Flags. Alcuni flag sono dichiaratamente PLACEHOLDER/inerti (nessun codice li risolve) solo per esercitare l'infrastruttura di release.
- **Ticketing "una domanda, una risposta"**: `activity_inquiries` non è una chat multi-turno — un messaggio, una risposta, con flag separati `read_by_parent`/`read_by_center` per i pallini di non-letto lato genitore e lato centro.
- **Funzioni pubbliche `security definer` a esposizione minima**: ogni endpoint pubblico senza login (`get_invite_preview()`, `get_shared_plan()`/`get_shared_plan_meta()`, `get_family_invite_preview()`) restituisce SOLO i campi strettamente necessari alla UI pubblica (mai importi, indirizzi, contatti) — evita di dover aprire una policy di lettura pubblica sull'intera tabella sottostante.
- **Audit log append-only**: `activity_log` e `center_onboarding_audit_log` sono scritti solo da Server Actions server-side, mai da un insert diretto client-side, e mai aggiornati/cancellati dopo la scrittura.
- **Coesistenza LEGACY/NEXTGEN**: nessuna route storica viene rimossa quando nasce l'equivalente NEXTGEN — `lib/version-preference.ts` (cookie `bk_version`) permette a un utente di passare tra le due esperienze, con un toggle bidirezionale riservato agli account di test (`components/VersionToggle.tsx`, `lib/dev/test-accounts.ts`) e — dietro flag — una riga di fallback "Torna alla versione classica" anche per utenti normali.

---

## 5. Cosa è TO-BE ma non ancora AS-IS

Incrocio esplicito fra quanto descritto nei 3 Handbook normativi (`docs/trama-one/derived/`) e quanto verificato in `STATE_OF_THE_ART.md` (23/09/2026). Gli Handbook stessi dichiarano nella propria nota metodologica che gran parte del loro contenuto è **TO-BE da validare** (Trust Layer, walkthrough/livelli, incentivi referral) distinto da "motori predisposti o successivi" (verifica AI, recommendation, health/quality engine, gamification, CRM evoluto, Marketplace B2B) — questo documento non fa che confermare, dal lato codice, quali di quei TO-BE sono stati effettivamente costruiti e quali no.

| Area | Dichiarato TO-BE (Handbook) | Stato AS-IS verificato |
|---|---|---|
| Trust Layer / Trust Score | Handbook Admin ("Control Room della salute dell'ecosistema") e Handbook Partner (Draft 1.1, "Trust Layer") descrivono un sistema di fiducia/livelli per i Partner | **Non implementato**: zero occorrenze nel codice applicativo (`app/`, `components/`), il concetto compare solo nei documenti Handbook/decisionali |
| Verifica identità AI-assisted | Handbook Admin cita "verifica AI" come motore predisposto/successivo | Schema pronto (`center_identity_verifications`), ma **0 righe in produzione**, nessun upload reale collegato (DEC-22, scelta di scope esplicita, non un gap accidentale) |
| Referral / incentivi | Handbook Parent Draft 1.2 dedicato esplicitamente a "Referral Incentives" | `invites` (Partner→genitore, con sconto) esiste ed è verificato in uso; un sistema di referral genitore→genitore più ampio come descritto nell'Handbook non risulta verificato riga-per-riga in questa sessione — richiederebbe un audit dedicato (vedi `STATE_OF_THE_ART.md`, nota esplicita) |
| Gamification / walkthrough livelli | Citata come motore "successivo" in entrambi gli Handbook Admin/Partner | Esistono walkthrough/onboarding carousel (`lib/nextgen/onboarding-slides.ts`, Spotlight Partner/Parent) ma dietro `TRAMA_ONE_ENABLED`, quindi visibili solo alla Controlled Beta Cohort — non un sistema di livelli/gamification a punti verificato nel codice |
| CRM evoluto / Marketplace B2B | Citati come estensioni architetturali, non implementazioni immediate, in entrambi gli Handbook | **Non implementati** — `partner_offers` è una lista curata pubblicata solo dall'Admin, esplicitamente NON un marketplace self-service |
| Profilo pubblico "centro" navigabile | Implicito nell'architettura di informazione Partner (sitemap 22 pagine) | **Non trovato**: nessuna route `/centro/[slug]` nel codice, il genitore vede un centro solo attraverso una singola attività pubblicata |
| Privacy/Termini pubblicati | Requisito di compliance per l'uscita dal perimetro "Fabrizio + conoscenti" (vedi `ROADMAP.md`, blocker ALTA priorità) | Infrastruttura pronta e onesta (`legal_documents`/`legal_acceptances`/`consent_events`/`parental_declarations`, pagine con "Documento in preparazione"), ma **`legal_documents` a 0 righe pubblicate** in produzione |
| Multi-sede Partner | Non esplicitamente nell'Handbook attuale, ma coerente con l'evoluzione "Control Room" Admin | **Non supportato architetturalmente**: `profiles.center_id` è singolare, un gestore = un centro |
| Famiglia multi-tenant (più tutori non conviventi) | Handbook Parent, architettura di informazione Famiglia | Modello attuale `families`/`family_members` a 0 righe in produzione (probabile percorso legacy mai adottato); il percorso realmente in uso è "Famiglia condivisa" (`family_people`), più semplice di un modello multi-tenant vero |

---

## 6. Riferimenti

- `docs/trama-one/STATE_OF_THE_ART.md` — fotografia dello stato verificato dominio per dominio, incluse le query dirette (read-only) sul DB di produzione Supabase (`eagsgfxunwyyxwwilldy`).
- `docs/trama-one/ROADMAP.md` — cosa manca, blocker pre-crescita, voci POST-BETA/SCALE, costruita sopra `STATE_OF_THE_ART.md`.
- `docs/trama-one/derived/TRAMA_Admin_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Control_Room.md` — Handbook normativo Admin (copia derivata, non canonica — fa fede il `.docx` originale).
- `docs/trama-one/derived/TRAMA_Partner_Product_Architecture_CX_Handbook_Draft_1.1_Trust_Layer.md` — Handbook normativo Partner (copia derivata, non canonica).
- `docs/trama-one/derived/TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md` — Handbook normativo Parent (copia derivata, non canonica).
- `supabase/schema.sql` — schema dati "bootstrap da zero", fonte di verità iniziale (non riscritto ad ogni migration successiva).
- `supabase/migration_07..37_*.sql` — migration incrementali che aggiungono le tabelle/colonne più recenti non presenti in `schema.sql` (feature flags, center leads, legal, beta feedback, travel reminders, family people, ecc.).
