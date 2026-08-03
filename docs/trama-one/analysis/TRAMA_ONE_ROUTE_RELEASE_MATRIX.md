
# TRAMA ONE — Route Release Matrix

Inventario di **tutte** le route TRAMA ONE realmente implementate negli Sprint 1-6 (Parent, Partner, Admin), verificato leggendo il repository (route reali, componenti, registry dei feature flag) e il database di produzione (sola lettura, progetto `eagsgfxunwyyxwwilldy`) — non per memoria documentale. Fa parte del gate **Controlled Beta Experience** (non riapre il dominio funzionale di Sprint 1-6, verifica solo pubblicazione/raggiungibilità).

**Metodo**: `find`/`grep` su `app/`, `components/`, `lib/` per ogni route sotto `/one`, `/center/one`, `/admin/one` più le due estensioni Sprint 5-6 non sotto flag (`center-leads`, `feature-flags`); lettura diretta dei file nav (`app/admin/layout.tsx`, `app/center/layout.tsx`, `components/nextgen/NextgenBottomNav.tsx`); query di sola lettura su `feature_flag_overrides` per lo stato live del flag.

## 0. Sintesi — due criticità trasversali trovate

Prima del dettaglio riga-per-riga, due fatti riguardano **tutte** le 8 route sotto e vanno risolti una volta sola, non route per route:

1. **Nessuna delle 8 route ha un punto di accesso in nessuna navigazione reale.** Verificato con `grep` su `app/admin/layout.tsx`, `app/center/layout.tsx`, `components/nextgen/NextgenBottomNav.tsx`, e su tutto `app/`+`components/`+`lib/` per stringhe `"/one"`, `"/center/one"`, `"/admin/one"`: zero occorrenze fuori dai file delle route stesse. Le uniche eccezioni sono `/admin/center-leads` e `/admin/feature-flags`, già presenti in `app/admin/layout.tsx` (righe 30-31). Questo è esattamente il gap descritto nel gate: le funzionalità sono tecnicamente complete e testate, ma **non pubblicate** nel senso operativo del termine.
2. **`TRAMA_ONE_ENABLED` è oggi, in produzione, un override `global` permanente (`enabled=true`, `expires_at=null`)**, verificato con query diretta su `feature_flag_overrides` (id `377b5a2a…`, creato 2026-07-22, aggiornato 2026-07-29). Questo significa che `/one`, `/center/one`, `/admin/one` sono già raggiungibili da **chiunque conosca l'URL**, non solo dalla coorte Controlled Beta — in violazione diretta del requisito "non un rollout globale" di questo gate. La correzione (sostituire l'override globale con uno scoped a coorte/ruolo) è un prerequisito del gate §16, non un'azione già fatta.

## 1. PARENT

### `/one`

