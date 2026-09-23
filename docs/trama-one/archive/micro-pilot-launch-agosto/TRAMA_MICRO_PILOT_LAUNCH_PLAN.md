# TRAMA — MICRO PILOT LAUNCH PLAN

AS_OF: 26/08/2026, dopo la decisione di governance "TECHNICAL GATE CLOSURE & MICRO PILOT LAUNCH PREPARATION" (chiude i cicli di accettazione tecnica; questo documento copre solo l'esecuzione operativa del primo Micro Pilot).

**Scope**: 1 Partner reale + 3 famiglie reali. Durata iniziale suggerita: 7-14 giorni.

**Non inventa traction**: ogni numero/criterio qui sotto è una soglia minima da osservare, non un risultato già raggiunto. Ad oggi (R-05, `TRAMA_PRELAUNCH_RISK_REGISTER.md`) zero dati reali di pilot esistono in produzione — questo piano è la procedura per generarli, non un resoconto di un pilot già avvenuto.

---

## 1. Stato dei gate all'ingresso di questo piano

| Gate | Stato | Nota |
|---|---|---|
| Technical Micro Pilot Gate | **READY** | Deploy live, Next.js 16.3.3 (0 HIGH), build/TS/lint PASS, Golden Journey Parent+Partner LIVE PASS, Partner dashboard P0 chiuso e verificato live, Admin operativo con demo dichiarate, infrastruttura legale tecnicamente pronta, nessun P0 noto. |
| TC-074 | **CLOSED — TEST HARNESS FIX PENDING NEXT REGRESSION CONFIRMATION.** Non blocker. | Commit `871d7e1`. Regressione dell'harness di test (locator ambiguo dopo l'upgrade Next.js), non del prodotto. Verrà rieseguito nella prossima normale regression suite. |
| Visual / Mobile UX | **PILOT UX VALIDATION** (non più gate pre-pilot) | I 3 utenti reali del Micro Pilot sono la fonte primaria di evidenza UX. I test responsive automatici restano attivi come rete di sicurezza per regressioni, non come condizione di ingresso. |
| Admin demo surfaces | Accettate per il Micro Pilot, non P0 | `/admin` e `/admin/activities`: CONTROLLED DEMO · `/admin/analytics`: MIXED+DISCLOSED · `/admin/centers`, `/admin/one`, `/admin/feature-flags`: REAL DATA. |
| Email/Resend | **ASSISTED BETA** — non blocca il primo Micro Pilot | Fallback manuale (`GATE_RESEND_API_KEY.md`) accettato per la scala 1+3. Da rivalutare esplicitamente prima di qualunque espansione (§10). |
| Legal content | **BLOCCA** — unico gate reale rimasto prima del primo utente | Privacy: bozza esistente, in revisione legale esterna. Termini Genitore/Partner e testo dichiarazione parentale: non ancora redatti. `LEGAL_TERMS_GATE`: OFF. |
| Dati reali di pilot | **Zero oggi (R-05)** | Non è un gate tecnico: è l'azione stessa che questo piano descrive. |

---

## 2. Chi invitare

**Partner (1)**: un centro reale con cui Fabrizio ha già un rapporto diretto — non uno dei centri/attività demo o test attualmente in produzione (nessuno dei 12 centri/9 attività esistenti è idoneo, per costruzione: sono tutti demo o placeholder, vedi R-05). Criteri minimi di idoneità:
- Un referente disponibile a dedicare tempo reale nella finestra pilota (non solo un "sì" di principio).
- Almeno un'attività reale, con posti/prezzo/calendario reali, che il centro è disposto a pubblicare per famiglie vere durante il pilot.
- Accesso a un dispositivo (desktop o mobile) per usare la dashboard Partner.

**Famiglie (3)**: persone reali (non account di test/staff), preferibilmente con bambini nella fascia d'età dell'attività scelta dal Partner, disposte a completare un vero percorso di prenotazione. Non serve alcun legame pregresso col Partner: l'obiettivo è osservare il journey completo richiesta→risposta→prenotazione tra sconosciuti reali, il caso d'uso reale del prodotto.

Fabrizio individua sia il Partner sia le 3 famiglie (azione di business, fuori scope tecnico).

---

## 3. Onboarding Partner

