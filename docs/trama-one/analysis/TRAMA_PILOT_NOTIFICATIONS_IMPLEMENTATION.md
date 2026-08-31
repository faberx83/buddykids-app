# TRAMA — Pilot Wave 3: Actionable In-App Notifications

Fonte: `docs/trama-one/analysis/TRAMA_PILOT_ARCHITECTURE_REVIEW.md`. Costruita sopra Wave 1 (Pilot Observability) e Wave 2 (Coordination Resurfacing), entrambe verificate presenti su `main` e deployate prima di iniziare (vedi report di stato). Nessuna migration, nessun deploy, nessuna modifica al routing Beta.

## Architettura: COMPUTED, non persistita

Nessuna tabella `notifications`. Ogni `NotificationItem` (`lib/notifications/model.ts`) è calcolato ad ogni lettura da stato di dominio già esistente — `group_invites`, `activity_inquiries`, `bookings`, `group_requests`, `carpool_offers`/`carpool_requests` — tramite le stesse funzioni data-layer già scritte per le UI corrispondenti (o loro estensioni minime). L'id è deterministico (`${type}:${entityId}`): la stessa condizione di dominio produce sempre lo stesso id, quindi non serve nessuna logica di deduplica separata (NOTIF-P10, verificato in test).

## Fonti dati (REUSE > EXTEND > NEW)

Invito a gruppo pendente: `getMyGroupInvites()` (`lib/data/groups.ts`, già esistente, wrapper della RPC `list_my_group_invites()`, già usata anche da Wave 2). Risposta del centro a una richiesta: `getInquiriesForParent()` (`lib/data/inquiries.ts`, riusa `activity_inquiries.read_by_parent`). Risposta del centro a una prenotazione: `getMyBookingsForParent()` (`lib/data/my-bookings.ts`), esteso con un campo additivo `respondedAt` (colonna `bookings.responded_at`, già esistente in produzione, semplicemente non ancora selezionata da questa query) — nessuna colonna nuova, nessuna migration. Richiesta gruppo accettata: `getRecentAcceptedGroupRequests()`, estratta da `lib/data/coordination-signal.ts` (Wave 2) in una funzione condivisa — stessa query, stessa finestra di 14 giorni, UNA SOLA fonte di verità sia per il Coordination Signal Home sia per le Notifiche (refactor locale esplicitamente permesso dal task). Carpool: `getCarpoolMatchSignals()` (`lib/data/carpool-signals.ts`, nuovo), che riusa **tale e quale** `matchesForRequest()` (`lib/carpool.ts`, pura, già usata da `GroupDetailClient.tsx` per "Abbinamenti proposti"), applicata a tutti i gruppi dell'utente invece che a uno solo.

## Notification types e priorità

`group_invite_pending` (ACTION) — un invito pendente/inviato indirizzato all'email del genitore. `inquiry_reply` (IMPORTANT) — il centro ha risposto a una richiesta; niente ACTION perché quel ticketing è "un solo giro", non c'è altro da fare oltre a leggere. `booking_response` (ACTION se `partner_decision='proposed'`, altrimenti IMPORTANT) — accettata/rifiutata sono decisioni già definitive, una proposta alternativa richiede invece una risposta del genitore. `group_request_accepted` (IMPORTANT) — lo sconto è già applicato automaticamente, nessuna azione richiesta. `carpool_match_for_my_request`/`carpool_match_for_my_offer` (ACTION) — un abbinamento compatibile è sempre "da guardare e possibilmente rispondere" (mettersi d'accordo con l'altro genitore).

Ordinamento: ACTION → IMPORTANT → INFO, poi più recente (`sortNotifications`, testata in NOTIF-P07).

### Carpool — perché solo questi due eventi

Il task elencava anche "nuova offerta"/"nuova richiesta" generiche come candidate. Deliberatamente NON implementate: notificare ogni nuova offerta/richiesta a chiunque nel gruppo, a prescindere da compatibilità, sarebbe "notify for activity", non per azione o cambiamento rilevante (principio §1 del task). I due eventi implementati notificano SOLO quando l'utente ha una richiesta/offerta propria E esiste un abbinamento compatibile — derivato dalla stessa funzione di matching già in produzione, zero regole nuove inventate.

