
# TRAMA ONE — Visual Conformance Audit

Copre §4-6 del gate "Controlled Beta Experience, Publication and Readiness Gate": audit di conformità visiva/brand delle 3 shell TRAMA ONE (`/one`, `/center/one`, `/admin/one`) contro il Product Bible/Handbook/Brand Kit già in uso nel resto del repository — **non** un audit di brand da zero, ma una verifica puntuale contro i pattern già stabiliti e verificati altrove (design tokens `tailwind.config.ts`, componenti condivisi `PageHeader`/`HubCard`, convenzioni admin già in uso in `FeatureFlagsAdminClient.tsx`/`RichiesteClient.tsx`). Eseguito PRIMA di qualunque wiring di navigazione, per esplicita istruzione di Fabrizio ("non è accettabile mostrare a una coorte pilota un `<h1>` di sistema e colori hardcoded").

## 1. Metodo

Fonte di verità per lo stile: `tailwind.config.ts` (token `trama-*`/`ink`/`ink-2`/`ink-3`/`navy-*`/`bg`, font `Poppins`/`Inter`), `components/PageHeader.tsx` (header standard NEXTGEN Parent), `components/dashboard/DashboardLayout.tsx` (variant `admin`/`partner`, sfondo `bg-navy` scuro per Admin verificato riga 237, padding responsive `p-5 md:p-8` sul `<main>` verificato riga 380), e tre pagine già mature usate come riferimento diretto per le convenzioni badge/card: `app/admin/feature-flags/FeatureFlagsAdminClient.tsx` (badge di stato, card bianche bordate `#E8EBF0` su sfondo Admin scuro), `app/center/richieste/RichiesteClient.tsx` (h1 Tailwind `text-xl font-bold text-ink` lato Partner), `app/nextgen/profile/segnalazioni/SegnalazioniClient.tsx` (empty state con icona + testo, `PageHeader` con `showBrandIcon`).

Non ri-verificato da zero: la palette/i font/i componenti condivisi stessi (già stabiliti e testati in sprint precedenti, TRAMA Sprint 1-3, righe 175-216 del Decision Log) — solo la loro APPLICAZIONE alle 3 shell TRAMA ONE, che ne erano rimaste fuori.

## 2. Violazioni trovate (stato PRIMA di questo intervento)

| File | Violazione | Evidenza |
|---|---|---|
| `app/one/page.tsx` | `<h1>` di sistema, `style={{padding:24}}` inline, nessun token/componente condiviso | Letto in `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md` §1 (Parent), riga "nessuno stile applicato" |
| `app/center/one/page.tsx` | `<h1>` di sistema, `style={{padding:24}}` inline, colore hardcoded `#2E86DE` per il link onboarding (non un token) | `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md` §2 (Partner) |
| `app/admin/one/page.tsx` | `<h1>` di sistema, interamente in `style={{}}` inline, 7 colori hex hardcoded per i badge priorità (`#FDECEA`/`#C0392B`/`#FFF6E5`/`#B7791F`/`#EAF7EE`/`#2E7D46`) + `#555`/`#8A93A3`/`#E8EBF0`/`#F0F2F5` per testo/bordi tabella, nessun breakpoint responsive esplicito | `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md` §3 (Admin) — "la route con il gap visivo più ampio di tutto l'inventario" |
| `app/one/WalkthroughCard.tsx` | Componente condiviso (montato in `/one` e `/center/one`): interamente in `style={{}}` inline, stesso colore hardcoded `#2E86DE` per i pulsanti primari, nessun token | Non era in §4ter del Route Release Matrix (componente, non route) ma condivide lo stesso difetto — trovato leggendo il file durante il restyle |

