# TRAMA — Roadmap

**Aggiornata il 20/10/2026.** Sostituisce la versione del 23/09/2026, ora in `archive/superseded-versions/ROADMAP_20260923.md`.
**Documenti collegati:** `LANCIO_BETA_20NOV.md` (stato e piano dei 31 giorni), `PREMORTEM.md` (pre-mortem della beta), `GUIDA_FAMIGLIE_BETA.md`.

---

## Obiettivo ricentrato (20/10/2026)

**Prima le famiglie.** TRAMA deve essere utile a una famiglia anche se nessuno dei suoi centri è su TRAMA:
- impegni e corsi della settimana;
- ponti e vacanze della scuola;
- chi accompagna e chi ritira;
- condivisione con nonni e tata.

**I centri arrivano "per accerchiamento".** Le famiglie che usano TRAMA generano segnali sui centri che frequentano (impegni, suggerimenti, Radar, salvati). Quando un centro ha già 5–10 famiglie della sua zona, TRAMA gli porta un dato, non una promessa.

**Modello economico in tre tempi:**
1. beta gratuita con tutto acceso;
2. freemium per le famiglie;
3. solo dopo, commissione o canone per i centri, sul valore portato.

Rispetto alla versione di settembre cambiano due cose:
- l'obiettivo non è più "25–30 centri prima delle famiglie";
- la beta non è più per singole funzioni: si lancia con tutto acceso, con missioni guidate.

---

## Fase 0 — Verso il lancio (21/10 → 20/11/2026)

**Obiettivo:** 15–20 famiglie amiche, invitate per grappoli (2–3 classi o scuole), entrano il 20/11 senza intoppi e trovano un'app utile da subito.

| Blocco | Cosa | Stato al 20/10 |
|---|---|---|
| Catalogo | Via i centri di test; Scoperte TRAMA vere di novembre–gennaio; 3 centri di prova dichiarati; 1–2 centri veri amici | Da fare: oggi 0 date future |
| Email | Registrazione e reset dal dominio (SMTP via Resend); prova reale delle email transazionali | Resend attivo; SMTP Supabase da fare |
| Legale | Titolare definito, informative bozza 2 senza campi vuoti, un'ora con un legale | Bozza 1 pubblicata, titolare mancante |
| Accessi | Nuovo codice beta; proroga della coorte al 30/06/2027 | Codice in scadenza il 01/12, coorte il 31/12 |
| Infrastruttura | Vercel Pro, regione delle funzioni a Parigi, backup del database | Hobby, `iad1`, backup da verificare |
| Notifiche | Prova reale di check-in, "Domani chi accompagna?", chiusure scolastiche, buongiorno | Job attivi, mai un invio reale |
| Misura | Cruscotto beta settimanale; 5 interviste in calendario | Da fare |
| Kit | Guida famiglie, messaggio WhatsApp, video brevi, teaser Instagram | Bozze pronte |
| Congelamenti | Funzioni dal 27/10, codice dal 16/11 | — |

**Già pronto (in produzione per la coorte beta):**
- app famiglie V2 (Home, Planner Settimana e Stagione, +, Scopri, richiesta a 2 passi senza pagamento, Prenotazioni, Profilo e La tua famiglia, Classe e scuola);
- impegni aggiunti a mano con Chi accompagna;
- calendario scolastico (Lombardia/Milano, Puglia/Rutigliano);
- Radar (AI simulata);
- promemoria push;
- consensi;
- dominio `tramapp.it` con trasloco degli accessi;
- pagina di benvenuto con lista d'attesa;
- email transazionali.

Solo in anteprima interna: il buongiorno di TRAMA e Chi accompagna plus.

---

## Fase 1 — Beta famiglie (20/11/2026 → 31/01/2027)

**Obiettivo:** capire se le famiglie tornano e se coordinano davvero, e iniziare a vedere segnali sui centri.

- **Lancio a ondate:**
  - 18/11: 5 famiglie;
  - 20/11: le altre;
  - gennaio: nuovi grappoli se i numeri reggono.
- **Correzioni** solo da uso reale, con rilasci nei giorni fissati. Le novità passano 48 ore in anteprima interna prima di arrivare alla coorte.
- **Candidati per dicembre**, in ordine, se emergono dall'uso:
  1. impegni ricorrenti ("ogni martedì");
  2. Chi accompagna nel weekend;
  3. riepilogo "famiglie per centro";
  4. porta finta "TRAMA Plus";
  5. messaggi ai centri come conversazione.
- **Decisione il 20/12** con i criteri del pre-mortem: Avanti, Correggere o Ripensare.

## Fase 2 — Stagione estiva (febbraio → maggio 2027)

**Obiettivo:** il caso d'uso più forte (organizzare l'estate) con centri veri.

- Rilancio a fine gennaio: "Inizia a organizzare l'estate".
- Scoperte estive pubblicate presto; primi centri veri nelle zone dei grappoli, entrati grazie ai segnali delle famiglie.
- Finestra chiave: iscrizioni ai centri estivi comunali di Milano (marzo–aprile).
- Verifica: al 31/03 almeno 3 centri veri con richieste reali dalle famiglie.

## Fase 3 — Modello economico (da settembre 2027)

- **Freemium famiglie:**
  - gratis il cuore (Planner, impegni, Scopri, Chi accompagna);
  - Plus da valutare (famiglia allargata, buongiorno avanzato, sincronizzazione calendario, storico);
  - prezzo indicativo 2–4 €/mese, da validare con la porta finta della Fase 1.
- **Centri:** commissione sulla richiesta confermata (3–5%) o canone leggero, solo dove TRAMA porta richieste reali.
- **Da tenere aperto:** canali B2B2C (welfare aziendale, comuni, scuole). Il freemium da solo difficilmente sostiene il progetto.

## Più avanti (senza date)

- Accompagnamento/Ritiro completo e Deleghe (servono il parere legale e il QR dinamico).
- Pagamenti in app.
- Multi-sede per i centri.
- Famiglie con più tutori non conviventi.
- Restyle del portale centri.
- App negli store.

---

## Debito da ridurre dopo la beta

- Spegnere e togliere le interfacce non più usate (Legacy famiglie, parti di TRAMA ONE) e ridurre i feature flag.
- Test end-to-end reali sui 5 percorsi chiave al posto di parte dei controlli statici sul sorgente.
- Eventi di prodotto con un identificativo pseudonimo, per misurare il ritorno per famiglia.
- Cancellazione account ed export dei dati self-service (oggi manuali).
- Verifica del marchio "TRAMA".