## Seen/read — due meccanismi, mai confusi con "resolved"

**Colonna DB reale** (`inquiry_reply`, `booking_response`): `isSeen` arriva già corretto dal server (`read_by_parent`); il tap su un item chiama le azioni server ESISTENTI e NON modificate (`markInquiriesReadAction`, `markBookingsReadAction`), che toccano solo quella colonna — mai `status`/`partner_decision` (NOTIF-P05: aprire la notifica non equivale a risolvere la richiesta/prenotazione, quello resta deciso dal centro).

**Cursore client-side** (`group_request_accepted`, `carpool_match_for_my_request`, `carpool_match_for_my_offer`): nessuna colonna DB "letto" esiste per `group_requests`/`carpool_offers`/`carpool_requests`, e aggiungerne una avrebbe richiesto una migration. Scelta: un timestamp "ultimo accesso al center" in `localStorage` (`applyClientCursor`, `lib/notifications/model.ts`, pura e testata in NOTIF-P09), aggiornato quando il drawer si apre. Limite noto e accettato: per-dispositivo, non sincronizzato fra telefono e desktop — un genitore che apre il center su due device può rivedere una volta in più lo stesso elemento. Non un problema di sicurezza/dati, solo di UX ripetuta; upgrade naturale futuro (Wave 4+) è una singola colonna `profiles.last_notifications_seen_at`.

**`group_invite_pending` è l'unico tipo escluso da ENTRAMBI i meccanismi**: resta sempre `isSeen=false` finché l'invito è pending — è ACTION, e SEEN ≠ RESOLVED (aprire il center non equivale ad accettarlo, il task lo richiede esplicitamente). Verificato in NOTIF-P09.

## Privacy

Ogni `NotificationItem` contiene solo: nome gruppo/attività (necessario alla UX), stato/priorità, un deep link, una data. Mai email, telefono, note carpool, testo libero del centro, o nomi di bambini. Nessuna nuova telemetry: questa wave non tocca `product_events`/`KNOWN_PRODUCT_EVENTS`.

## Admin

Nessuna modifica. `/admin/one/pilot` resta invariata; il modello di sicurezza service-role introdotto nel security check pre-deploy di Wave 1+2 (`lib/data/pilot-users.ts`, `lib/supabase/service.ts`) non è stato toccato (diff verificato: 0 righe).

## Entry point e UI

Bottone flottante fisso (non trascinabile, a differenza di `BetaFeedbackButton`) in basso a sinistra — stesso principio di ancoraggio a `.app-shell` già in uso, angolo scelto per non sovrapporsi al ribbon "Beta" (alto-destra, solo Home), al back-arrow di `PageHeader` (alto-sinistra) e al pulsante feedback (basso-destra). Montato una sola volta in `app/nextgen/layout.tsx`, copre ogni pagina genitore NEXTGEN; si nasconde su `/nextgen/admin`/`/nextgen/center` (stesso perimetro di `BetaFeedbackButton`) e per qualunque utente il cui ruolo reale non sia `parent` (NOTIF-P11 — sia lato UI sia lato dati: `getParentNotifications()` verifica sessione+ruolo autonomamente, stesso principio del security check service-role di Wave 1).

Mini notification center: bottom sheet su mobile / dialog centrato su desktop (stesso pattern responsivo già in uso per il dialog di `BetaFeedbackButton`). Ogni riga mostra cosa è successo, se richiede un'azione ("Nuovo", non solo colore) e dove risolverlo (icona + testo). Tap → mark-read reale dove esiste una colonna DB, poi navigazione al deep link — mai verso Legacy (tutte le route sono `/nextgen/...`).

Accessibilità: bottone con `aria-label` dinamico (include il conteggio), badge `aria-hidden` (il conteggio reale vive nel label del bottone, non solo visivamente), `role="dialog"`/`aria-modal`, focus spostato al bottone di chiusura all'apertura e restituito al bottone campanella alla chiusura, `Escape` chiude, lista semantica (`ul`/`li`), non-letto indicato da testo ("Nuovo") oltre che da colore/sfondo.

## Deep link

