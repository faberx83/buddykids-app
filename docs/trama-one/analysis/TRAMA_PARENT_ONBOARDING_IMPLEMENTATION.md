# TRAMA — Parent Private Beta Onboarding Carousel: Implementazione

Nota di trasparenza: `trama-onboarding-private-beta-final.pptx` (fonte visiva indicata nel task)
non è presente in questo ambiente di sviluppo. Copy, titoli, CTA, palette e regole di
contenuto ("NON mostrare X") sono stati trascritti verbatim dalla specifica testuale fornita
nella richiesta, non riletti dal file stesso. Il titolo Slide 2 è la decisione DEFINITIVA
esplicitamente data: "Le tue settimane, finalmente visibili" (NON "La tua estate, finalmente
visibile").

## Trigger

Il carousel viene recuperato/montato in `app/nextgen/layout.tsx` (unico layout server-side
dell'intera area Parent NEXTGEN) SOLO quando:

- utente autenticato (guard esistente, invariato — redirect a `/auth/login` se assente);
- `TRAMA_ONE_ENABLED` risolve a `true` per l'utente (stesso flag/cohort già usato per lo
  Spotlight `discover_book_parent`, nessun nuovo flag creato);
- `realRole === "parent"` (doppia sicurezza esplicita, oltre al fatto che questo layout serve
  solo `/nextgen`);
- il tutorial `parent_beta_onboarding` non risulta ancora risolto per l'utente
  (`currentStepKey !== null`).

Se una qualunque di queste condizioni non è vera, `onboardingProgress` resta `null` e
`OnboardingCarousel` non renderizza nulla (`return null`).

Il carousel precede lo Spotlight in-context (`discover_book_parent`): quest'ultimo viene
recuperato solo dopo che l'onboarding risulta completato o saltato, per evitare due overlay
sovrapposti nella stessissima prima sessione.

## Persistenza

Zero nuove migration. Riuso 100% dell'infrastruttura Walkthrough esistente:

- nuova voce nel registry (`lib/walkthrough/registry.ts`): `parent_beta_onboarding`, con UN
  solo step sentinella (`carousel`) — non 5 step, perché le 5 slide sono un'esperienza
  autocontenuta il cui avanzamento vive solo nello stato client del componente; ciò che serve
  persistere lato server è unicamente il risultato finale (visto/risolto oppure no).
- stessa tabella `public.tutorial_progress`, stesse Server Action generiche
  (`completeWalkthroughStepAction`, `skipWalkthroughStepAction`, `startWalkthroughStepAction`
  di `app/actions/walkthrough.ts`).
- `getWalkthroughProgress(userId, "parent_beta_onboarding").currentStepKey === null` è la
  condizione booleana esatta per "il genitore ha già completato o saltato l'onboarding" —
  usata sia per decidere se mostrare il carousel, sia (implicitamente) per il replay futuro
  (un eventuale restart non deve cancellare questo stato: `restartWalkthroughAction` esiste
  già nell'infrastruttura generica e resta disponibile se in futuro si vorrà agganciare un
  punto di replay).

"Salta" e "Completa 5/5" persistono ENTRAMBI lo stesso stato (nessuna differenza per il
mostra/non-mostra futuro): rispettivamente `skipWalkthroughStepAction` e
`completeWalkthroughStepAction` sullo step `carousel`.

## Ordinamento rispetto al Legal Gate

Nessun nuovo codice di controllo legale è stato scritto. L'ordinamento "eventuali obblighi
legali PRIMA dell'onboarding" è garantito per costruzione: il redirect verso
`/auth/legal-pending` avviene in `app/auth/callback/route.ts` (backstop fail-closed, DEC-80),
eseguito PRIMA che l'utente possa mai raggiungere `app/nextgen/layout.tsx` — dove il carousel
viene recuperato/montato. Se in futuro `LEGAL_TERMS_GATE` viene attivato, il carousel arriverà
automaticamente dopo il completamento del flusso legale, senza alcuna modifica a questo codice.
Oggi il flag resta OFF globalmente (nessuna regressione).

## Parent-only (Partner/Admin non vedono mai il carousel)

Difesa in profondità:

1. per costruzione — `OnboardingCarousel` è importato e montato ESCLUSIVAMENTE in
   `app/nextgen/layout.tsx`; Partner usa `app/center/layout.tsx`, Admin usa
   `app/admin/layout.tsx`, entrambi file separati mai toccati in questo task;
2. guardia esplicita — `realRole === "parent"` nel data-fetch gate, a costo zero, come seconda
   sicurezza contro un ipotetico accesso diretto a `/nextgen` da un account Partner/Admin.

## Slide 1-5

Dati puri in `lib/nextgen/onboarding-slides.ts` (separati dal rendering per essere testabili
senza browser), rendering in `components/nextgen/OnboardingCarousel.tsx`:

1. **CAOS** — "Benvenuto in TRAMA" — visual scattered chips → frecce → settimane organizzate.
2. **VEDO** — "Le tue settimane, finalmente visibili" (titolo definitivo) — visual coerente col
   Planner reale: stati Coperta/Parziale/Da organizzare per Sofia e Luca.
3. **TROVO** — "Trova ciò che serve davvero" — settimana scoperta → ricerca → attività demo
   disponibile. Nessun testo di scoring/match% (verificato da test ONB-P09).
4. **CHIEDO E ORGANIZZO** — "Tu chiedi. Il centro risponde." — flow
   Famiglia→Richiesta→In attesa→Centro→Risposta→Planner, esiti Confermata/Alternativa. Nessun
   riferimento a pagamento/checkout (verificato da test ONB-P10).
5. **ORA PROVO** — "Adesso prova TRAMA" — CTA "Inizia a esplorare" → chiude onboarding →
   persiste completamento → Home.

"Salta" presente su tutte le schermate, nessuna conferma richiesta.

## Responsive

- Desktop: dialog centrato, `max-w-[640px]`, overlay `bg-black/50`.
- Mobile (~390px): bottom-sheet full-width, CTA full-width `min-h-[48px]`, titolo `text-2xl`
  (→ `sm:text-[28px]` su desktop), Slide 2 nasconde le settimane oltre la quarta sotto il
  breakpoint `sm:` (`hidden sm:inline-flex` da indice 4 in poi), Slide 4 impila il flow in
  colonna su mobile e passa a riga con wrap da `sm:` in su.
- Tablet: adattamento naturale via gli stessi breakpoint Tailwind (`sm:`), nessun breakpoint
  dedicato necessario.

Swipe gesture mobile: NON implementato — l'infrastruttura esistente non offre un gestore di
gesture pronto e affidabile; introdurne uno nuovo solo per questo task avrebbe significato una
gesture fragile, esplicitamente sconsigliata dal task. Navigazione copertà da CTA, tasti
freccia e "Indietro" testuale.

## Accessibilità

`role="dialog"`, `aria-modal="true"`, `aria-labelledby` sul titolo, focus trap manuale (Tab/
Shift+Tab ciclano dentro il dialog), focus iniziale sul dialog alla prima apparizione (non
ri-focato ad ogni remeasure), ESC = equivalente a "Salta", frecce tastiera per navigare,
touch target `min-h-[36px]`/`min-h-[48px]`, contrasto WCAG AA (token TRAMA esistenti, stessa
palette già in uso nell'app), progress leggibile da screen reader (`aria-live="polite"` sul
testo "N/5", non solo un indicatore visivo a puntini), elementi puramente decorativi (le
illustrazioni) marcati `aria-hidden="true"`, animazione di apparizione condizionata
`motion-safe:` (rispetta `prefers-reduced-motion`), nessuna informazione veicolata solo dal
colore (ogni stato Planner ha icona + etichetta testuale, non solo un colore).

## Replay / "Guida"

**REPLAY ENTRY POINT: NOT IMPLEMENTED.**

`components/WalkthroughRestartButton.tsx` è generico e riusabile (parametrizzato per
`tutorialKey`), ma verificato via grep essere montato SOLO in
`app/center/account/preferenze/page.tsx` (Impostazioni Partner) — non esiste alcuna analoga
sezione "Guida"/impostazioni nell'area Parent NEXTGEN in cui agganciarlo. Per istruzione
esplicita del task, non è stata creata una nuova sezione UI solo per questo. Non è un blocker
per la Beta: l'infrastruttura di replay (`restartWalkthroughAction`) esiste già ed è pronta per
essere agganciata in futuro a un eventuale punto "Guida" Parent, quando/se verrà introdotto.

## Feature flag / cohort

Nessun nuovo flag creato. Riuso diretto di `TRAMA_ONE_ENABLED` (stesso Controlled Beta Cohort
già usato per lo Spotlight Parent), con l'aggiunta della guardia esplicita `realRole ===
"parent"` descritta sopra.

## Migration

**NESSUNA.** Un solo step sentinella nella tabella `tutorial_progress` già esistente è
sufficiente a rappresentare "il genitore ha risolto l'onboarding, in un modo o nell'altro" —
non è stata necessaria alcuna nuova colonna/tabella.

## Test

`tests/nextgen/onboarding-carousel.spec.ts` — 12 scenari (ONB-P01..P12) più verifiche di
registry/contenuto aggiuntive:

- **[no browser]** (girano SEMPRE, anche in questo sandbox, eseguiti e superati in questa
  sessione): registry `parent_beta_onboarding` con un solo step `carousel`; ONB-P08 (Slide 4
  contiene "In attesa"); ONB-P09 (nessun "Match NN%"/scoring/ranking); ONB-P10 (nessun
  riferimento a pagamento/checkout); titolo Slide 2 definitivo; conteggio/ordine 5 slide.
- **Richiedono un browser reale** (ONB-P01-P07, P11, P12): gated `isRealDeployment`. Questo
  sandbox non può lanciare NESSUN browser (Chromium/headless shell) — mancano librerie di
  sistema (`libxdamage1`, vari pacchetti font) e non è disponibile `sudo`/root per installarle
  (limite hardware pre-esistente e già documentato in sessioni precedenti, non introdotto da
  questo task). Questi test sono scritti, integrati nella suite (`npx playwright test --list`
  conferma 1276 test totali, nessun errore di sintassi), ma NON eseguibili qui: richiedono un
  deploy reale. ONB-P07 in particolare è unconditionally skipped perché richiederebbe attivare
  `LEGAL_TERMS_GATE=ON`, cosa che questa sessione non fa mai per regola di governance; il suo
  esito è comunque garantito per costruzione (vedi sezione "Ordinamento").

## Limitazioni

- Swipe gesture mobile non implementato (vedi sezione Responsive).
- Replay/"Guida" Parent non implementato (vedi sezione Replay).
- 9 dei 12 test funzionali richiedono un deploy reale per essere eseguiti (limite del
  sandbox, non del codice) — vedi `BuddyKids_Test_Case.xlsx`, righe ONB-P01..P12, colonna
  Esito = "REQUIRES LIVE DEPLOY" per questi casi, "PASS AUTOMATED" per P08/P09/P10.
