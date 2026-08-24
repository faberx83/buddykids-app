# PRIVACY / TERMINI / CONSENSI — Design Tecnico

**PRE-LAUNCH REMEDIATION WAVE 1 — R-546.** Decisione Fabrizio, 24/08/2026.
AS_OF_COMMIT: a12d40b (HEAD al momento di scrivere questo documento).

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

## 3. Modello dati (vedi `supabase/migration_27_privacy_terms_consent.sql`, bozza NON applicata)

Due livelli, non uno:

| Livello | Dove | Cosa risponde |
|---|---|---|
| Stato corrente | `profiles.tos_version` / `tos_accepted_at` / `privacy_notice_version` / `privacy_notice_accepted_at` / `marketing_consent` / `marketing_consent_updated_at` | "Questo utente è in regola ORA?" — letto da qualunque gate applicativo futuro, una query, nessun join. |
| Storico/audit | Nuova tabella `consent_events` (append-only: `user_id`, `consent_type`, `version`, `action`, `source`, `created_at`) | "Chi ha accettato cosa, quando, quale versione, e se poi l'ha ritirato?" — la vera risposta a una richiesta di accesso (art. 15) o a una contestazione. |

Le 6 colonne su `profiles` da sole NON bastano per un audit reale (dicono
solo lo stato attuale, non la storia) — da qui la tabella separata,
append-only per costruzione (nessuna `UPDATE`/`DELETE` concessa via RLS: si
corregge scrivendo un nuovo evento, mai riscrivendo la storia).

Migrazione **additiva al 100%**: nessuna colonna/tabella esistente
modificata o rimossa. **Non applicata** — Fabrizio la esegue dopo aver
confermato il modello.

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
   (facoltativo, MAI preselezionato). Al submit, passati nello stesso
   `options.data` già usato per `invite_code` (stesso meccanismo, stesso
   trigger `handle_new_user()` esteso per scrivere anche le 6 colonne
   `profiles` in un colpo solo). Gate: migration_27 applicata (altrimenti
   il trigger fallirebbe scrivendo su colonne inesistenti).
3. **`app/actions/consent.ts`** (nuovo) — server action per registrare un
   evento in `consent_events` (accettazione al signup + eventuale ritiro
   futuro del consenso marketing da Impostazioni) e aggiornare lo stato
   corrente su `profiles` in modo atomico. Gate: migration_27 applicata.
4. **Impostazioni → sezione "Privacy"** — mostra lo stato corrente
   (versione accettata, data) e permette di ritirare SOLO il consenso
   marketing (Termini/Privacy Notice non sono ritirabili senza smettere di
   usare il servizio, essendo la base contrattuale). Gate: passi 2-3.

**Perché questi passi non sono stati implementati in questo turno**: farlo
oggi significherebbe (a) scrivere query verso colonne/tabelle che non
esistono ancora in produzione (rottura del signup reale), oppure (b)
mostrare un placeholder di testo legale a famiglie/centri veri durante il
Micro Pilot spacciandolo per l'informativa vera — entrambi gli esiti
peggiori di aspettare. Questo è esattamente il gate genuino di cui parla
l'istruzione di Fabrizio ("stop alla soglia solo quando serve davvero testo
legale o SQL").

## 6. Dati dei bambini (nota distinta, non risolta qui)

I profili bambino (`kids`) sono creati dal genitore, non dal minore
stesso — il genitore è titolare del consenso per conto del figlio (età di
consenso digitale autonomo in Italia: 14 anni, sotto Garante Privacy — vedi
Audit 360°, ricerca GDPR/minori). Questo documento NON introduce un
meccanismo di consenso separato per i dati dei bambini: è materia
distinta, richiede una valutazione legale propria (probabilmente
un'informativa dedicata "dati dei minori" all'interno della Privacy
Notice, non un consenso a parte) — segnalata qui come nota aperta, non
risolta, per non lasciarla implicitamente "chiusa" insieme al resto.

## 7. Cosa NON fare (esplicito)

- Non pubblicare mai `/legal/terms`/`/legal/privacy` con testo placeholder
  a utenti reali (solo Fabrizio/staff interno in fase di revisione).
- Non applicare `migration_27` prima che Fabrizio confermi il modello.
- Non scrivere mai, in nessun testo del prodotto o di questo programma,
  "conforme al GDPR" — solo "controlli tecnici predisposti / testo legale
  in attesa di validazione".
- Non introdurre un consenso marketing preselezionato o bundlato con
  Termini/Privacy Notice.

## Verifica statica

`tsc --noEmit`: 0 errori. `eslint` sui file toccati: 0 warning/errori.
`tests/one/consent.spec.ts`: 5/5 passed (test puro, nessun I/O, gira in
questo sandbox).

## Decisione richiesta a Fabrizio

1. Confermare il modello a due livelli (§3) o proporre un'alternativa.
2. Fornire/validare il testo legale reale per Termini e Privacy Notice
   (fuori dal perimetro tecnico di questo documento).
3. Applicare `migration_27_privacy_terms_consent.sql` quando pronto.
4. Solo dopo (1)-(3): autorizzare l'implementazione del wiring §5.
