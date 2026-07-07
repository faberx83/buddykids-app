# BuddyKids

App Next.js (App Router + TypeScript + Tailwind CSS) che riproduce fedelmente il mockup approvato lato genitori, più due pannelli dashboard: uno per l'admin della piattaforma e uno per i gestori dei centri estivi. Pronta per essere collegata a Supabase per autenticazione e database.

## Avvio rapido

```bash
npm install
npm run dev
```

Apri http://localhost:3000.

Senza chiavi Supabase l'app funziona comunque: tutte le schermate usano dati mock in `lib/mock-data.ts`, così puoi vedere subito il design. Login/registrazione mostreranno un avviso finché non colleghi Supabase.

## Le tre aree dell'app

BuddyKids ha tre viste, per tre tipi di persone diverse:

1. **App genitori** (`/`, `/search`, `/activity/[id]`, `/booking/[id]`, `/groups`, `/calendar`, `/profile`) — quella del mockup originale: cerca attività, prenota, gestisci i bambini. Nella sezione Calendario, il tab "Calendari centri" mostra il calendario giorno-per-giorno del centro per ogni attività a cui i bambini sono iscritti (giorni aperti, pieni, con sconto o promo), evidenziando i giorni effettivamente frequentati.
2. **Pannello Gestore centro** (`/center`) — per chi gestisce un singolo centro estivo: modifica le informazioni del centro e delle attività, gestisce il calendario di disponibilità giorno-per-giorno (aprire/chiudere un giorno, aggiornare i posti liberi, segnalare "giornate particolari" come piscina o giochi d'acqua) e crea promozioni: sconti su un giorno specifico della settimana (es. "-15% ogni venerdì") o promo last-minute per riempire i posti rimasti vuoti a ridosso della data. La configurazione di ogni attività include: tag multipli (sport, arte, piscina…), pre/post servizio (ingresso anticipato/uscita posticipata con orario e sovrapprezzo), pasto (incluso / al sacco / non fornito), agenda della giornata editabile e posizione con anteprima mappa. Dalla pagina profilo si collegano anche gli account social del centro.
3. **Pannello Admin piattaforma** (`/admin`) — per chi gestisce BuddyKids: panoramica su tutti i centri, tutte le attività, tutte le prenotazioni, un'area Analisi (stagionalità, composizione clienti, cross-selling tra centri vicini) e la gestione della lista master dei tag (`/admin/tags`) che i centri possono assegnare alle proprie attività.

### Ruolo demo

Dato che Supabase non ha ancora ruoli reali collegati, in basso a destra c'è un selettore **"Ruolo demo"** che permette di passare tra Genitore / Gestore centro / Admin piattaforma e vedere subito tutte e tre le aree, senza login. Il ruolo scelto resta salvato nel browser. Le pagine `/center` e `/admin` controllano questo ruolo demo e mostrano un avviso se provi ad aprirle con il ruolo sbagliato.

Questo è **solo un meccanismo di demo/anteprima** — quando colleghi Supabase, la protezione vera va fatta lato server (vedi sotto) perché chiunque potrebbe altrimenti cambiare il ruolo demo dal browser.

## Collegare Supabase

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Copia `.env.example` in `.env.local` e incolla le chiavi del progetto (Project Settings → API):

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. Apri lo **SQL Editor** di Supabase ed esegui il contenuto di `supabase/schema.sql`. Crea le tabelle `centers` (con `social_links` jsonb), `profiles` (con `role` e `center_id`), `kids`, `activities` (con `pre_service`/`post_service`/`meal_option`/`latitude`/`longitude`), `tags` + `activity_tags` (lista master dei tag, gestita dall'admin, e relazione N:N con le attività), `activity_weeks`, `activity_days` (calendario giorno-per-giorno, con `special_label`/`special_emoji` per le giornate particolari), `promotions`, `bookings`, `booking_weeks`, `booking_kids`, `groups`, `group_members`, `reviews` — con Row Level Security già configurata e un trigger che crea automaticamente un profilo "parent" alla registrazione.
4. Riavvia `npm run dev`.

A questo punto `/auth/login` autentica realmente gli utenti (email + password, con conferma via email). Le pagine continuano a mostrare i dati mock finché non colleghi le query reali alle tabelle Supabase (vedi sotto).

### Promuovere un utente a Gestore centro o Admin piattaforma

Per ora questo si fa a mano dal SQL Editor di Supabase (i commenti in fondo a `supabase/schema.sql` hanno gli esempi pronti):

```sql
-- Gestore di un centro specifico
update public.profiles
set role = 'center_admin', center_id = (select id from public.centers where slug = 'centro-sportivo-lido')
where email = 'gestore@centrolido.it';

-- Admin della piattaforma
update public.profiles set role = 'platform_admin' where email = 'admin@buddykids.it';
```

Quando vorrai un flusso self-service (es. un centro che si registra da solo), andrà aggiunta una pagina di richiesta accesso con approvazione manuale o un invito via email — al momento non è inclusa.

### Protezione reale di `/admin` e `/center`

Il gate attuale in `components/dashboard/DashboardLayout.tsx` legge solo il ruolo demo lato client. Prima di andare in produzione:

1. In `middleware.ts`/`proxy.ts` (o in ogni `layout.tsx` di `/admin` e `/center`), leggi l'utente reale con `createClient()` da `lib/supabase/server.ts` e la riga `profiles` collegata.
2. Reindirizza a `/auth/login` se non autenticato, o a `/` se il ruolo non corrisponde.
3. Le policy RLS in `supabase/schema.sql` già impediscono le scritture non autorizzate a livello di database — questo controllo lato route è solo per l'esperienza utente (evitare di mostrare pagine che poi falliscono in scrittura).

## Struttura del progetto

```
app/
  (main)/                 Home, Cerca, Gruppi, Calendario, Profilo (bottom nav condivisa)
  activity/[id]/           Dettaglio attività (mostra anche le promo attive)
  booking/[id]/            Flusso di prenotazione in 3 step + schermata di successo
  calendar-center/[id]/    Calendario del centro in sola lettura per i genitori
  auth/login/              Login / registrazione Supabase
  auth/callback/           Route handler per la conferma email / OAuth
  admin/                   Pannello Admin piattaforma (dashboard, centri, attività, prenotazioni)
  center/                  Pannello Gestore centro (dashboard, profilo, attività, calendario, promo)
components/
  dashboard/               Layout e componenti condivisi da /admin e /center
  AvailabilityCalendar.tsx Calendario giorno-per-giorno stile booking (editabile o sola lettura)
  DemoRoleProvider.tsx     Contesto React per il ruolo demo (Genitore/Gestore/Admin)
  RoleSwitcher.tsx         Selettore fluttuante del ruolo demo
lib/
  supabase/                Client Supabase (browser, server, middleware)
  mock-data.ts             Dati demo: attività, centri, calendari, promozioni, prenotazioni
  types.ts                 Tipi TypeScript condivisi
supabase/schema.sql        Schema SQL completo con RLS pronto per l'import
```

## Passare dai dati mock a Supabase

Le pagine leggono da `lib/mock-data.ts`. Per collegarle ai dati reali:

1. Popola le tabelle `centers` / `activities` / `tags` / `activity_tags` / `activity_weeks` / `activity_days` / `promotions` in Supabase (manualmente o via script).
2. Nelle pagine server (`app/(main)/page.tsx`, `app/activity/[id]/page.tsx`, `app/center/**`, `app/admin/**`, ecc.) sostituisci l'import da `mock-data` con una query al client Supabase server-side (`lib/supabase/server.ts`), mantenendo la stessa forma dati definita in `lib/types.ts`.
3. Per bambini, prenotazioni e gruppi legati all'utente loggato, usa `createClient()` da `lib/supabase/server.ts` per leggere `auth.getUser()` e filtrare le query per `parent_id`. Per `/center`, filtra per `center_id` del profilo loggato invece della costante demo `demoCenterAdminCenterId`.
4. Il salvataggio di calendario/promozioni/profilo centro (attualmente solo in stato React locale, con nota "demo" a schermo) va collegato a `insert`/`update` su `activity_days`, `promotions` e `centers`.

## Design

Palette colori, font (Inter) e icone (Tabler Icons, via CDN) riprendono esattamente il mockup HTML fornito per l'app genitori. Il layout dell'app genitori è mobile-first con un "app shell" centrato (`components/PhoneShell.tsx`) che su desktop appare come una card con bordi arrotondati e ombra. I pannelli `/admin` e `/center` usano invece un layout desktop a tutta larghezza con sidebar, più adatto a tabelle e calendari.
