# MICRO PILOT RUNBOOK — 1 centro reale + 1 attività reale + 3 famiglie reali

**Wave 1 #11 (task #549), 24/08/2026.** Chiude RB-06 (`TRAMA_PRELAUNCH_REMEDIATION_BACKLOG.md`) e R-05 (`TRAMA_PRELAUNCH_RISK_REGISTER.md`). Esegue le azioni operative descritte in `CONTROLLED_BETA_OPERATING_MODEL.md`, riferimento §32 dell'audit 360°.

Tutte le azioni qui sotto sono di Fabrizio (business/operative) o richiedono la sua conferma esplicita — Claude non crea account reali, non invia inviti a persone reali, non applica migrazioni.

## 0. Perché questo pilot prima di aprire a chiunque altro

Oggi (verificato 24/08/2026) zero famiglie, zero centri e zero attività reali esistono in produzione — solo dati demo/test. Il Micro Pilot è il primo momento in cui persone vere useranno il prodotto con dati veri. Scala volutamente minima (1+1+3) per rendere ogni problema facilmente diagnosticabile e reversibile prima di un Controlled Beta più ampio.

## 1. Pre-flight — gate di codice richiesti PRIMA di iniziare

| Gate | Stato al 24/08/2026 | Blocca il Micro Pilot? |
|---|---|---|
| R-01/R-02 (dashboard mock senza banner) | CHIUSO/MITIGATO (Wave 1) | No |
| R-07 (race condition capacità) | CHIUSO (Wave 1) | No |
| R-09 (Planner senza test) | CHIUSO (Wave 1) | No |
| R-10 (migrazioni privacy 23/24) | CHIUSO, confermato applicato live (Wave 1) | No |
| R-14 (admin.ts hardening) | CHIUSO (Wave 1) | No |
| R-19 (accessibilità Planner) | CHIUSO (Wave 1) | No |
| **R-03 (informativa privacy/T&C)** | Infrastruttura tecnica pronta, **testo legale ancora mancante** | **SÌ — vero gate.** Con dati di minori reali, il pilot non deve iniziare senza almeno un'informativa minima validata da Fabrizio, collegata al signup |
| **R-06 (`next` vulnerabile, 4 advisory HIGH)** | Piano pronto, esecuzione post Security Release 26/08/2026 | Consigliato chiudere prima, non strettamente bloccante per un pilot a 4 persone note |
| R-08 (RESEND_API_KEY) | Non configurata — vedi `GATE_RESEND_API_KEY.md` | No (fallback manuale già presente: link/codice da copiare) ma consigliato prima di scalare oltre il Micro Pilot |

**Condizione minima per iniziare**: R-03 deve avere almeno un'informativa privacy minima pubblicata e collegata (anche un testo semplice validato da Fabrizio, non necessariamente rifinito) prima che un genitore reale registri un bambino reale. Gli altri item sono raccomandati ma non bloccanti a questa scala.

## 2. Onboarding del centro reale (1)

1. Il centro compila il **form pubblico di candidatura** (`/auth/candidati`, `CandidatiForm.tsx`), oppure Fabrizio lo crea direttamente se il centro è già un contatto diretto.
2. Fabrizio (Admin) **approva la candidatura** da `/admin/one` (Command Center) o dalla coda candidature — azione "Approva e crea centro".
3. Il centro riceve le credenziali/accesso e completa l'**onboarding checklist** (profilo, verifica identità con documento reale — DEC-22, dati di contatto).
4. Fabrizio verifica in Admin che il centro risulti con stato reale (non più `SUBMITTED` pending) prima di procedere.

**Verifica di sola lettura consigliata** (Fabrizio, via Supabase): `select id, name, status, created_at from centers where status not in ('demo')` per confermare che il nuovo centro reale sia distinguibile dai demo/test esistenti.

## 3. Creazione dell'attività reale (1)

1. Il centro (o Fabrizio per suo conto) crea **un'attività reale** con date/prezzo/capienza veri tramite `/center/attivita/nuova`.
2. Impostare disponibilità reale (calendario giorni/settimane) tramite `AvailabilityCalendar`.
3. Verificare che l'attività sia visibile in Ricerca/Scopri lato genitore prima di invitare le famiglie (evita che le prime 3 famiglie trovino la piattaforma vuota).