`group_invite_pending` → `/nextgen/groups?tab=inviti` (nuovo supporto opt-in in `GroupsClient`/`app/nextgen/groups/page.tsx`, apre direttamente la tab "Inviti" invece di "I miei gruppi"). `inquiry_reply` → `/nextgen/richieste`. `booking_response` → `/nextgen/prenotazioni?bookingId=...` (deep link già esistente, riusato). `group_request_accepted`/`carpool_*` → `/nextgen/groups/[id]`.

## Coordination Signal Home — integrazione

Nessuna duplicazione: Home mostra al massimo UN segnale (invariato, Wave 2), il Notification Center mostra l'elenco breve di tutto ciò che merita attenzione. Fonte condivisa per "richiesta gruppo accettata" (vedi sopra) — mai due copie della stessa regola di business.

## Test

`tests/one/notifications.spec.ts`: 8 test `[no browser]` sulla logica pura (priorità/ordinamento, badge, seen≠resolved, deduplica — tutti passati) più un gruppo di test gated (`isRealDeployment`) per NOTIF-P00/P01/P02-P03/P04-P05/P06/P11/P12/P13/P14/P15, che richiedono un deploy reale e — per alcuni (invito pendente, risposta prenotazione, abbinamento carpool) — uno stato specifico dell'account di test non garantito in questo repository: marcati con `test.skip` esplicito quando la precondizione manca, invece di fallire un run legittimo (stesso pattern di `pilot-observability.spec.ts`).

## Limitazioni note

Cursore "seen" per i tipi senza colonna DB è per-dispositivo (vedi sopra). `inquiry_reply` è sempre IMPORTANT anche se in futuro il ticketing dovesse diventare multi-turno (oggi è "un solo giro", quindi corretto). Il badge non distingue "molte notifiche vecchie mai aperte" da "una sola nuova": è un conteggio di non-visti, non una coda prioritaria separata — coerente col principio "readability > sophistication" del task.

## Estensione: Notification Center Partner (31/08/2026)

