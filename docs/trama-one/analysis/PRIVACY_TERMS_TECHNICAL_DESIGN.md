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

## 5. Wiring previsto (NON ancora fatto — piano, non implementazione)

Passi, in ordine, ciascuno con il proprio gate:

1. **Route legali pubbliche** `/legal/terms` e `/legal/privacy` —
   struttura di pagina pronta a ricevere il testo (titolo, sezioni
   standard: Titolare, Dati raccolti, Finalità, Base giuridica,
   Conservazione, Diritti dell'interessato, Contatti). **Testo reale non
   scritto da Claude** — un placeholder esplicito ("BOZZA — in attesa di
   validazione legale") in ogni sezione finché Fabrizio non fornisce/
   approva il contenuto. Gate: testo legale.
2. **Checkbox al signup** in `LoginForm.tsx` — "Ho letto e accetto
   [Termini] e l'[Informativa Privacy]" (obbligatorio, blocca l'invio se
   non spuntato) + "Voglio ricevere comunicazioni di marketing"
   (facoltativo, MAI preselezionato, e comunque già gestibile oggi da
   `updateMarketingConsentAction()` esistente — non richiede
   necessariamente il checkbox al signup). Al submit, passati nello stesso
   `options.data` già usato per `invite_code` (stesso meccanismo, stesso
   trigger `handle_new_user()` esteso per scrivere le 5 colonne cache
   nuove su `profiles`). Gate: migration_27 v2 applicata (altrimenti il
   trigger fallirebbe scrivendo su colonne inesistenti).
3. **`app/actions/consent.ts`** (nuovo) — due funzioni distinte, non una:
   (a) accettazione Termini/Privacy Notice al signup → riga in
   `legal_acceptances` (mai withdraw/decline); (b) ritiro/attivazione
   marketing → estende l'`updateMarketingConsentAction()` già esistente
   (`app/actions/profile.ts`) per scrivere ANCHE una riga in
   `consent_events` (oggi aggiorna solo `profiles.marketing_consent`,
   senza storico). Aggiorna lo stato di cache su `profiles` in modo
   atomico in entrambi i casi. Gate: migration_27 v2 applicata.
4. **Impostazioni → sezione "Privacy"** — mostra lo stato corrente
   (versione accettata, data) e permette di ritirare SOLO il consenso
   marketing (già possibile oggi via la UI esistente collegata a
   `updateMarketingConsentAction()` — da estendere per scrivere anche lo
   storico in `consent_events`; Termini/Privacy Notice non sono ritirabili
   senza smettere di usare il servizio, essendo la base contrattuale).
   Gate: passi 2-3.
5. **Dichiarazione genitoriale** — al momento di aggiungere un bambino
   (`kids`), un passaggio che chieda al genitore di dichiarare la propria
   responsabilità genitoriale (checkbox + testo, versionato come Termini/
   Privacy Notice) → riga in `parental_declarations`. Gate: migration_27
   v2 applicata + testo della dichiarazione validato legalmente.

**Perché questi passi non sono stati implementati in questo turno**: farlo
oggi significherebbe (a) scrivere query verso colonne/tabelle che non
esistono ancora in produzione (rottura del signup reale), oppure (b)
mostrare un placeholder di testo legale a famiglie/centri veri durante il
Micro Pilot spacciandolo per l'informativa vera — entrambi gli esiti
peggiori di aspettare. Questo è esattamente il gate genuino di cui parla
l'istruzione di Fabrizio ("stop alla soglia solo quando serve davvero testo
legale o SQL").

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

## 7. Cosa NON fare (esplicito)

- Non pubblicare mai `/legal/terms`/`/legal/privacy` con testo placeholder
  a utenti reali (solo Fabrizio/staff interno in fase di revisione).
- Non applicare `migration_27` (v2) prima che Fabrizio confermi il modello.
- Non droppare/alterare `profiles.marketing_consent` (pre-esistente da
  migration_06) — solo estenderla con un companion timestamp.
- Non scrivere mai, in nessun testo del prodotto o di questo programma,
  "conforme al GDPR" — solo "controlli tecnici predisposti / testo legale
  in attesa di validazione".
- Non introdurre un consenso marketing preselezionato o bundlato con
  Termini/Privacy Notice.

## Verifica statica

`tsc --noEmit`: 0 errori. `eslint` sui file toccati: 0 warning/errori.
`tests/one/consent.spec.ts`: 5/5 passed (test puro, nessun I/O, gira in
questo sandbox).

**SHA-256 di `migration_27_privacy_terms_consent.sql` v2** (calcolato dopo
il salvataggio finale, 25/08/2026):
`e89efd877506dc0ae7a64f6e694d6aa783d881ade7293524a516f4c52604401b` — da
usare per confermare, al momento dell'applicazione, che il file eseguito su
Supabase è esattamente questo e non una copia modificata nel frattempo.

## Decisione richiesta a Fabrizio

1. Confermare il modello a 4 tabelle v2 (§3) o proporre un'alternativa.
2. Fornire/validare il testo legale reale per Termini, Privacy Notice e
   dichiarazione genitoriale (fuori dal perimetro tecnico di questo
   documento).
3. Applicare `migration_27_privacy_terms_consent.sql` (v2) quando pronto —
   PRE-CHECK/POST-CHECK/ROLLBACK inclusi nel file, da eseguire manualmente.
4. Solo dopo (1)-(3): autorizzare l'implementazione del wiring §5.