1. Fabrizio crea l'account del centro **tramite il meccanismo esistente** (`createCenterAndAssignAction`, `/admin/centers` — reale, verificato R-01 CLOSED), oppure tramite il flusso "Candidati come centro" (DEC-77) se si preferisce far passare il Partner dal percorso self-service reale già costruito.
2. Il Partner completa la registrazione (email+password, flusso già esistente e invariato).
3. Il Partner arruola sé stesso nella coorte `trama-one-controlled-beta` — **non un'azione UI**: l'unico meccanismo esistente è SQL diretto (`supabase/script_controlled_beta_expand_cohort.sql`, template non compilato per esplicita decisione precedente, DEC-57). Fabrizio esegue questo script sostituendo i placeholder con l'email/id reale del Partner, nello SQL Editor Supabase (progetto `eagsgfxunwyyxwwilldy`), dopo aver letto le sezioni PRE-CHECK del file.
4. Verificare (Fabrizio o su richiesta Claude, sola lettura) che la membership sia attiva e che l'override cohort `TRAMA_ONE_ENABLED` non sia scaduto (scade 2026-10-02 — compatibile con una finestra pilota di 7-14 giorni avviata ora).
5. Il Partner configura **un'attività reale**: nome, fascia d'età, prezzo, posti disponibili, calendario/giorni. Non un'attività segnaposto — deve essere qualcosa che il Partner offrirebbe davvero.
6. Il Partner pubblica l'attività (percorso già esistente, invariato).

---

## 4. Onboarding famiglie

1. Fabrizio contatta le 3 famiglie individuate, condivide URL di accesso (dominio famiglia) e, se serve, una guida non tecnica equivalente a `docs/trama-one/GUIDA_TOUR_PER_CENTRO_AMICO.md` (stesso principio: niente gergo, niente spoiler sui passaggi, per non guidare la risposta).
2. Ogni famiglia si registra autonomamente (flusso email+password esistente, invariato — nessuna azione SQL richiesta per le famiglie: solo il Partner richiede l'arruolamento cohort per accedere a superfici gated da `TRAMA_ONE_ENABLED`; il journey Parent standard non richiede la coorte, salvo le sezioni `/one` genitore se applicabili — verificare al momento con `/admin/feature-flags`, REAL DATA, quali route genitore sono effettivamente gated).
3. Ogni famiglia inserisce il/i bambino/i reale/i (nome, età) — dato reale minimo necessario per cercare e prenotare l'attività del Partner.
4. Ogni famiglia cerca e trova l'attività reale pubblicata dal Partner (§3.6).

**Dati reali minimi richiesti** (non oltre): nome del bambino, età, un contatto telefonico/WhatsApp raggiungibile (necessario per il fallback manuale email, §6). Nessun altro dato non necessario va richiesto.

---

## 5. Gestione richieste/prenotazioni

Flusso invariato, journey già verificato live (Golden Journey Parent+Partner PASS):
1. Famiglia invia una richiesta di prenotazione reale sull'attività del Partner.
2. Partner vede la richiesta nel proprio pannello (`/center`, dati reali, R-02 CLOSED) e risponde (accetta/rifiuta).
3. Famiglia vede l'esito nel proprio Planner/Prenotazioni.

Nessuna azione manuale richiesta in questo passaggio, salvo il fallback notifiche (§6) se l'email non parte.

---

## 6. Fallback notifiche manuali (email)

Riferimento diretto, non riscritto: `docs/trama-one/analysis/GATE_RESEND_API_KEY.md`. Sintesi operativa per la durata del pilot:
- Gruppo A (inviti centro/gruppo/famiglia): link/codice sempre generato in-app, nessuna azione manuale necessaria.
- Gruppo B (risposta a prenotazione, check-in in ritardo, assenza segnalata): **nessun fallback in-app oggi**. Fabrizio/staff eseguono 1-2 volte al giorno la query SQL già documentata in `GATE_RESEND_API_KEY.md` su `bookings.email_delivery_status = 'not_configured'` e contattano la famiglia via telefono/WhatsApp con un messaggio semplice ("la tua richiesta è stata [accettata/rifiutata], apri TRAMA per i dettagli").
- Questa procedura si esaurisce da sola se/quando Resend viene configurato — non richiede altro codice.

---

## 7. Supporto durante il pilot

- Canale di contatto diretto (telefono/WhatsApp, già raccolto in onboarding) tra Fabrizio/staff e sia il Partner sia le 3 famiglie, per l'intera durata del pilot.
- CTA "Segnala un problema" già disponibile su entrambi i portali (Parent/NEXTGEN da tempo, Partner/LEGACY da DEC-75) — feedback strutturato raccolto in `beta_feedback`, visibile in Admin.
- Nessun SLA formale per un pilot di questa scala: risposta "il prima possibile durante l'orario di lavoro" è sufficiente e va comunicata così ai partecipanti, senza promettere di più.

---

## 8. Kill switch

Il meccanismo di spegnimento sicuro esiste già ed è **REAL DATA** (verificato): `/admin/feature-flags` (Feature Control Center). In caso di problema serio (P0):
1. Disattivare l'override cohort `trama-one-controlled-beta` per `TRAMA_ONE_ENABLED` (o l'override specifico del Partner/famiglia coinvolti) da questa UI, oppure via lo stesso meccanismo SQL usato per l'arruolamento (§3.3) in senso inverso.
2. Questo non cancella alcun dato: riporta semplicemente gli utenti pilota al comportamento non-TRAMA-ONE per le superfici gated, senza impatto sul resto della piattaforma.
3. Non è necessario alcun deploy per attivare il kill switch: è un cambio di configurazione (feature flag), non di codice.

