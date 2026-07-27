# TRAMA ONE — Baseline dei fallimenti preesistenti (PRE-EXISTING TECHNICAL DEBT)

Richiesto dall'audit esterno di Build Sprint 1 (sezione 11, "Baseline completa dei test"): identificare individualmente, non genericamente, i fallimenti Playwright già presenti su Legacy/NextGen/branding PRIMA e INDIPENDENTEMENTE da TRAMA ONE, così che qualunque nuovo fallimento nella suite completa sia riconoscibile come BLOCKER reale e non confuso con debito tecnico già noto.

## 0. AGGIORNAMENTO — dati reali dal run Integration Gate (27/07/2026)

Questo documento restava, fino ad oggi, interamente "DA CONFERMARE" (vedi §1 originale sotto): nessun run completo (`TEST_SCOPE=all`) era mai stato eseguito da Sprint 1 in poi (per decisione di governance DEC-29, la suite completa non era richiesta ad ogni sprint). Il primo run completo reale è stato eseguito da Fabrizio il 27/07/2026 (`logs/deploy-20260727-152424.log`, 44.1 minuti, esito finale **137 failed, 301 skipped, 70 did not run, 374 passed**) in preparazione dell'Integration Gate (`AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md`, DEC-30).

**I dati "DA CONFERMARE" della tabella §2 sono ora sostituiti da dati reali** per le aree 1-5. Onestamente, il quadro che emerge è diverso da quanto atteso:

- Le aree 1-5 (login header, login sfondo, nav "Gestione", badge NextGen, logo TRAMA) **si sono confermate reali**, ma con **14 occorrenze** (7 sintomi distinti × 2 progetti Playwright, chromium + mobile-chrome), non 7 come stimato nel 2026-07 iniziale — la stima precedente non aveva raddoppiato per i due browser/progetto.
- **L'area 6 ("Admin dashboard") non si è riprodotta in questo run**: i test dell'area Admin dashboard (`tests/admin/dashboard.spec.ts`) sono passati. Non è quindi più classificata come debito preesistente attivo — resta nella cronologia sotto per trasparenza, ma non compare più nel totale corrente.
- Il run ha rivelato una massa di fallimenti (97) e di test mai eseguiti (70) che **queste 4 aree non spiegano** — vedi `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` per il dettaglio completo e la classificazione onesta. Questo documento non li assorbe per assunzione: solo le corrispondenze verificate riga per riga con la traccia d'errore sono incluse qui.

## 1. Stato di questo documento (versione originale, invariata per cronologia)

**Importante — trasparenza sui dati disponibili.** Le 4 categorie sotto sono note e documentate fin da `AUDIT_CHECKPOINT_SPRINT_0.md` (§4, §13: "7 fallimenti su funzionalità Legacy/NextGen/branding preesistenti — login header, dashboard Gestore, badge NextGen, logo TRAMA — non correlati a TRAMA ONE"), riconfermate qualitativamente ad ogni deploy successivo (incluso quello di Sprint 1, §4/§6 di `AUDIT_CHECKPOINT_SPRINT_1.md`). Fino al run del 27/07 non era mai stato conservato in questo repository l'output raw per-test del run Playwright completo che le ha rilevate.

## 2. Le aree confermate dal run reale del 27/07/2026

| # | Area | File/route coinvolta | Sintomo osservato (verificato riga per riga nel log) | TC | Browser/progetto | Indipendenza da TRAMA ONE |
|---|---|---|---|---|---|---|
| 1 | Login — header/splash duplicato | `tests/genitori/login.spec.ts:18` | Splash overlay e pagina mostrano insieme "Organizing childhood. Together." — 2 elementi, strict-mode violation | TC-204 | chromium + mobile-chrome (2×) | Nessun file `app/auth/*` toccato da TRAMA ONE Sprint 0-4 |
| 2 | Login — sfondo | `tests/genitori/login.spec.ts:66` | Sfondo pagina non "bianco puro" atteso | TC-208 | chromium + mobile-chrome (2×) | Stesso motivo del punto 1 |
| 3 | Gestore — voce "Gestione" | `tests/gestore/dashboard.spec.ts:51` | `getByText("Gestione", exact)` non trovato nel nuovo raggruppamento di navigazione | TC-119 | chromium + mobile-chrome (2×) | Nessun componente di navigazione Legacy Gestore toccato da TRAMA ONE |
| 4 | NextGen — badge | `tests/nextgen/smoke.spec.ts:11/19/27` | `getByText("NextGen")` non trovato (parent/gestore/admin) | TC-N01/N02/N03 | chromium + mobile-chrome (6×) | Dominio `app/nextgen/*` mai toccato da TRAMA ONE (Strangler Fig) |
| 5 | NextGen — logo TRAMA | `tests/nextgen/smoke.spec.ts:68` | `img[src=".../trama-logo-mark.png"]` risolve a 2 elementi (duplicato, non "non renderizzato" come ipotizzato in origine) | TC-N89 | chromium + mobile-chrome (2×) | Stesso motivo del punto 4 |

**Totale confermato in queste 5 aree: 14 fallimenti** (non 7 — la stima originale non considerava la doppia esecuzione cross-browser).

