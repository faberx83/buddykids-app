
# TRAMA ONE — Controlled Beta Experience, Publication and Readiness Gate — Output finale (§20)

Documento autosufficiente: chiude il gate "Controlled Beta Experience, Publication and Readiness Gate" (§1-§20), consolidando tutto il lavoro delle sezioni precedenti in un unico verdetto GO/NO-GO. Non ripete il dettaglio implementativo già coperto dai documenti citati in §3 — questo è l'output di sintesi richiesto esplicitamente da §20.

## 1. Verdetto

**GO WITH CONDITIONS** — non GO pieno, non NO-GO.

Tutto ciò che Claude può fare in questo ambiente (codice, test "no browser", documentazione, script SQL non applicati, verifica statica) è chiuso e verificato. Tre condizioni, tutte eseguibili solo da Fabrizio (browser reale/deploy/produzione), restano tra questo documento e la pubblicazione effettiva:

1. **Eseguire `TRAMA_ONE_VISUAL_ACCEPTANCE.md`** (§15) — screenshot a 3 breakpoint, matrice PASS/FIX/N-A. Nessuna riga può essere dichiarata chiusa da Claude senza uno screenshot reale osservato.
2. **Lanciare `TEST_SCOPE=critical bash test-deploy.sh` + `tests/one/*.spec.ts`** contro un deploy reale con Supabase configurato (§17 punto 2) — copre in particolare `TC-N414`/`TC-N415`/`TC-N416` (Spotlight reale) e `TC-N418` (wiring Command Center), mai eseguiti contro un browser vero in questo ambiente.
3. **Decidere se e quando eseguire** `supabase/script_production_hygiene_cleanup.sql` (§19, non applicato) e cosa fare di `Test centro estivo` (ambiguo, lasciato esplicitamente alla valutazione di Fabrizio).

Nessuna di queste 3 condizioni richiede altro codice da scrivere: sono azioni di verifica/decisione, non lavoro in sospeso.

## 2. Stato per sezione (§1-§19)

| Sezione | Oggetto | Stato | Riferimento |
|---|---|---|---|
| §1 | Fonti di verità lette | Chiuso | Task #421 |
| §2 | Route Release Matrix | Chiuso | `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md` |
| §3 | Information Architecture / navigazione | Chiuso | DEC-58 |
| §4-6 | Visual Conformance (statico) | Chiuso | `TRAMA_ONE_VISUAL_CONFORMANCE.md`, DEC-59 |
| Fase E | Wiring navigazione (`/admin/one` nel menu) | Chiuso | DEC-62 (`app/center/page.tsx` deliberatamente non toccato — vedi §4 sotto) |
| §7-14 | Product Walkthrough Spotlight reale | Chiuso | DEC-60 |
| §15 | Visual Acceptance Gate | **Instrumentato, APERTO** — esecuzione riservata a Fabrizio | `TRAMA_ONE_VISUAL_ACCEPTANCE.md`, DEC-61 |
| §16-17 | Controlled Publication procedure | Prodotta, non eseguita | `TRAMA_ONE_CONTROLLED_PUBLICATION.md`, DEC-62 |
| §18 | Pilot Operating Model | Chiuso | `CONTROLLED_BETA_OPERATING_MODEL.md`, DEC-63 (corretta) |
| §19 | Production Hygiene | Chiuso | `TRAMA_ONE_PRODUCTION_HYGIENE.md`, DEC-64 |
| Blocker §1 (flag/coorte) | Override globale → coorte scoped | Chiuso e verificato live | DEC-57 |

## 3. Deliverable prodotti in questo gate (elenco completo)

Documentazione: `TRAMA_ONE_ROUTE_RELEASE_MATRIX.md`, `TRAMA_ONE_VISUAL_CONFORMANCE.md`, `TRAMA_ONE_VISUAL_ACCEPTANCE.md`, `TRAMA_ONE_CONTROLLED_PUBLICATION.md`, `CONTROLLED_BETA_OPERATING_MODEL.md`, `TRAMA_ONE_PRODUCTION_HYGIENE.md`, questo documento. Voci `DECISION_LOG.md`: DEC-57..DEC-64. Codice: `lib/spotlight/position.ts`, `components/spotlight/PartnerSpotlight.tsx`, estensioni a `lib/walkthrough/registry.ts`/`data.ts`, `app/actions/spotlight.ts`, 3 nuovi eventi in `lib/telemetry/known-events.ts`, `app/admin/layout.tsx` (voce "Command Center" gated). Test: `tests/one/spotlight-position.spec.ts` (nuovo), `tests/one/walkthrough-partner.spec.ts` (riscritto, +TC-N416), `tests/one/command-center.spec.ts` (+TC-N418). SQL non applicati: `supabase/script_controlled_beta_flag_cohort.sql`, `supabase/script_controlled_beta_expand_cohort.sql` (template), `supabase/script_production_hygiene_audit.sql`, `supabase/script_production_hygiene_cleanup.sql`.

## 4. Cosa è stato deliberatamente escluso (perimetro del gate rispettato)

- **`app/center/page.tsx`** non è stato toccato: manca un redirect per `center_admin` non-`APPROVED` verso l'onboarding (gap noto da DEC-58) — chiuderlo richiederebbe modificare la state machine di onboarding Centro, dominio funzionale Sprint 1, esplicitamente fuori perimetro ("explicitly not reopening Sprint 1-6 functional domain").
- **Nessun nuovo business epic**: ogni capability usata nel Pilot Operating Model (Command Center, Feature Flags Admin, Segnalazioni BETA, Walkthrough/Spotlight) esisteva già prima di questo gate — §16-19 sono riuso puro, non nuove funzionalità.
- **Nessuna migrazione applicata da Claude**: ogni file SQL prodotto (coorte, template arruolamento, audit hygiene, cleanup hygiene) ha intestazione "QUESTO FILE NON È STATO APPLICATO AL DATABASE" e resta da eseguire manualmente da Fabrizio.
- **Comunicazione a centri/famiglie pilota** (email di invito, materiale onboarding): non richiesta dal gate, non prodotta.

## 5. Repository state

- Branch: `main`. Working tree pulito (verificato `git status --short` prima di scrivere questo documento).
- HEAD di questo gate: `42c4eea` ("docs(trama-one): DEC-64 (§19 Production Hygiene) + correzione DEC-63").
- 29 commit granulari da `bd99f41` (DEC-57) a `42c4eea` (DEC-64), tutti scoped a una singola unità logica, nessun `git add .`.

## 6. Percorso verso il GO pieno

Ordine esatto già descritto in `TRAMA_ONE_CONTROLLED_PUBLICATION.md` §3: chiudere §15 (screenshot reali) → `TEST_SCOPE=critical` + `tests/one/*` mirati contro il deploy → deploy invariato → verifica live post-deploy → decisione facoltativa di espandere la coorte oltre i 2 account di test → monitoraggio nella finestra di 60 giorni (scade 2026-10-02, DEC-57). Nessun passo di questa sequenza richiede altro lavoro di implementazione: sono tutte azioni di Fabrizio (browser reale, deploy, produzione), coerenti con la governance permanente del programma.
