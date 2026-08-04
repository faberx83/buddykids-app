
# TRAMA ONE — Visual Acceptance Gate (§15)

Copre §15 del gate "Controlled Beta Experience, Publication and Readiness Gate": verifica visiva a schermo, a tre breakpoint, di tutto ciò che è stato toccato in §4-6 (Visual Conformance, task #424, `TRAMA_ONE_VISUAL_CONFORMANCE.md`) e §7-14 (Product Walkthrough Spotlight reale, task #425, DEC-60) — **eseguibile solo da Fabrizio**: richiede un browser reale contro un deploy con Supabase configurato e un account della coorte Controlled Beta (DEC-57), fuori dal perimetro di ciò che Claude può eseguire in questo ambiente (nessun browser reale, nessuna sessione autenticata contro produzione).

Questo documento è la checklist/matrice da compilare durante l'esecuzione — non un report di un audit già fatto. La §0 e la §2bis sotto sono passi operativi puntuali, pensati per essere seguiti senza conoscenze tecniche pregresse di DevTools/Playwright.

## 0. Prima di iniziare — accesso, account, host

**3 host di produzione, uno per portale** (non 3 ambienti diversi, stesso deploy — vedi `deploy.sh`):

| Portale | Host | Account da usare |
|---|---|---|
| Parent | `https://buddykids-app.vercel.app` | `TEST_PARENT_EMAIL` |
| Partner (gestore) | `https://buddykids-partner.vercel.app` | `TEST_CENTER_ADMIN_EMAIL` |
| Admin | `https://buddykids-admin.vercel.app` | `TEST_PLATFORM_ADMIN_EMAIL` |

Le password reali sono nel tuo file locale `.env.test` (mai committato, per sicurezza) — cerca le righe `TEST_PARENT_PASSWORD`, `TEST_CENTER_ADMIN_PASSWORD`, `TEST_PLATFORM_ADMIN_PASSWORD` in quel file. Login su ciascun host: vai su `/auth/login`, compila i campi Email e Password, clicca "Accedi".

**Scadenza da controllare prima di iniziare**: gli override che abilitano questi 3 account scadono il **2026-10-02** (coorte `trama-one-controlled-beta`, DEC-57). Se esegui questo gate dopo quella data, controlla prima su `/admin/feature-flags` che la coorte sia stata rinnovata — altrimenti tutte le route `/one*` risulteranno invisibili per un motivo noto (scadenza), non per un difetto visivo.

**Per il Partner serve almeno un'attività esistente** nel centro collegato all'account di test — il centro di test (`[TEST] Centro BuddyKids`) ne ha già 2, quindi non serve crearne una apposta salvo per testare lo step `create_activity` stesso (vedi §4bis).

## 1. Come impostare le 3 larghezze di schermo (Chrome, passo per passo)

Non serve nessuno strumento speciale: si usa la modalità "dispositivo" già integrata in Chrome.

1. Apri la pagina da controllare in Chrome.
2. Apri gli strumenti sviluppatore: tasto destro sulla pagina → "Ispeziona", oppure da tastiera `Cmd+Option+I` (Mac).
3. Attiva la modalità responsive/dispositivo: l'icona con lo smartphone/tablet in alto a sinistra nel pannello DevTools, oppure da tastiera `Cmd+Shift+M` (Mac).
4. In alto compare un menu a tendina (di solito con scritto "Responsive" o il nome di un telefono): aprilo e seleziona **"Responsive"**.
5. Accanto compaiono due caselle numeriche (larghezza × altezza): cancella il valore di larghezza e scrivi quello del breakpoint da testare — **390**, poi **768**, poi **1440** — lasciando l'altezza come sta (o impostala a 800-900 se ti risulta comoda).
6. Per ogni riga della matrice (§4), ripeti la pagina a tutti e 3 i valori prima di passare alla riga successiva.

## 2. Come compilare la matrice

Per ogni riga: apri l'URL indicato con l'account indicato, imposta la larghezza del breakpoint, confronta con quanto descritto in "Check" e segna l'esito:

- **PASS**: corrisponde a quanto descritto, nessun difetto visibile.
- **FIX**: c'è uno scostamento reale (testo tagliato, elemento sovrapposto, colore non-brand, overlay disallineato, popover che esce dal viewport, ecc.) — fai uno screenshot (Cmd+Shift+4 su Mac per un ritaglio) e annota cosa non va nella colonna Note.
- **N/A**: la riga non è raggiungibile in questo giro — annota il motivo in Note, non lasciare vuoto.

Per riportare un FIX: mandami lo screenshot e il numero della riga a cui corrisponde. Non applico correzioni visive "alla cieca" — correggo solo dopo aver visto l'evidenza reale, poi ripeto `tsc`/`eslint` e richiudo la riga.

## 3. Percorso operativo, sezione per sezione

### 3.1 Shell `/one` (Parent) — righe 1-3

1. Vai su `https://buddykids-app.vercel.app/auth/login`, accedi con `TEST_PARENT_EMAIL`.
2. Vai su `https://buddykids-app.vercel.app/one`.
3. Controlla righe 1 e 2 ai 3 breakpoint (§1).
4. Riga 3 (stato vuoto senza progresso Walkthrough): l'account di test standard ha già un progresso salvato, quindi questa riga è probabilmente **N/A** per mancanza di un secondo account "pulito" — annota il motivo, non serve crearne uno apposta.

### 3.2 Shell `/center/one` (Partner) — riga 4

1. Vai su `https://buddykids-partner.vercel.app/auth/login`, accedi con `TEST_CENTER_ADMIN_EMAIL`.
2. Vai su `https://buddykids-partner.vercel.app/center/one`.
3. Controlla riga 4 ai 3 breakpoint.

### 3.3 Shell `/admin/one` (Command Center) — righe 5-9

1. Vai su `https://buddykids-admin.vercel.app/auth/login`, accedi con `TEST_PLATFORM_ADMIN_EMAIL`.
2. Vai su `https://buddykids-admin.vercel.app/admin/one`.
3. Controlla righe 5-9 ai 3 breakpoint. Verifica anche, mentre sei qui, che la voce **"Command Center"** compaia nel menu laterale e porti a questa stessa pagina senza redirect (wiring chiuso in DEC-62, task #427) — non è una riga della matrice ma vale la pena guardarla ora che sei loggato come Admin.

### 3.4 Product Walkthrough Spotlight reale (Partner) — righe 10-20

**Attenzione prima di iniziare**: a differenza delle sezioni precedenti, qui ogni CLIC REALE fa avanzare il tour in modo permanente (salvato nel database) — non torna indietro da solo. Leggi tutta questa sezione prima di cliccare, e controlla ogni riga della matrice AI 3 BREAKPOINT prima di cliccare per passare allo step successivo. Se sbagli sequenza o vuoi ripartire da capo, vedi §4 "Come resettare".

Resta loggato come Partner (stesso account di §3.2), host `https://buddykids-partner.vercel.app`.

> **Aggiornamento (DEC-69)**: dal riscontro di Fabrizio, l'ordine e i testi di questa sezione sono stati rivisti due volte in due direzioni opposte — quello valido ORA è quello scritto sotto: `publish` viene PRIMA di `configure_spot_days` (segui il form fino in fondo e salva, poi apri il calendario). Anche i testi degli step 2 e 3 sono stati corretti perché non corrispondevano a ciò che l'elemento evidenziato mostra davvero.

> **Aggiornamento (DEC-71)**: secondo riscontro di Fabrizio — per gli step il cui target è un'intera card con più campi ("Informazioni di base", "Servizi extra e pasto"), il vecchio comportamento "il primo click dentro la card completa lo step" faceva scattare l'avanzamento al primo click su QUALUNQUE campo (es. la checkbox "Ingresso anticipato"), impedendo di finire di compilare gli altri campi. Ora questi due step mostrano un pulsante esplicito **"Ho finito, continua →"** nel popover: puoi cliccare/compilare liberamente i campi della card senza che il tour avanzi da solo, e avanzi solo quando clicchi quel pulsante. Lo step "Giorni spot" (`configure_spot_days`, riga 16) ha ricevuto lo stesso trattamento per lo stesso motivo (il target è un calendario con più giorni cliccabili singolarmente).

> **Aggiornamento (DEC-72)**: terzo giro di riscontro Fabrizio, testando il deploy di DEC-71 — 3 bug reali trovati e corretti. (1) **Bug bloccante**: dentro le card "manuali" (Informazioni di base, Servizi extra), cliccare un campo reale (es. un input di testo, o aprire il menu a tendina "Pasto") faceva sparire il cursore/chiudeva il menu quasi subito — causa: il popover si ri-focalizzava da solo ogni ~500ms, rubando il focus al campo appena cliccato. Corretto: il popover riceve il focus SOLO alla prima comparsa di ogni step, non più a ripetizione. (2) **Bug bloccante**: dopo aver salvato, NESSUN indizio compariva su dover andare al Calendario disponibilità (né overlay né badge) — causa, un booleano invertito nel codice faceva sì che l'intero componente non renderizzasse nulla quando la pagina corrente non corrisponde alla route dello step. Corretto: ora compare sempre il badge "target non trovato" (con link, per Giorni spot) quando il target vive altrove — questo fix riguarda anche la riga 18 sotto, mai realmente verificabile prima d'ora. (3): "Inizia" non compare più per gli step successivi al primo (`configure_weeks`, `configure_pricing`, `publish`, `configure_spot_days`) — si avviano da soli non appena diventano correnti, perché l'utente è già chiaramente dentro il percorso guidato; resta solo per il primissimo step (`create_activity`).

1. Vai su `/center/activities`. Vedi l'overlay scuro con un ritaglio attorno al pulsante **"+ Nuova attività"**, popover con titolo "Crea l'attività", "Passo 1 di 6", pulsante "Inizia" (SOLO qui, il primissimo step — DEC-72). Controlla **righe 10, 11, 12** ai 3 breakpoint (riga 12: per verificare che il popover appaia anche SOPRA quando manca spazio sotto, prova a scorrere la pagina finché il pulsante non è vicino al fondo schermo, poi ricarica).
2. Clicca "Inizia", poi clicca realmente su **"+ Nuova attività"** — il tour avanza allo step "Informazioni di base" (`configure_weeks`), che si avvia già da solo (DEC-72).
3. Vai (o torna) su `/center/activities` e apri **un'attività già esistente** dalla lista (il centro di test ne ha già 2, non serve crearne una nuova) — atterri su `/center/activities/[id]`. Vedi l'overlay sulla card **"Informazioni generali"** (nome, fascia d'età, prezzo a settimana, descrizione), popover GIÀ con il testo "Compila con calma i campi di questa sezione, poi continua." e il pulsante **"Ho finito, continua →"** — nessun "Inizia" da cliccare (DEC-72). Controlla **riga 13**.
4. Prova a cliccare/compilare un campo reale della card (es. il prezzo a settimana): il tour NON deve avanzare da solo, e il cursore/focus deve restare nel campo mentre digiti senza sparire (DEC-72). Solo cliccando esplicitamente "Ho finito, continua →" il tour avanza a "Servizi extra e pasto" (`configure_pricing`, già avviato da solo), l'overlay si sposta sulla card omonima nella stessa pagina (ingresso anticipato, uscita posticipata, opzione pasto). Controlla **riga 14**.
5. Prova a cliccare un campo reale (es. la checkbox "Ingresso anticipato (pre-servizio)", o apri il menu a tendina "Pasto" e scegli un'opzione con calma) e verifica che il tour NON avanzi e che il campo resti utilizzabile normalmente, poi clicca "Ho finito, continua →" — il tour avanza a "Pubblica" (`publish`, già avviato da solo, questo step resta click-based: l'azione stessa di salvare è la conferma genuina, nessun "Ho finito"). Resti sulla stessa pagina di modifica. Vedi l'overlay sul pulsante **"Salva modifiche"** in fondo alla form. Controlla **riga 15**.
6. Clicca il pulsante "Salva modifiche" — il tour avanza a "Configura i Giorni spot" (`configure_spot_days`, già avviato da solo). **Il target di questo step è su un'altra pagina** (`/center/activities/[id]/calendar`): siccome resti sulla pagina di modifica dopo il salvataggio, ora deve comparire il badge "target non trovato" in alto a destra CON un link cliccabile **"Vai al Calendario disponibilità →"** (DEC-72: prima di questo fix non compariva NULLA qui) — verifica che il link ci sia e sia cliccabile prima di navigare tu stesso. Controlla **riga 16**. Clicca il link (o naviga manualmente): vedi l'overlay sul riquadro del calendario disponibilità, popover GIÀ con "Ho finito, continua →" (nessun "Inizia").
7. Prova a cliccare un giorno del calendario: il tour NON deve avanzare da solo. Clicca "Ho finito, continua →" — il tour avanza a "Monitora dalla dashboard" (`dashboard`, già avviato da solo), l'ultimo step, che resta invece click-based. L'overlay compare ora sulla voce **"Dashboard"** nel menu laterale, su QUALSIASI pagina `/center/*` (nav item persistente). Controlla **riga 17** — su mobile verifica che il menu (drawer/hamburger) esponga comunque questa voce in modo raggiungibile.
8. **Riga 18 (badge "target non trovato" SENZA link)**: per vederla devi trovarti in uno stato in cui lo step corrente non ha un target sulla pagina aperta e NON è lo step "Giorni spot" — es. mentre lo step è ancora "Informazioni di base" o "Servizi extra e pasto" (prima di completarlo), naviga su `/center/profile` invece che sulla pagina dell'attività. Deve comparire un badge in alto a destra con titolo e descrizione dello step, senza alcun link (il link compare SOLO per lo step Giorni spot, vedi riga 16), non un overlay vuoto o un errore — **DEC-72: prima di questo fix non compariva nulla qui, verifica con particolare attenzione**.
9. **Riga 19 (Escape)**: con l'overlay/popover visibile su una qualunque pagina sopra, premi il tasto `Esc` — deve sparire (equivalente a "Salta per ora" per lo step corrente).
10. **Riga 20 (click reale avanza)**: già verificata implicitamente dai passi 2/5/6/7 sopra — se ognuno di quei clic ha davvero fatto avanzare il tour allo step successivo, questa riga è PASS.

## 4. Come resettare il tour Partner se serve ripartire da capo

Il portale Partner (a differenza del Parent) **non ha un bottone "Ricomincia il percorso"** nell'interfaccia. Se durante la verifica sbagli qualcosa, vuoi ripetere una riga, o vuoi tornare allo step 1 per rifare la sequenza da capo, hai due modi, entrambi equivalenti:

- **Da terminale, nella cartella del progetto** (resetta SOLO il tour Partner per l'account di test, non tocca altri dati):
  ```
  set -a && source .env.test && set +a && node tests/cleanup-test-data.mjs
  ```
- **Rilanciare `bash deploy.sh` o `bash test-deploy.sh`**: entrambi eseguono questo stesso reset automaticamente prima della suite di test (lo vedi già nell'output come `walkthroughProgressReset: 1`).

## 5. Matrice PASS/FIX/N-A

### 5.1 Shell `/one` (Parent) — task #424

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 1 | `/one` — `parent` | Header: icona brand + titolo "TRAMA ONE — Parent" via `PageHeader`, freccia indietro verso `/nextgen` funzionante | | | | |
| 2 | `/one` — `parent` | `WalkthroughCard` (percorso `welcome_parent`): titolo "Benvenuto in TRAMA ONE", step corrente, pulsanti `Inizia`/`Continua`/`Salta per ora`/`Ricomincia il percorso` in `bg-trama-violet` (non blu `#2E86DE`), nessuno stile inline visibile (bordi/spaziature coerenti col resto dell'app) | | | | |
| 3 | `/one` — account senza progresso Walkthrough (se disponibile) | Stato vuoto esplicito visibile (non un riquadro vuoto silenzioso) | | | | |

### 5.2 Shell `/center/one` (Partner) — task #424/#425

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 4 | `/center/one` — `center_admin` | `<h1>` "TRAMA ONE — Partner" in stile Tailwind (stessa convenzione di `/center/richieste`), link "Vai all'onboarding del centro →" in `text-trama-violet`, nessun colore hardcoded, nessuna `WalkthroughCard` residua (rimossa in DEC-60: il vero percorso ora vive su `/center/activities`, non più qui) | | | | |

### 5.3 Shell `/admin/one` (Command Center) — task #424

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 5 | `/admin/one` — `platform_admin` | Header bianco su sfondo `bg-navy`, sottotitolo `text-navy-text2`, coerente con le altre pagine Admin | | | | |
| 6 | `/admin/one` — `platform_admin` | Badge priorità: "alta" rosso (`#FBEAEA`/`#C0392B`), "media" arancio (`orange-light`/`trama-orange`), "bassa" verde (`green-light`/`#2d8f52`) — stessa palette di `/admin/feature-flags`, nessun colore inventato | | | | |
| 7 | `/admin/one` — `platform_admin` | 7 code operative in card bianche bordate `#E8EBF0`, leggibili e non sovrapposte a nessun breakpoint | | | | |
| 8 | `/admin/one` — `platform_admin` | Tabella funnel Walkthrough: scroll orizzontale (`overflow-x-auto`) su mobile invece di rottura layout | | | | |
| 9 | `/admin/one` — `platform_admin` | Stati vuoti (nessuna coda / nessun dato funnel) visibili se applicabile, non riquadri vuoti silenziosi | | | | |

### 5.4 Product Walkthrough Spotlight reale — task #425 (DEC-60)

Ordine reale del percorso (`lib/walkthrough/registry.ts`, DEC-69): create_activity → configure_weeks → configure_pricing → **publish** → **configure_spot_days** → dashboard. Le righe sotto seguono questo ordine — **invertito di nuovo rispetto alla versione precedente di questo documento**: quella versione aveva configure_spot_days prima di publish, ma il riscontro di Fabrizio ha mostrato che così si rimbalzava tra due pagine senza un modo esplicito per navigare; l'ordine corretto è save-prima-poi-calendario, con un link cliccabile per raggiungerlo (righe 15/16).

**Aggiornamento (DEC-70)**: dal secondo giro di riscontro di Fabrizio, 3 correzioni applicate — (1) il badge "target non trovato" è stato spostato dall'angolo in basso a destra (dove copriva pulsanti reali di pagine corte, es. "Crea attività" su `/new`) all'angolo in alto a destra, sotto l'header; (2) il ring del cutout ora segue il border-radius REALE dell'elemento evidenziato invece di un raggio fisso; (3) bug reale risolto — la voce "Dashboard" esiste due volte nel DOM (sidebar desktop + cassetto mobile) e su schermi <768px veniva scelta per errore la copia nascosta, producendo un popover rotto invece di evidenziare il vero nav item.

**Aggiornamento (DEC-71)**: terzo riscontro di Fabrizio — per gli step `configure_weeks`, `configure_pricing` e `configure_spot_days` (target = card/calendario con più campi/celle cliccabili, non un singolo pulsante), il click su un campo reale qualunque non completa più lo step da solo: serve il pulsante esplicito "Ho finito, continua →" nel popover. `create_activity`, `publish` e `dashboard` restano invariati (click-based, l'azione stessa È la conferma).

**Aggiornamento (DEC-72)**: quarto giro di riscontro di Fabrizio, 3 bug reali corretti — (1) il popover si ri-focalizzava da solo ogni ~500ms, rubando il focus a qualunque campo reale l'utente stesse compilando (cursore che sparisce, `<select>` che si chiude prima di poter scegliere); (2) un booleano invertito faceva sì che l'INTERO componente non renderizzasse nulla (né overlay né badge) quando la pagina corrente non corrisponde alla route dello step corrente — bug che rendeva di fatto invisibile il badge con link della riga 16 e il badge senza link della riga 18, mai realmente verificabile prima d'ora; (3) "Inizia" non compare più per gli step successivi al primo — si avviano automaticamente quando diventano correnti (solo `create_activity`, il primissimo step del percorso, richiede ancora un click esplicito su "Inizia").

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 10 | `/center/activities` — `center_admin`, step `create_activity` in corso | Overlay scuro con cutout ben allineato attorno al pulsante "+ Nuova attività", stessa forma/raggio d'angolo del pulsante reale (non un raggio fisso, DEC-70), popover leggibile con titolo "Crea l'attività", "Passo 1 di 6", pulsante "Inizia" (SOLO qui, il primissimo step — DEC-72) | | | | |
| 11 | `/center/activities` (stesso step) | Il popover NON esce dal viewport a nessun breakpoint (attenzione particolare a Mobile 390px: popover largo 320px, verificare che resti dentro lo schermo e non copra il cutout) | | | | |
| 12 | `/center/activities` (stesso step) | Il popover appare SOTTO l'elemento di default, e SOPRA solo se non c'è spazio sufficiente sotto (scrollare la pagina per verificare entrambi i casi se possibile) | | | | |
| 13 | `/center/activities/[id]` (scheda di modifica di un'attività esistente), step `configure_weeks` | Overlay ancorato alla card "Informazioni generali" (nome, fascia d'età, prezzo a settimana, descrizione — titolo popover "Informazioni di base"), nessuna sovrapposizione con altri elementi della form; lo step è GIÀ avviato (nessun "Inizia", DEC-72), popover con "Compila con calma i campi di questa sezione, poi continua." + pulsante "Ho finito, continua →" (DEC-71); cliccando/digitando in un campo reale il cursore/focus NON deve sparire (DEC-72) | | | | |
| 14 | `/center/activities/[id]`, step `configure_pricing` | Overlay ancorato alla card "Servizi extra e pasto" (ingresso anticipato, uscita posticipata, opzione pasto); già avviato (nessun "Inizia", DEC-72), stesso pulsante "Ho finito, continua →" del check precedente (DEC-71); aprire il menu a tendina "Pasto" e scegliere un'opzione deve funzionare normalmente, senza che si chiuda da solo (DEC-72) | | | | |
| 15 | `/center/activities/[id]`, step `publish` | Overlay ancorato al pulsante "Salva modifiche" (step invariato: click-based, nessun "Inizia" né "Ho finito", già avviato — DEC-72) | | | | |
| 16 | `/center/activities/[id]` (dopo aver salvato), step `configure_spot_days` — target reale su un'altra pagina | Badge "target non trovato" (in alto a destra, sotto l'header — DEC-70) con titolo "Configura i Giorni spot" E un link cliccabile **"Vai al Calendario disponibilità →"** che porta a `/center/activities/[id]/calendar` — **DEC-72: prima di questo fix non compariva NULLA qui (bug bloccante), verifica con particolare attenzione**; una volta lì, overlay ancorato al calendario disponibilità (non alla card KPI/occupazione sopra di esso), già avviato (nessun "Inizia"), stesso pulsante "Ho finito, continua →" (DEC-71/72) | | | | |
| 17 | Qualunque pagina `/center/*`, step `dashboard` | Overlay ancorato alla voce "Dashboard" nel menu — su desktop/tablet (≥768px) è già visibile nella sidebar; **su mobile (390px) apri prima il menu (☰) in alto a sinistra**: solo con il cassetto aperto il nav item è visibile e viene evidenziato (DEC-70 — con il cassetto chiuso compare invece il badge "target non trovato" della riga 18, comportamento corretto, non un bug) | | | | |
| 18 | Navigare a una pagina senza il target dello step corrente e diverso da "Giorni spot" (es. atterrare su `/center/profile` con lo step ancora "Informazioni di base"/"Servizi extra e pasto", oppure lo step "dashboard" su mobile col cassetto chiuso) | Badge "target non trovato" in alto a destra (titolo + descrizione dello step), SENZA alcun link (il link compare solo per lo step Giorni spot, riga 16) — non un overlay vuoto, non un popover mal posizionato, non un errore silenzioso — **DEC-72: prima di questo fix non compariva NULLA qui (bug bloccante, stesso booleano invertito della riga 16), verifica con particolare attenzione** | | | | |
| 19 | Con lo Spotlight visibile, premere Escape | Il popover/overlay scompare (equivalente a "Salta per ora" per lo step corrente) | | | | |
| 20 | Con lo Spotlight visibile su un elemento reale allo step `create_activity`, `publish` o `dashboard` (click-based), cliccare l'elemento evidenziato (non un bottone del tour) | Il click naviga/agisce normalmente sull'elemento reale (nessun blocco dell'overlay) E il percorso avanza allo step successivo | | | | |
| 21 | `/center/account/preferenze` — `center_admin` | Nuova sezione "Tour guidato" con pulsante "Riavvia il tour guidato" (DEC-70) — visibile solo se il flag TRAMA_ONE_ENABLED è attivo per l'account; cliccandolo il messaggio cambia in "Percorso riavviato..." e una successiva visita a `/center/activities` riparte dallo step 1 | | | | |
| 22 | Allo step `configure_weeks` o `configure_pricing` (già avviato, DEC-72), cliccare/digitare in un campo REALE dentro la card (es. la checkbox "Ingresso anticipato (pre-servizio)" o un input di testo in "Servizi extra e pasto") (DEC-71/72) | Il click/digitazione sul campo NON fa avanzare il tour né perde il focus/cursore: il popover resta sullo stesso step con "Ho finito, continua →" visibile, il campo resta pienamente utilizzabile; puoi continuare a compilare gli altri campi senza interruzioni; il tour avanza SOLO cliccando esplicitamente quel pulsante | | | | |

## 6. Chiusura del gate

Il gate §15 si considera chiuso quando ogni riga della matrice è **PASS** o **N/A con motivazione esplicita accettata** — nessuna riga **FIX** aperta. Se emergono FIX, riportarli a Claude con screenshot per la correzione, poi ripetere la sola riga corretta (non l'intera matrice) prima di richiudere.

Solo dopo la chiusura di questo gate si procede a §16-17 (Controlled Publication procedure, task #427).
