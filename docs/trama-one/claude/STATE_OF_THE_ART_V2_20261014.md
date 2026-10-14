# TRAMA — Stato dell'arte del restyle V2 (app famiglie)

**Data:** 14/10/2026, sera · **Produzione:** `main` @ `dc1add3`, deploy Vercel READY · **Autore:** Claude, per l'audit finale con ChatGPT
**Ambito:** area famiglie NEXTGEN (`/nextgen/*`) e la card Release in Admin. Portale Gestori, Admin (resto), Legacy: **non toccati**.

> Documento autosufficiente: chi lo legge non ha visto la conversazione. Le immagini reali sono nella cartella prodotta da `scripts/screenshots-v2.mjs` (sezione 9).

---

## 1. In una riga

In due giorni (13–14/10/2026) l'app famiglie è stata ridisegnata pagina per pagina su una baseline approvata ("V2.1"): Home, Planner, barra di navigazione, Scopri, Prenotazioni, Profilo e Gruppi. Tutto è **in produzione ma spento** dietro 7 feature flag (dark release), acceso oggi solo per l'anteprima interna. **Nessuna migration**, nessuna tabella nuova, nessuna scrittura nuova a database: solo nuove letture e nuova presentazione.

## 2. Contesto prodotto

TRAMA (ex BuddyKids) è una PWA per famiglie in Italia che organizzano centri estivi, attività extrascolastiche e la logistica dei figli (chi porta, chi ritira). Tre portali: Famiglie, Gestori (centri Partner), Admin. Stack: Next.js 16 (App Router), React 19, Supabase, Vercel. Pilot previsto a settembre 2026 con una coorte chiusa; l'app è oggi in beta controllata.

## 3. Metodo di rilascio (vale per tutto ciò che segue)

| Elemento | Come funziona |
|---|---|
| Feature flag | Registro in `lib/feature-flags/registry.ts`, default **false**, risoluzione lato server, *fail-closed*: se la lettura del flag fallisce si mostra la versione attuale. |
| Catalogo | Ogni flag ha una voce in `lib/feature-registry/catalog.ts` con `releaseEligible: true`. |
| Release | Le voci sono raggruppate in release (`lib/releases/catalog.ts`) gestite da **Admin → Feature Flags → Release**. Livelli cumulativi: Anteprima interna → Pilot → Tutti ("Tutti" richiede di scrivere GLOBAL). |
| Ripiego | Con il flag spento ogni pagina rende il componente di prima, invariato (le vecchie versioni restano nel codice accanto alle nuove). |
| Riuso | Classificazione REUSE / ADAPT / WRAP / NEW. I componenti condivisi con Legacy ricevono una variante opzionale (`v2`, `nextgen="v2"`) con default identico a prima. |
| Consegna | Claude lavora su rami `claude/*`; Fabrizio lancia `bash deploy.sh` (controllo tipi, merge su main, deploy, test). |

**Novità di oggi nella card Release:** una **tabella** funzionalità × pubblico (righe = funzionalità raggruppate per release; colonne Anteprima interna / Pilot / Tutti; spunte cumulative; click su casella vuota = accendi fino a lì, su casella spuntata = torna indietro di un livello). Le card di prima restano sotto, chiuse.

## 4. Inventario delle superfici V2

