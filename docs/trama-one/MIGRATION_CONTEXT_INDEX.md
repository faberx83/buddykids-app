# MIGRATION_CONTEXT_INDEX — Pacchetto di contesto per una nuova sessione/account

> Scopo di questo file: permettere a chiunque (o a una nuova sessione Claude su un nuovo account)
> di ricostruire rapidamente scopo, traiettoria, stato dell'arte e codice del progetto
> BuddyKids/TRAMA, senza dover rileggere mesi di conversazioni. Non duplica nulla: punta ai
> documenti che già esistono nel repository, in ordine di lettura consigliato.
>
> Questo file vive dentro il repository Git (`docs/trama-one/MIGRATION_CONTEXT_INDEX.md`), quindi
> viaggia automaticamente con qualunque trasferimento/clone del repo — nessuna azione manuale
> richiesta per portarlo sul nuovo account.

## Come usarlo

1. Apri una nuova chat sul nuovo account.
2. Incolla il "prompt di priming" qui sotto, sostituendo `<percorso repo>` con la cartella del
   progetto sul tuo computer (o allega direttamente i file dei Livelli 1-3 se stai lavorando senza
   accesso a cartella).
3. Lascia che Claude legga i file nell'ordine indicato prima di chiedere qualunque lavoro nuovo.

### Prompt di priming (pronto da incollare)

```
Stiamo riprendendo il lavoro sul progetto BuddyKids/TRAMA (marketplace famiglie-centri estivi/
doposcuola in Italia). Prima di iniziare, leggi in questo ordine i file nella cartella
<percorso repo>/docs/trama-one/:

1. MIGRATION_CONTEXT_INDEX.md (questo file, per la mappa completa)
2. BUSINESS_PLAN.md, ROADMAP.md, PREMORTEM.md (scopo, traiettoria, rischi)
3. STATE_OF_THE_ART.md, TECHNICAL_FUNCTIONAL_OVERVIEW.md (stato dell'arte tecnico)
4. TRAMA_FINAL_PRODUCT_STATE_HANDOFF_20260903.md, TRAMA_PILOT_ARCHITECTURE_REVIEW.md,
   TRAMA_DARK_RELEASE_MODEL_REPORT.md, TRAMA_EVOLUTION_LAB_REPORT.md (approfondimenti tecnici)
5. PLANNER_BETA_V1.1_PROPOSTA.md e school-calendar-milano-puglia/ (feature in corso)

Poi conferma cosa hai capito di: cos'è TRAMA, a che punto è, quali feature sono attive in
produzione, quali sono in corso, e quali sono i prossimi passi da roadmap — prima di procedere
con qualunque richiesta.
```

## Livello 1 — Orientamento (leggere per primi, ~20 min)

| File | Cosa risponde |
|---|---|
| `BUSINESS_PLAN.md` | Cos'è TRAMA, per chi, modello di business |
| `ROADMAP.md` | Cosa è stato fatto, cosa viene dopo, in che ordine |
| `PREMORTEM.md` | Rischi principali e come sono mitigati |

## Livello 2 — Stato dell'arte tecnico (~30 min)

| File | Cosa risponde |
|---|---|
| `STATE_OF_THE_ART.md` | Inventario di tutte le feature, cosa è live e cosa no |
| `TECHNICAL_FUNCTIONAL_OVERVIEW.md` | Architettura, moduli principali, come sono collegati |
| `TRAMA_FINAL_PRODUCT_STATE_HANDOFF_20260903.md` | Fotografia dello stato prodotto a inizio settembre 2026 |
| `TRAMA_PILOT_ARCHITECTURE_REVIEW.md` | Revisione architetturale del pilota |
| `TRAMA_DARK_RELEASE_MODEL_REPORT.md` | Come funziona il rilascio "dark" delle feature (feature flag) |
| `TRAMA_EVOLUTION_LAB_REPORT.md` | Sperimentazioni ed evoluzioni prodotto |

## Livello 3 — Feature in corso / decisioni recenti

| File | Cosa risponde |
|---|---|
| `PLANNER_BETA_V1.1_PROPOSTA.md` + `analysis/TRAMA_PLANNER_BETA_V1.1*.md` | Planner beta: proposta e implementazione |
| `school-calendar-milano-puglia/PART_D_*.sql`, `PART_D2_*`, `PART_D3_*` | Intelligenza calendario scolastico: dati regionali (Lombardia/Milano, Puglia/Rutigliano) e proposta di migrazione/servizio |

## Livello 4 — Dati e codice (riferimenti, non duplicati qui)

Il codice e lo schema database vivono accanto a questa cartella, già tracciati da Git — nessuna
copia necessaria:

- `supabase/schema.sql` — schema database completo
- `supabase/migration_02_*.sql` … `migration_39_*.sql` (39 migrazioni, storico completo e in ordine)
- `app/` — pagine e route (Next.js), incluso `app/nextgen/` (la UI corrente in sviluppo attivo)
- `components/` — componenti React condivisi
- `lib/` — logica di dominio (booking, availability, discovery, feature-flags, ecc.)
- `package.json` — dipendenze e script (`npm run dev`, `npm run build`, ecc.)
- `CLAUDE.md` (nella root del repo) — istruzioni di progetto per Claude Code

## Livello 5 — Storico/archivio (consultare solo se serve un dettaglio specifico)

- `analysis/` — documenti di analisi puntuali (audit, log decisioni, specifiche feature)
- `archive/` — fasi superate del progetto (beta chiusa, pre-lancio, checkpoint sprint)
- `derived/` — versioni Markdown derivate dai documenti Word/HTML originali
- `package/` — pacchetto di documentazione storico (changelog, matrici di requisiti)

## File non-Markdown di riferimento (handoff/design originali)

Documenti Word/HTML del design handoff originale (`TRAMA_ONE_*`, `TRAMA_Admin_*`,
`TRAMA_Partner_*`, `TRAMA_Product_Architecture_*`) restano nella root di `docs/trama-one/` per
riferimento storico — le versioni Markdown equivalenti, più facili da leggere, sono in `derived/`.

---

*Nota di manutenzione: quando si aggiunge un nuovo documento importante al progetto, aggiungerlo
qui al livello giusto — così questo indice resta la mappa aggiornata, invece di un altro file da
disarchiviare in futuro.*
