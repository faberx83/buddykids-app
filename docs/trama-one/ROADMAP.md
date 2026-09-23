# TRAMA — Roadmap

23/09/2026. Questo documento **sostituisce `docs/trama-one/analysis/TRAMA_BETA_ROADMAP_EXTERNAL.md`** come riferimento roadmap principale. È costruito sopra `docs/trama-one/STATE_OF_THE_ART.md`, verificato lo stesso giorno contro codice sorgente e query dirette (read-only) sul DB di produzione Supabase — non è una riscrittura stilistica della vecchia roadmap, ogni "stato attuale" qui sotto è allineato a quanto effettivamente verificato in quel documento, non a quanto la roadmap precedente dava per assunto.

Come la vecchia roadmap, resta un documento prodotto per Partner/famiglie: non contiene backlog tecnico puro (migration, RLS, refactoring, debito tecnico, observability, framework di test) salvo dove quel debito è esso stesso un blocker per andare oltre la Beta — vedi sezione dedicata sotto.

---

## PRIVATE BETA — SETTEMBRE (stato attuale)

Ciò che è realmente disponibile oggi, verificato contro codice e DB live (`STATE_OF_THE_ART.md`, 23/09/2026):

- Iscrizione famiglia, gestione base figli, Planner (settimana/famiglia/indirizzi/logistica/promemoria — promemoria con persistenza reale, non più stato locale), Ricerca con filtri avanzati, richiesta prenotazione, risposta del centro (intera/per-giorno/alternativa), gestione prenotazioni, gruppi/community, condivisione piano (link pubblico senza login), segnalazioni.
- Per i Partner: candidatura assistita, verifica identità assistita (schema pronto, upload documento **non collegato** per decisione esplicita DEC-22 — non è un gap, è una scelta di scope), gestione completa attività/calendario/prezzi/capacità (con race condition su `spots_left` **risolta** via Compare-And-Swap applicativo e test di regressione dedicato — verificata staticamente, non ancora sotto carico concorrente reale), inbox richieste, risposta a prenotazioni, cancellazioni/rimborsi per giorno.
- Assistenza diretta TRAMA per: notifiche (email non ancora attive in modo verificabile — vedi blocker sotto), spegnimento di un'attività, cancellazione account.
- **Discovery Map**: ciclo di bugfix live completo e deployato con successo (commit `fa121ca` → `1f0e0ea`, confermato su `deploy_events`), verificato dal vivo da Fabrizio: basemap OpenStreetMap stabile, legenda sempre visibile senza scroll, 3 tipologie di marker con popup dedicati (TRAMA/Da invitare/Fonte pubblica), filtro Copertura con semantica corretta, chip Età/Servizi/Prezzo con stato attivo visibile, bell/chat mai sopra i marker, X per svuotare la ricerca.
- **Non ancora deployato in produzione**: fix del chip Età che mostrava fantasma `(0-0)` all'apertura della Mappa (commit `6f44ef7`, root cause: `Number(null)` coercizzato a `0` invece di `NaN`). Il branch locale è avanti di 3 commit rispetto a `origin/main` (`e3d5451`, `d75db9c`, `6f44ef7`) — questo fix è pronto ma **in attesa di push/deploy**, non ancora verificabile live.

---

## Blocker pre-crescita / pre-produzione

Non sono feature future: sono prerequisiti perché il prodotto possa uscire dal perimetro "Fabrizio + conoscenti" in modo sicuro e conforme. Onestamente, oggi il pilota **non ha dati di mercato reali** — tutti i 10 `profiles` in produzione sono account di Fabrizio o di conoscenti/famiglia (nessun utente acquisito via canale reale), quindi questa sezione conta più di qualunque voce POST-BETA per la prossima fase.

| Blocker | Impatto | Urgenza |
|---|---|---|
| Privacy Notice / Termini mai pubblicati (`legal_documents`=0 righe in produzione) | Il codice è onesto ("Documento in preparazione") ma non c'è alcun contenuto legale reale pubblicato — non conforme per un pilota con utenti esterni | ALTA — blocca qualunque acquisizione di utenti reali |
| Vulnerabilità npm `high` (`sharp` <0.35.4, GHSA-rgj7-g3m4-5g8c) | Fix disponibile (`npm audit fix`), non applicato | ALTA — vulnerabilità di sicurezza nota e risolvibile, da chiudere prima di aprire il traffico |
| `RESEND_API_KEY` non verificabile in produzione | Codice degrada senza rompersi (link/codice invito copiabile a mano dal Gestore), ma le notifiche email restano non confermate attive — solo Fabrizio/Vercel possono verificarlo | ALTA — condiziona sia la voce "Notifiche email automatiche" sotto sia l'esperienza Beta dichiarata |
| Golden Journeys mai eseguiti sotto carico reale | 81 test su 124 file `.spec.ts` sono gated `isRealDeployment` (richiedono ambiente reale, non eseguibili in sandbox) — mai passati come PASS confermato | MEDIA — condizione nota da settimane, da chiudere prima di scalare oltre il Micro Pilot |
| Zero dati pilota reali (solo dogfooding) | Nessuna validazione di mercato reale a oggi, nonostante 2 nuovi contatti esterni rispetto ad agosto/settembre | MEDIA — non un bug, ma un rischio di validazione da tenere esplicito prima di investire su feature POST-BETA |
| Dati mock in dashboard Admin/Partner senza banner esplicativo confermato | Non riverificato voce per voce — con solo 8 attività/9 centri/20 prenotazioni alcune viste potrebbero sembrare "vuote" più che "mock", ma non è stato chiarito | BASSA/MEDIA — da chiarire con un'ispezione UI dedicata prima di mostrare le dashboard a Partner esterni |
| Accessibilità non auditata | Nessuno strumento (axe/Lighthouse) eseguito, nessun pattern sistematico `aria-*` trovato nei componenti chiave ispezionati — stato "non verificato", non "confermato assente" | BASSA — da mettere in coda per un audit dedicato |