| # | Superficie | Flag | Release | Cosa cambia | Stato |
|---|---|---|---|---|---|
| 1 | Home | `HOME_V2_ENABLED` | TRAMA — Home V2 | Saluto con data ("Buon mercoledì · 14 ottobre"), avatar → Profilo, **Oggi** (timeline unica: prenotazioni + impegni esterni + chi porta/ritira), **Da fare** (max 3, una azione ciascuna), riepilogo del periodo (estate oppure "Ponti e vacanze" fuori stagione), prossima chiusura scolastica, azioni rapide. | Online, anteprima interna, verificata dal vivo e corretta più volte |
| 2 | Planner | `PLANNER_V2_ENABLED` | TRAMA — Planner V2 | Viste **Settimana / Stagione**. Settimana: navigatore, striscia 7 giorni, giorni in lista, "Chi fa cosa" assegnabile sul posto, Mese in un pannello, condividi/esporta, impegni propri. Stagione: riepilogo, copertura per figlio, settimane per mese, filtro Da sistemare, "Trova attività / Non serve", chiusure della scuola, budget. Mappa e Gruppi come strumenti secondari nell'intestazione. | Online, anteprima interna |
| 3 | Barra di navigazione | `NAV_V2_ENABLED` | TRAMA — Nuova barra | Home, Planner, **+** al centro (Un impegno / Chi accompagna / Un altro genitore), Scopri, Prenotazioni. Profilo dall'avatar in Home. Pagina "Cos'è TRAMA". | Online, anteprima interna |
| 4 | Profilo | `PROFILE_V2_ENABLED` | TRAMA — Nuova barra | Account e figli in alto; voci in tre gruppi (Famiglia, Le tue attività, App); tolte le voci doppie (Prenotazioni è nella barra; Preferiti → Salvati). | Online, **da accendere e verificare** |
| 5 | Prenotazioni | `BOOKINGS_V2_ENABLED` | TRAMA — Scopri e Prenotazioni V2 | Riepilogo in una riga, In arrivo / Passate, **Da sistemare** (rifiutate, parziali, proposte del centro), raggruppamento per mese, prenotazione aperta con stato spiegato e azioni (Scrivi al centro, Modifica, Scheda, Annulla). | Online, anteprima interna |
| 6 | Scopri | `DISCOVER_V2_ENABLED` | TRAMA — Scopri e Prenotazioni V2 | **Per quando** (prossimi ponti/vacanze della scuola, prossime 4 settimane, estate) che filtra per data, Per chi, Filtri raccolti in un pulsante, card con al massimo 3 motivi chiari (niente "Match 80%"), Salva, Elenco/Mappa. Card Scoperte TRAMA e community nello stesso stile. | Online, anteprima interna |
| 7 | Gruppi | `GROUPS_V2_ENABLED` | TRAMA — Planner V2 | Elenco (I miei gruppi / Scopri / Inviti), dettaglio gruppo (Bambini & Richiesta, Accompagnamento), scheda Gruppi nel Planner. | Online, **da accendere e verificare** |

Trasversale (con le stesse superfici accese): **segno TRAMA** sotto i titoli (quattro fili con i colori del logo); nelle intestazioni condivise compare solo con la nuova barra accesa, quindi Legacy e Gestori restano invariati.

## 5. Sistema visivo applicato (V2.1)

- Sfondo pagina `#FDFCFA`, card bianche angoli 20px con ombra leggera, testo `#1A1D2E`, blu notte `#172A4D` per selezioni e prezzi, viola `#6F63C5` per le azioni principali, link `#5B4FB0`.
- Titoli pagina Poppins 24px (Home compresa); sezioni Poppins 18px; testo Inter 13–16px.
- Stati con stesse parole e colori ovunque: **Organizzata** verde `#2DBA8C`, **Da completare** ambra `#F6B84B`, **Da organizzare** tratteggio `#8B93A1`.
- Una sola azione primaria per blocco; blocchi vuoti nascosti; niente emoji come stato.
- Schede a due/tre voci a pillola (stessa forma dentro e fuori); pill dei filtri bianche con bordo, selezionate blu notte; bottoni alti almeno 40–44px.
- La "cornice telefono" è fissa su mobile: scorre solo il contenuto, la barra in basso resta ferma.

## 6. Architettura (cosa c'è sotto)

- **Logica pura testabile** separata dai componenti: `lib/nextgen/home-inbox.ts`, `today-agenda.ts`, `season-summary.ts`, `holiday-summary.ts`, `planner-week.ts`, `planner-season.ts`, `bookings-v2.ts`, `discover-v2.ts`, `profile-v2.ts`, `lib/school-calendar/next-closure.ts`, `lib/releases/visibility.ts` (tabella Release).
- **Componenti condivisi** Home ↔ Planner: `AgendaItemRow`, `SeasonSummaryCard`, `DayCoordination` (chi porta / chi ritira), `TramaThread` (segno), `AddSheet` (+).
- **Dati:** solo letture già esistenti più due nuove letture in sola lettura (`getKidClosureIntervalsForParent` sul calendario scolastico; `getActivityOpenRanges` su settimane/giorni aperti con posti). Azioni riusate: assegnazione responsabilità settimanali, annullo prenotazione, preferiti, gruppi.
- **Rete di sicurezza nel Planner:** Mappa e Gruppi dentro un error boundary; in anteprima interna l'errore mostra messaggio e punto del codice.