**Area "Admin dashboard" (ex punto 6-7 della stima originale): NON riprodotta in questo run.** `tests/admin/dashboard.spec.ts` è passato integralmente. Rimossa dal conteggio corrente; se dovesse ripresentarsi in un run futuro va trattata come nuova scoperta, non come riconferma di un problema già noto.

## 3. Le 4 aree note (versione storica originale, 2026-07, prima del run reale)

| # | Area | File/route coinvolta (nota) | Sintomo osservato | Prima evidenza documentale | Browser/progetto | Nome test esatto / assertion | Indipendenza da TRAMA ONE |
|---|---|---|---|---|---|---|---|
| 1 | Login — header duplicato | `/auth/login` (Legacy) | Header mostrato due volte nella pagina di login in alcuni contesti di rendering | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 (luglio 2026), riconfermato in Sprint 1 | DA CONFERMARE (chromium e/o firefox) | DA CONFERMARE — presumibilmente in `tests/genitori/login.spec.ts` o `tests/genitori/app-splash.spec.ts` | Nessun file dell'area login toccato da TRAMA ONE Sprint 0/1 |
| 2 | Login — sfondo | `/auth/login` (Legacy) | Sfondo della pagina di login non conforme al design atteso in almeno un browser/viewport | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 | DA CONFERMARE | DA CONFERMARE — presumibilmente in `tests/genitori/login.spec.ts` | Stesso motivo del punto 1 |
| 3 | Gestore — voce di navigazione "Gestione" | `/center/*` (Legacy) | Voce di navigazione "Gestione" nel menu Gestore non nello stato/posizione atteso dal test | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 | DA CONFERMARE | DA CONFERMARE — presumibilmente in `tests/gestore/dashboard.spec.ts` | TRAMA ONE Sprint 0/1 non ha toccato alcun componente di navigazione Gestore esistente |
| 4 | NextGen — badge | `/nextgen/*` | Badge "NextGen" non visibile/non conforme in almeno un test | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 | DA CONFERMARE | DA CONFERMARE — presumibilmente in `tests/nextgen/smoke.spec.ts` | Nessun file `app/nextgen/*` toccato da TRAMA ONE |
| 5 | NextGen — logo TRAMA | `/nextgen/*` | Logo TRAMA non renderizzato come atteso in almeno un test | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 | DA CONFERMARE | DA CONFERMARE — presumibilmente in `tests/nextgen/smoke.spec.ts` | Stesso motivo del punto 4 |
| 6 | Admin — dashboard | `/admin/*` (Legacy) | Un secondo fallimento nell'area Admin dashboard, distinto dal precedente set (conteggio "7" riportato in Sprint 0 include ripetizioni cross-browser/progetto, non necessariamente 7 sintomi distinti) | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 (conteggio aggregato) | DA CONFERMARE | DA CONFERMARE — presumibilmente in `tests/admin/dashboard.spec.ts` | Nessun file `app/admin/*` esistente toccato da TRAMA ONE |
| 7 | Ripetizione cross-browser di uno dei punti sopra | — | Lo stesso sintomo di uno dei punti 1-6 replicato su un secondo progetto Playwright, conteggiato separatamente nel totale "7" | `AUDIT_CHECKPOINT_SPRINT_0.md` §13 | DA CONFERMARE | DA CONFERMARE | Stesso motivo del punto corrispondente |

## 4. Fallimenti noti/non bloccanti per precondizioni di test documentate (12, confermati dal run 27/07)

Distinti dal debito "pre-esistente" sopra: questi non sono bug di prodotto, sono conseguenza di condizioni note e già documentate in `DECISION_LOG.md`, verificate riga per riga contro il log:

| Gruppo | TC | File | Causa documentata | Fonte |
|---|---|---|---|---|
| Conflitto account di test (DEC-34) | TC-N302/303/304/401/402 | `tests/one/smoke.spec.ts` | Gli account di test fissi hanno `TRAMA_ONE_ENABLED=true` come override necessario per testare l'onboarding — i test che assumono "flag disattivato di default" falliscono per costruzione su quegli stessi account | `DECISION_LOG.md` DEC-34 |
| Precondizione SQL manuale (DEC-33) | TC-N409 | `tests/one/onboarding-remediation.spec.ts` | Richiede una precondizione SQL manuale non ancora eseguita per il percorso "SUBMITTED → CHANGES_REQUESTED → SUBMITTED → APPROVED" — comportamento atteso e già documentato | `DECISION_LOG.md` DEC-33 |

10 occorrenze del primo gruppo (5 TC × 2 browser) + 2 del secondo (1 TC × 2 browser) = 12.

## 5. Condizione di chiusura di questo gap

**Parzialmente chiusa dal run del 27/07/2026** per le aree 1-5 (§2). Resta aperta la parte più consistente: 97 fallimenti e 70 test "did not run" che NON rientrano né nel debito preesistente né nei gap noti — vedi `AUDIT_CHECKPOINT_INTEGRATION_SPRINT_1_4.md` per la classificazione completa, che questo documento non duplica. Se un prossimo run completo mostra numeri diversi da quelli di questa sezione §2, questo file va aggiornato di conseguenza senza nascondere la discrepanza, stesso principio già enunciato per la versione originale sotto.