---

## 9. Escalation P0/P1

- **P0** (blocco totale, esposizione dati tra utenti, perdita dati, impossibilità di completare il journey base): Fabrizio valuta lo spegnimento immediato via kill switch (§8) e contatta Claude per diagnosi/fix appena possibile secondo la governance standard (nessuna modifica DB/deploy da parte di Claude senza il via libera di Fabrizio).
- **P1** (fastidio, comportamento non ottimale ma journey completabile): registrato, non blocca il pilot in corso, valutato a fine pilot o nella normale regression suite.
- Ogni P0/P1 osservato va registrato con: cosa è successo, chi era coinvolto (Partner/famiglia, mai nomi reali nei documenti tecnici — usare "Partner pilota"/"Famiglia 1/2/3"), quando, e se riproducibile.

---

## 10. Cosa osservare — Pilot UX Validation (osservazione non guidata)

Principio: **mai chiedere "ti piace?"**. L'osservazione è comportamentale, non un sondaggio di gradimento. Per ogni partecipante, registrare ciascuna delle domande sotto come una delle tre etichette: **TASK COMPLETED WITHOUT HELP** / **TASK COMPLETED WITH HELP** / **TASK NOT COMPLETED**, più una nota qualitativa libera (cosa ha detto/fatto, non un'interpretazione).