Stesso componente/stile del genitore (`components/nextgen/NotificationCenter.tsx`, generalizzato con prop `scope: "parent" | "partner"`, stesso pattern già stabilito da `BetaFeedbackButton`/`appSource`), montato in `app/center/layout.tsx`. Aggrega 4 tipi `center_*` (`lib/data/notifications-partner.ts`) che riusano gli STESSI segnali già calcolati per i badge della sidebar Partner: richieste gruppo in attesa (`center_group_request_new`), messaggi genitori non letti (`center_inquiry_new`), check-in da confermare (`center_checkins_unconfirmed` — unica notifica AGGREGATA, non una per riga: nessuna pagina di dettaglio per singolo check-in esiste nell'app), prenotazioni non lette (`center_booking_new`). Cursore "seen" client-side scoped separatamente da quello genitore (`lib/notifications/seen-cursor.ts`, chiavi localStorage distinte). Anche qui: nessuna tabella nuova, nessuna migration.

Estensione naturale (stesso giorno, stessa richiesta): pallini contestualizzati sulla bottom nav genitore — "Prenotazioni" per `booking_response` non visto, "Profilo" per tutto il resto — riusando la stessa lista `notifications` già calcolata per la campanella.

## Estensione: Push notifications (31/08/2026)

Canale AGGIUNTIVO (banner di sistema, anche ad app chiusa) rispetto al notification center in-app — non lo sostituisce. Richiede persistenza reale (a differenza del resto, COMPUTED): `supabase/migration_31_push_subscriptions.sql`, applicata da Fabrizio dopo un report esplicito "MIGRATION REQUIRED" (nuova tabella `push_subscriptions`, RLS "solo le proprie", verificata live via MCP Supabase read-only prima di scrivere codice che ne dipende, stesso principio già seguito per `migration_25` in Wave 3).

**Architettura**: `lib/push/send.ts` (server-only) — `sendPushToUser(userId, payload)`, usa `createServiceClient()` (Wave 1) per leggere subscription di un utente diverso dal chiamante (RLS le limiterebbe altrimenti a "solo le proprie"), invia via `web-push`+VAPID, self-cleaning sulle subscription scadute (404/410 → riga cancellata, nessun job cron). `lib/push/client.ts` — lato browser, richiesta permesso + `pushManager.subscribe()`, mai automatico al caricamento pagina. `app/actions/push-subscriptions.ts` — subscribe/unsubscribe, verifica sessione esplicita oltre a RLS. `public/sw.js` esteso con `push`/`notificationclick` (un solo service worker per tutti gli scope: Legacy/Parent/Partner).

**UI**: nessun nuovo toggle creato — il toggle "Notifiche push" esisteva GIÀ in `ProfilePreferencesSection.tsx` (condiviso Parent/Partner, `profiles.notifyPush`) ma era puramente cosmetico (salvava solo una preferenza, nessuna iscrizione reale). Wired to real subscribe/unsubscribe: se l'iscrizione reale fallisce (permesso negato, browser non supportato), il toggle NON passa ad "attivo" e mostra l'errore — `notifyPush` riflette sempre lo stato reale, mai solo l'intenzione.

**Trigger P0 implementati** (priorità ACTION nel notification center in-app, per non affaticare l'utente con troppe push): invito a gruppo (`inviteToGroupAction`, solo se l'email invitata corrisponde già a un profilo registrato) → push al genitore; proposta alternativa su una prenotazione (`respondToBookingAction`, solo `decision==="proposed"`) → push al genitore; nuova richiesta gruppo (`sendGroupRequestAction`) → push a tutti gli admin del centro; nuova prenotazione (`createBookingAction`) → push a tutti gli admin del centro. Ogni chiamata è best-effort per costruzione (mai un'eccezione verso il flusso di dominio che la genera).

**Deliberatamente NON agganciati in questo primo giro** (priorità IMPORTANT/aggregato nel sistema in-app, o eventi computed senza un singolo punto di mutazione): `inquiry_reply`/`center_inquiry_new` quando non ACTION, `group_request_accepted`, `center_checkins_unconfirmed` (nessun "evento" singolo — è un aggregato ricalcolato), i due match carpool (richiederebbero ri-eseguire la logica di matching dentro `upsertCarpoolOfferAction`/`upsertCarpoolRequestAction` per trovare l'ALTRO utente da notificare — rimandato, non un'omissione silenziosa).

**Privacy payload push**: title/body/deepLink minimi, stessa disciplina di `NotificationItem` — mai email/telefono/testi liberi del richiedente (il sistema operativo può mostrare il payload anche a schermo bloccato).

## Future work esplicitamente escluso

Digest email, SMS/WhatsApp, WebSocket, preferenze di notifica avanzate (per-tipo), cronologia notifiche permanente, event bus enterprise, `responsible_group_member_id`/bridge accompagnamento↔gruppo (week_responsibilities: gap documentato sotto), cursore "seen" in-app sincronizzato multi-device (richiederebbe una colonna, altra migration), push per i trigger non-P0 elencati sopra, cleanup periodico automatico delle subscription push obsolete (oggi solo self-cleaning al primo invio fallito).

### Accompagnamento/ritiro non assegnato — gap documentato, non implementato

Verificato `lib/data/responsibilities.ts`/`week_responsibilities`: un giorno "non assegnato" è semplicemente l'ASSENZA di una riga per quel `(kid_id, week_start_date, weekday, moment)`, non un valore esplicito. Per sapere se quell'assenza significa davvero "manca chi accompagna" servirebbe incrociarla con quali giorni la famiglia ha realmente un'attività prenotata in quel weekday/moment (planner/bookings) — una derivazione a più fonti non ancora scritta da nessuna parte nel progetto, con rischio concreto di falsi positivi (es. "manca chi accompagna" per un giorno in cui non è nemmeno prevista nessuna attività) se la regola viene approssimata. Per non inventare precisione che i dati non garantiscono, questo evento resta fuori scope in questa wave, come esplicitamente permesso dal task.

## Verifica statica

`npx tsc --noEmit`: pulito. `npx eslint` sui file toccati: pulito. `npm run build`: completato senza errori. `npx playwright test --grep "no browser"`: 328/328 passati (intera suite, nessuna regressione sui test esistenti — comprende Wave 3 Parent, Notification Center Partner, Push notifications).
