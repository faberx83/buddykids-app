# Leggimi — sessioni di Claude su TRAMA (da qualsiasi dispositivo)

Aggiornato il 09/10/2026. Vale per ogni sessione di Claude che lavora su questo
repository: Claude Code da Mac, iPad o telefono, Cowork, app desktop.

## Obiettivo di Fabrizio
Lavorare al progetto da qualsiasi dispositivo, fisso o mobile. Sul Mac lancia
**un solo comando**: `bash deploy.sh`. Niente download, niente sequenze di comandi.

## Come consegna il codice una sessione di Claude
1. Lavora su un ramo `claude/<nome>`: quello della sessione va bene. Non fa
   mai push su `main` e non crea merge commit.
2. Parte da `origin/main` aggiornato e fa commit piccoli, con i test aggiornati
   nello stesso commit (regole in `CLAUDE.md`).
3. Fa push del ramo. Vercel non fa deploy dai rami `claude/*`, né da `main`
   (`vercel.json`): la produzione si aggiorna solo con `bash deploy.sh`.
4. Dice a Fabrizio: "lancia `bash deploy.sh`".

`bash deploy.sh`, sul Mac di Fabrizio:
- trova i commit nuovi su tutti i rami `claude/*` (git cherry, quindi mai due
  volte), li mostra e, dopo la conferma `s`, li porta su main;
- installa le dipendenze se servono, controlla i tipi (`tsc`) e si ferma se
  ci sono errori;
- applica gli SQL in attesa (vedi sotto), dopo la conferma scritta `APPLICA`;
- pubblica: push su main, `vercel --prod`, alias partner e admin.

Dettaglio completo nell'intestazione del passo [0/5] di `deploy.sh`.

## Migration SQL
- Un file `supabase/*.sql` con la riga `-- STATO: PREPARATA, NON APPLICATA`
  viene eseguito da `deploy.sh`, previa conferma di Fabrizio. Il registro dei
  file già eseguiti è sul suo Mac, in `~/.trama-deploy/sql-applicati.log`.
- Dopo l'applicazione, nel commit successivo la riga diventa
  `-- STATO: APPLICATA il <data>`.
- Claude non esegue mai SQL in scrittura in produzione: legge solo in sola
  lettura (governance in `CLAUDE.md` e nel Project).

## Stato al 09/10/2026 sera
- In produzione: family-first beta pass (onboarding a 4 schermate, Novità con
  voti, feedback con categoria), fix del 404 dell'anteprima Partner, pacchetto
  tecnico go-live (font e icone serviti dal nostro dominio, `sharp` 0.35.4).
- Migration 40: applicata. **Migration 41** (igiene sicurezza delle funzioni):
  preparata, la applica `deploy.sh` al prossimo lancio.
- Prossimo lavoro (go-live): bozze di Privacy e Termini, che rivede un legale,
  con il rendering dei testi versionati; poi Resend con il dominio
  `tramapp.it`; poi `LEGAL_TERMS_GATE`.

## Dove sta il resto del contesto
- Questo repository: `CLAUDE.md`, `docs/trama-one/` (indice:
  `MIGRATION_CONTEXT_INDEX.md`).
- Il Project claude.ai "TRAMA" (documenti `claude/INIZIATIVA_*.md`,
  `claude/WORKFLOW.md`, stato) è raggiungibile solo dalle sessioni collegate
  al Project. Le sessioni di Claude Code partono da qui.