Nessuna delle 3 shell aveva stati vuoti espliciti: se il dato sorgente era `null`/vuoto, la pagina renderizzava un contenitore vuoto senza spiegazione (non un errore, ma un'assenza silenziosa).

## 3. Correzioni applicate

Tutte le correzioni sono di sola presentazione (classi Tailwind/token al posto di `style={{}}` inline e colori hex) — **nessun cambio di logica, dati, comportamento, markup semantico rilevante per i test, o testo verificato dai test Playwright esistenti**, verificato file per file:

- **`app/one/WalkthroughCard.tsx`**: sostituiti tutti gli `style={{}}` con classi Tailwind (`trama-violet` per la CTA primaria, palette `ink`/`ink-2` già in uso altrove). Preservati esattamente: `role="region"`, `aria-label`, `aria-busy`, `aria-live="polite"`, `aria-atomic="true"`, `id="walkthrough-current-step-title"`, ogni `aria-describedby`, e i nomi accessibili esatti dei pulsanti ("Inizia"/"Continua"/"Salta per ora"/"Ricomincia il percorso") — `tests/one/walkthrough-partner.spec.ts` (TC-N414/N415) li individua per nome esatto via `getByRole`.
- **`app/one/page.tsx`**: rimosso `<h1>`/`style={{padding:24}}`, sostituito con `PageHeader` (icona brand, `backHref="/nextgen"`) — stesso linguaggio di `/nextgen/profile/segnalazioni`. Titolo lasciato **testualmente invariato** ("TRAMA ONE — Parent"): `tests/one/smoke.spec.ts` (TC-N306) verifica `page.getByText("TRAMA ONE — Parent")`, nessuna modifica al test necessaria. Aggiunto uno stato vuoto esplicito quando `walkthrough` è `null`.
- **`app/center/one/page.tsx`**: rimosso `<h1>`/`style={{padding:24}}`/colore hardcoded, sostituito con `<h1 className="text-xl font-bold text-ink">` (stessa convenzione di `RichiesteClient.tsx`) e link `text-trama-violet`. Aggiunto lo stesso stato vuoto esplicito. Nessun wrapper `<main>` aggiuntivo: `DashboardLayout` applica già il padding responsivo.
- **`app/admin/one/page.tsx`**: sostituiti tutti gli inline style — h1 bianco + sottotitolo `text-navy-text2` (convenzione Admin già stabilita, sfondo `bg-navy` del container), badge priorità con la STESSA palette già in uso in `FeatureFlagsAdminClient.tsx` (`bg-[#FBEAEA]/text-[#C0392B]` alta, `bg-orange-light/text-trama-orange` media, `bg-green-light/text-[#2d8f52]` bassa — invece di inventarne una nuova), card bianche bordate `#E8EBF0` per ogni coda, tabella funnel con le stesse classi. Aggiunti DUE stati vuoti espliciti (nessuna coda operativa; nessun dato di funnel) prima assenti. Aggiunta responsività esplicita (`sm:flex-row sm:items-center sm:justify-between` sulle righe coda, `overflow-x-auto` sulla tabella funnel per mobile). Nessun testo verificato dai test toccato: `tests/one/command-center.spec.ts` legge le label dai dati (`q.label`), non da stringhe hardcoded nel markup — verificato riga per riga prima di procedere.

## 4. Cosa NON è stato toccato in questo passaggio

- Nessuna logica di dominio, query dati, o comportamento dei tre layout `/one*` (gate feature flag invariato).
- Nessuna voce di navigazione aggiunta (wiring rimandato alla fase E, dopo questo restyle — DEC-58).
- Nessun contenuto dei sotto-percorsi già maturi (`/center/one/onboarding`, `/admin/one/onboarding`, `/admin/center-leads`, `/admin/feature-flags`): erano già conformi (uso di componenti/registry condivisi, non stili inline), confermato in `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md` §1-3.
- **Verifica visiva a schermo (screenshot, breakpoint mobile/tablet/desktop)**: non eseguibile da Claude in questo ambiente — richiede un browser reale contro un deploy con Supabase configurato e flag attivo per un account della coorte, stessa limitazione documentata per l'intera suite Playwright UI-driven di questo repository. Rimandata al Visual Acceptance Gate (§15, task #426), da eseguire dopo restyle+wiring+Spotlight, con Fabrizio.
- **Stato di "loading" a livello di route** (`loading.tsx`/Suspense): verificato che NESSUNA route dell'intero repository lo usa (`grep` su `app/**/loading.tsx`, zero risultati) — tutte le pagine sono Server Component che attendono i dati prima del render, architettura consistente già esistente. Non introdotto qui per non rompere questa consistenza architetturale con un pattern nuovo isolato alle sole route TRAMA ONE.
- **Stato di errore a livello di route**: le funzioni dati aggregate (`getCommandCenterQueues`, `getWalkthroughProgress`, ecc.) ereditano il fail-safe silenzioso già esistente nei singoli moduli di dominio (es. `lib/data/center-leads.ts`, DEC-56) — non introdotta nessuna nuova gestione d'errore qui, per non riaprire il dominio funzionale Sprint 1-6 (vincolo esplicito del gate).

## 5. Verifica statica eseguita

- `tsc --noEmit`: pulito sull'intero progetto (0 errori) dopo tutte le modifiche di questa sezione.
- `eslint` sui 4 file toccati (`app/one/page.tsx`, `app/one/WalkthroughCard.tsx`, `app/center/one/page.tsx`, `app/admin/one/page.tsx`): pulito (0 warning/errori).
- Riletti tutti i test Playwright che toccano queste route (`tests/one/smoke.spec.ts`, `tests/one/walkthrough-partner.spec.ts`, `tests/one/command-center.spec.ts`) per confermare che ogni testo/selettore verificato è preservato — nessuna modifica ai test necessaria.
- Esecuzione UI-driven (screenshot/rendering reale): non eseguibile in questo ambiente, vedi §4.

## 6. Esito

Le 3 shell e il componente Walkthrough condiviso sono ora conformi ai token/componenti/convenzioni già stabiliti nel resto del repository — nessun colore hardcoded, nessun `<h1>` di sistema, nessuno stile inline residuo, stati vuoti espliciti dove prima mancavano. Restyle completato: sblocca la fase successiva (E, wiring navigazione — solo per `/admin/one`, `PRIMARY_NAV` per §6.3 del Route Release Matrix) e, in parallelo/successivamente, il vero Product Walkthrough Spotlight (§7-14, task #425).
