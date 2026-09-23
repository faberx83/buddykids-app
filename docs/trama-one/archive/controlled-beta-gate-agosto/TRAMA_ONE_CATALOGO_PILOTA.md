# TRAMA ONE — Catalogo Pilota (Sezione 9)

**Chiude**: OD-06 ("Classificazione dati pilota non ancora prodotta, blocca GO/NO-GO e qualunque report a terzi").
**Metodo**: query di sola lettura via Supabase MCP direttamente sul database di produzione (progetto `eagsgfxunwyyxwwilldy`), nessuna scrittura eseguita.
**As-of**: 2026-08-24T13:10:33+02:00, commit `f4fb668`.

## Classificazione usata

- **PILOT_REAL** — un centro/attività/famiglia/prenotazione reale, non riconducibile a un account di test noto né a un pattern di naming di test.
- **DEMO_CONTROLLED** — dato seminato intenzionalmente come demo/reference (es. il bootstrap iniziale dei 5 centri), non test debris ma nemmeno pilota reale.
- **TECHNICAL_TEST** — creato da un account di test noto (`faberx83+...@gmail.com`, alias `TEST_*_EMAIL` di `.env.test`) o da un fixture Playwright (naming `[TEST] ...`/timestamp epoch), o esplicitamente autodichiarato di test da Fabrizio nel nome ("prova", "pippo", ecc.).
- **UNKNOWN** — non riconducibile con certezza a nessuna delle 3 categorie sopra con i soli dati disponibili; richiede una decisione esplicita di Fabrizio.

## 1. Centri (11 righe totali)

| Centro | Creato il | Attività | Classificazione | Motivazione |
|---|---|---|---|---|
| Accademia CreArte | 07/07 12:43 | 1 | DEMO_CONTROLLED | Bootstrap iniziale, 5 centri creati nello stesso identico istante (`schema.sql`/seed) |
| TechKids Milano | 07/07 12:43 | 1 | DEMO_CONTROLLED | Idem |
| Campo Brera | 07/07 12:43 | 1 | DEMO_CONTROLLED | Idem |
| Scuola di Musica Aria | 07/07 12:43 | 1 | DEMO_CONTROLLED | Idem |
| Centro Sportivo Lido | 07/07 12:43 | 1 | DEMO_CONTROLLED | Idem |
| Test centro estivo | 07/07 16:15 | 1 (nome attività: "test") | UNKNOWN | Già segnalato ambiguo in DEC-64, lasciato esplicitamente alla decisione di Fabrizio — non incluso in nessuna pulizia finora |
| Centro pippo | 07/07 22:07 | 0 | TECHNICAL_TEST | Nome placeholder generico ("pippo"), 0 attività, mai completato |
| [TEST] Centro BuddyKids | 09/07 21:09 | 2 | TECHNICAL_TEST | Fixture permanente collegato a `TEST_CENTER_ADMIN_EMAIL`, prefisso `[TEST]` esplicito |
| Centro estivo prova candidatura | 05/08 13:29 | 1 (nome attività: "Prova FP") | TECHNICAL_TEST | Autocandidatura di test di Fabrizio stesso, già classificata così in `MVP_SEPTEMBER_READINESS_MATRIX.md` |
| [TEST] Centro Auto LEAD 1787560030469 | 24/08 08:27 | 0 | TECHNICAL_TEST | Naming epoch identico ai fixture Playwright già documentati in DEC-64 (rigenerato a ogni run del test Sprint 5 auto-LEAD) |
| [TEST] Centro Idempotenza 1787560031045 | 24/08 08:27 | 0 | TECHNICAL_TEST | Idem |

**Nessun centro PILOT_REAL.**

## 2. Attività (9 righe totali)