---

## POST-BETA / VALIDAZIONE Q4

Capability già motivate dai primi use case reali della Beta, con dipendenze e confidenza dichiarate. Stati aggiornati secondo `STATE_OF_THE_ART.md`:

| Feature | Value proposition | Stato attuale | Dipendenza | Confidenza |
|---|---|---|---|---|
| Notifiche email automatiche | Ridurre il bisogno di contatto manuale per ogni evento | Codice pronto (`lib/email.ts`, degrada senza rompersi se manca la chiave); non verificabile da remoto se `RESEND_API_KEY` sia oggi impostata in produzione — vedi blocker sopra | Conferma/configurazione della chiave in produzione (verificabile solo da Fabrizio/Vercel) | HIGH |
| Pubblicazione/sospensione attività autonoma | Dare ai Partner il controllo di mettere in pausa un'attività senza contattarci | Non esiste ancora | Decisione di design + piccola estensione dati | HIGH |
| Modifica/cancellazione profilo figlio | Permettere correzioni senza contattare l'assistenza | Solo aggiunta esiste oggi | Estensione delle azioni esistenti | HIGH |
| Accettazione parziale strutturata per prenotazioni a settimana | Dare ai Partner lo stesso livello di flessibilità già disponibile per le prenotazioni a giorno | Oggi solo un messaggio libero | Estensione del modello di risposta già esistente per i giorni | MEDIUM |
| Dashboard analytics per Partner | Dare visibilità sulle proprie performance | Non esiste (solo lato Admin, e solo parzialmente) | Costruzione ex-novo | MEDIUM |
| Calendario scolastico integrato al Planner | Aiutare le famiglie a pianificare attorno alle chiusure scolastiche | Struttura dati di base predisposta; flag `SCHOOL_CALENDAR_INTELLIGENCE_ENABLED` esiste ed è attivo per alcune cohort interne, ma il grado di completezza applicativa non è stato riverificato in questa sessione | Fonte dati chiusure scolastiche regionali/nazionali + logica Planner + verifica dedicata del flag | MEDIUM |
| Cancellazione account con esportazione dati | Dare alle famiglie un controllo reale e conforme sui propri dati | Oggi solo disattivazione manuale | Pipeline di cancellazione/export dedicata | MEDIUM |
| Filtro per tipo marker sulla Mappa Discovery (Centri TRAMA / Da invitare / Fonte pubblica) | Lasciare al genitore la scelta di quali categorie vedere, riducendo il rumore visivo su mappe affollate | Legenda statica sempre visibile (confermato ancora vero dopo il ciclo di bugfix di settembre), nessun filtro interattivo per tipo | Nuovo chip filtro + stato dedicato, integrato con la persistenza URL/restore della Mappa già esistente | MEDIUM |
| Scelta della modalità/stile di visualizzazione della mappa | Dare controllo visivo/preferenza estetica sulla cartografia | Un solo stile (OpenStreetMap standard, oggi anche più stabile dopo il fix del basemap grigio), nessuna opzione di scelta | Valutazione di provider tile aggiuntivi compatibili con una usage policy verificata (vedi cronologia provider in `ActivityMap.tsx`) | LOW |
| Zoom automatico sulla propria posizione con "Usa la mia posizione" | Centrare rapidamente la mappa sulla propria zona senza pan/zoom manuale | La posizione viene mostrata come marker, ma la mappa non si ricentra automaticamente su di essa — non toccato dal ciclo di bugfix di settembre | Piccola estensione del comportamento di fit esistente in `ActivityMap.tsx` | MEDIUM |

---

## SCALE / FUTURE

Capability strutturali per quando il prodotto cresce oltre la scala del Micro Pilot:

| Feature | Value proposition | Stato attuale | Dipendenza | Confidenza |
|---|---|---|---|---|
| Multi-sede per un Partner | Permettere a un gestore con più centri di operare da un unico account | Non supportato architetturalmente oggi | Evoluzione del modello dati di proprietà del centro | MEDIUM |
| Pagamenti in-app | Chiudere il ciclo prenotazione→pagamento dentro la piattaforma | Non esiste | Integrazione con un fornitore di pagamenti | LOW (nessuna data sostenibile oggi) |
| Famiglia multi-tenant (più tutori non conviventi) | Supportare situazioni familiari più complesse | Modello famiglia attuale è a singolo nucleo (nota: `families`/`family_members`=0 righe in produzione, probabile percorso legacy; il percorso reale oggi è "Famiglia condivisa" su `family_people`) | Evoluzione dello schema dati Famiglia | LOW |

Nessuna data d'arrivo viene indicata per le voci "Scale/Future": non ancora sostenibile.

---

## Nota

Questo documento sostituisce `docs/trama-one/analysis/TRAMA_BETA_ROADMAP_EXTERNAL.md` come riferimento principale. Il vecchio file resta consultabile per lo storico delle decisioni ma non va più aggiornato.
