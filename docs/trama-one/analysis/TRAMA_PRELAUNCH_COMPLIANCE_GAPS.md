# TRAMA — PRE-LAUNCH COMPLIANCE GAPS (Legal / Regulatory)

AS_OF_COMMIT: `6d7b1021bdb38d6db2fc77ae4132a32616bedce3`

Nota metodologica: questo documento NON fornisce conclusioni legali definitive. Dove serve una determinazione legale, è marcato esplicitamente `EXTERNAL LEGAL REVIEW RECOMMENDED`. Le fonti usate sono citate con URL e data di consultazione (24/08/2026); Claude non è un consulente legale.

## MUST BEFORE PILOT

### C-01 — Nessuna informativa privacy pubblicata o collegata
**Norma/tema**: GDPR art. 13/14 (informativa al momento della raccolta dati), Codice Privacy italiano.
**Evidenza prodotto**: CODE_VERIFIED — nessuna route `/privacy`/`/informativa` esiste nell'app; nessun link da signup o footer. Esiste solo un piano documentale interno (`BuddyKids_Privacy_Compliance_Piano.docx`, mai pubblicato/collegato).
**Gap**: raccolta dati di adulti e minori (nome, data di nascita, foto, indirizzo) senza informativa accessibile all'utente.
**Rischio**: alto — requisito di trasparenza GDPR non soddisfatto.
**Azione**: pubblicare un'informativa privacy collegata dal signup prima di onboardare qualunque famiglia reale.
**Owner**: Fabrizio (contenuto/testo legale) + Claude (pubblicazione/wiring).

### C-02 — Nessun consenso/accettazione T&C distinto al momento del signup
**Norma/tema**: base giuridica del trattamento (contratto vs consenso), GDPR art. 6/7.
**Evidenza prodotto**: CODE_VERIFIED — `LoginForm.tsx` raccoglie solo email/password, nessun checkbox di accettazione termini/informativa. L'unico consenso esistente nell'app è un toggle "marketing" post-signup, per una finalità diversa e non collegata all'accesso al servizio.
**Gap**: nessuna registrazione dell'evento di accettazione (nessuna colonna `tos_accepted_at`).
**Rischio**: alto, specialmente perché il servizio raccoglie anche dati di minori inseriti dal genitore.
**Azione**: introdurre un consenso/accettazione esplicito e separato da quello marketing, con registrazione dell'evento (data/versione del documento accettato).
**Owner**: Fabrizio (testo) + Claude (implementazione, richiede una piccola migrazione additiva).

