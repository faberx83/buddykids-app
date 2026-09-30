# TRAMA — Stato al 30/09/2026

Sintesi di passaggio per il nuovo account Claude. Ricostruita leggendo i 17 documenti caricati nel Project (vedi §10) e integrata con tre chiarimenti verificati direttamente da Fabrizio il 30/09/2026 (§2). Non sostituisce `STATE_OF_THE_ART.md` e `ROADMAP.md`: li riassume e li riconcilia con i documenti tecnici più vecchi.

**Regole di lettura:**
- dove i documenti si contraddicono vale il più recente, e la contraddizione è segnalata in §9;
- lo stato del database e del codice vale più di qualunque documento;
- ciò che non è stato verificato è marcato come tale;
- governance invariata: migration SQL, scritture su produzione, deploy e run live di Playwright restano sempre a Fabrizio.

---

## 1. Cos'è TRAMA

TRAMA è la versione rinominata ed estesa di BuddyKids. Aiuta i genitori a organizzare il tempo dei figli (centri estivi, attività, settimane scoperte, chi accompagna e chi ritira) senza che diventi un secondo lavoro.

È pensata in quattro parti:

1. **App famiglie:** Planner, Scopri/Mappa, prenotazioni, gruppi, condivisione del piano.
2. **Portale gestori (Partner):** attività, calendario, prezzi, posti, richieste, risposte alle prenotazioni.
3. **Area Admin di controllo:** approvazioni, qualità, raccolta centri, feature flag, monitoraggio del pilota.
4. **Marketplace fornitori e professionisti:** solo visione futura, non esiste.

- **Posizionamento:** partire dal bisogno della famiglia. Un periodo scoperto porta al confronto tra più centri verificati, poi alla richiesta o prenotazione, e il Planner si aggiorna.
- **Vero concorrente:** il fai-da-te (WhatsApp, Excel, passaparola). SQUBY è visto come possibile partner più che come rivale.
- **Modello di business:** ipotesi non testata. Beta gratuita, commissioni solo simulate al 3% promo e 5% standard. A regime: canone per i gestori più commissione, Founder Program per i primi 50 centri.
- **Stack:** Next.js (App Router) + Supabase (Postgres, Auth, Storage, RLS) + Vercel. Repository `faberx83/buddykids-app`. Deploy manuale con `deploy.sh` da parte di Fabrizio.

---

## 2. Chiarimenti verificati da Fabrizio (30/09/2026)

| # | Tema | Esito |
|---|---|---|
| 1 | Migration `PART_D2_migration_comune_scope.sql` e dati del calendario scolastico | **Applicata e pubblicata.** Colonna `school_calendar_events.comune` presente e popolata. Lombardia: 10 eventi regionali + 2 per Milano. Puglia: 10 eventi regionali + 1 per Rutigliano. Tutti `published`, anno 2026/2027. Il bug SQL del 16/09 è superato. |
| 2 | Planner Beta v1.1, fase 2 (pagina di dettaglio settimana) | **Implementata.** `app/nextgen/planner/settimana/[startDate]/page.tsx` è nel repository e tra le route pubblicate in produzione. |
| 3 | Problemi aperti dall'handoff del 03/09 (legale, cookie banner, `sharp`, variabili Vercel, altri) | **Non ancora verificati: considerarli tutti aperti** finché Fabrizio non indica il contrario (vedi §6). |

---

## 3. A che punto è

**Fase pre-pilota.** Il prodotto è tecnicamente maturo su gran parte del perimetro, ma non ha dati di mercato reali.

