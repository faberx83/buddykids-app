# GATE MANUALE — RESEND_API_KEY (R-08, task #484/#548/#558)

**Stato: MUST BEFORE MICRO PILOT** (elevato da "raccomandato" a bloccante — decisione Fabrizio, PRE-MICRO-PILOT CLOSURE GATE, 25/08/2026). Il Micro Pilot non può iniziare finché non è vera **una delle due condizioni**:

1. Resend è configurato e verificato in produzione (vedi §"Passi"), **oppure**
2. Il fallback manuale formalizzato in questo documento (§"Fallback manuale") è stato letto e accettato esplicitamente da Fabrizio come procedura operativa per la durata del pilot.

Nessuna delle due = nessun avvio pilot. Questo documento non chiede né contiene alcuna chiave: copre solo cosa fare, perché, e come verificare.

## Perché è un gate manuale (non lo fa Claude)

Creare un account su un servizio esterno (Resend), verificare la proprietà di un dominio email, e impostare variabili d'ambiente in produzione (Vercel) richiedono un account/dominio di cui Fabrizio è titolare. Claude non ha né dovrebbe avere accesso a queste credenziali.

## Cosa sblocca

Oggi (verificato via query diretta Supabase, sola lettura, 24-25/08/2026) `RESEND_API_KEY` non è configurata in produzione: `lib/email.ts` fa da fallback silenzioso (`isEmailConfigured = false`), nessuna funzionalità si rompe, ma **6 journey email non partono mai**. Queste 6 journey NON sono equivalenti tra loro — la Wave 1 le aveva presentate come un blocco omogeneo con "sempre un link/codice da copiare come alternativa", ma una rilettura del codice per questo gate (25/08/2026) mostra due comportamenti diversi:

### Gruppo A — hanno già un fallback manuale nel prodotto (link/codice generato comunque)

1. **Candidatura/invito centro** (`app/actions/invites.ts`) — genera sempre `inviteLink`/`inviteCode` e li ritorna al chiamante indipendentemente dall'invio email (`emailSent` è un campo separato). L'Admin può copiare il link e inviarlo manualmente (WhatsApp/SMS/email personale).
2. **Invito Gruppo** (`app/actions/groups.ts`) — stesso pattern: link/codice generato sempre.
3. **Invito Famiglia** (`app/actions/family.ts`) — stesso pattern: link/codice generato sempre.

Per questi 3, il fallback manuale **esiste già in produzione, non richiede nulla di nuovo**: chi invita ha sempre il link a schermo, con o senza email.

### Gruppo B — NON hanno oggi alcun fallback in-app (correzione rispetto alla Wave 1)

4. **Richiesta prenotazione → notifica** (`app/actions/booking-response.ts`) — se `isEmailConfigured` è `false`, la funzione registra `email_delivery_status = 'not_configured'` su `bookings` e **si ferma silenziosamente**: nessun link, nessun banner, nessun avviso per il Gestore che l'invio non è partito.
5. **Check-in in ritardo** (`app/actions/checkin.ts`) — stessa logica: se non configurato, l'email al centro semplicemente non viene tentata, nessuna traccia visibile in UI.
6. **Assenza segnalata** (`app/actions/attendance.ts`) — stessa logica: email al genitore non tentata, nessun fallback in-app.

Per questi 3, l'unico segnale osservabile oggi è tecnico (colonna `email_delivery_status` per le prenotazioni; per check-in/assenza non esiste nemmeno una colonna equivalente) — non qualcosa che un operatore vede nell'app durante l'uso normale.

## Fallback manuale (formalizzato per il Micro Pilot, 25/08/2026)

Vista la scala del Micro Pilot (1 centro, 3 famiglie — vedi `CONTROLLED_BETA_OPERATING_MODEL.md`), il fallback per il Gruppo B non richiede nuovo codice: richiede una procedura operativa che Fabrizio/staff eseguono a mano finché Resend non è operativo.

**Principio**: l'assenza di email NON significa dato perso. Ogni azione del Gruppo B scrive comunque lo stato reale nel database — il destinatario può sempre vedere l'informazione aggiornata aprendo l'app (Planner/Prenotazioni per il genitore, Registro/Richieste per il Gestore). L'email è solo una *notifica proattiva*; senza di essa, serve un avviso umano che dica "apri l'app, c'è una novità".

**Procedura (da eseguire da Fabrizio/staff, 1-2 volte al giorno durante il Micro Pilot, finché Resend non è confermato operativo)**:

