# TRAMA — PRODUCT & ARCHITECTURE REVIEW
## Pilot Coordination Layer, Observability & Account Lifecycle

Fase di discovery tecnica + product design. Nessun codice modificato, nessuna migration creata, nessun deploy, nessun documento di audit congelato toccato. Ogni conclusione è ancorata a file, tabelle o funzioni realmente presenti nel repository e nel database (verificato anche via query read-only su Supabase, progetto `eagsgfxunwyyxwwilldy`).

---

## 0. Metodo e principale correzione di framing

Il principio REUSE > EXTEND > NEW ha retto quasi ovunque. La sorpresa più grande di questa review è che **quasi nessuna capability richiesta è davvero assente**: gruppi, carpooling, "chi porta/ritira", pipeline di analytics, richiesta di cancellazione account esistono già, con schema dati solido. Il problema del pilot non è "cosa costruire da zero", ma **cosa è stato costruito e poi sepolto**: spostato da voce di navigazione primaria a sotto-scheda, mai collegato a un Admin che lo mostri, mai esposto in Home. Questo cambia radicalmente le wave proposte più avanti: molto meno building, molto più *resurfacing* mirato.

---

## 2. GRUPPI — "Andiamo Insieme" (killer feature)

### A. AS-IS

**IMPLEMENTED** (Legacy + NextGen, stesse tabelle):
- `public.groups` (id, activity_id → attività singola, name, created_by, discount_percent) + `public.group_members` (group_id, parent_id) — RLS via `is_group_member()` security-definer. Creazione (`createGroupAction`, `app/actions/groups.ts:21`), adesione via link (`joinGroupAction`, riga 94), invito reale via email con token (`inviteToGroupAction`, riga 173, tabella `group_invites`, migration_25 — **verificato applicata in produzione**, tabella presente in `information_schema.tables`).
- "Scopri" gruppi pubblici: colonna `groups.is_public`, funzione `list_public_groups()` (migration_25) — chiude un gap che prima rendeva le tab "Scopri"/"Inviti" statiche placeholder ("funzionalità in arrivo").
- Bambini + preferenze per aggregazioni: `group_kids` (kid_id, preferred_tag_id, notes), `group_subgroups`/`group_subgroup_kids` generati da `generateSubgroupsAction` (raggruppa per tag dichiarato).
- Richiesta Gruppo → sconto: `group_requests` (kids_count, discount_percent calcolato da `discountForGroupSize()`, stato pending/accepted/rejected), gestita dal centro in `/center/group-requests`.
- Esposizione NextGen: `app/nextgen/groups/page.tsx` è un **guscio NextGen-native** attorno agli STESSI dati (`getGroupsForUser`, `getPublicGroups`, `getMyGroupInvites` — `lib/data/groups.ts`), introdotto apposta (commento nel file, 24/08) per chiudere "il gap più grave del rimando legacy segnalato da Fabrizio — un genitore NextGen che entrava in Gruppi finiva nel layout/bottom-nav LEGACY".

**PARTIAL / DEMOTED IN NAVIGAZIONE** (finding centrale di questa sezione):
- `components/nextgen/NextgenBottomNav.tsx` ha **5 voci**: Home/Planner/Scopri/Prenotazioni/Profilo. Il commento nel file è esplicito: *"Community esce da qui (non sparisce: dallo sprint 5.6 è già raggiungibile da Planner → scheda 'Gruppi')"* — Community/Gruppi era una 4ª voce di primo livello, **rimossa durante il rebrand TRAMA** per allinearsi al mockup a 5 voci.
- Oggi Gruppi vive come una delle 5 SCHEDE del Planner (`PlannerGroupsView.tsx`, "riepilogo... riuso puro dei dati già letti" — nessuna nuova query), raggiungibile con: Bottom nav → Planner → tab "Gruppi" → eventualmente click per aprire il dettaglio reale. **3 livelli di profondità** per la feature dichiarata "killer" nel brief.
- In Home (`app/nextgen/HomeDashboardClient.tsx`) esiste un solo segnale sociale: `communitySignal` (riga 264-274), una riga non invasiva tipo *"3 famiglie di [Community] stanno valutando [Attività]"*, con link diretto — commento esplicito: *"Home deve mostrare piccoli elementi sociali (richiesta di Fabrizio)"*. Copre solo Community con proposte attive, non Gruppi/carpool/accompagnamento.

**Modello a due livelli, già coerente** (non è duplicazione, è gerarchia intenzionale — commento in `PlannerGroupsView.tsx`): **Community** = persistente, multi-attività, ruoli creatore/admin/membro (`communities`, `community_members`, `community_activity_proposals/interest`) → una proposta con interesse sufficiente può generare un **Gruppo** vero (`spawnGroupFromProposalAction`, `app/actions/communities.ts`) legato a UNA attività per sconto + carpooling.

**LEGACY-only**: nessuna delle capability Gruppi è persa in NextGen — sono tutte raggiungibili, solo più in profondità.

### B. RECOVERY
Tutto il modello dati, le RLS, gli inviti (email+link+scoperta pubblica), la generazione aggregazioni, la richiesta sconto sono **completi e già applicati in produzione**. Zero migration necessarie per "far apparire" i Gruppi — serve solo cambiare DOVE compaiono nell'interfaccia.