- **Funzione**: shell/placeholder del portale TRAMA ONE Parent; mostra la card Walkthrough "welcome_parent" se in corso.
- **Ruolo autorizzato**: qualunque utente autenticato (nessun controllo di ruolo nel layout oltre l'autenticazione).
- **Sprint di origine**: Sprint 0 (shell), Sprint 1 (prima dimostrazione reale del motore Walkthrough).
- **Stato implementazione**: minimale — `app/one/page.tsx` è 29 righe, un `<h1>` e una card, senza dati di dominio (niente Planner/prenotazioni/ricerca collegati da qui).
- **Accesso da navigazione**: **nessuno**. Non in `NextgenBottomNav`, non in nessun menu, non in nessuna card.
- **Entry point**: URL digitato manualmente. Nessun altro.
- **Feature flag**: `TRAMA_ONE_ENABLED` (unico flag esistente nel registry — non esistono flag granulari per singola capability, nonostante il gate ne presupponga la possibile esistenza).
- **Coorte**: nessuna coorte applicata di fatto — vedi §0.2 (override globale).
- **Fallback flag-off**: `app/one/layout.tsx` reindirizza altrove se il flag risolve a `false` (verificato in Sprint 0) — Legacy/NextGen restano intatti, invariato.
- **Stato desktop/mobile**: nessuno stile applicato (`style={{padding:24}}`, `<h1>` di sistema) — renderizza ma è visivamente incoerente con TRAMA (nessun font Poppins/Inter, nessun token colore, nessun `PageHeader`).
- **Empty/loading/error/success state**: nessuno stato gestito esplicitamente oltre "walkthrough presente/assente".
- **Test**: `tests/one/smoke.spec.ts` (TC-N302, TC-N306) verifica solo la raggiungibilità con flag attivo, non contenuto/stile.
- **Deploy**: live in produzione (route dinamica, confermato `export const dynamic` nei layout `/one`).
- **Route orfana**: **sì** — nessun accesso da IA reale, solo URL diretto.

### `/center-leads` ("I tuoi suggerimenti")

- **Funzione**: lista di sola lettura delle segnalazioni di centri non iscritti fatte dal genitore.
- **Ruolo autorizzato**: genitore autenticato (RLS per riga, `suggested_by = auth.uid()`).
- **Sprint di origine**: Sprint 5.
- **Stato implementazione**: completa (usa `PageHeader`, stati/badge coerenti con il resto dell'app — vedi `STATUS_STYLE` in `app/(main)/center-leads/page.tsx`).
- **Accesso da navigazione**: **nessuno** in bottom nav/menu. Entry point contestuale esistente: `components/nextgen/SuggestCenterCard.tsx`, mostrata solo quando una ricerca non produce risultati.
- **Entry point**: solo contestuale (ricerca senza risultati) — nessun accesso permanente da Profilo/Planner per rivedere le proprie segnalazioni già inviate in altri momenti.
- **Feature flag**: **nessuno** — route sempre attiva, non gated da `TRAMA_ONE_ENABLED` (per design Sprint 5, coerente con `lib/data/center-leads.ts`).
- **Coorte**: N/A (sempre-on).
- **Fallback flag-off**: N/A.
- **Stato desktop/mobile**: coerente con il resto dell'app (usa componenti condivisi Legacy/NextGen).
- **Empty/loading/error/success state**: gestiti (fail-safe silenzioso lato dati, vedi DEC-56 — lista vuota se errore, nessun errore mostrato).
- **Test**: `tests/one/center-leads.spec.ts` (TC-N600-N606), tutti PASSED nel run 2026-08-03 (vedi `AUDIT_CHECKPOINT_BETA_RELEASE.md`).
- **Deploy**: live in produzione, sempre raggiungibile (non gated).
- **Route orfana**: **parzialmente** — entry point contestuale esiste ed è corretto per il caso d'uso principale, ma manca un accesso permanente per rivedere lo storico.

## 2. PARTNER

### `/center/one`

- **Funzione**: shell/placeholder del portale TRAMA ONE Partner; link verso l'onboarding; card Walkthrough "activity_creation_partner".
- **Ruolo autorizzato**: `center_admin` autenticato.
- **Sprint di origine**: Sprint 0 (shell), Sprint 1 (link onboarding), Sprint 2 (Walkthrough attività).
- **Stato implementazione**: minimale, stesso pattern di `/one` — 36 righe, `<h1>` di sistema, **colore hardcoded `#2E86DE`** per il link (non un token del design system, violazione diretta del vincolo "non introdurre colori locali hardcoded se esiste un token").
- **Accesso da navigazione**: **nessuno**. Non in `app/center/layout.tsx` (verificato, 12 voci di menu, nessuna verso `/center/one`).
- **Entry point**: URL digitato manualmente.
- **Feature flag**: `TRAMA_ONE_ENABLED`.
- **Coorte**: vedi §0.2.
- **Fallback flag-off**: Legacy/NextGen Partner restano invariati.
- **Stato desktop/mobile**: non stilizzato, colore hardcoded non-token.
- **Empty/loading/error/success state**: non gestiti esplicitamente.
- **Test**: `tests/one/smoke.spec.ts` (TC-N303), solo raggiungibilità. `tests/one/walkthrough-partner.spec.ts` (TC-N414/N415) verifica il modulo Walkthrough attività.
- **Deploy**: live.
- **Route orfana**: **sì**.

### `/center/one/onboarding`

- **Funzione**: checklist di attivazione centro (stato LEAD→APPROVED), upload verifica identità.
- **Ruolo autorizzato**: `center_admin` del centro proprietario (RLS).
- **Sprint di origine**: Sprint 1, hardening Sprint 1 remediation (auto-inizializzazione LEAD, migration_10).
- **Stato implementazione**: completa e matura — usa `ONBOARDING_STATUS_REGISTRY`/badge condivisi, non stili inline.
- **Accesso da navigazione**: **nessuno** direttamente da menu; raggiungibile solo tramite il link dentro `/center/one` (che è a sua volta orfana — vedi sopra: **catena di 2 hop, entrambi non raggiungibili da IA reale**).
- **Entry point**: solo dentro la pagina orfana `/center/one`.
- **Feature flag**: `TRAMA_ONE_ENABLED` (ereditato dal layout `/center/one`).
- **Coorte**: vedi §0.2.
- **Fallback flag-off**: onboarding Legacy (se esiste un percorso equivalente) non impattato.
- **Stato desktop/mobile**: non verificato in questo passaggio (rimandato a `TRAMA_ONE_VISUAL_CONFORMANCE.md`).
- **Empty/loading/error/success state**: gestiti (checklist con stati per-item, upload con stato verifica).
- **Test**: `tests/one/onboarding.spec.ts`, `tests/one/onboarding-remediation.spec.ts` (TC-N407-N413), tutti coperti da unit "no browser" + UI-driven confermati verdi nel run 2026-08-03.
- **Deploy**: live.
- **Route orfana**: **sì** (raggiungibile solo attraverso un'altra route orfana).

## 3. ADMIN

### `/admin/one`

- **Funzione**: Command Center — aggrega 7 code operative (onboarding, prenotazioni, richieste, CenterLead, certificazioni, segnalazioni BETA, feature flag) con priorità calcolata; sezione funnel Walkthrough.
- **Ruolo autorizzato**: `platform_admin` (RLS su `tutorial_progress`/onboarding/ecc., nessun controllo esplicito di ruolo nella route stessa oltre l'ereditarietà del layout `/admin`).
- **Sprint di origine**: Sprint 6 (E08, DEC-51), hardening Sprint 6 (funnel, DEC-54).
- **Stato implementazione**: funzionalmente completa e complessa (aggrega dati reali da 7 domini), ma **interamente in `style={{}}` inline con colori hardcoded** (`#FDECEA`, `#C0392B`, `#FFF6E5`, `#B7791F`, `#EAF7EE`, `#2E7D46`, `#555`) — zero classi Tailwind/token, zero componenti condivisi (`PageHeader`, card, badge). È la route con il gap visivo più ampio di tutto l'inventario, nonostante sia la più importante funzionalmente.
- **Accesso da navigazione**: **nessuno**. Non in `app/admin/layout.tsx` (16 voci di menu verificate, nessuna verso `/admin/one`).
- **Entry point**: URL digitato manualmente. Nessun'altra pagina Admin rimanda qui.
- **Feature flag**: `TRAMA_ONE_ENABLED`.
- **Coorte**: vedi §0.2.
- **Fallback flag-off**: dashboard Admin Legacy (`/admin`) invariata.
- **Stato desktop/mobile**: non responsive testato in questo passaggio; il markup a `<div style={{display:"grid"}}>` non ha breakpoint espliciti.
- **Empty/loading/error/success state**: non gestiti esplicitamente (nessun messaggio per "0 code aperte").
- **Test**: `tests/one/command-center.spec.ts` (logica priorità, "no browser", 8 casi verdi) + `tests/one/smoke.spec.ts` (TC-N304) + `tests/one/walkthrough-funnel.spec.ts` (TC-N613) — tutti PASSED nel run 2026-08-03.
- **Deploy**: live.
- **Route orfana**: **sì** — è la più critica delle 8, perché è il punto di ingresso concettuale a tutta l'operatività Admin di TRAMA ONE.

### `/admin/one/onboarding`

- **Funzione**: review Admin delle richieste di attivazione centro, verifica documenti identità, audit log.
- **Ruolo autorizzato**: `platform_admin`.
- **Sprint di origine**: Sprint 1.
- **Stato implementazione**: completa e matura, usa componenti/badge condivisi (`AdminOnboardingReviewClient.tsx`), non stili inline.
- **Accesso da navigazione**: **nessuno** direttamente da menu; linkata da `/admin/one` (route orfana) tramite `lib/data/command-center.ts` (href della card Command Center).
- **Entry point**: solo dentro `/admin/one`, che è a sua volta orfana — stessa catena a 2 hop del lato Partner.
- **Feature flag**: `TRAMA_ONE_ENABLED` (ereditato).
- **Coorte**: vedi §0.2.
- **Fallback flag-off**: N/A (nessun percorso admin review Legacy equivalente noto).
- **Stato desktop/mobile**: non verificato in questo passaggio.
- **Empty/loading/error/success state**: gestiti.
- **Test**: `tests/one/onboarding-remediation.spec.ts` (TC-N407-N413), verdi.
- **Deploy**: live.
- **Route orfana**: **sì** (stessa catena di `/admin/one`).

### `/admin/center-leads`

- **Funzione**: coda Admin delle segnalazioni CenterLead, con claim verso centro esistente.
- **Ruolo autorizzato**: `platform_admin`.
- **Sprint di origine**: Sprint 5.
- **Stato implementazione**: completa; bug di embed PostgREST trovato e risolto in DEC-56 (`profiles!suggested_by`).
- **Accesso da navigazione**: **presente** — `app/admin/layout.tsx` riga 30, voce "Segnalazioni centri".
- **Entry point**: menu Admin, sempre visibile.
- **Feature flag**: **nessuno** (sempre-on, non gated da `TRAMA_ONE_ENABLED`).
- **Coorte**: N/A.
- **Fallback flag-off**: N/A.
- **Stato desktop/mobile**: coerente con lo stile Admin esistente (usa lo stesso layout/menu delle altre pagine Admin mature).
- **Empty/loading/error/success state**: gestiti (fail-safe silenzioso, vedi DEC-56).
- **Test**: `tests/one/center-leads.spec.ts` (TC-N603/N605), PASSED dopo fix nel run 2026-08-03.
- **Deploy**: live.
- **Route orfana**: **no** — unica delle 8 già correttamente integrata in IA.

### `/admin/feature-flags`

- **Funzione**: gestione override feature flag (crea/vedi/elimina), stato scaduto/in scadenza.
- **Ruolo autorizzato**: `platform_admin` (RLS su `feature_flag_overrides`).
- **Sprint di origine**: Sprint 6 (DEC-48).
- **Stato implementazione**: completa; bug locator test risolto in DEC-56 (non bug di prodotto).
- **Accesso da navigazione**: **presente** — `app/admin/layout.tsx` riga 31, voce "Feature flag".
- **Entry point**: menu Admin, sempre visibile.
- **Feature flag**: N/A (la pagina gestisce i flag, non è essa stessa gated).
- **Coorte**: N/A.
- **Fallback flag-off**: N/A.
- **Stato desktop/mobile**: coerente (usa classi Tailwind, verificato in `FeatureFlagsAdminClient.tsx`).
- **Empty/loading/error/success state**: gestiti (badge di stato override, alert scadenza).
- **Test**: `tests/one/feature-flags.spec.ts` (TC-N609 + 20 unit "no browser"), PASSED dopo fix nel run 2026-08-03.
- **Deploy**: live.
- **Route orfana**: **no**.

## 4. Riepilogo tabellare

| Route | Portale | Sprint | In IA? | Flag | Stato visivo | Orfana |
|---|---|---|---|---|---|---|
| `/one` | Parent | 0/1 | No | `TRAMA_ONE_ENABLED` | Scaffold non stilizzato | **Sì** |
| `/center-leads` | Parent | 5 | Contestuale solo | Nessuno | Coerente | Parziale |
| `/center/one` | Partner | 0/1/2 | No | `TRAMA_ONE_ENABLED` | Scaffold, colore hardcoded | **Sì** |
| `/center/one/onboarding` | Partner | 1 | No (2° hop da route orfana) | `TRAMA_ONE_ENABLED` | Coerente | **Sì** |
| `/admin/one` | Admin | 6 | No | `TRAMA_ONE_ENABLED` | Scaffold, tutto inline/hardcoded | **Sì** |
| `/admin/one/onboarding` | Admin | 1 | No (2° hop da route orfana) | `TRAMA_ONE_ENABLED` | Coerente | **Sì** |
| `/admin/center-leads` | Admin | 5 | **Sì** | Nessuno | Coerente | No |
| `/admin/feature-flags` | Admin | 6 | **Sì** | Nessuno | Coerente | No |

**6 route su 8 sono orfane** (nessun accesso da navigazione reale). Le uniche 2 già correttamente pubblicate sono quelle Sprint 5-6 non gated da `TRAMA_ONE_ENABLED`. Le 3 "shell" (`/one`, `/center/one`, `/admin/one`) sono inoltre gli unici 3 file rimasti allo stadio di scaffold Sprint 0 non più aggiornato, nonostante ospitino/aggreghino funzionalità mature costruite sopra negli sprint successivi.

## 5. Implicazioni per §3 (IA/navigazione) e §16 (Controlled Publication)

1. Serve una voce di navigazione per `/one` (Parent), `/center/one` (Partner) e `/admin/one` (Admin) in ciascun menu — condizionata al flag come le altre voci Sprint 5-6, non un rollout permanente.
2. `/center/one/onboarding` e `/admin/one/onboarding` diventano raggiungibili automaticamente una volta risolto il punto 1 (sono già linkate correttamente dalle rispettive shell).
3. Le 3 shell vanno restyle-ate (§4, Visual Conformance) prima della pubblicazione — non è accettabile mostrare a una coorte pilota un `<h1>` di sistema e colori hardcoded.
4. L'override globale permanente di `TRAMA_ONE_ENABLED` (§0.2) va sostituito con uno scoped a coorte/ruolo (Controlled Beta) prima o durante il deploy di questo gate — è un'azione SQL, quindi resta a Fabrizio (governance permanente), ma va programmata esplicitamente nella procedura di §16.
