# TRAMA ONE — Transition Register

Registro degli adapter/ponti tra AS-IS (Legacy, Next Gen, modelli dati esistenti) e TRAMA ONE, richiesto come output esplicito di TRAMA ONE Build Sprint 0 dal Master Prompt ("aggiungi Transition Register e Assumption Log nel repository"). Ogni riga documenta un punto in cui TRAMA ONE si appoggia temporaneamente o permanentemente a un meccanismo AS-IS invece di sostituirlo.

**Stato in Build Sprint 0**: nessun vero adapter creato in questo sprint — nessuna capability di business (Request lifecycle, Booking, Offering, PlannerItem) è nello scope Sprint 0, quindi non c'è ancora nulla da "adattare". Questo registro è predisposto vuoto/scaffolded, pronto per essere popolato a partire da Build Sprint 1 (primo vero riuso: state machine Center) e soprattutto da Build Sprint 4 (WRAP di `activity_inquiries`+`bookings` nella state machine Request unificata, il punto di adapter più significativo dell'intera sequenza, classificato rischio Alto in `analysis/TRAMA_ONE_Impact_Assessment_v1.0.md`).

## Convenzione per le righe future

Ogni adapter registrato qui deve indicare: nome/scopo, sprint di introduzione, asset AS-IS coinvolti (tabelle/servizi), asset TRAMA ONE coinvolti, tipo di ponte (sola lettura / scrittura duale / traduzione di stato), condizione di rimozione (quando l'adapter potrà essere eliminato, non prima della parità dimostrata — vedi `analysis/DECISION_LOG.md` DEC-15), rischio residuo.

| Nome adapter | Sprint di introduzione | AS-IS coinvolto | TRAMA ONE coinvolto | Tipo di ponte | Condizione di rimozione | Rischio |
|---|---|---|---|---|---|---|
| _(nessuno ancora — registro vuoto in Build Sprint 0)_ | — | — | — | — | — | — |

## Collegamenti già stabiliti in Build Sprint 0 (non adapter di business, solo riuso infrastrutturale)

Questi non sono "adapter" nel senso Master Prompt (non traducono uno stato di business), ma sono i punti di riuso diretto dell'infrastruttura AS-IS su cui il Feature Flag Engine e le route `/one` si appoggiano, per completezza di riferimento:

- **Auth/sessione**: `lib/supabase/server.ts` (client anon, RLS-bound) riusato as-is nei tre layout `/one` per identificare utente/ruolo — nessuna traduzione, stesso meccanismo di Legacy/NextGen.
- **Tenant/rewrite**: `proxy.ts`/`lib/tenant.ts` riusati as-is, non modificati — le route `/one` ereditano gate tenant/ruolo esistente senza alcun ponte dedicato.
- **Toggle Legacy/NextGen** (`bk_version`, `lib/version-preference.ts`): resta un meccanismo indipendente dal Feature Flag Engine (`TRAMA_ONE_ENABLED`) — nessun collegamento tra i due in questo sprint (Assumption Log D3).

## Prossimo aggiornamento previsto

Alla chiusura di TRAMA ONE Build Sprint 1 (state machine Center) — se quello sprint introduce un qualunque ponte verso `centers`/`profiles` esistenti diverso da un semplice ADAPT (nuova colonna), va registrato qui.