### C. GAP
1. Nessuna voce di primo livello per Gruppi/Community in NextGen (sepolta in Planner→tab).
2. Home mostra il segnale sociale solo per Community con proposte attive — un Gruppo "Andiamo Insieme" con richiesta accettata, o un carpool scoperto, non genera mai un segnale in Home.
3. Nessun collegamento visibile fra Gruppo e Planner (i giorni/settimane del gruppo non appaiono nel Calendario personale).

### D. Product proposal
Non ricreare una 6ª voce di bottom nav (violerebbe lo spec esplicito "5 voci, sintesi"). Invece: **promuovere il segnale Home** già esistente (`communitySignal`) a un pattern generico "segnale coordinamento" che copre anche Gruppi (richiesta accettata, nuovo membro, aggregazione pronta) — stesso componente, stesso principio "una riga, mai un widget nuovo".

### E. Technical delta
Nessun DB. Frontend: generalizzare `CommunityHomeSignal` → `CoordinationSignal` (union type) in `lib/types.ts`, alimentata da una funzione che aggrega community+gruppi (riuso di `getGroupsForUser`/`getCommunitiesForUser`, già letti altrove). Nessuna nuova query.

### F. Pilot classification
**P0 — PILOT** (resurfacing, non rebuild).

### G. Impact
VALUE: HIGH · EFFORT: LOW · TECH RISK: LOW

---

## 3. ACCOMPAGNAMENTO E RITIRO

