# PRIVACY / TERMINI / CONSENSI — Design Tecnico

**PRE-LAUNCH REMEDIATION WAVE 1 — R-546.** Decisione Fabrizio, 24/08/2026.
AS_OF_COMMIT: a12d40b (HEAD al momento di scrivere questo documento).

**REVISIONE v2 — PRE-MICRO-PILOT CLOSURE GATE (25/08/2026, task #559).**
Fabrizio ha chiesto di riverificare la coerenza di questo modello contro 7
punti espliciti prima di autorizzare `migration_27`. Verifica eseguita: 3
problemi reali trovati e corretti, 1 gap esplicitamente aperto (§6 sotto)
colmato. Dettaglio completo del changelog nell'header di
`supabase/migration_27_privacy_terms_consent.sql` (v2). Riassunto:

1. **Incoerenza corretta**: la Privacy Notice era modellata con lo stesso
   vocabolario "accepted/declined/withdrawn" del marketing (un consenso
   revocabile) — concettualmente sbagliato, un'informativa Art. 13 non si
   "ritira". Ora vive in una tabella dedicata (`legal_acceptances`, solo
   "accettato").
2. **Gap di integrità referenziale colmato**: la versione era prima solo una
   stringa libera, ora è una vera foreign key verso un nuovo registro
   versionato (`legal_documents`).
3. **Scoperta**: `profiles.marketing_consent` esiste GIÀ in produzione da
   `migration_06` (sprint Profilo esteso, precedente e indipendente), già
   letta/scritta da `updateMarketingConsentAction()`
   (`app/actions/profile.ts`) che la definisce esplicitamente come "opt-in
   commerciale, separato dalle preferenze funzionali" — il requisito
   "marketing separato" di Fabrizio era quindi GIÀ soddisfatto da un sprint
   precedente, non serviva reinventarlo. `migration_27` v1 l'avrebbe
   ri-aggiunta come se fosse nuova; v2 lo corregge.
4. **Gap colmato**: §6 sotto lasciava esplicitamente aperta la dichiarazione
   di responsabilità genitoriale sui dati dei bambini. v2 introduce
   `parental_declarations` (nuova tabella, verificata contro `kids.parent_id`
   in scrittura).

Stato invariato: ancora bozza tecnica, **non applicata**. Stato contenuto
legale invariato: **PENDING EXTERNAL REVIEW**, mai "conforme al GDPR".

**REVISIONE v3 — AS-BUILT (PRE-MICRO-PILOT CLOSURE GATE, 25/08/2026 sera,
task #566-575).** Fabrizio ha applicato manualmente `migration_27` v2 in
produzione (LIVE, POST-CHECK confermato). Su questa base è stato costruito
l'intero wiring §5, prima solo pianificato — ora **implementato e verificato
staticamente**. §5 sotto è aggiornato con lo stato AS-BUILT di ciascun
passo. Stato finale invariato nella sostanza: **TECHNICAL IMPLEMENTATION:
BUILT/STATIC_TESTED; DATABASE: LIVE; LEGAL CONTENT: PENDING EXTERNAL
REVIEW; LEGAL GATE: OFF; PILOT READINESS: BLOCKED BY LEGAL CONTENT.** Non
CLOSED — vedi §8.

## Stato: controlli tecnici predisposti / testo legale in attesa di validazione

Questo documento descrive SOLO l'infrastruttura tecnica (modello dati,
routing, versioning, wiring). **Non contiene testo legale definitivo** e
**non conclude in nessun punto che TRAMA sia "conforme al GDPR"** — quella
valutazione richiede una revisione legale esterna (vedi
`TRAMA_PRELAUNCH_COMPLIANCE_GAPS.md`, C-01/C-02/C-03), fuori dal perimetro
di questo lavoro tecnico. Ovunque in questo documento si legga "pronto",
si intende "pronto lato tecnico, in attesa di testo legale validato".

## 1. Cosa esiste oggi (AS-IS)

Verificato leggendo `app/auth/login/LoginForm.tsx` (riga ~96) e
`supabase/schema.sql`:

- La registrazione chiama `supabase.auth.signUp()` direttamente dal client,
  senza alcun checkbox di accettazione Termini/Privacy Notice e senza alcun
  consenso marketing — né bloccante né opzionale.
- Un trigger DB `handle_new_user()` legge `raw_user_meta_data` (oggi solo
  `invite_code`) per creare la riga `profiles` collegata.
- `public.profiles` non ha oggi nessuna colonna di consenso/accettazione.
- Nessuna pagina `/legal/*` o equivalente esiste nel prodotto.
- Nessuna tabella di log/audit dei consensi esiste.

Questo è esattamente il gap C-01/C-02 già registrato nell'Audit 360°
(nessuna Informativa Privacy, nessuna accettazione Termini tracciata).

## 2. Tre concetti tecnicamente distinti (per esplicita richiesta di Fabrizio)

Non vanno mai fusi in un unico "accetto tutto":

1. **Privacy Notice** (Informativa ex art. 13 GDPR) — informativa, non
   richiede consenso attivo per l'uso base del servizio (base giuridica
   contrattuale/legittimo interesse per l'erogazione del servizio stesso),
   ma l'utente deve poterla leggere PRIMA di usare il prodotto e la sua
   versione va tracciata (se cambia sostanzialmente, va ri-presentata).
2. **Termini di Servizio** — accettazione contrattuale, questa SÌ va
   registrata come consenso esplicito con timestamp/versione (l'utente
   stringe un contratto con la piattaforma).
3. **Consenso marketing** — OPZIONALE, separato, mai precompilato/
   preselezionato, revocabile in qualsiasi momento senza impedire l'uso
   del servizio (base giuridica: consenso, non contratto — per questo va
   tenuto del tutto indipendente dai due sopra).

Una quarta area, distinta dalle prime tre e più delicata (dati di minori —
i bambini iscritti dai genitori), è trattata separatamente in §6.

## 3. Modello dati v2 (vedi `supabase/migration_27_privacy_terms_consent.sql`, bozza v2 NON applicata)

Quattro tabelle, non due (revisione v2 — vedi changelog in cima a questo
documento):

| Tabella | Cosa risponde |
|---|---|
| `legal_documents` | "Quali versioni di Termini/Privacy Notice esistono, quando pubblicate?" — registro versionato, scritto solo da platform_admin. |
| `legal_acceptances` | "Chi ha accettato quale VERSIONE di quale documento, quando?" — SOLO azione "accettato" (FK verso `legal_documents`, mai withdraw/decline: un'informativa non si ritira). |
| `consent_events` | "Chi ha dato/ritirato il consenso marketing, quando?" — l'UNICA area genuinamente revocabile (accepted/withdrawn). |
| `parental_declarations` | "Quale genitore ha dichiarato la responsabilità genitoriale per quale bambino?" — verificata contro `kids.parent_id` in scrittura (§6). |

Più 5 colonne di cache su `profiles` (`tos_version`/`tos_accepted_at`/
`privacy_notice_version`/`privacy_notice_accepted_at`/
`marketing_consent_updated_at`) per lettura O(1) senza join — la colonna
`marketing_consent` stessa è pre-esistente da `migration_06`, non
reintrodotta qui.

Le colonne di cache da sole NON bastano per un audit reale (dicono solo lo
stato attuale, non la storia) — da qui le tabelle separate, tutte
append-only per costruzione (nessuna `UPDATE`/`DELETE` concessa via RLS: si
corregge scrivendo un nuovo evento/una nuova accettazione, mai riscrivendo
la storia).

Migrazione **additiva al 100%**: nessuna colonna/tabella esistente
modificata o rimossa (inclusa `marketing_consent`, solo letta/estesa con un
companion). **Non applicata** — Fabrizio la esegue dopo aver confermato il
modello.

## 4. Versioning (`lib/legal/consent.ts`, già scritto, inerte)

`CURRENT_TERMS_VERSION` / `CURRENT_PRIVACY_NOTICE_VERSION` sono oggi
segnaposto (`"v0-draft-2026-08-24"`). Quando il testo legale reale sarà
pronto, la versione va aggiornata qui — un confronto stringa tra la
versione accettata da un utente e questa costante è il meccanismo con cui
un futuro gate può capire "questo utente deve ri-accettare, i Termini sono
cambiati dall'ultima volta".

`hasAcceptedCurrentTermsAndPrivacyNotice()` è l'unica funzione di lettura
esposta oggi — pura, testata (`tests/one/consent.spec.ts`, 5/5 passed in
sandbox), non collegata a nessuna route.

## 5. Wiring — AS-BUILT (v3, 25/08/2026 sera, task #566-574)

Passi, in ordine, con lo stato reale di implementazione:

1. **Route legali pubbliche** — implementate come `app/privacy/page.tsx` e
   `app/terms/page.tsx` (non sotto `/legal/*` come originariamente
   pianificato — nomi più diretti, stessa funzione), server component
   `dynamic = "force-dynamic"`, risolvono il documento PUBLISHED più
   recente via `resolvePublishedDocumentForPublicRoute()`
   (`lib/legal/gate.ts`). **Testo reale non scritto da Claude**: se nessun
   documento PUBLISHED esiste (caso attuale, 0 righe), mostrano "Documento
   in preparazione" — mai un placeholder spacciato per testo vero. Route
   raggiungibili senza login (`proxy.ts` esteso per bypassare il gate
   auth su questi due path). **FATTO.**
2. **Checkbox al signup** in `LoginForm.tsx` — implementato: sezione
   Termini (obbligatorio, blocca il submit se non spuntato o se gate ON
   senza documento PUBLISHED — fail-closed) + link Privacy (informativa,
   non un checkbox) + Marketing (facoltativo, mai preselezionato),
   montata SOLO se `legalGateEnabled && mode === "signup"`. Con
   `LEGAL_TERMS_GATE` OFF (stato di oggi), questa sezione non si monta
   affatto — zero cambio di comportamento visibile per l'utente reale.
   **FATTO.**
3. **`app/actions/legal.ts`** (nuovo, non `consent.ts` come nominato nel
   piano originale) — `recordSignupLegalAcceptanceAction()`: scrittura
   server-side via service-client, keyed sull'userId restituito da
   Supabase Auth (mai un valore client), con validazione che esista una
   riga `profiles` corrispondente (creata sincronamente dal trigger
   `handle_new_user()`) — risolve il problema di timing "sessione non
   ancora confermata via email" individuato durante l'implementazione.
   `updateMarketingConsentAction()` (`app/actions/profile.ts`) estesa per
   scrivere anche in `consent_events` oltre a `profiles.marketing_consent`.
   **FATTO.**
4. **Impostazioni → sezione "Privacy"** — comportamento invariato lato
   utente (nessuna regressione, LEGAL-14): la funzione sottostante ora
   scrive anche lo storico in `consent_events`, la UI esistente non è
   stata toccata. **FATTO** (nella parte tecnica minima richiesta oggi;
   una UI dedicata di stato/versione resta possibile estensione futura,
   non richiesta esplicitamente da Fabrizio in questo giro).
5. **Dichiarazione genitoriale** — implementata in `app/actions/kids.ts`
   (`addKidAction`, 5° parametro `parentalDeclarationAccepted`) +
   checkbox in `components/AddKidForm.tsx`, mostrato SOLO se il flag
   risolve `true` per l'utente (oggi mai, gate OFF). Scrive
   `parental_declarations` via `recordParentalDeclaration()`. Versione
   segnaposto `CURRENT_PARENTAL_DECLARATION_VERSION` in
   `lib/legal/consent.ts`, in attesa del testo reale. **FATTO** (attivo
   solo dietro il gate, non obbligatorio finché il testo non è validato —
   come richiesto esplicitamente da Fabrizio, §9 dell'ordine operativo).

**Differenze dal piano originale**: nomi file (`legal.ts` non `consent.ts`
per le azioni; `/privacy` e `/terms` non `/legal/*`), aggiunta di
`lib/legal/gate.ts` come data layer con funzioni bootstrap dedicate al
signup (non previsto nel piano v2, necessario per il problema di timing
email-confirmation/RLS scoperto in fase di implementazione), e feature flag
`LEGAL_TERMS_GATE` come meccanismo di attivazione (il piano v2 non
specificava come sarebbe stato acceso/spento — ora lo è, riusando
l'infrastruttura esistente in `lib/feature-flags/`). Nessuna di queste
differenze cambia il perimetro concordato: nessun contenuto legale reale
creato, nessuna abilitazione globale, nessun deploy.

## 6. Dati dei bambini — dichiarazione di responsabilità genitoriale (RISOLTO in v2, era aperto in v1)

I profili bambino (`kids`) sono creati dal genitore, non dal minore
stesso — il genitore è titolare del consenso per conto del figlio (età di
consenso digitale autonomo in Italia: 14 anni, sotto Garante Privacy — vedi
Audit 360°, ricerca GDPR/minori).

**v1 lasciava questo punto esplicitamente non risolto.** v2 introduce
`public.parental_declarations` (vedi `migration_27` v2, sezione 4): un
evento append-only che registra "il genitore X dichiara di essere titolare
della responsabilità genitoriale per il bambino Y e autorizza il
trattamento dei suoi dati", verificato in scrittura contro `kids.parent_id`
(un genitore non può dichiarare per un bambino che non è il proprio, anche
conoscendone l'UUID). Il testo reale della dichiarazione resta da validare
legalmente — stesso gate di Termini/Privacy Notice, stessa disciplina di
versioning (`declaration_version`).

**Cosa questo NON introduce**: un consenso separato per il minore stesso
(il minore non ha un account nel prodotto) — è sempre e solo il genitore a
dichiarare. Non sostituisce né anticipa una eventuale informativa dedicata
"dati dei minori" all'interno della Privacy Notice, che resta materia di
revisione legale esterna.

## 7. Cosa NON fare (esplicito, invariato)

- Non pubblicare mai testo placeholder su `/privacy`/`/terms` spacciandolo
  per testo reale (oggi mostrano "Documento in preparazione" — mai testo
  finto).
- Non riapplicare `migration_27` (già LIVE) — nessuna migration
  sostitutiva salvo evidenza di errore reale.
- Non droppare/alterare `profiles.marketing_consent` (pre-esistente da
  migration_06) — solo estenderla con un companion timestamp.
- Non scrivere mai, in nessun testo del prodotto o di questo programma,
  "conforme al GDPR" — solo "controlli tecnici predisposti / testo legale
  in attesa di validazione".
- Non introdurre un consenso marketing preselezionato o bundlato con
  Termini/Privacy Notice.
- Non abilitare `LEGAL_TERMS_GATE` globalmente — solo su coorte di test,
  e solo dopo pubblicazione di testo legale reale validato.

## Verifica statica

`tsc --noEmit`: 0 errori (intero progetto, dopo il wiring completo).
`eslint` sui file toccati: 0 warning/errori. `tests/one/legal-gate.spec.ts`
(16 test nominati LEGAL-01..16): 8/16 eseguiti e verdi (logica pura, nessun
I/O), 8/16 documentati come richiedenti un deploy reale o fixture
TEST-marked non ancora esistenti (§8 di `PRE_MICRO_PILOT_GATE_STATUS.md`
per il dettaglio completo).

**SHA-256 di `migration_27_privacy_terms_consent.sql` v2**:
`e89efd877506dc0ae7a64f6e694d6aa783d881ade7293524a516f4c52604401b` — **la
migrazione è ora LIVE in produzione**, applicata manualmente da Fabrizio,
POST-CHECK di sola lettura confermato (4 tabelle, RLS attiva su tutte, 8
policy corrispondenti esattamente al file).

## 8. Decisione richiesta a Fabrizio — aggiornata

1. ~~Confermare il modello a 4 tabelle v2~~ — **fatto implicitamente**
   applicando la migrazione così com'era (nessuna modifica richiesta).
2. **Ancora aperto**: fornire/validare/pubblicare il testo legale reale
   per Termini, Privacy Notice e dichiarazione genitoriale (righe in
   `legal_documents` con `published_at` valorizzato) — fuori dal
   perimetro tecnico di questo documento, unico gate genuino rimasto.
3. ~~Applicare `migration_27_privacy_terms_consent.sql` (v2)~~ — **fatto**
   (LIVE).
4. ~~Solo dopo (1)-(3): autorizzare l'implementazione del wiring §5~~ —
   **fatto**: il wiring è stato costruito e verificato staticamente. Resta
   solo, dopo il punto 2: abilitare `LEGAL_TERMS_GATE` — inizialmente su
   una coorte di test, mai globalmente senza una nuova conferma esplicita
   di Fabrizio.

## 9. Addendum 25/08/2026 sera — migration_29 LIVE + rimozione service-role (task #605-607)

Il gap noto documentato al punto 1 di §5 ("policy SELECT `to authenticated`
soltanto") è chiuso. Sequenza reale:

- **migration_28** (`migration_28_legal_documents_anon_read.sql`) applicata
  da Fabrizio: introduceva una policy anon SELECT ma con un bug di
  ricorsione infinita (`ERROR 42P17`) — riprodotto 2 volte via query
  read-only. Nessuna esposizione dati (0 righe, e le route pubbliche
  usavano ancora il workaround service-role in quel momento). Rilevato
  anche che la policy authenticated preesistente (`qual=true`) esponeva
  ogni riga (incluse bozze) a qualunque utente non-admin.
- **migration_29 v2** (`migration_29_legal_documents_rls_remediation.sql`,
  SHA-256 `3cd5a2e67735ebc45d96e8abf9ac239c0fd06168a25925ce0d40004ff02021c6`)
  applicata da Fabrizio: risolve la ricorsione con una funzione
  `SECURITY DEFINER` hardened (search_path fisso, schema-qualified, EXECUTE
  minimo) e sostituisce la policy authenticated con una scoped a
  PUBLISHED-non-DRAFT. **LIVE, verificata PASS** (MIGRATION_29 LIVE
  POST-CHECK, 25/08/2026): matrice ALLOW/DENY dimostrata con query reali in
  transazione con ROLLBACK — anon vede solo il documento CURRENT
  PUBLISHED, authenticated normale vede CURRENT+SUPERSEDED (mai DRAFT),
  platform_admin vede tutto incluso DRAFT.
- **`resolvePublishedDocumentForPublicRoute()` in `lib/legal/gate.ts`
  riscritta**: non usa più `createServiceClient()` (bypass RLS) — usa ora
  `createClient()` (chiave anon, RLS attiva), lo stesso client di ogni
  altra pagina dell'app. Un visitatore senza sessione su `/privacy` o
  `/terms` viaggia quindi come ruolo `anon`, esattamente il ruolo per cui
  migration_29 ha creato la policy dedicata — nessun bypass RLS residuo sul
  percorso di lettura pubblica. `createServiceClient()` resta in uso SOLO
  per il bootstrap di signup (due funzioni distinte, invariate, fuori
  scope), mai per la lettura pubblica.

**PUBLIC LEGAL ACCESS: READY** (tecnicamente — il gate sul testo legale
reale, punto 2 sopra, resta aperto e separato).