1. Eseguire questa query di sola lettura su Supabase per le prenotazioni (Gruppo B, voce 4):
   ```sql
   select id, center_id, kid_id, status, email_delivery_status, email_delivery_error, updated_at
   from public.bookings
   where email_delivery_status = 'not_configured'
     and updated_at > now() - interval '1 day'
   order by updated_at desc;
   ```
   Per ogni riga: contattare il genitore (telefono/WhatsApp, dato raccolto in fase di iscrizione al pilot) con un messaggio del tipo "La tua richiesta è stata [accettata/rifiutata] dal centro — apri TRAMA per i dettagli".
2. Per check-in in ritardo (voce 5) e assenza segnalata (voce 6) — nessuna colonna di stato dedicata oggi: dato il volume del Micro Pilot (1 centro), il Gestore stesso, dopo aver segnato un check-in "in ritardo" o un'assenza nell'app, avvisa direttamente a voce/messaggio la famiglia coinvolta (non è un'azione delegabile a query, va fatta contestualmente all'azione stessa).
3. Questa procedura si esaurisce automaticamente appena Resend è configurato e verificato (§"Passi" sotto) — da quel momento le email partono da sole e la query manuale può essere abbandonata.

**Questo È il fallback richiesto da Fabrizio.** Se durante il Micro Pilot questa procedura non viene seguita e Resend non è operativo, le famiglie/il centro pilota non ricevono alcuna notifica per le voci 4-6: è un gap reale, non ipotetico, e va trattato come tale nel report finale del gate.

## Passi per attivare Resend (solo Fabrizio)

1. **Creare un account su [resend.com](https://resend.com)** (piano gratuito sufficiente per il volume del Micro Pilot: 3 famiglie + 1 centro).
2. **Verificare un dominio email di proprietà** (es. `trama.it` o dominio scelto) seguendo la procedura Resend (record DNS SPF/DKIM presso il proprio registrar) — necessario per non finire in spam e per usare un mittente reale invece di quello di test.
3. **Generare una API key** dalla dashboard Resend (Settings → API Keys).
4. **Impostare in Vercel** (Project Settings → Environment Variables, ambiente Production):
   - `RESEND_API_KEY=re_xxxxxxxx` (la chiave generata al passo 3)
   - `INVITE_FROM_EMAIL="TRAMA <inviti@tuodominio.it>"` (il mittente verificato al passo 2 — opzionale: senza questa variabile si usa un mittente di test Resend, valido solo per inviare a se stessi)
5. **Ridistribuire** (redeploy) l'app perché le nuove variabili d'ambiente vengano lette (Vercel non le applica retroattivamente su un deployment già in esecuzione).

## Come verificare che ha funzionato (dopo il redeploy, azione di Fabrizio)

Non serve una chiave per verificare — bastano azioni nell'app reale + una query di sola lettura:

1. Fare una qualunque delle 6 azioni sopra (es. una richiesta di prenotazione, poi accettarla come Gestore) sull'ambiente reale.
2. Controllare che l'email sia arrivata a destinazione.
3. (Opzionale, verifica incrociata) Query Supabase in sola lettura sulla colonna `email_delivery_status` di `bookings`: deve passare da `not_configured` a `sent` (o mostrare l'errore Resend specifico se qualcosa non va, es. dominio non verificato).

## Cosa NON serve fare

- Nessuna nuova migrazione SQL per il Gruppo A/il flusso booking (colonna già esistente su `bookings`).
- Nessuna modifica al codice per attivare Resend: `lib/email.ts` legge già `RESEND_API_KEY`/`INVITE_FROM_EMAIL` da variabili d'ambiente, con retry automatico (1 tentativo + 1 retry) già implementato.
- Nessuna chiave va condivisa con Claude in nessun momento di questo processo.

## Nota per il backlog (non bloccante per il Micro Pilot, 1 centro/3 famiglie)

A scala più ampia (oltre il Micro Pilot), il fallback manuale sopra non regge: andrebbe aggiunto un segnale in-app per il Gruppo B (badge "notifica non inviata" su Richieste/Registro lato Gestore, colonna di stato dedicata per check-in/assenza) invece di una query SQL eseguita a mano. Non incluso in questo gate perché fuori scope rispetto alla richiesta esplicita di Fabrizio ("prepara il gate", non "costruisci una nuova funzionalità") e perché la scala del Micro Pilot rende la query manuale sufficiente e verificabile.