### A. AS-IS — IMPLEMENTED (parziale nello scope, non nell'esistenza)
`public.week_responsibilities` (schema.sql:1563): `parent_id, kid_id, week_start_date, weekday (lun..ven), moment (andata|ritorno), responsible (io|partner|nonno|nonna|tata|altro), responsible_label`. Esattamente il modello "persona + attività(giorno) + azione" richiesto — **manca solo il legame diretto con una singola occorrenza di attività/prenotazione**: è per settimana+giorno-della-settimana, non per singola prenotazione. RLS condivisa in famiglia (`parent_id = any(get_family_member_ids())`, dopo l'estensione multi-genitore) — un secondo genitore della stessa famiglia legge/scrive le stesse assegnazioni. Esposto in NextGen Planner (`app/nextgen/planner/famiglia/FamigliaClient.tsx`, `PlannerCalendarView.tsx`, `lib/nextgen/responsibility-options.ts`) come vista "Chi fa cosa". **Non esiste in Legacy.**

### B. Recovery
Tabella + RLS + UI Planner già complete e in produzione. `lib/data/responsibilities.ts`/`app/actions/responsibilities.ts` già astraggono la lettura/scrittura.

### C. Gap
1. Scope settimana/giorno-della-settimana, non attività/data specifica: due iscrizioni diverse nello stesso weekday (es. due centri il martedì) condividono la stessa riga — ambiguo con più di un'attività per giorno.
2. Nessun collegamento con Gruppo/altri genitori NON della stessa famiglia: "altro genitore del gruppo" (dal brief) non è un valore valido di `responsible` (solo io/partner/nonno/nonna/tata/altro testo libero) — non referenzia `group_members`/`carpool_offers`.
3. Nessuna notifica quando un'assegnazione cambia o resta scoperta.

### D. Product proposal
Non ricostruire il modello (è già la responsabilità organizzativa richiesta). Estendere `responsible` con un settimo valore `altro_genitore_gruppo` che referenzia `group_members.parent_id`, così un accompagnamento può essere assegnato a un genitore del gruppo — base diretta per il carpool (sezione 4).

### E. Technical delta
DB: 1 migration additiva (nuova colonna opzionale `responsible_group_member_id uuid references group_members`, nessuna modifica a righe esistenti). Frontend: 1 opzione in più nel selettore già esistente.

### F. Pilot classification
**P1 — AFTER INITIAL PILOT** (il modello attuale, family-scoped, è già sufficiente per il pilot: il gap "altro genitore del gruppo" è un'estensione, non un blocco).

### G. Impact
VALUE: MEDIUM · EFFORT: LOW · TECH RISK: LOW

---

## 4. PASSAGGI AUTO / CARPOOLING

### A. AS-IS — IMPLEMENTED, non perso, ma invisibile su NextGen
Contrariamente all'ipotesi del brief ("capability persa durante l'evoluzione"): `public.carpool_offers` (group_id, parent_id, seats_available, has_child_seat, legs andata/ritorno/entrambe, notes) e `public.carpool_requests` (stesso scope, kids_count, needs_child_seat) esistono, con RLS, dal modello Gruppi "avanzati" (`migration_gruppi_avanzati.sql`, già confluito in `schema.sql`). Matching logico puro in `lib/carpool.ts` (`matchesForRequest`/`buildCarpoolMatches`: filtra per tratta compatibile, posti sufficienti, seggiolino se serve — **mai una prenotazione vincolante**, resta un suggerimento, "l'accordo finale resta tra genitori" per commento esplicito). Server actions complete: `upsertCarpoolOfferAction`/`removeCarpoolOfferAction`/`upsertCarpoolRequestAction`/`removeCarpoolRequestAction` (`app/actions/groups.ts:506-590`). UI: `components/GroupDetailClient.tsx` (**solo Legacy**).

**Verificato con grep mirato**: zero occorrenze di `carpool`/`pickup`/`dropoff`/`accompagn` in tutto l'albero `app/nextgen/` — il carpool NON è stato ricostruito in NextGen, è rimasto indietro quando `/nextgen/groups` è stato creato come guscio (la pagina NextGen riusa `GroupsClient` per lista/scoperta/inviti, ma il **dettaglio gruppo con carpool non ha ancora un equivalente NextGen-native**).

### B. Recovery
100% del modello dati e della logica di matching sono riusabili senza modifiche. Serve "solo" collegare `carpool_offers`/`carpool_requests` alla pagina dettaglio gruppo NextGen (quando esisterà, o al componente Legacy riusato via bridge, come già fatto altrove nel progetto per `/nextgen/groups`).

### C. Gap
Scope solo di gruppo (non di singolo giorno/attività): un'offerta "porto io, 2 posti, andata+ritorno" vale per l'intero gruppo, non per singole date — coerente col brief ("nasce naturalmente tra persone che condividono gruppo e attività", non un marketplace granulare), ma non si integra ancora con `week_responsibilities` (sezione 3) per sapere CHI ha bisogno di un passaggio in un giorno specifico.

### D. Product proposal
Minimum Lovable Feature — esattamente ciò che esiste già, esposto su NextGen: pattern testuale semplice ("Martedì porto io" / "2 posti disponibili" / "Mi serve un passaggio"), stessa UI Legacy portata su `/nextgen/groups/[id]`. **Nessun marketplace**, nessuna prenotazione — resta un suggerimento fra genitori dello stesso gruppo, come oggi.

### E. Technical delta
Nessun DB. Frontend: creare (o adattare) `app/nextgen/groups/[id]/page.tsx` che usa gli stessi dati/azioni di `GroupDetailClient.tsx`, stile NextGen — stesso pattern già seguito per la lista gruppi.

### F. Pilot classification
**P0 — PILOT LEVERAGE** (alto valore percepito, zero lavoro DB, il gap è puramente "manca la pagina NextGen").

### G. Impact
VALUE: HIGH · EFFORT: LOW-MEDIUM · TECH RISK: LOW

---

## 5. NOTIFICHE

### A. AS-IS
**MISSING**: nessuna tabella `notifications`, nessun notification center, nessuna push subscription/VAPID (verificato: zero risultati DB e codice). **PARTIAL/pattern esistenti riusabili**:
- **Unread booleano per-riga**: `activity_inquiries.read_by_parent`/`read_by_center` (schema.sql:797-798) — unico precedente di "badge non letto", commento esplicito: *"deve essere notificato da entrambe le parti l'arrivo di un messaggio... con un pallino"*.
- **Reminder calcolati, non persistiti**: `lib/nextgen/reminders.ts` — banner con tono urgent/warning/info + CTA opzionale, calcolati ad ogni render da dati già letti (prenotazioni in scadenza, attività imminenti, settimana prioritaria scoperta). Nessuna schedulazione, nessun invio, nessuna persistenza "letto/non letto".
- **Toast client-side**: `NextgenToastProvider` (`app/nextgen/layout.tsx`) — feedback immediato di un'azione, non persistito, sparisce al reload.
- **Email transazionali**: `lib/email.ts`/`sendEmail()`, usata SOLO per: invito gruppo, invito famiglia, invito sconto centro, risposta booking Partner, check-in, presenze — tutte innescate da un'azione precisa, mai un digest/riepilogo.
- **Unico "cron" esistente**: `/internal/beta-pipeline` — endpoint interno protetto da secret, chiamato ogni 15' da un'automazione esterna (non Vercel Cron nativo) per processare `beta_feedback` confermati. Precedente riusabile per un futuro digest schedulato.
- **Home come sostituto dichiarato**: commento esplicito in `HomeDashboardClient.tsx`: *"non esiste ancora un centro notifiche dedicato: il segnale Community e le sezioni Check-in/Attività da confermare assolvono per ora al ruolo 'Notifiche'"*.

### B. Recovery
Pattern unread booleano (`activity_inquiries`) e reminder calcolati sono riusabili come TEMPLATE per i nuovi eventi, non serve un framework nuovo.

### C. Gap
Nessuna vera "coda eventi → utente → canale". Ogni nuovo evento (invito gruppo, richiesta risposta, accompagnamento scoperto, passaggio offerto/accettato) oggi richiederebbe di essere aggiunto punto-per-punto senza un modello comune.

### D. Product proposal — progressione (evita notification fatigue)
**Livello 0 (pilot)**: badge non letto (pattern `activity_inquiries`) esteso a `group_invites` (già ha `status`, manca solo `seen_at`) e a `week_responsibilities` scoperte. **Livello 1**: mini notification center in-app (lista, non push), alimentata da una VISTA calcolata (non una nuova tabella pesante) che unisce: inviti gruppo pendenti, richieste con risposta, accompagnamento non assegnato, passaggio offerto. **Livello 2 (dopo pilot)**: email digest giornaliero/settimanale (riuso pipeline `/internal/*` + `lib/email.ts`). **Livello 3 (later)**: push reali (richiede VAPID/service worker, oggi assente).

Per evento (estratto, i più rilevanti per il pilot):

| EVENTO | DESTINATARIO | PRIORITÀ | CANALE | AZIONE | DEEP LINK |
|---|---|---|---|---|---|
| Invito a gruppo ricevuto | Invitato | media | in-app | accetta/rifiuta | `/nextgen/groups` (tab Inviti) |
| Richiesta gruppo accettata dal centro | Membri gruppo | alta | in-app+email | vedi sconto | `/nextgen/groups/[id]` |
| Risposta del centro a una richiesta | Genitore | alta | in-app+email (già esiste) | leggi risposta | `/richieste` |
| Accompagnamento ancora non assegnato (giorno T-1) | Genitore | media | in-app | assegna | Planner → Famiglia |
| Passaggio offerto nel gruppo | Genitori senza offerta | bassa | in-app | vedi offerta | `/nextgen/groups/[id]` |

### E. Technical delta
DB: 1 colonna `seen_at`/`read_at` su `group_invites` (additiva). Backend: 1 funzione di aggregazione "centro notifiche" (query, non tabella nuova). Frontend: 1 badge + 1 lista, riuso stile esistente.

### F. Pilot classification
**P0 — PILOT** (Livello 0/1 minimi) · Livello 2/3 = **P2 — LATER**.

### G. Impact
VALUE: HIGH · EFFORT: MEDIUM · TECH RISK: LOW

---

## 6. LINK INVITO BETA / ROUTING TRAMA ONE

### Funnel ricostruito (con citazioni esatte)
`?beta=CODICE` → letto in `LoginForm.tsx:65` (`searchParams.get("beta")`) → **validato** via `getBetaInvitePreviewAction()` (RPC `get_beta_invite_preview`, mostra solo un badge, mai bloccante) → passato come `raw_user_meta_data.beta_invite_code` in `signUp()` → **assegnazione cohort** avviene nel trigger DB `handle_new_user()` (migration_30, verificato applicato: `pg_get_functiondef` corrisponde esattamente al file autore) — incrementa `beta_invite_codes.redeemed_count` e inserisce in `beta_cohort_memberships` **solo se** il codice è attivo/non scaduto/non esaurito, in un blocco `exception when others then null` (non può mai bloccare la registrazione) → **conferma email** → `app/auth/callback/route.ts` → **redirect**.

**Root cause (risolta in questa stessa sessione, commit `35642bd`, non ancora deployato)**: prima del fix, sia il redirect di conferma email sia ogni login successivo di `LoginForm.tsx` sceglievano `next ?? "/"` — la Legacy Home — **indipendentemente dalla cohort**. Prima del 27/08 non era un problema bloccante: `VersionToggle.tsx` era visibile a chiunque, un beta tester poteva comunque passare a NextGen con un tocco. Da quando quel pulsante è stato ristretto alle sole utenze di test di Fabrizio (richiesta esplicita, stessa sessione), un beta tester esterno atterrato su Legacy **non aveva più alcun modo di raggiungere NextGen** — confermato in produzione: l'account "Maria" (`mariafpoli@gmail.com`), iscritto tramite `TRAMABETA26`, correttamente membro della cohort (verificato via query read-only), risultava comunque su Legacy.

**Fix minimo consigliato (già implementato, non deployato)**: `lib/auth/default-landing.ts#resolveDefaultLandingPath()` — se il ruolo profilo è `parent` e `TRAMA_ONE_ENABLED` risolve `true` per quell'utente (stesso flag/cohort già usato per Onboarding Carousel/Spotlight), la destinazione di default diventa `/nextgen` invece di `/`. Usato sia nel callback (`app/auth/callback/route.ts`) sia nel login normale (`app/actions/navigation.ts`, chiamato solo per tenant `family`).

**Comportamento per caso**:
- Nuovo utente + codice valido → redirect NextGen dopo conferma email (col fix).
- Utente già esistente che riusa `?beta=` → nessun duplicate signup (Supabase anti-enumerazione, vedi anche il secondo bug corretto in sessione: "email già registrata" ora mostra un errore esplicito invece di un falso "controlla la mail").
- Login successivo (senza `?beta=` in URL) → col fix, ogni login normale ri-verifica la cohort e forza NextGen finché l'utente resta membro attivo.
- Partner/Admin → invariati (guardia sul ruolo profilo + tenant "family" esplicito in `getPostLoginDestinationAction`).

**Rischi di regressione**: nessuno rilevato nella verifica statica (tsc/eslint/build puliti, già eseguiti in sessione) — una query in più per profilo/flag ad ogni login `family` (trascurabile, stesso servizio già interrogato altrove nello stesso request).

### Classificazione
**PILOT BLOCKER** — senza questo fix, ogni nuovo invitato Beta che si registra rischia di restare permanentemente su Legacy, vanificando lo scopo stesso del link di invito. Il fix esiste già in questa sessione (commit `35642bd`) ma **richiede un deploy** (non ancora eseguito da Fabrizio a questa data).

---

## 7. CANCELLAZIONE ACCOUNT

### A. AS-IS — PARTIAL, non assente
UI completa in `components/ProfilePrivacySection.tsx`: due azioni distinte, **Disattiva temporaneamente** (reversibile, `account_status='deactivated'`) e **Richiedi cancellazione account** (`requestAccountDeletionAction`, `account_status='deletion_requested'` + `deletion_requested_at`), con conferma a due passaggi e copy esplicito "diritto all'oblio... non è reversibile una volta completata". **La cancellazione VERA è manuale**: commento nel codice, *"va evasa manualmente da un platform_admin dal SQL Editor di Supabase"* — nessuna automazione, nessuna Admin UI che mostri le richieste in coda (verificato: zero riferimenti a `deletion_requested` in `app/admin/`). Questo gap è **già documentato e classificato rischio MEDIO** in un audit esistente e congelato: `docs/trama-one/analysis/TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md`, voce C-05 — *"i diritti esistono in principio ma senza processo end-to-end tracciato... rischio medio, accettabile temporaneamente per una Beta a piccola scala"*.

### B. Lifecycle FK verificato via query diretta sul DB (delete CASCADE da `profiles`)
CASCADE: `kids`, `bookings`, `booking_kids` (via kids), `favorites`, `group_members`, `group_kids`, `carpool_offers/requests`, `community_members`, `community_activity_interest`, `family_members`, `plan_shares`, `parent_addresses`, `week_responsibilities`, `activity_inquiries`, `tutorial_progress`, `beta_cohort_memberships`, `beta_feedback`, `reviews`, `school_calendar_overrides`, `kid_school_profiles`, `attendance_records` (via kids), `parental_declarations` (via kids).
SET NULL (il dato sopravvive, l'attribuzione si perde): `groups.created_by`, `families.created_by`, `group_invites.invited_by/accepted_by`, `group_requests.requested_by`, `invites.created_by/registered_parent_id`, `activity_log.actor_id`, `feature_flag_overrides.created_by/updated_by`, `beta_invite_codes.created_by/updated_by`, `beta_cohort_memberships.created_by/updated_by`, certificazioni/onboarding centro.

### C. Gap
1. Un hard delete cancella `reviews` (recensioni pubbliche visibili ad altri/al centro) — potrebbe essere un dato che il centro ha interesse a conservare (analogo a un cliente che cancella l'account su un e-commerce: la recensione spesso resta, anonimizzata).
2. Un hard delete cancella `bookings`/`booking_days`/`booking_weeks` — un centro potrebbe avere bisogno dello storico prenotazioni per la propria contabilità anche dopo la cancellazione del genitore.
3. Nessuna finestra di attesa/annullamento della richiesta di cancellazione, nessun export/portabilità dati (già segnalato in C-05).

### D. Product proposal
UX minima **già esistente e sufficiente per il pilot** (Settings → Cancella account → spiegazione → conferma forte → richiesta registrata). Manca solo il lato Admin: una coda "Richieste di cancellazione" (stesso pattern del Command Center, sezione 8) con un'azione "Esegui cancellazione" che invochi una funzione SQL security-definer dedicata (non ancora scritta) che: anonimizza `reviews` (testo→null, mantiene rating aggregato) invece di cancellarle, mantiene `bookings` con `parent_id` anonimizzato (SET NULL già previsto da `groups`/`invites`, stesso pattern andrebbe esteso a `bookings`), e SOLO DOPO esegue il delete reale su `auth.users` (cascata sul resto).

### E. Technical delta
DB: 1 migration che (a) cambia `bookings.parent_id` da CASCADE a SET NULL con colonna aggiuntiva `deleted_parent_email_hash` per riferimento contabile centro (**da verificare legalmente**), (b) anonimizza anziché cancellare `reviews.comment`. Backend: 1 funzione admin-only di esecuzione cancellazione. Frontend: 1 riga in più nel Command Center Admin.

**Richiede verifica legale/GDPR esplicita**: se la conservazione anonimizzata di `bookings`/`reviews` per finalità contabili del centro sia legittima senza consenso esplicito aggiuntivo, e i tempi di retention.

### F. Pilot classification
**P1 — AFTER INITIAL PILOT** (UI utente già esiste ed è sufficiente; l'esecuzione manuale via SQL Editor è accettabile per il volume di un pilot, come già concluso in C-05).

### G. Impact
VALUE: MEDIUM · EFFORT: MEDIUM · TECH RISK: MEDIUM (per via delle implicazioni legali sui dati del centro)

---

## 8. ADMIN — NUOVI UTENTI E PILOT MONITORING

### A. AS-IS
**MISSING** come pagina dedicata (verificato: nessun `app/admin/users` o equivalente). **RECOVERY-RICCO**: il Command Center Admin (`lib/data/command-center.ts`, `/admin/one`, completato Build Sprint 6/DEC-51) aggrega già 7 code operative esistenti (onboarding centri, prenotazioni in attesa, richieste aperte, lead centro, certificazioni, feedback Beta, allarmi feature flag) con un pattern di priorità calcolata (`lib/command-center/priority.ts`) — **stesso pattern riusabile** per una nuova coda "Nuovi utenti/Pilota". `/admin/beta-invites` (costruito in questa sessione) mostra già codici e conteggio redenzioni aggregato, non la lista utenti.

### B. Recovery — dati già disponibili per-utente (nessuna nuova tabella)
`profiles.created_at` (data registrazione), `beta_cohort_memberships` (cohort + `active`), `profiles.role`, `tutorial_progress` (**ha `user_id`, `status`, `started_at`, `completed_at`** — "onboarding completato" è già derivabile), `bookings.created_at`/`kids.created_at` (prima attività significativa), `auth.users.last_sign_in_at` (via service client, ultima attività).

### C. Gap
Nessuna vista che unisca questi segnali per-utente in una lista consultabile.

### D. Product proposal
Una pagina `/admin/one/pilot` (o una coda aggiuntiva nel Command Center): tabella "chi è entrato" con colonne Email · Data registrazione · Cohort · Ruolo · Onboarding (da `tutorial_progress`) · Prima attività (da `bookings`/`kids`) · Ultimo accesso (`last_sign_in_at`) · Stato pilot (derivato: "non ancora attivo" se nessuna prenotazione/bambino dopo N giorni). **Nessuna notifica real-time**: una tabella aggiornata a lettura, coerente col resto del Command Center (no overengineering, no CRM).

### E. Technical delta
Backend: 1 nuova funzione di lettura (`lib/data/pilot-users.ts`) che joina `profiles`+`beta_cohort_memberships`+`tutorial_progress`+`bookings`+`kids` via service client (stesso pattern di `getBetaInviteCodesForAdmin`). Frontend: 1 pagina Admin, stile tabellare esistente. **Zero migration.**

### F. Pilot classification
**P0 — PILOT OBSERVABILITY** (indispensabile per capire se il pilot funziona, costo bassissimo perché tutti i dati esistono già).

### G. Impact
VALUE: HIGH · EFFORT: LOW · TECH RISK: LOW

---

## 9. PRODUCT ANALYTICS / EVENT LOGGING

### A. AS-IS — infrastruttura pronta, tassonomia troppo stretta
`public.product_events` (migration_20, **verificato applicata in produzione**): colonne `event_name, correlation_id, tenant, role, detail, created_at` — **deliberatamente senza `user_id`** (per costruzione: `lib/telemetry/correlation.ts` vieta esplicitamente qualunque identificativo utente/PII, whitelist `TELEMETRY_FORBIDDEN_FIELDS`). `persistProductEvent()` (`lib/telemetry/events.ts`) scrive SOLO eventi nella whitelist `KNOWN_PRODUCT_EVENTS` (`lib/telemetry/known-events.ts`): oggi sono 9, tutti di **osservabilità tecnica** (`one_route_access`, `one_route_fallback`, `feature_flag_silent_fallback_expired_override`, `walkthrough_step_*`, `spotlight_*`) — **zero eventi di prodotto/funnel** (nessun `group_created`, `booking_created`, `invite_opened`...). `lib/analytics.ts` (Admin, riga per riga verificata) è interamente business analytics aggregato (occupazione settimanale, breakdown tag/età, centri vicini) — non tocca utenti singoli, per disegno (DEC-52: "affianca senza sostituire").

### B. Recovery
Il pattern whitelist + `persistProductEvent()` + `logTelemetryEvent()` "prima, sempre" è solido e pronto: **aggiungere un evento nuovo costa una riga in `KNOWN_PRODUCT_EVENTS` + una chiamata al call site**, zero nuova infrastruttura.

### C. Gap
Senza `user_id` (nemmeno pseudonimizzato), `product_events` non può MAI rispondere a "quanti utenti hanno completato l'onboarding" o "quanti sono tornati" — solo "quante volte è successo X" in aggregato. Per l'Admin monitoring (sezione 8) e per un vero funnel serve un identificativo, anche pseudonimo.

### D. Product proposal — tassonomia minima (dettaglio in sezione finale)
Estendere `KNOWN_PRODUCT_EVENTS` con un piccolo set di eventi di attivazione (vedi Event Taxonomy MVP sotto), aggiungendo una colonna opzionale `user_id_hash` (mai l'uuid reale, un hash troncato) SOLO per poter contare utenti unici senza poter risalire a PII in chiaro — decisione che richiede una scelta esplicita di Fabrizio (vedi sezione Decisioni).

### E. Technical delta
DB: 1 colonna additiva opzionale su `product_events` (o tabella parallela, per non toccare la RLS/insert-policy esistente). Backend: estendere whitelist, 5-8 call site nuovi (group create/join, carpool offer, booking create, ecc.). **Nessuna sostituzione di `lib/analytics.ts`.**

### F. Pilot classification
**P0 — PILOT OBSERVABILITY** (tassonomia minima) · un vero funnel storico = **P1**.

### G. Impact
VALUE: HIGH · EFFORT: LOW-MEDIUM · TECH RISK: LOW (se si rispetta la minimizzazione già in vigore)

---

## 10. PRIVACY BY DESIGN — verifica trasversale

Il progetto ha già una cultura di minimizzazione insolitamente rigorosa per questo stadio (whitelist eventi, divieto esplicito PII in telemetry, RPC che restituiscono solo campi non sensibili per anteprime pubbliche — stesso pattern usato sia per inviti sconto sia per inviti Beta). I gap reali non sono di disegno ma di **processo**: cancellazione manuale (sezione 7, già in C-05), nessun export/portabilità dati. **Da verificare legalmente**: retention di `bookings`/`reviews` dopo cancellazione account (sezione 7), e se un futuro `user_id_hash` in `product_events` (sezione 9) richieda un aggiornamento della privacy policy.

---

## 11. ANALISI TRASVERSALE — COORDINATION LAYER

L'ipotesi del brief è **confermata dall'evidenza**: Attività + Gruppo + Persone + Giorno + Accompagnamento/Ritiro + Passaggio + Notifica non è un modello da inventare — è **quasi interamente già costruito**, sparso su tabelle distinte ma coerenti:

```
Activity (activities) ──< Group (groups, 1 attività per gruppo)
                              │
                              ├──< GroupMember (group_members) ──> Person (profiles)
                              ├──< GroupKid (group_kids) ──> Child (kids)
                              ├──< CarpoolOffer / CarpoolRequest (per Person+Group)
                              └──< GroupRequest (sconto, → Center)

Community (communities, multi-attività, persistente)
   ├──< CommunityMember (ruoli creatore/admin/membro)
   └──< CommunityActivityProposal/Interest ──spawn──> Group

Family (families) ──< FamilyMember (multi-genitore)
   └──< WeekResponsibility (parent_id, kid_id, week+weekday+moment, responsible)
         [GAP: responsible non referenzia ancora group_members — vedi sez.3]

Notification: MANCANTE come entità — oggi solo pattern sparsi (unread booleano,
reminder calcolati, toast, email puntuali) — nessuna tabella dedicata.
```

**Entità mancanti** (le uniche vere): (1) un ponte esplicito fra `week_responsibilities.responsible` e `group_members`/`carpool_offers` (sezione 3); (2) un'entità Notification/evento aggregato (sezione 5); (3) un identificativo utente in `product_events` per l'osservabilità per-persona (sezione 9). Tutto il resto — Group, Community, Family, Carpool, Responsibility — esiste già e è coerente.

---

## 12. HOME — VALUE SURFACE

**AS-IS verificato** (`app/nextgen/HomeDashboardClient.tsx`, spec esplicita di Fabrizio citata nel codice): Hero "Stato della famiglia" (copertura sintetica) → Check-in del giorno → Prossimo appuntamento (singolare) → Suggerimenti → Attività da confermare → segnale Community (se rilevante) → CTA "Apri Planner". Commento esplicito: *"non esiste ancora un centro notifiche dedicato: il segnale Community e le sezioni Check-in/Attività da confermare assolvono per ora al ruolo 'Notifiche'"* — cioè Fabrizio ha già, implicitamente, costruito una Home a 3 livelli (Cosa succede / Cosa devo fare / Con chi mi sto organizzando), senza chiamarla così.

**Proposta minima**: non aggiungere sezioni. Generalizzare il singolo segnale Community esistente in un piccolo slot "Con chi mi sto organizzando" che può mostrare, in ordine di rilevanza, UNO tra: segnale Community, richiesta gruppo appena accettata, accompagnamento di domani non ancora assegnato — sempre una riga, mai un widget per feature. La Home resta "solo sintesi" per spec esplicita: il cambiamento è nel CONTENUTO possibile dello slot sociale già esistente, non nella struttura.

---

# OUTPUT TRASVERSALE

## 1. PILOT BLOCKERS
1. **Routing Beta→Legacy** (sezione 6) — fix già scritto in questa sessione (commit `35642bd`), manca solo il deploy. Senza deploy, ogni nuovo invitato Beta rischia di restare intrappolato su Legacy.
2. Nessun altro blocker reale identificato: le altre capability richieste (gruppi, carpool, accompagnamento) esistono già; i gap sono di esposizione, non di assenza.

## 2. TOP 5 PILOT LEVERAGE ITEMS
1. **Carpool su NextGen** (sez.4) — dato/logica pronti al 100%, manca solo la pagina; altissimo valore percepito per zero rischio DB.
2. **Admin: pagina "Nuovi utenti/Pilota"** (sez.8) — tutti i dati esistono già per-utente; senza questa pagina Fabrizio sta pilotando alla cieca.
3. **Segnale coordinamento in Home** (sez.2/12) — generalizzare un componente che già esiste (`communitySignal`), zero nuove query.
4. **Tassonomia eventi minima** (sez.9) — estendere una whitelist già pronta, pochi call site.
5. **Bridge accompagnamento↔gruppo** (sez.3) — una colonna additiva che collega due modelli già completi e sblocca il carpool "reale" (chi ha bisogno di un passaggio in un giorno preciso, non solo "nel gruppo in generale").

## 3. PROPOSED MINIMUM TRAMA COORDINATION MODEL
Vedi diagramma in sezione 11 — confermato supportato dall'evidenza, non ipotetico.

## 4. HOME PROPOSAL
Vedi sezione 12 — nessun redesign, generalizzazione di un pattern (slot sociale a 1 riga) già presente e già voluto esplicitamente da Fabrizio.

## 5. EVENT TAXONOMY MVP

| EVENT NAME | WHEN FIRES | ACTOR | PAYLOAD MINIMO | PII | RETENTION | ADMIN? |
|---|---|---|---|---|---|---|
| `beta_invite_redeemed` | trigger `handle_new_user()`, codice valido | system | cohort_key | no | 12 mesi | sì |
| `onboarding_completed` / `onboarding_skipped` | fine carousel Beta | parent | — (già tracciato in `tutorial_progress`) | no | 12 mesi | sì |
| `group_created` / `group_joined` | `createGroupAction`/`joinGroupAction` | parent | group_id | no | 12 mesi | sì |
| `carpool_offer_created` | `upsertCarpoolOfferAction` | parent | group_id | no | 12 mesi | no (solo aggregato) |
| `booking_created` | prima prenotazione reale | parent | — | no | 12 mesi | sì (proxy "attivazione") |
| `meaningful_return` | 2° accesso dopo 7+ giorni | parent | — | no | 12 mesi | sì |

Tutti riusano `persistProductEvent()` esistente; nessuno introduce PII (nessun payload libero, solo id tecnici già ammessi dal disegno attuale).

## 6. IMPLEMENTATION WAVES

**WAVE 0 — FIX/BLOCKERS**
Scope: deploy del fix routing Beta (già scritto, commit `35642bd`).
Dipendenze: nessuna. Migration: nessuna. Test: manuale (Maria/Luca ri-login → verificare atterraggio NextGen). Rischio: basso. Completamento: Maria/Luca su NextGen dopo un login normale, verificato via query Supabase.

**WAVE 1 — PILOT OBSERVABILITY**
Scope: pagina Admin "Nuovi utenti/Pilota" (sez.8) + tassonomia eventi minima (sez.9, colonna `user_id_hash` opzionale — **decisione di Fabrizio richiesta**).
Dipendenze: nessuna da Wave 0. Migration: 1 additiva (colonna `product_events.user_id_hash` o tabella parallela). Test: verifica manuale che la pagina mostri correttamente Maria/Luca. Rischio: basso. Completamento: Fabrizio può rispondere "chi è entrato e ha iniziato ad usare TRAMA" senza SQL Editor.

**WAVE 2 — COORDINATION CORE**
Scope: carpool su NextGen (sez.4) + bridge accompagnamento↔gruppo (sez.3) + segnale coordinamento generalizzato in Home (sez.2/12) + livello 0/1 notifiche (badge non letto + mini centro, sez.5).
Dipendenze: Wave 1 utile ma non bloccante. Migration: 2 additive (colonna `week_responsibilities.responsible_group_member_id`, colonna `seen_at` su `group_invites`). Test: regressione Legacy groups (nessuna modifica) + nuova pagina NextGen. Rischio: medio (nuova pagina, non nuovo modello). Completamento: un genitore può offrire/richiedere un passaggio da NextGen, vedere un accompagnamento scoperto e un badge non letto.

**WAVE 3 — PILOT LEARNING ITERATION**
Scope: cancellazione account con anonimizzazione (sez.7, **richiede verifica legale prima**) + email digest (sez.5 livello 2) + funnel storico con `product_events` esteso.
Dipendenze: Wave 1 (tassonomia) + verifica legale esplicita. Migration: 1 (SET NULL su `bookings.parent_id` + funzione anonimizzazione). Rischio: medio-alto (dati contabili centro). Completamento: Admin può eseguire una richiesta di cancellazione senza SQL Editor, con retention corretta.

## 7. DECISIONI PER FABRIZIO

1. **`product_events.user_id_hash`**: introdurre un identificativo pseudonimo per contare utenti unici (necessario per un vero funnel), sapendo che oggi il disegno lo vieta esplicitamente per scelta di minimizzazione? (sez.9)
2. **Retention `bookings`/`reviews` dopo cancellazione account**: anonimizzare e conservare per contabilità centro, o cancellare comunque? Richiede parere legale (sez.7).
3. **`week_responsibilities.responsible`**: estendere a "altro genitore del gruppo" ora (Wave 2) o restare scoped-famiglia per questo pilot? (sez.3)
4. **Notifiche livello 2 (email digest)**: prioritario per il pilot o rimandabile a dopo? (sez.5)
5. **Carpool NextGen**: pagina dedicata `/nextgen/groups/[id]` o bridge temporaneo verso il componente Legacy? (sez.4)
6. **Home — slot coordinamento**: quali segnali includere oltre a Community (gruppo accettato? accompagnamento scoperto?) e con quale priorità se più di uno è vero contemporaneamente? (sez.2/12)
7. **Community vs Gruppi in navigazione**: restano sotto Planner→tab per questo pilot, o vale la pena riconsiderare una voce di primo livello ora che il pilot enfatizza il coordinamento? (sez.2)

---

# TRAMA PILOT ARCHITECTURE REVIEW — COMPLETE

| ITEM | AS-IS | TARGET | PRIORITY | VALUE | EFFORT | RISK | WAVE |
|---|---|---|---|---|---|---|---|
| Routing Beta→Legacy | Fix scritto, non deployato | Deploy | BLOCKER | HIGH | LOW | LOW | 0 |
| Admin: nuovi utenti/pilota | Missing (dati pronti) | Pagina di lettura | P0 | HIGH | LOW | LOW | 1 |
| Event taxonomy minima | Whitelist tecnica, no funnel | +6 eventi prodotto | P0 | HIGH | LOW-MED | LOW | 1 |
| Carpool su NextGen | Implemented, Legacy-only | Pagina NextGen | P0 | HIGH | LOW-MED | LOW | 2 |
| Segnale coordinamento Home | Partial (solo Community) | Generalizzato | P0 | HIGH | LOW | LOW | 2 |
| Notifiche liv.0/1 (badge+centro) | Missing/pattern sparsi | Mini centro in-app | P0 | HIGH | MEDIUM | LOW | 2 |
| Bridge accompagnamento↔gruppo | Partial | +1 colonna | P1 | MEDIUM | LOW | LOW | 2 |
| Cancellazione account automatizzata | Partial (manuale, già in C-05) | Coda Admin + anonimizzazione | P1 | MEDIUM | MEDIUM | MEDIUM | 3 |
| Notifiche liv.2 (email digest) | Missing | Digest schedulato | P2 | MEDIUM | MEDIUM | LOW | 3 |
| Community/Gruppi 1° livello nav | Demoted (sub-tab) | Decisione Fabrizio | P2 | MEDIUM | LOW | LOW | — |