Tutte le attività ereditano la classificazione del centro a cui appartengono (verificato via `center_id`, tabella sopra): 5 DEMO_CONTROLLED (una per centro seed), 3 TECHNICAL_TEST ("test", "[TEST] Attività BuddyKids", "[TEST] Attività auto 1787559983246"), 1 UNKNOWN ("Prova FP" — nome dell'attività stesso già di per sé un indizio di test, ma appartiene al centro classificato TECHNICAL_TEST, non a "Test centro estivo").

## 3. Center Leads / Candidature (20 righe totali)

| Pattern | Righe | Classificazione |
|---|---|---|
| `[TEST] Centro Segnalato <epoch>` (parent_referral) | 13 | TECHNICAL_TEST |
| `[TEST] Centro Autocandidatura <epoch>` (self_candidacy) | 3 | TECHNICAL_TEST |
| `Centro estivo prova candidatura` (self_candidacy, email `faberx83+partnernew@gmail.com`) | 1 | TECHNICAL_TEST |

**Aggiornamento di OD-07**: il conteggio precedente ("9 righe su 10 sono rumore di test") è superato — sono ora **20 righe, 20 delle quali TECHNICAL_TEST, 0 PILOT_REAL**. Nessuna candidatura o segnalazione da un centro/genitore reale è mai stata ricevuta.

## 4. Account (profiles, 6 righe totali)

| Email | Ruolo | Creato il | Classificazione |
|---|---|---|---|
| faberx83@gmail.com | platform_admin | 07/07 09:43 | TECHNICAL_TEST — account interno di Fabrizio (`TEST_PLATFORM_ADMIN_EMAIL`) |
| faberpirulli@gmail.com | parent | 08/07 12:32 | TECHNICAL_TEST — account personale di Fabrizio usato per test manuali (10 delle 16 prenotazioni) |
| faberx83+test-genitore@gmail.com | parent | 09/07 21:03 | TECHNICAL_TEST — alias `TEST_PARENT_EMAIL` |
| faberx83+test-gestore@gmail.com | center_admin | 09/07 21:04 | TECHNICAL_TEST — alias `TEST_CENTER_ADMIN_EMAIL` |
| faberx83+partnernew@gmail.com | center_admin | 05/08 09:10 | TECHNICAL_TEST — alias creato per testare il flusso Candidati Partner |
| faberx83+newparent@gmail.com | parent | 05/08 15:53 | TECHNICAL_TEST — alias creato per testare un secondo profilo genitore |

**Tutti e 6 gli account esistenti sono varianti `+alias` dello stesso indirizzo Gmail di Fabrizio. Zero utenti pilota reali (famiglie o centri esterni) sono mai stati registrati.**

## 5. Prenotazioni (16 righe totali)

Tutte le 16 prenotazioni appartengono ai 3 profili `parent` sopra (10 + 4 + 2 = 16, verificato per somma): nessuna prenotazione orfana, nessuna riconducibile a un utente esterno. Classificazione ereditata: TECHNICAL_TEST.

## 6. Nota su Gruppi/Community (fuori dal perimetro letterale di questa sezione, segnalato per contesto)

3 righe `groups` / 51 righe `communities` / 3 `group_members` / 51 `community_members` — generate anch'esse esclusivamente dagli stessi 6 account sopra (nessun settimo account esiste nel database). Non analizzate riga per riga in questo catalogo (la Sezione 9 dell'Addendum riguarda esplicitamente centri/attività, non community/gruppi) — se Fabrizio vuole lo stesso livello di dettaglio anche qui, è un'estensione rapida della stessa query.

## 7. Riepilogo esecutivo

- **0 righe PILOT_REAL** in tutto il database, in nessuna tabella controllata (centri, attività, center_leads, account, prenotazioni).
- **5 righe DEMO_CONTROLLED** (i centri/attività seed originali, bootstrap del 07/07).
- **1 riga UNKNOWN** ("Test centro estivo" + la sua attività "test") — stessa ambiguità già segnalata in DEC-64, non risolta qui: richiede una decisione esplicita di Fabrizio (tenerlo come demo permanente, riclassificarlo TECHNICAL_TEST, o eliminarlo).
- **Tutto il resto (20 center_leads, 6 account, 16 prenotazioni, i 2 nuovi centri di oggi) è TECHNICAL_TEST** — generato da account interni o da fixture Playwright, non da traffico reale.

**Implicazione diretta per il gate GO/NO-GO**: qualunque numero estratto oggi da questo database (es. "N centri", "N candidature", "N prenotazioni") in un report o materiale rivolto a terzi **non rappresenta trazione pilota reale** — va sempre accompagnato da questa classificazione, o il rischio è di riportare rumore di test come se fosse adozione reale (rischio già segnalato in OD-07, ora quantificato con precisione).

Nessuna azione correttiva applicata al database in questo task (nessuna riga toccata, nessuna pulizia eseguita) — coerente con la governance permanente: Claude produce solo la classificazione, l'eventuale pulizia (`script_production_hygiene_cleanup.sql`, già pronto da DEC-64 ma non applicato) resta una decisione ed esecuzione di Fabrizio.