### C-03 — Età di consenso per il trattamento dati dei minori non gestita esplicitamente
**Norma/tema**: GDPR art. 8 fissa il limite generale UE a 16 anni per il consenso digitale diretto del minore, con facoltà per gli Stati membri di abbassarlo fino a 13; **l'Italia ha fissato il limite a 14 anni** per il consenso autonomo e valido ai servizi della società dell'informazione. Sotto tale soglia serve il consenso di chi esercita la responsabilità genitoriale.
**Fonte**: [Garante Privacy — Minori](https://www.garanteprivacy.it/temi/minori) (consultato 24/08/2026); [Federprivacy — provvedimento Garante su consenso digitale minori](https://www.federprivacy.org/informazione/garante-privacy/garante-privacy-precludere-ai-minori-di-15-anni-l-attivazione-di-account-su-social-e-piattaforme-anche-con-il-consenso-del-genitore-non-e-in-linea-con-il-gdpr) (consultato 24/08/2026, nota: la ricerca ha segnalato discussioni legislative italiane in corso a inizio 2026 su possibili modifiche di queste soglie).
**Evidenza prodotto**: in TRAMA i dati del bambino sono sempre inseriti e gestiti dal genitore (account unico, nessun accesso diretto del minore al servizio) — questo modello è coerente con l'impianto "consenso del titolare della responsabilità genitoriale", ma **non esiste una clausola esplicita nell'informativa/T&C (che non esistono, vedi C-01/C-02) che dichiari questo modello**.
**Gap**: assenza di una dichiarazione esplicita del modello "il genitore è l'unico soggetto che interagisce col servizio e presta il consenso anche per il minore".
**Rischio**: medio — il modello di prodotto è probabilmente già conforme nella sostanza (nessun account minore, nessuna raccolta diretta dal minore), ma senza informativa/T&C questo non è documentato né dichiarato.
**Azione**: `EXTERNAL LEGAL REVIEW RECOMMENDED` — far scrivere/validare da un professionista la clausola specifica su trattamento dati minori nell'informativa (C-01).

## ACCEPTABLE WITH MANUAL MITIGATION

### C-04 — Qualifica giuridica di TRAMA come intermediario/marketplace (Digital Services Act)
**Norma/tema**: il DSA introduce obblighi differenziati per hosting provider, piattaforme online e marketplace che consentono ai consumatori di concludere contratti a distanza con operatori commerciali; include anche servizi dedicati a prenotazioni online. Tra gli obblighi generali: punto di contatto unico, possibilità di intervento umano (non solo chatbot/automazione), meccanismo di segnalazione di contenuti/servizi illeciti.
**Fonte**: [Digital Services Act: obblighi, sanzioni, VLOP, marketplace](https://www.matricedigitale.it/2026/05/04/digital-services-act-dsa-guida/) (consultato 24/08/2026); [Osservatorio TMT — Data Protection, DSA](https://www.osservatorio-dataprotection.it/tmt/digital-services-act-dal-17-febbraio-le-nuove-regole-sui-servizi-digitali-si-applicano-a-tutti-i-prestatori-di-servizi-intermediari/) (consultato 24/08/2026).
**Analisi comportamento reale (non assunto)**:
- Chi pubblica: il Partner (center_admin) pubblica le proprie attività/disponibilità.
- Chi offre il servizio: il Partner (centro estivo/scuola/associazione), non TRAMA.
- Chi contratta/accetta: parent↔Partner tramite il flusso richiesta→accettazione TRAMA.
- Chi determina il prezzo: il Partner (`price_per_week`, sconti configurati dal centro).
- Chi incassa: **nessun pagamento reale transita in TRAMA oggi** — `payment_method` è solo un campo enum descrittivo, nessun gateway di pagamento integrato (CODE_VERIFIED, nessuna integrazione Stripe/PayPal/altro trovata). I pagamenti avvengono fuori piattaforma.
- Chi gestisce la cancellazione: regola configurabile per centro (`cancellation_window_days`), applicata dall'app TRAMA.
- Ruolo di TRAMA: facilitazione di scoperta/richiesta/accettazione tra genitore e centro, senza intermediazione di pagamento, ranking algoritmico esplicito, o moderazione contenutistica formalizzata oltre alla coda di approvazione centro (Admin).
**Gap**: non è stata fatta una qualificazione legale formale di TRAMA come "servizio intermediario" ai sensi del DSA, né sono stati implementati i requisiti generali (punto di contatto, meccanismo di segnalazione illeciti) se applicabili.
**Rischio**: medio — la scala attuale (Beta privata, pochi centri) rende il rischio di enforcement immediato basso, ma la questione va chiarita prima di uno scale pubblico.
**Azione**: `EXTERNAL LEGAL REVIEW RECOMMENDED` per la qualificazione DSA; nel frattempo, mitigazione manuale accettabile per un pilot controllato — Fabrizio agisce già come punto di contatto informale.
**Owner**: Fabrizio (decisione business) + revisione legale esterna raccomandata prima dello scale.

### C-05 — Diritti dell'interessato (accesso/portabilità/cancellazione) parzialmente manuali
**Evidenza prodotto**: CODE_VERIFIED — la richiesta di cancellazione account esiste (`requestAccountDeletionAction`) ma la cancellazione effettiva è un processo manuale via SQL Editor da parte dell'Admin, senza SLA né automazione; nessuna funzione di export/portabilità dati.
**Gap**: i diritti esistono in principio ma senza processo end-to-end tracciato.
**Rischio**: medio, accettabile temporaneamente per una Beta a piccola scala con un numero gestibile di richieste manuali.
**Azione**: documentare l'SLA manuale (es. "entro 30 giorni") e tracciarlo; automatizzare prima dello scale.
**Owner**: Fabrizio (processo) + Claude (tracciamento/documentazione).

### C-06 — Cookie/tracking senza banner, ma senza tracker di terze parti
**Evidenza prodotto**: CODE_VERIFIED — nessun Google Analytics/Meta Pixel/Mixpanel trovato; analytics first-party no-PII (`product_events`). Due chiamate CDN di terze parti (Google Fonts, jsDelivr) partono senza gate di consenso.
**Gap**: assenza di una cookie policy/banner, anche minimale, per il cookie di sessione Supabase Auth.
**Rischio**: basso-medio.
**Azione**: pubblicare una breve cookie policy (può essere una sezione della privacy policy in C-01); valutare self-hosting di font/icone per eliminare la questione alla radice.
**Owner**: Fabrizio + Claude.

## BEFORE PUBLIC SCALE

### C-07 — Termini specifici Partner (responsabilità, rimozione/sospensione, gestione controversie)
**Evidenza prodotto**: CODE_VERIFIED — nessun documento di "condizioni Partner" trovato collegato all'onboarding centro.
**Rischio**: basso per un pilot controllato con pochi centri noti personalmente da Fabrizio; diventa necessario a scala.
**Azione**: redigere condizioni Partner prima di aprire l'onboarding self-service su larga scala.

### C-08 — Obblighi futuri quando verranno introdotti pagamenti reali
**Nota esplicita**: l'MVP attuale non gestisce pagamenti reali (nessun gateway integrato, CODE_VERIFIED) — non si introducono qui regole e-commerce/pagamenti non pertinenti allo stato attuale. **Da tenere a mente per quando verrà aggiunta questa capability**: obblighi di fatturazione, diritto di recesso per contratti a distanza (Codice del Consumo), gestione rimborsi, eventuale qualificazione come "payment facilitator", PSD2 se si useranno gateway terzi.
**Azione**: nessuna azione ora; riaprire questo item quando si pianifica l'integrazione pagamenti.

---

## Riepilogo per il gate LG-04 (Regulatory Gate)

| Item | Categoria | Blocca il pilot controllato? |
|---|---|---|
| C-01 Informativa privacy assente | MUST BEFORE PILOT | Sì |
| C-02 Nessun consenso T&C a signup | MUST BEFORE PILOT | Sì |
| C-03 Età consenso minori non dichiarata esplicitamente | MUST BEFORE PILOT (dipende da C-01) | Sì (indirettamente, via C-01) |
| C-04 Qualifica DSA non determinata | ACCEPTABLE WITH MITIGATION | No, per pilot privato a coorte controllata |
| C-05 Diritti interessato manuali | ACCEPTABLE WITH MITIGATION | No |
| C-06 Cookie policy assente | ACCEPTABLE WITH MITIGATION | No |
| C-07 Termini Partner assenti | BEFORE PUBLIC SCALE | No |
| C-08 Pagamenti | BEFORE PUBLIC SCALE (non applicabile oggi) | No |

Sources:
- [Minori - Garante Privacy](https://www.garanteprivacy.it/temi/minori)
- [Garante Privacy: consenso digitale minori under 15](https://www.federprivacy.org/informazione/garante-privacy/garante-privacy-precludere-ai-minori-di-15-anni-l-attivazione-di-account-su-social-e-piattaforme-anche-con-il-consenso-del-genitore-non-e-in-linea-con-il-gdpr)
- [GDPR e minori, gestire consenso e privacy - Cyber Security 360](https://www.cybersecurity360.it/legal/privacy-dati-personali/gdpr-e-minori-gestire-consenso-e-privacy-sui-social-che-ce-da-sapere/)
- [Digital Services Act: guida](https://www.matricedigitale.it/2026/05/04/digital-services-act-dsa-guida/)
- [Digital Services Act - Osservatorio TMT](https://www.osservatorio-dataprotection.it/tmt/digital-services-act-dal-17-febbraio-le-nuove-regole-sui-servizi-digitali-si-applicano-a-tutti-i-prestatori-di-servizi-intermediari/)
