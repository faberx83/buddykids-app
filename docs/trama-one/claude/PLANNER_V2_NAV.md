# Planner V2 e nuova barra (14/10/2026)

Iniziativa "Home e Planner v2" (documento completo nel Project claude.ai:
`claude/INIZIATIVA_home_planner_v2.md`). Baseline visuale: canvas "TRAMA Home
e Planner V2.1" (tavole Planner Settimana e Stagione) e "TRAMA Navigazione ·
proposta" (barra, pulsante +, Profilo, Cos'è TRAMA).

Due flag, due release nella card Admin → Feature Flags → Release:

| Release | Flag | Ripiego |
|---|---|---|
| TRAMA — Planner V2 (`planner-v2`) | `PLANNER_V2_ENABLED` | Planner attuale (`PlannerClient`) |
| TRAMA — Nuova barra (`nav-v2`) | `NAV_V2_ENABLED` | barra attuale con Profilo |

Nessuna migration, nessuna tabella, nessuna scrittura nuova: le sole azioni
usate sono quelle esistenti (chi accompagna, "Non serve", condivisione).

## Planner V2
- **Intestazione**: Planner, Mappa e Gruppi (pannello con i componenti
  esistenti), "Aggiungi" solo se la nuova barra è spenta.
- **Settimana | Stagione** come viste principali; filtro per figlio; riga
  **Salvati** (preferiti Partner, Scoperte TRAMA e community non ancora
  prenotati né nel Planner).
- **Settimana**: qualunque settimana (non solo l'estate), frecce, "Mese" in
  un pannello dal basso, riga di stato ("12 impegni · 1 passaggio da
  assegnare"), striscia dei 7 giorni con pallini per figlio e scuola chiusa,
  giorni in lista con prenotazioni TRAMA, Scoperte e impegni insieme. In
  fondo a ogni giorno chi accompagna: riga compressa se deciso, tabella se
  manca qualcuno, **Assegna** apre l'assegnazione sul posto (Io, Mamma/Papà,
  persone salvate, nonni, tata, Altro…). Condividi settimana (link di 30
  giorni), Esporta calendario (col suo flag), elenco "I tuoi impegni".
- **Stagione**: riepilogo come in Home (a estate finita: Ponti e vacanze),
  copertura per figlio, tutte le settimane per mese (raggruppamento solo
  visivo), filtro Tutte / Da sistemare, Trova attività / Non serve /
  Ripristina, budget compatto con "Vedi dettaglio".
- Link esistenti compatibili: `?mode=calendario&week=…` apre la Settimana,
  `?mode=mappa|gruppi` il pannello, `?mode=budget` la Stagione,
  `?nuovo=impegno` il modulo degli impegni.

## Nuova barra
- Home, Planner, **+** al centro, Scopri, Prenotazioni.
- Il **+** apre "Cosa aggiungi?": Un impegno (col flag degli impegni), Chi
  accompagna (settimana corrente), Un altro genitore (Gruppi).
- Il Profilo si apre dall'**avatar** nell'intestazione della Home V2, che
  prende il posto del logo; il logo vive nella pagina **Cos'è TRAMA**
  (`/nextgen/trama`), raggiungibile dal Profilo.
- Da accendere insieme a Home V2 (con la Home attuale l'avatar non c'è e il
  Profilo resta su `/nextgen/profile`).

## Limiti noti
- La Stagione usa le settimane estive già calcolate dal Planner.
- Gli impegni aggiunti a mano non contano nella copertura (regola attuale).
- "Chi c'è dietro" della tavola Cos'è TRAMA non è in pagina: serve il testo.
- Il pallino di notifiche che stava su Profilo non c'è più nella nuova barra
  (le notifiche restano nella campanella).

## Verifica dal vivo (Fabrizio, pending local verification)
Con le due release in Anteprima interna e l'account `+testparent`:
- [ ] barra: + al centro, il foglio si apre e si chiude, i tre link portano
      nel posto giusto; Profilo dall'avatar in Home; Cos'è TRAMA dal Profilo;
- [ ] Planner Settimana: frecce e Mese cambiano settimana; oggi evidenziato;
      impegni e prenotazioni insieme; Assegna salva e la riga diventa
      "Accompagnamenti decisi";
- [ ] Stagione: stessi numeri del riepilogo in Home; Da sistemare filtra;
      Non serve / Ripristina funzionano;
- [ ] Mappa e Gruppi si aprono nel pannello;
- [ ] Condividi settimana crea un link che si apre;
- [ ] spegnendo i flag tornano Planner e barra attuali.

Test: `tests/one/planner-v2.spec.ts` (PV2-01…16).

## Correzioni dopo la verifica dal vivo (14/10/2026, pomeriggio)
- **Barra che scorre**: sul telefono la cornice dell'app è ora fissa sulla
  finestra visibile (`position: fixed`, top/bottom 0) e la pagina non può più
  scorrere: scorre solo l'area interna. Vale per tutte le schermate con la
  cornice telefono (famiglie, LEGACY compresa). Verificato in emulazione
  Pixel 5: altezza documento = finestra, la barra non si muove.
- **Mappa** ("This page couldn't load"): Mappa e Gruppi ora sono una pagina
  interna del Planner (come nel Planner attuale) invece di un pannello, con
  una rete di sicurezza: se un componente esistente fallisce compare un
  messaggio, non cade la pagina.
- **Chi fa cosa**: nella Settimana una riga "Chi fa cosa" apre la settimana
  intera giorno per giorno (tocca un giorno per assegnare) e "Uguale per tutta
  la settimana" per Porta e Ritira.
- **Ponti e vacanze nel Planner**: a estate finita la Stagione elenca le
  chiusure ("Chiusure della scuola") con Trova attività e Apri la settimana;
  l'estate passata è richiudibile ("Estate AAAA · conclusa").
- **Saluto della Home**: "Buon mercoledì · 14 ottobre" al posto di data +
  numero di impegni (già detto dalla sezione Oggi).

Test: PV2-17…21.
