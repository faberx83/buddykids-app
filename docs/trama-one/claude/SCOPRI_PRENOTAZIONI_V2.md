# Scopri e Prenotazioni V2 (14/10/2026)

Tavole approvate: canvas "TRAMA Scopri e Prenotazioni V2" (4 schermate).
Release "TRAMA — Scopri e Prenotazioni V2" (`scopri-prenotazioni-v2`) nella
card Admin → Feature Flags → Release, con due funzioni:

| Funzione | Flag | Ripiego |
|---|---|---|
| Prenotazioni V2 (`bookings_v2`) | `BOOKINGS_V2_ENABLED` | `PrenotazioniClient` attuale |
| Scopri V2 (`discover_v2`) | `DISCOVER_V2_ENABLED` | Scopri attuale |

Nessuna migration, nessuna scrittura nuova.

## Prenotazioni V2
- Riga di riepilogo ("3 in arrivo · €288 spesi quest'anno"), In arrivo | Passate.
- **Da sistemare** in cima, stesse parole del Da fare della Home: Richiesta non
  accettata → Alternative (Scopri sulla stessa settimana), Confermata in parte
  → Controlla, Proposta del centro → Vedi.
- Prenotazioni per mese con data, stato (stessi colori del Planner), figli e
  prezzo. Le non accettate non sono "in arrivo" (stanno tra le passate).
- **Prenotazione aperta** (`?id=`, anche dai vecchi link `?bookingId=`): stato
  spiegato a parole, riepilogo (quando con orari, per chi, totale), Chi
  accompagna → Planner, Scrivi al centro, Modifica, Scheda attività, Annulla
  con il termine. La copertura delle settimane non è più qui: rimando al Planner.

## Scopri V2
- Scheda principale: titolo, Elenco | Mappa in alto, ricerca.
- **Per quando**: le prossime due chiusure della scuola (ponte / vacanze),
  le prossime 4 settimane, l'estate. Filtra Partner (settimane e giorni con
  posti), Scoperte TRAMA e community (una data non indicata non esclude).
  "Trova attività" da un ponte o una vacanza nel Planner apre Scopri già su
  quella settimana.
- **Per chi** e **Filtri · N**: i filtri esistenti restano tutti, in un solo
  pulsante.
- Card Partner nuove: Partner TRAMA, Salva, motivi chiari ("Posti liberi ·
  Ponte 7–8 dic", "Piace a Lino", "Pranzo incluso") al posto del Match %.
- "Mandalo a TRAMA" in fondo all'elenco.
- Limite: le card Scoperte TRAMA e community restano quelle attuali.

## Verifica dal vivo (Fabrizio, pending local verification)
- [ ] Prenotazioni: In arrivo/Passate, Da sistemare, apertura, Scrivi al
      centro, Annulla (su una prenotazione di prova);
- [ ] Scopri: Per quando sul ponte filtra davvero, Filtri apre la riga dei
      filtri, Mappa funziona, Salva e Vedi;
- [ ] Planner → Stagione → "Trova attività" su un ponte apre Scopri su quella
      settimana;
- [ ] spegnendo la release tornano le pagine attuali.

Test: `tests/one/scopri-prenotazioni-v2.spec.ts` (SPV2-01…11).