**Famiglia**:
- Sa dove iniziare senza indicazioni aggiuntive?
- Trova l'attività reale del Partner pilota?
- Capisce il Planner (cosa vede, cosa significa)?
- Capisce la differenza tra "richiesta inviata" e "prenotazione confermata"?
- Trova punti morti (dead-end: pagine dove non sa cosa fare dopo)?
- Chiede aiuto? Su cosa, esattamente?
- Clicca cose inaspettate (segnale di confusione sull'interfaccia)?
- Usa il prodotto da mobile senza problemi evidenti?

**Partner**:
- Capisce come creare/configurare un'attività (prezzo, posti, calendario)?
- Trova le richieste ricevute?
- Capisce come rispondere (accetta/rifiuta)?
- Sa cosa fare dopo aver risposto?
- Trova punti morti?
- Chiede aiuto? Su cosa?
- Clicca cose inaspettate?
- Usa il prodotto da mobile senza problemi evidenti?

Queste osservazioni sono la sostanza della "PILOT UX VALIDATION": sostituiscono il gate Visual Acceptance manuale pre-pilot, che a partire da questa decisione di governance non è più un requisito d'ingresso.

---

## 11. Feedback Parent/Partner

- Raccolto sia tramite la CTA "Segnala un problema" in-app (dato strutturato, `beta_feedback`) sia tramite una breve conversazione diretta (telefono/messaggio) a metà e a fine pilot — non un questionario formale con punteggio, per non introdurre metriche vanity non richieste.
- Domande aperte suggerite (non esaustive, non a punteggio): "cosa ti ha confuso di più?", "cosa avresti voluto poter fare e non hai trovato?", "rifaresti la stessa cosa la prossima volta senza chiedere aiuto?".

---

## 12. Metriche da raccogliere

**Qualitative** (primarie per un pilot di questa scala):
- Le osservazioni comportamentali di §10, per ciascun partecipante.
- Note libere da feedback (§11).
- Eventuali P0/P1 osservati (§9).

**Quantitative** (di supporto, non vanity — solo ciò che serve a valutare il gate di espansione, §13):
- Partner onboarding completato: sì/no.
- Numero di attività reali configurate (atteso: ≥1).
- Numero di famiglie che completano l'onboarding (atteso: ≥1 su 3, obiettivo 3 su 3).
- Numero di richieste reali Genitore→Partner inviate.
- Numero di richieste a cui il Partner risponde, e tempo di risposta.
- Numero di P0 osservati (obiettivo: 0).
- Numero di volte in cui è stato necessario il fallback manuale email (§6), come indicatore diretto per la decisione di espansione su Resend.

Nessuna metrica di crescita/traction viene definita qui, perché non è quello che un pilot di 1+3 può produrre in modo significativo.

---

## 13. Pilot Success Criteria (minimi)

Il Micro Pilot è considerato riuscito se, entro la finestra di 7-14 giorni, **tutti** i seguenti sono veri:
1. Onboarding Partner completato.
2. Almeno 1 attività reale configurata e pubblicata.
3. Almeno 1 famiglia completa l'onboarding (obiettivo, non minimo: tutte e 3).
4. Almeno 1 richiesta reale Genitore→Partner viene inviata.
5. Il Partner vede e comprende la richiesta ricevuta (osservato, non solo tecnicamente possibile).
6. Il Partner risponde alla richiesta.
7. La famiglia vede la risposta del Partner.
8. Lo stato di prenotazione/Planner si aggiorna correttamente per entrambe le parti.
9. Zero P0.
10. Nessuna esposizione di dati tra utenti (un utente non vede mai dati di un altro Partner/un'altra famiglia).
11. Ogni problema riscontrato è recuperabile operativamente (nessun blocco permanente, nessuna perdita di dati).
12. Feedback raccolto da entrambe le parti (Partner e almeno una famiglia).

---

## 14. Expansion Gate (prima di espandere a 3-5 Partner / 10-20 famiglie)

Da valutare **solo dopo** la chiusura del Micro Pilot iniziale, esplicitamente, prima di qualunque scala superiore:

| Criterio | Domanda da porsi |
|---|---|
| P0 | Sono zero durante il pilot? Se non zero, sono stati chiusi e verificati? |
| P1 principali | Sono stati identificati e prioritizzati? |
| Feedback UX | Le osservazioni di §10 mostrano un percorso comprensibile senza aiuto eccessivo, per entrambi i ruoli? |
| Operazioni manuali | Il carico manuale (fallback email, supporto diretto) è sostenibile alla scala attuale? Resta sostenibile moltiplicato per 3-5x Partner e 10-20x famiglie? |
| Resend | È stato configurato? Se no, è stata presa una decisione esplicita e documentata di restare su fallback manuale anche a scala 3-5/10-20 (sconsigliato, il fallback è stato accettato solo per 1+3)? |
| Carico di supporto | Il volume di richieste dirette a Fabrizio/staff è stato gestibile con le risorse attuali? |
| Qualità dei dati | I dati inseriti da Partner/famiglie reali sono utilizzabili (non richiedono correzioni manuali sistematiche)? |
| Completamento journey | Le richieste inviate arrivano a una risposta e a uno stato Planner coerente, senza intervento manuale ripetuto? |
| Stabilità del gate legale | `LEGAL_TERMS_GATE`/contenuto legale: la situazione è stabile o è cambiata (es. testo pubblicato) rispetto all'ingresso di questo pilot? |

**Output atteso di questa valutazione, a fine Micro Pilot**: uno tra **EXPAND** / **EXPAND WITH CONDITIONS** / **DO NOT EXPAND** — non prodotto in questo documento (che descrive solo il processo), ma nel report di chiusura del Micro Pilot stesso, quando i dati sopra esisteranno davvero.

---

## 15. Vincoli espliciti di questo documento

- Non sostituisce né riapre `TRAMA_PLATFORM_PRODUCT_TRUTH.md` o gli altri 8 documenti dell'audit congelato (commit `05d06e1`).
- Non introduce nuove feature, migrazioni, o modifiche a dati reali.
- Non inventa traction: ogni numero in questo documento è una soglia da osservare, non un dato già raccolto.
- Non riapre: gate Visual manuale pre-pilot (sostituito da Pilot UX Validation), TC-074, School Calendar, Partner analytics avanzato, multi-sito, pagamenti, cancellazione dati automatizzata, publish/unpublish, JourneyContext, cleanup Legacy non bloccante per l'utente.