## 7. Qualità e verifiche

| Verifica | Esito |
|---|---|
| Test nuovi (logica + controlli sul sorgente) | `home-v2` 35 · `planner-v2` 22 · `scopri-prenotazioni-v2` 20 · `profile-v2` 7 · `groups-v2` 7 · `release-matrix` 9 = **100 test, tutti verdi** nel sandbox |
| Regressione `tests/one` (file caricabili nel sandbox) | Nessuna regressione: le uniche failure (9) sono identiche su `main` prima del lavoro e preesistenti (calendar-export 2, global-action-progress 2, real-discovery-pilot 2, release-catalog 3). 12 file non si caricano nel sandbox (dipendenze server) |
| Controllo tipi completo + deploy + test | Eseguiti da `deploy.sh` sul Mac a ogni pubblicazione; ultimo deploy READY (`dc1add3`) |
| Resa visiva | Render di prova con dati di esempio confrontati con le tavole approvate; poi verifica dal vivo di Fabrizio su telefono (Home, Planner, Scopri, Prenotazioni), con correzioni nello stesso giorno |
| Test browser end-to-end | **Pending local verification** (non eseguibili nel sandbox) |

**Errore trovato e corretto oggi dal controllo dei tipi del deploy:** una variabile che si riferiva a se stessa (Scopri, colore delle pill); il deploy si è fermato prima della pubblicazione come previsto.

## 8. Problemi aperti, limiti noti, rischi

**Aperti**
1. **Mappa del Planner:** dal vivo dava `TypeError: Cannot read properties of undefined (reading '_leaflet_events')` (in Scopri funziona). Analizzato il sorgente di Leaflet 1.9.4: il punto più probabile è `Marker._removeIcon` su un segnaposto tolto prima di avere un'icona. Applicata una protezione mirata (`dc1add3`); **da riverificare dal vivo**. Se torna, l'errore ora mostra anche lo stack.
2. Profilo V2 e Gruppi V2 appena pubblicati: **da accendere e provare** dal vivo.

**Limiti noti (scelte consapevoli)**
- Riepilogo/Stagione: dati per la sola estate; fuori stagione la Home mostra "Ponti e vacanze" dal calendario scolastico.
- Gli impegni aggiunti a mano compaiono in Oggi e nella Settimana ma non contano nella copertura (regola attuale).
- Impegni ricorrenti non esistono ancora; "Salvati" senza data non è possibile (servirebbe una migration).
- Prenotazione aperta: mancano i servizi extra (pranzo, navetta) nel riepilogo.
- Scopri: "Per quando" sulle chiusure richiede il calendario scolastico attivo per la famiglia.
- Sottopagine del Profilo (Impostazioni, Famiglia, Segnalazioni) e pagine Community: solo intestazione aggiornata, restyle completo non fatto.
- Card Scoperte: i pulsanti interni ("Aggiungi al Planner", "Proponi invito") sono più bassi dello standard 44px.
- "Più tardi" sulla prossima chiusura è salvato nel browser (per dispositivo).

