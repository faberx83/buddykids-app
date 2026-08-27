# Codici invito Beta (WhatsApp) — auto-iscrizione alla Controlled Beta Cohort

Richiesta di Fabrizio (27/08/2026): chi riceve un invito esplicito via WhatsApp deve entrare
automaticamente nella Beta (Spotlight + Onboarding Carousel visibili) al momento della
registrazione, senza che Fabrizio debba più fare un INSERT SQL manuale persona per persona.

## Come funziona

1. Fabrizio crea un codice da `/admin/beta-invites` (es. `TRAMABETA26`) — nessuna azione SQL
   manuale necessaria per il caso comune (un solo codice riutilizzabile).
2. Copia il link generato (`https://buddykids-app.vercel.app/auth/login?beta=TRAMABETA26`) e lo
   incolla manualmente nel messaggio WhatsApp — l'invio resta sempre un'azione manuale di
   Fabrizio, nessuna funzionalità di invio automatico è stata costruita.
3. Chi apre il link vede il form di registrazione (mai il codice esplicitamente, solo un badge
   "✨ Invito riconosciuto") e si registra normalmente.
4. Il codice viene passato come `user_metadata.beta_invite_code` a `supabase.auth.signUp()`.
5. Il trigger DB `handle_new_user()` (esteso da `migration_30_beta_invite_codes.sql`) legge
   quel valore e, se il codice è attivo/non scaduto/non esaurito, iscrive automaticamente il
   nuovo profilo a `beta_cohort_memberships` (`cohort_key = 'trama-one-controlled-beta'`) —
   stessa cohort già usata per `TRAMA_ONE_ENABLED`.
6. Al primo accesso a `/nextgen`, l'onboarding carousel appare come per qualunque altro membro
   della cohort — nessuna logica nuova lato app, riuso totale dell'infrastruttura esistente.

## Sicurezza

Il ramo che gestisce il codice Beta dentro `handle_new_user()` è avvolto in un blocco
`begin ... exception when others then null; end;`: qualunque problema sulla tabella
`beta_invite_codes` (inesistente, corrotta, constraint inatteso) viene ignorato silenziosamente
e la registrazione dell'utente procede comunque. `handle_new_user()` è la funzione a più alto
rischio dell'app — se solleva un'eccezione non gestita, nessuno può registrarsi, per nessun
motivo — quindi questa protezione è stata aggiunta appositamente (il ramo esistente per lo
sconto-centro non ne aveva bisogno prima, e non è stato toccato).

`beta_invite_codes` ha RLS `platform_admin`-only su tutte le operazioni (stessa filosofia di
`beta_cohort_memberships`): nessuna query diretta client-side, mai. La validazione durante il
signup passa dalla funzione `get_beta_invite_preview()` (security definer, restituisce solo
`valid`/`public_label`, mai `redeemed_count`/`cohort_key`/dati interni).

## Migration

**RICHIESTA (non applicata).** `supabase/migration_30_beta_invite_codes.sql` — crea la tabella
`beta_invite_codes`, la funzione di anteprima pubblica, e **sostituisce** `handle_new_user()`
con una versione che aggiunge il terzo ramo Beta preservando byte-per-byte il comportamento
esistente (collegamento invito-sconto centro). Pre-check/post-check/rollback completi nel file
stesso — il rollback richiede di verificare (pre-check punto 2) che la definizione live di
`handle_new_user()` combaci con quella assunta, prima di sostituirla.

`supabase/schema.sql` non è stato riscritto (stessa scelta già fatta per
`beta_cohort_memberships` in `migration_08`): contiene solo un commento-puntatore alla nuova
migrazione sopra la vecchia definizione di `handle_new_user()`.

## Admin UI

`/admin/beta-invites` — crea/disattiva/riattiva/elimina codici, copia il link pronto per
WhatsApp, vedi utilizzi/scadenza/stato. Supporta fin da subito più codici con limiti di
utilizzo e scadenze (costo marginale nullo avendo già una pagina Admin), anche se l'uso
previsto oggi è un solo codice riutilizzabile.

## Anteprima social (WhatsApp/link preview)

Richiesta esplicita di Fabrizio: il link deve mostrare una preview coerente ("TRAMA — Private
Beta"), mai il codice/token. `app/auth/login/page.tsx` espone `generateMetadata()` condizionato
alla presenza del parametro `?beta=` (qualunque valore, mai interpolato in output): titolo/
descrizione fissi + un'immagine OG **statica** (`public/og/trama-private-beta.png`, 1200×630,
generata una sola volta con `next/og` a partire dal logo ufficiale — nessun dato variabile,
identica per ogni codice). Verificato manualmente (curl contro dev server locale, HTML
server-rendered ispezionato) che: (a) con `?beta=`, i meta `og:*`/`twitter:*` compaiono
correttamente e il codice di test non appare in nessuno di essi; (b) senza `?beta=`, zero meta
OG — nessuna regressione sul login/invito-sconto centro esistente, che restano senza preview
dedicata come prima di questa modifica.

## Test

`tests/one/beta-invite-codes.spec.ts`:
- **[no browser]** (eseguiti e superati in questa sessione, 8/8): `computeBetaInviteCodeState()`
  su tutte le combinazioni active/scaduto/esaurito, incluso il caso data non valida (fail-safe)
  e la priorità inactive > expired > exhausted.
- **[UI]**, gated `isRealDeployment` (richiedono un deploy reale + browser, non eseguibili in
  questo sandbox — limite pre-esistente, non introdotto da questa modifica): CRUD Admin
  end-to-end (BETA-03), meta Open Graph end-to-end via Playwright (BETA-04/05, verificati però
  anche manualmente via curl in questa sessione, vedi sopra).

Righe BETA-01..06 aggiunte a `BuddyKids_Test_Case.xlsx`.

## Limitazioni

- Il messaggio WhatsApp resta interamente manuale (nessuna integrazione di invio).
- Nessun rate-limiting dedicato sul consumo di un codice oltre a `max_redemptions` — un codice
  senza limite impostato è, per definizione, riutilizzabile da chiunque lo riceva (comportamento
  voluto per il caso "un solo codice condiviso con più persone").
- 2 dei test funzionali richiedono un deploy reale per essere eseguiti dal sandbox (limite del
  sandbox, non del codice) — verificati manualmente dove possibile (vedi sezione Anteprima
  social sopra).