## 4. Onboarding delle famiglie reali (3)

1. Fabrizio genera **3 inviti** (via il meccanismo `invite_code` già esistente in `handle_new_user()`, o invito diretto se già in uso in produzione) per 3 famiglie reali disposte a partecipare a un test.
2. Ogni famiglia si registra normalmente (`app/auth/login/LoginForm.tsx`), completa il profilo e aggiunge almeno un bambino reale.
3. **Punto di attenzione R-03**: al momento della registrazione, se l'informativa privacy minima (§1) non è ancora collegata al flusso di signup, Fabrizio deve comunicare comunque per iscritto (email/messaggio) alle 3 famiglie come vengono trattati i dati, prima che inseriscano dati di un minore — pratica minima anche in assenza del wiring tecnico completo.

## 5. Esecuzione dal vivo dei Golden Journey (GJ-01..GJ-11)

Riferimento: tabella Golden Journey in `TRAMA_PRELAUNCH_360_AUDIT.md`. Con 1 centro + 1 attività + 3 famiglie reali, eseguire dal vivo (Fabrizio, non Claude — nessun test Playwright automatico contro produzione):

| Journey | Cosa verificare concretamente |
|---|---|
| GJ-01 Parent onboarding | Le 3 famiglie completano profilo/bambini senza errori |
| GJ-02/GJ-03 Partner candidacy → Admin approval | Il centro reale appare nella coda Admin ed è approvabile |
| GJ-04/GJ-05 Partner first activity/availability | L'attività reale e le sue disponibilità sono corrette e visibili |
| GJ-06 Parent discovery | Le famiglie trovano l'attività reale in Ricerca/Scopri (non solo demo) |
| GJ-07 Parent request | Almeno una famiglia invia una richiesta di prenotazione reale |
| GJ-08/GJ-09 Partner acceptance (totale/parziale) | Il centro accetta/rifiuta e la famiglia vede l'esito corretto |
| GJ-11 Booking → Planner | La prenotazione confermata appare correttamente nel Planner della famiglia (incl. gli 8 stati settimana ora accessibili, R-19) |
| GJ-14 Email delivery | Se R-08 non ancora chiuso: confermare che il fallback manuale (link/codice) funzioni comunque, senza email |

Ogni riga FAIL va registrata come bug reale (non ignorata) prima di procedere oltre il Micro Pilot.

## 6. Osservabilità durante il pilot

`product_events` è attiva (992 righe, verificato Wave 1) ma non copre ancora il journey booking (R-04) — durante il Micro Pilot, chiedere sempre a chi segnala un problema: schermata (screenshot), orario preciso, e se possibile il `correlationId` visibile nei log Vercel per quella richiesta, in assenza di un log booking dedicato.

## 7. Rollback / kill switch durante il pilot

Se qualcosa va storto in modo serio (dati corrotti, bug bloccante):
- **Feature flag `TRAMA_ONE_ENABLED`**: kill switch immediato disponibile via SQL (vedi `SPRINT_0_ACTIVATION_RUNBOOK.md` §8, Opzione C) — disattiva TRAMA ONE per tutti senza toccare la produzione LEGACY.
- **Centro/famiglie del pilot**: non esiste oggi un "pausa pilot" dedicato — l'opzione più semplice è disattivare temporaneamente l'attività reale (nasconderla da Ricerca) lato Admin, che ferma nuove richieste senza cancellare dati esistenti.

## 8. Checkpoint di uscita (go/no-go per Controlled Beta più ampio)

Il Micro Pilot si considera concluso con successo quando, per almeno 1-2 settimane:
- Nessun Golden Journey (§5) è FAIL.
- Nessun bug P0 emerso non risolto.
- Le 3 famiglie e il centro confermano (anche informalmente) un'esperienza utilizzabile.
- R-08 (email) risolto o esplicitamente accettato come debito per questa scala.

Solo a queste condizioni ha senso discutere l'apertura a un numero maggiore di centri/famiglie reali — decisione di Fabrizio, non automatica.