- **Utenti:** 10 profili in produzione (23/09), tutti di Fabrizio (alias `+test`) o di conoscenti e familiari. Nessun utente acquisito da un canale reale.
- **Dati:** 9 centri, 8 attività, 20 prenotazioni (17 confermate, 1 in attesa, 2 cancellate), 211 richieste ai gestori (in parte di test). Sono dati di dogfooding.
- **Visibilità:** `TRAMA_ONE_ENABLED` è spento per tutti. È acceso solo per il gruppo `trama-one-controlled-beta` (8 membri, fino al 31/12/2026) e per il ruolo `platform_admin`.
- **Documenti legali:** nessuno pubblicato (`legal_documents` = 0 righe).
- **Codice beta:** `TRAMABETA26` scade il **01/11/2026** (dato dell'handoff del 03/09, da riverificare).

---

## 4. Attivo in produzione

### Famiglie
- Onboarding (carousel e walkthrough).
- Planner: settimana, famiglia, indirizzi, logistica, promemoria salvati su `travel_reminders`.
  - Copertura divisa in due: "copertura attività" (c'è una prenotazione) e "completezza coordinamento" (andata e ritorno assegnati). L'hero mostra "prossimo passo" e il gap di coordinamento.
  - **Planner Beta v1.1:** fase 1 (panoramica) e fase 2 (dettaglio settimana, confermata da Fabrizio). Lo stato della fase 3 (calendario operativo con una sola attività espansa per volta) non è verificato.
- Chi fa cosa (Andata/Ritorno) e Famiglia condivisa (`family_people`) sono due feature distinte. Non esiste un modulo "deleghe".
- Ricerca e Discovery Map: correzioni live del 23/09 in produzione (commit `1f0e0ea`).
- Prenotazioni a settimana intera e a giorni singoli, con conferma parziale, lista d'attesa e i 4 stati per giorno. Modifica e annullamento entro la finestra del centro.
- Gruppi "Andiamo Insieme": sconto, inviti via email, link e gruppi pubblici. Carpooling solo come suggerimento. Community con codice completo ma mai usata.
- Piano condiviso via link pubblico senza login.
- Notification Center in-app. Push via Web Push/VAPID su alcuni eventi.
- Segnalazioni (`beta_feedback`).
- Preferiti unificati Partner + Scoperte TRAMA (`curated_favorites`, migration 38 applicata).
- Novità TRAMA: annunci con campanella, callout e pagina `/nextgen/novita` (migration 38 applicata).

### Partner
- Candidatura, onboarding con stato, checklist e registro delle azioni.
- Verifica identità: esiste nel database, ma il caricamento del documento non è collegato per scelta (DEC-22).
- Gestione di attività, calendario, prezzi e posti. La race condition su `spots_left` è risolta con Compare-And-Swap, verificato solo staticamente e non sotto carico reale.
- Richieste in arrivo, risposte alle prenotazioni (intera, per giorno, in blocco, con posti residui visibili), cancellazioni per giorno.
- L'interfaccia Partner è tutta in stile Legacy. `/center/one` è una shell interna.

### Admin
- Approvazioni, qualità del catalogo, anomalie, raccolta centri (CenterLead), registro delle azioni, feature flag (CRUD, audit, scadenze, attivazione in blocco).
- Command Center `/admin/one` e dashboard del pilota `/admin/one/pilot`.
- Calendario scolastico `/admin/school-calendar`.
- Dashboard root e `/admin/activities` restano **MOCK** (dati finti).

### School Calendar Intelligence (V1, in FREEZE)
- **Modello regione + comune:** `comune` vuoto significa evento valido per tutta la regione, valorizzato significa solo per quel comune. Il confronto sul nome del comune è normalizzato (`normalizeComuneKey`).
- **Lombardia:** inizio 14/09, fine 08/06, Natale 23/12–06/01, Pasqua 25–30/03, festività nazionali. Nessun Carnevale regionale, perché la data dipende dal rito (romano o ambrosiano).
- **Milano:** Sant'Ambrogio (07/12) e Carnevale Ambrosiano (solo il 12/02). L'11 e il 10 febbraio sono esclusi perché li decide ogni istituto.
- **Puglia:** inizio 17/09, fine 08/06, Natale, Pasqua, ponte del 07/12, festività nazionali.
- **Rutigliano:** SS. Crocifisso, 14–15/09/2026 (Ordinanza Sindacale n. 23/2026).
- **Flag:** `SCHOOL_CALENDAR_INTELLIGENCE_ENABLED`, attivo solo per alcuni gruppi.
- **Limiti noti:**
  - una sola data di inizio e fine anno per calendario, quindi l'infanzia (fine 30/06) non è gestita a parte;
  - l'evento di Rutigliano cade prima del 17/09 e non produce effetti nel Planner;
  - le date della Puglia vengono da tre fonti secondarie concordi, non dalla lettura diretta del PDF della delibera: conviene una verifica visiva.

---

## 5. In corso

| Feature | Stato | Prossimo passo |
|---|---|---|
| **External Planner Items** (28/09) | Implementata; migration 39 applicata. Visibile solo al gruppo `internal-preview` (`EXTERNAL_PLANNER_ITEMS_ENABLED`). Giro di correzioni UX live fatto (visibilità nel calendario, rimozione ottimistica, date richieste quando mancano). Per scelta **non conta** nella copertura. | Validazione live di Fabrizio (EPI-L01..L22, `tests/one/external-planner-items.spec.ts`), poi la ricorrenza settimanale (P1 immediato). La colonna `recurrence_rule` jsonb è già pronta. |
| **Fix chip Età "(0-0)"** (commit `6f44ef7`) | Rilasciato — confermato push su GitHub e produzione il 30/09. | Nessuno. |
| **Planner Beta v1.1, fase 3** | Non verificato. | Controllare `PlannerCalendarView.tsx` (una sola attività espansa per volta, "Condividi" dentro la card). |

---

## 6. Problemi aperti (tutti da considerare aperti al 30/09)

### Blocchi prima di aprire a utenti esterni
1. **Privacy e Termini non pubblicati** (`legal_documents` = 0). Serve una revisione legale professionale, trattandosi di dati di minori.
2. **La tabella `legal_documents` non ha una policy di lettura per `anon`**. Quando si pubblicheranno i testi, le pagine pubbliche `/privacy` e `/terms` non li mostrerebbero. Va corretto insieme alla pubblicazione.
3. **Consenso spento** (`LEGAL_TERMS_GATE`, mai acceso) e **cookie banner assente**. Google Fonts e le icone jsDelivr partono senza consenso: soluzione proposta, il self-hosting.
4. **Vulnerabilità alta di `sharp`** (<0.35.4, GHSA-rgj7-g3m4-5g8c): si risolve con `npm audit fix`.
5. **Variabili Vercel da verificare:** `RESEND_API_KEY` (email) e `SUPABASE_SERVICE_ROLE_KEY` (senza, il piano condiviso completo torna alla versione vecchia senza dare errori).
6. **Golden Journeys mai eseguiti** in ambiente reale: 81 test su 124 file `.spec.ts` sono gated `isRealDeployment`.

### Gap di prodotto (dall'handoff del 03/09, non riverificati)
- Home: il riquadro "prossimo appuntamento" non distingue le prenotazioni confermate solo in parte o in lista d'attesa.
- "Modifica prenotazione": non mostra lo stato di ogni singolo giorno.
- Notifiche push: disattivarle nelle preferenze (`profiles.notify_push`) non blocca l'invio in `lib/push/send.ts`.
- Nessuna push per prenotazione accettata, rifiutata o promossa dalla lista d'attesa (solo email). Non è un bug, ma una scelta di scope da riconfermare.
- **Limite di Chi fa cosa:** la chiave è bambino + giorno + momento, non per attività. Due attività dello stesso bambino nello stesso giorno contano come un solo passaggio di andata e uno di ritorno.
- Cancellazione account solo manuale (SQL Editor). Nessun export dei dati.
- KPI mancanti: nessun evento su esito delle prenotazioni, notifiche e Community.
- Voce `groups_discover_invites` non aggiornata in `lib/feature-registry/catalog.ts`. Stato delle segnalazioni beta mai aggiornato.
- Accessibilità non verificata. Dati mock nelle dashboard da chiarire prima di mostrarle ai Partner.

### Proposte tecniche non realizzate
- Controllo dell'SHA in `deploy.sh` prima di `vercel --prod`, perché oggi pubblica i file locali e non necessariamente ciò che è stato caricato su GitHub.
- Badge "Anteprima interna — solo TRAMA" e file `RELEASE_LOG.md` (dal report sul rilascio "al buio").
- Protezione dei dati sensibili dei bambini a livello di colonna (oggi solo applicativa).

---

## 7. Prossimi passi da roadmap

1. **Chiudere i blocchi di §6** prima di qualunque invito esterno.
2. **External Planner Items:** validazione live, poi la ricorrenza settimanale semplice ("ogni martedì dal 6/10 al 15/12"), con modifica della singola occorrenza o dell'intera serie.
3. **Accompagnamento/Ritiro**, prossimo blocco di prodotto, non iniziato. Serve prima **una decisione di perimetro**:
   - **se è organizzativo** (chi accompagna, chi ritira): si estende `week_responsibilities` per singola attività (risolvendo il limite di §6) e lo si collega ai membri del gruppo (`responsible_group_member_id`, come da review del pilota);
   - **se è un'autorizzazione al ritiro fisico**, coincide con le **Deleghe**: serve un parere legale prima di scrivere codice. Meccanismo raccomandato: QR dinamico o link a scadenza, non documenti d'identità di terzi.
4. **Seguono**, nello stesso filone: Deleghe, Carpooling su NextGen, Gruppi più integrati, notifiche coordinate, sincronizzazione col calendario personale (prima feed ICS; OAuth solo se c'è adozione reale).
5. **Dopo il beta:** sospensione autonoma delle attività, modifica ed eliminazione dei profili figli, risposta parziale strutturata per le settimane, analytics per i Partner, filtri e posizione sulla mappa, cancellazione account con export.
6. **Più avanti:** più sedi per un Partner, pagamenti in-app, famiglia con più tutori non conviventi. Smart Departure, Location e avviso ritardo al centro solo dopo aver validato l'adozione della parte organizzativa.
7. **Mercato:** onboarding dei centri in 2–3 micro-zone di Milano (obiettivo 25–30, oggi 9), una prima lista d'attesa di famiglie, eventi di prodotto essenziali (P0) attivi prima dei primi utenti esterni, un primo test di pagamento reale anche simbolico.

---

## 8. Modello di rilascio adottato

Rilascio "al buio" direttamente in produzione, non l'ambiente di staging separato proposto dall'Evolution Lab.

- Ogni flag nasce `defaultValue: false`.
- La visibilità sale per gruppi: `internal-preview` → `trama-one-controlled-beta` → tutti. Si gestisce da `/admin/feature-flags`, senza nuovo deploy.
- `resolveFeatureFlag` legge il database a ogni chiamata e **in caso di errore restituisce false**: un bug nasconde una feature, non la scopre.
- Ogni punto di accesso (pagina, Server Action, cron, invio push o email, API esterna) deve controllare il flag da solo, non solo la pagina.
- Deleghe e sincronizzazione calendario via OAuth richiedono una revisione in più, non basta il flag.

---

## 9. Incoerenze nei documenti (corrette il 30/09)

- **`ROADMAP.md`, sezione "Prossimo blocco prodotto principale"**: diceva che la migration 39 era "preparata ma non applicata" e la validazione live "non eseguita". **Corretto il 30/09**: la migration è applicata (commit `b216ce8`) e il giro di correzioni live è fatto. Resta da confermare la chiusura formale di EPI-L01..L22 (§2, punto 3).
- **`TECHNICAL_FUNCTIONAL_OVERVIEW.md`**: `announcement_receipts` era indicata come "NON ANCORA APPLICATA". **Corretto il 30/09**: applicata (migration 38, commit `6e36f07`), coerente con `STATE_OF_THE_ART.md`.
- **`TRAMA_EVOLUTION_LAB_REPORT.md` e `TRAMA_DARK_RELEASE_MODEL_REPORT.md`**: descrivono School Calendar come "schema senza codice né dati" — superato dall'implementazione V1 e dai dati pubblicati (§2, §4). Documenti storici, non corretti (restano come fotografia del loro momento).
- **`TRAMA_PILOT_ARCHITECTURE_REVIEW.md`**: dice che non esiste un centro notifiche — superato: il Notification Center e le push esistono (handoff del 03/09). Documento storico, non corretto.
- **File superati, da non eseguire né usare** (restano nel repository come riferimento storico, in `school-calendar-milano-puglia/`):
  - `PART_D_school_calendar_lombardia_milano_2026_2027.sql`, sostituito da `PART_D2_data_regional_and_milano_2026_2027.sql`;
  - `PART_D2_migration_proposed_comune_scope.sql`, sostituito da `PART_D2_migration_comune_scope.sql` (la sintassi `ADD CONSTRAINT IF NOT EXISTS` non è valida — e comunque già applicata, vedi §2);
  - `PART_D2_service_layer_proposal_getSchoolCalendarForKid.md`: usava il confronto esatto sul nome del comune, la versione finale lo normalizza.

---

## 10. Documenti sorgente

- **Livello 1:** `MIGRATION_CONTEXT_INDEX.md`, `BUSINESS_PLAN.md`, `ROADMAP.md`, `PREMORTEM.md` (23/09).
- **Livello 2:** `STATE_OF_THE_ART.md`, `TECHNICAL_FUNCTIONAL_OVERVIEW.md` (23/09, con aggiornamenti al 28/09), `TRAMA_FINAL_PRODUCT_STATE_HANDOFF_20260903.md`, `TRAMA_PILOT_ARCHITECTURE_REVIEW.md` (fine agosto), `TRAMA_DARK_RELEASE_MODEL_REPORT.md`, `TRAMA_EVOLUTION_LAB_REPORT.md`.
- **Livello 3:** `PLANNER_BETA_V1.1_PROPOSTA.md` e i file `PART_D*` (15–16/09).

*Scritto originariamente come documento del Project sul nuovo account Claude (30/09/2026), riportato nel repository per non dipendere da un solo posto. Da aggiornare quando Fabrizio conferma la chiusura dei problemi di §6 o la validazione di External Planner Items.*
