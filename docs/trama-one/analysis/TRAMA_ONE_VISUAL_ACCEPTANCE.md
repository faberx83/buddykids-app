
# TRAMA ONE — Visual Acceptance Gate (§15)

Copre §15 del gate "Controlled Beta Experience, Publication and Readiness Gate": verifica visiva a schermo, a tre breakpoint, di tutto ciò che è stato toccato in §4-6 (Visual Conformance, task #424, `TRAMA_ONE_VISUAL_CONFORMANCE.md`) e §7-14 (Product Walkthrough Spotlight reale, task #425, DEC-60) — **eseguibile solo da Fabrizio**: richiede un browser reale contro un deploy con Supabase configurato e un account della coorte Controlled Beta (DEC-57), fuori dal perimetro di ciò che Claude può eseguire in questo ambiente (nessun browser reale, nessuna sessione autenticata contro produzione).

Questo documento è la checklist/matrice da compilare durante l'esecuzione — non un report di un audit già fatto.

## 1. Precondizioni

- Deploy con Supabase configurato (produzione, o un deploy di anteprima equivalente).
- Login con un account della coorte Controlled Beta: gli account di test `TEST_PARENT_EMAIL`/`TEST_CENTER_ADMIN_EMAIL`/`TEST_PLATFORM_ADMIN_EMAIL` hanno già l'override attivo (DEC-57, coorte `trama-one-controlled-beta` + ruolo `platform_admin` permanente), valido fino al **2026-10-02** — se questo documento viene eseguito dopo quella data, verificare prima in `/admin/feature-flags` che la coorte sia stata rinnovata, altrimenti tutte le route `/one*` e lo Spotlight risulteranno invisibili per un motivo noto (scadenza), non per un difetto visivo.
- Per il Partner (`center_admin`): almeno un'attività esistente nel centro assegnato all'account di test, per poter raggiungere `/center/activities/[id]` e `/center/activities/[id]/calendar` (necessari per verificare gli step `configure_weeks`/`configure_pricing`/`configure_spot_days`/`publish` dello Spotlight).

## 2. Breakpoint

Non esiste un progetto Playwright "tablet" nell'harness (`playwright.config.ts` ha solo `chromium`/Desktop e `mobile-chrome`/Pixel 7) — questo gate è manuale, quindi i tre breakpoint vanno impostati a mano (DevTools → device toolbar, o ridimensionamento finestra):

| Breakpoint | Larghezza | Riferimento |
|---|---|---|
| Mobile | 390px | iPhone 12/13, stessa famiglia del Pixel 7 già usato da `mobile-chrome` |
| Tablet | 768px | iPad, portrait |
| Desktop | 1440px | Laptop standard |

## 3. Come eseguire

Per ogni riga della matrice (§4): aprire l'URL indicato con l'account indicato, impostare la larghezza del breakpoint, confrontare con quanto descritto in "Check" e segnare l'esito nella colonna corrispondente:

- **PASS**: corrisponde a quanto descritto, nessun difetto visibile.
- **FIX**: c'è uno scostamento reale (testo tagliato, elemento sovrapposto, colore non-brand, overlay disallineato, popover che esce dal viewport, ecc.) — fare uno screenshot e annotare cosa non va nella colonna Note.
- **N/A**: la riga non è raggiungibile in questo giro (es. nessuna attività esistente per testare `configure_weeks`) — annotare il motivo in Note, non lasciare vuoto.

Per riportare un FIX a Claude: allegare lo screenshot (o il file) e la riga della matrice a cui corrisponde. Claude non applica correzioni visive "alla cieca" — corregge solo dopo aver visto l'evidenza reale (screenshot), poi ripete `tsc`/`eslint` e richiude la riga.

## 4. Matrice PASS/FIX/N-A

### 4.1 Shell `/one` (Parent) — task #424

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 1 | `/one` — `parent` | Header: icona brand + titolo "TRAMA ONE — Parent" via `PageHeader`, freccia indietro verso `/nextgen` funzionante | | | | |
| 2 | `/one` — `parent` | `WalkthroughCard` (percorso `welcome_parent`): titolo "Benvenuto in TRAMA ONE", step corrente, pulsanti `Inizia`/`Continua`/`Salta per ora`/`Ricomincia il percorso` in `bg-trama-violet` (non blu `#2E86DE`), nessuno stile inline visibile (bordi/spaziature coerenti col resto dell'app) | | | | |
| 3 | `/one` — account senza progresso Walkthrough (se disponibile) | Stato vuoto esplicito visibile (non un riquadro vuoto silenzioso) | | | | |

### 4.2 Shell `/center/one` (Partner) — task #424/#425

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 4 | `/center/one` — `center_admin` | `<h1>` "TRAMA ONE — Partner" in stile Tailwind (stessa convenzione di `/center/richieste`), link "Vai all'onboarding del centro →" in `text-trama-violet`, nessun colore hardcoded, nessuna `WalkthroughCard` residua (rimossa in DEC-60: il vero percorso ora vive su `/center/activities`, non più qui) | | | | |

### 4.3 Shell `/admin/one` (Command Center) — task #424

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 5 | `/admin/one` — `platform_admin` | Header bianco su sfondo `bg-navy`, sottotitolo `text-navy-text2`, coerente con le altre pagine Admin | | | | |
| 6 | `/admin/one` — `platform_admin` | Badge priorità: "alta" rosso (`#FBEAEA`/`#C0392B`), "media" arancio (`orange-light`/`trama-orange`), "bassa" verde (`green-light`/`#2d8f52`) — stessa palette di `/admin/feature-flags`, nessun colore inventato | | | | |
| 7 | `/admin/one` — `platform_admin` | 7 code operative in card bianche bordate `#E8EBF0`, leggibili e non sovrapposte a nessun breakpoint | | | | |
| 8 | `/admin/one` — `platform_admin` | Tabella funnel Walkthrough: scroll orizzontale (`overflow-x-auto`) su mobile invece di rottura layout | | | | |
| 9 | `/admin/one` — `platform_admin` | Stati vuoti (nessuna coda / nessun dato funnel) visibili se applicabile, non riquadri vuoti silenziosi | | | | |

### 4.4 Product Walkthrough Spotlight reale — task #425 (DEC-60)

| # | URL / account | Check | Mobile | Tablet | Desktop | Note |
|---|---|---|---|---|---|---|
| 10 | `/center/activities` — `center_admin`, step `create_activity` in corso | Overlay scuro con cutout ben allineato attorno al pulsante "+ Nuova attività" (nessun disallineamento tra cutout ed elemento reale), popover leggibile con titolo "Crea l'attività", "Passo 1 di 6", pulsante "Inizia" | | | | |
| 11 | `/center/activities` (stesso step) | Il popover NON esce dal viewport a nessun breakpoint (attenzione particolare a Mobile 390px: popover largo 320px, verificare che resti dentro lo schermo e non copra il cutout) | | | | |
| 12 | `/center/activities` (stesso step) | Il popover appare SOTTO l'elemento di default, e SOPRA solo se non c'è spazio sufficiente sotto (scrollare la pagina per verificare entrambi i casi se possibile) | | | | |
| 13 | `/center/activities/[id]` (scheda di modifica di un'attività esistente), step `configure_weeks` | Overlay ancorato alla card "Informazioni generali", nessuna sovrapposizione con altri elementi della form | | | | |
| 14 | `/center/activities/[id]`, step `configure_pricing` | Overlay ancorato alla card "Servizi extra e pasto" | | | | |
| 15 | `/center/activities/[id]`, step `publish` | Overlay ancorato al pulsante "Salva modifiche" | | | | |
| 16 | `/center/activities/[id]/calendar`, step `configure_spot_days` | Overlay ancorato al calendario disponibilità, non alla card KPI/occupazione sopra di esso | | | | |
| 17 | Qualunque pagina `/center/*`, step `dashboard` | Overlay ancorato alla voce "Dashboard" nel menu (nav item persistente) — su mobile verificare che il menu (drawer/hamburger) esponga comunque il target in modo raggiungibile | | | | |
| 18 | Navigare a una pagina senza il target dello step corrente (es. atterrare su `/center/profile` con uno step `configure_weeks` attivo) | Badge "target non trovato" in basso a destra (titolo + descrizione dello step), NON un overlay vuoto o un errore silenzioso | | | | |
| 19 | Con lo Spotlight visibile, premere Escape | Il popover/overlay scompare (equivalente a "Salta per ora" per lo step corrente) | | | | |
| 20 | Con lo Spotlight visibile su un elemento reale, cliccare l'elemento evidenziato (non un bottone del tour) | Il click naviga/agisce normalmente sull'elemento reale (nessun blocco dell'overlay) E il percorso avanza allo step successivo | | | | |

## 5. Chiusura del gate

Il gate §15 si considera chiuso quando ogni riga della matrice è **PASS** o **N/A con motivazione esplicita accettata** — nessuna riga **FIX** aperta. Se emergono FIX, riportarli a Claude con screenshot per la correzione, poi ripetere la sola riga corretta (non l'intera matrice) prima di richiudere.

Solo dopo la chiusura di questo gate si procede a §16-17 (Controlled Publication procedure, task #427).
