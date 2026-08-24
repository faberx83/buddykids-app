# GATE MANUALE — RESEND_API_KEY (R-08, task #484/#548)

**Wave 1 #10, 24/08/2026.** Documento preparatorio per Fabrizio — non chiede né contiene alcuna chiave. Copre solo cosa fare, perché, e come verificare che abbia funzionato.

## Perché è un gate manuale (non lo fa Claude)

Creare un account su un servizio esterno (Resend), verificare la proprietà di un dominio email, e impostare variabili d'ambiente in produzione (Vercel) sono tutte azioni che richiedono un account/dominio di cui Fabrizio è titolare. Claude non ha né dovrebbe avere accesso a queste credenziali.

## Cosa sblocca

Oggi (verificato via query diretta Supabase, sola lettura, 24/08/2026) `RESEND_API_KEY` non è configurata in produzione: `lib/email.ts` fa da fallback silenzioso (`isEmailConfigured = false`), nessuna funzionalità si rompe, ma **6 journey email non partono mai**:

1. **Candidatura/invito centro** (`app/actions/invites.ts`) — email al referente del centro con link di invito.
2. **Richiesta prenotazione → notifica** (`app/actions/booking-response.ts`) — email al genitore quando il Gestore accetta/rifiuta.
3. **Check-in in ritardo** (`app/actions/checkin.ts`) — email al centro quando un genitore segnala ritardo.
4. **Assenza segnalata** (`app/actions/attendance.ts`) — email al genitore quando il Gestore segna il bambino assente.
5. **Invito Gruppo** (`app/actions/groups.ts`) — email di invito a un gruppo genitori.
6. **Invito Famiglia** (`app/actions/family.ts`) — email di invito multi-genitore.

Senza la chiave, l'app non mente: mostra sempre link/codice da copiare manualmente (WhatsApp, SMS, email personale) come alternativa. Il gate non blocca l'uso del prodotto, ma senza email automatiche il Micro Pilot richiede più lavoro manuale di comunicazione da parte di Fabrizio/staff.

## Passi (solo Fabrizio)

1. **Creare un account su [resend.com](https://resend.com)** (piano gratuito sufficiente per il volume del Micro Pilot: 3 famiglie + 1 centro).
2. **Verificare un dominio email di proprietà** (es. `trama.it` o dominio scelto) seguendo la procedura Resend (aggiunta record DNS SPF/DKIM presso il proprio registrar) — necessario per non finire in spam e per usare un mittente reale invece di quello di test.
3. **Generare una API key** dalla dashboard Resend (Settings → API Keys).
4. **Impostare in Vercel** (Project Settings → Environment Variables, ambiente Production):
   - `RESEND_API_KEY=re_xxxxxxxx` (la chiave generata al passo 3)
   - `INVITE_FROM_EMAIL="TRAMA <inviti@tuodominio.it>"` (il mittente verificato al passo 2 — opzionale: senza questa variabile si usa un mittente di test Resend, valido solo per inviare a se stessi)
5. **Ridistribuire** (redeploy) l'app perché le nuove variabili d'ambiente vengano lette (Vercel non le applica retroattivamente su un deployment già in esecuzione).

## Come verificare che ha funzionato (dopo il redeploy, azione di Fabrizio)

Non serve una chiave per verificare — bastano azioni nell'app reale + una query di sola lettura:

1. Fare una qualunque delle 6 azioni sopra (es. una richiesta di prenotazione, poi accettarla come Gestore) sull'ambiente reale.
2. Controllare che l'email sia arrivata a destinazione.
3. (Opzionale, verifica incrociata) Query Supabase in sola lettura sulla colonna `email_delivery_status` di `bookings` (aggiunta da `migration_19_bookings_email_delivery_status.sql`, già applicata): deve passare da `not_configured` a `sent` (o mostrare l'errore Resend specifico se qualcosa non va, es. dominio non verificato).

## Cosa NON serve fare

- Nessuna nuova migrazione SQL: la colonna `email_delivery_status` esiste già.
- Nessuna modifica al codice: `lib/email.ts` legge già `RESEND_API_KEY`/`INVITE_FROM_EMAIL` da variabili d'ambiente, con retry automatico (1 tentativo + 1 retry) già implementato.
- Nessuna chiave va condivisa con Claude in nessun momento di questo processo.