**Rischi**
- Molte superfici accese insieme: il valore del flag per superficie consente di spegnerle una alla volta, ma la Nuova barra presuppone Home V2 (l'avatar del Profilo sta nella sua intestazione).
- Componenti condivisi con Legacy modificati con varianti opzionali (Profilo, Gruppi, card Scoperte, `ActivityMap`): il ramo di default è stato mantenuto identico, ma la regressione visiva Legacy non è stata verificata dal vivo.
- La protezione su Leaflet modifica il prototipo di `L.Marker` (una sola volta, idempotente): effetto globale su tutte le mappe dell'app.

## 9. Screenshot reali

Generati sul Mac di Fabrizio con:

```bash
node scripts/screenshots-v2.mjs
```

Finestra Chromium a misura di iPhone (390×844); se serve si fa il login nella finestra e si preme Invio nel Terminale. Visita in **sola lettura**: Home, foglio del +, Planner (Settimana, Stagione, Mappa, Gruppi), Scopri (Elenco, Mappa), Prenotazioni (elenco e una prenotazione aperta), Profilo, Gruppi (elenco e dettaglio), Cos'è TRAMA, una sottopagina con intestazione condivisa, Admin → Release. Output in `logs/screens-AAAAMMGG-HHMM/` con `INDICE.md`; per ogni pagina `_top` (schermo) e `_full` (pagina intera). Le immagini contengono dati reali della famiglia di test/del titolare: da controllare prima di condividerle.

## 10. Cosa chiediamo all'audit

Da incollare in ChatGPT insieme a questo documento e agli screenshot:

> Sei un revisore senior di prodotto e UX per app mobili consumer. Ti allego lo stato dell'arte del restyle "V2" di TRAMA (app per famiglie che organizzano attività e logistica dei figli) e gli screenshot reali, uno per pagina (`_top` = schermo, `_full` = pagina intera).
> 1. **Coerenza visiva:** dove le pagine non rispettano il sistema della sezione 5 (titoli, card, colori, pill, bottoni, spaziature)? Elenca le incoerenze con file e punto preciso dello screenshot.
> 2. **Chiarezza:** in ogni pagina, l'azione principale è evidente entro 3 secondi? Ci sono testi ambigui, doppioni o parole diverse per la stessa cosa (es. stati della settimana, "Salvati")?
> 3. **Navigazione:** la barra con il + al centro, il Profilo dall'avatar e Mappa/Gruppi come strumenti del Planner sono comprensibili per un genitore non tecnico? Cosa manca o cosa è in più?
> 4. **Accessibilità:** contrasto, dimensioni dei bersagli (min 44px), gerarchia dei titoli, stati comunicati solo con il colore.
> 5. **Pronto per il Pilot?** Per ogni superficie: "Pronta", "Pronta con correzioni minori" o "Non pronta", con la motivazione.
> 6. **Priorità:** le 10 correzioni con il miglior rapporto impatto/sforzo, in ordine.
> Rispondi in italiano, in tabelle, e distingui i problemi visti negli screenshot da quelli dedotti dal documento.

## 11. Cronologia (main)

| Quando | Commit | Cosa |
|---|---|---|
| 13/10 23:13 | `97eb549` | Home V2 fase 1 dietro flag |
| 14/10 09:41–10:08 | `32680cd` `eb1c31f` `26ca4c8` `ff2903c` | Correzioni Home dal vivo, tolto "Torna a V1", "Ponti e vacanze" |
| 14/10 10:35 | `0a507d8` | Planner V2 e nuova barra con + |
| 14/10 11:05–11:23 | `16354aa` `2e02b0e` `a49446c` | Barra ferma, Chi fa cosa, ponti con azioni, saluto, freccia indietro, rete di sicurezza Mappa |
| 14/10 11:43 | `a85f481` | Scopri e Prenotazioni V2 |
| 14/10 14:56 | `745baa4` | Release come tabella |
| 14/10 15:00–15:25 | `886df4b` `770cada` `5cce39c` | Scopri allineato, segno TRAMA, "Natale", correzione di tipo |
| 14/10 15:52 | `792d619` `dc1add3` | Mappa Planner protetta, saluto 24px, Profilo V2, Gruppi V2 |

Documenti collegati nel repo: `docs/trama-one/claude/HOME_V2_FASE1.md`, `PLANNER_V2_NAV.md`, `SCOPRI_PRENOTAZIONI_V2.md`. Tavole di design: canvas "TRAMA Home e Planner V2.1", "TRAMA Navigazione · proposta", "TRAMA Scopri e Prenotazioni V2".
