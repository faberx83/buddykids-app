# TRAMA — Route Inventory & Legacy Redirect Graph

25/08/2026 — AUDIT ONLY, nessuna modifica. Riferimento: `TRAMA_PLATFORM_PRODUCT_TRUTH.md` per fotografia e verdetto. Tutte le colonne DEPLOYED sono calcolate contro l'ultimo deploy produzione realmente riuscito, commit `6d7b102` (24/08/2026) — HEAD repo attuale `e0d4911` (49 commit di differenza, non deployati).

Architettura: LEGACY (nessun flag) · NEXTGEN (`/nextgen/*`, nessun flag, solo cookie `bk_version` client-side) · TRAMA ONE (`/one`, `/center/one`, `/admin/one`, gated da `TRAMA_ONE_ENABLED`).

---

## 1. ROUTE INVENTORY COMPLETA

Tassonomia: REAL_CURRENT · REAL_WITH_LEGACY_DEPENDENCY · MIXED_CURRENT_LEGACY · LEGACY_ONLY · MOCK_DEMO · STUB · INCOMPLETE · REDIRECT_ONLY · DEAD_OR_ORPHAN · INTERNAL_ONLY · TEST_ONLY

### 1.1 LEGACY — Parent (`app/(main)/*`)

| Route | Portal/Ruolo | Data source | UI reachable | URL diretto | Flag | Deployed | Stato |
|---|---|---|---|---|---|---|---|
| `/` | PARENT | `getActivities()` reale + fallback mock **con banner** | YES (Home) | YES | — | YES | REAL_WITH_LEGACY_DEPENDENCY |
| `/search` | PARENT | `getActivities()`, **nessun banner** su fallback | YES (BottomNav) | YES | — | YES | MOCK_DEMO risk (unbannered) |
| `/groups`, `/groups/[id]`, `/groups/join/[id]` | PARENT | Reale (Supabase) | YES | YES | — | YES | REAL_CURRENT |
| `/calendar` | PARENT | Reale | YES (BottomNav) | YES | — | YES | REAL_CURRENT |
| `/prenotazioni` | PARENT | Reale | YES | YES | — | YES | REAL_CURRENT |
| `/prenotazioni/[id]/modifica` | PARENT | Reale, **nuovo editor add/remove giorni** | YES | YES | — | **NO** | INCOMPLETE→REAL_CURRENT una volta deployato |
| `/presenze` | PARENT | Reale | YES (Profilo) | YES | — | YES | REAL_CURRENT |
| `/preferiti` | PARENT | Reale | YES | YES | — | YES | REAL_CURRENT |
| `/profile`, `/profile/preferenze`, `/profile/privacy`, `/profile/sicurezza` | PARENT | Reale | YES | YES | — | YES | REAL_CURRENT (sotto-voci lingua/tema/pagamenti = INCOMPLETE dichiarato) |
| `/profile/notifiche` | PARENT | — | YES | YES | — | YES | REDIRECT_ONLY (shim verso Preferenze) |
| `/center-leads` | PARENT | Reale | YES | YES | — | YES | REAL_CURRENT |

### 1.2 NEXTGEN — Parent (`app/nextgen/*`)

Gate: solo login (`app/nextgen/layout.tsx:73`), nessun feature flag.

| Route | Data source | Deployed | Stato |
|---|---|---|---|
| `/nextgen` | `getActivities()` + banner su fallback | YES | REAL_WITH_LEGACY_DEPENDENCY |
| `/nextgen/search` | `getActivities()`, **nessun banner** | YES | MOCK_DEMO risk (unbannered) |
| `/nextgen/planner` (+famiglia, indirizzi, promemoria) | Reale, alcune chiamate `getActivities()` unbannered | YES | REAL_CURRENT / MOCK_DEMO risk parziale |
| `/nextgen/planner/logistica` | — | YES | REDIRECT_ONLY (shim deprecato → `/nextgen/profile/famiglia`) |
| `/nextgen/community`, `/nextgen/community/[id]` | Reale | YES | REAL_CURRENT |
| `/nextgen/groups`, `/nextgen/groups/[id]` | Reale | YES | REAL_CURRENT |
| `/nextgen/prenotazioni` | Reale (riuso deliberato di `PrenotazioniClient` Legacy) | YES | REAL_CURRENT |
| `/nextgen/preferiti`, `/nextgen/presenze`, `/nextgen/richieste` | Reale | YES | REAL_CURRENT |
| `/nextgen/profile/*` (famiglia, impostazioni, segnalazioni) | Reale; lingua/tema/pagamenti/ricevute = INCOMPLETE dichiarato | YES | REAL_CURRENT + INCOMPLETE sotto-voci |
| `/nextgen/center-leads` | Reale | YES | REAL_CURRENT |

### 1.3 NEXTGEN — Partner/Admin (thin)

| Route | Gate | Deployed | Stato |
|---|---|---|---|
| `/nextgen/center` | login + ruolo `center_admin`/`platform_admin` | YES | REAL_CURRENT (minimale) |
| `/nextgen/admin` | login + ruolo `platform_admin` | YES | STUB ("La Control Room arriva nello Sprint 5", testo statico) |

### 1.4 TRAMA ONE shell (`/one`, `/center/one`, `/admin/one`)

| Route | Gate | Fallback se flag off | Nav entry | Deployed | Stato |
|---|---|---|---|---|---|
| `/one` | `TRAMA_ONE_ENABLED` | `redirect("/")` | — | YES | REAL_CURRENT (shell minimale) |
| `/center/one`, `/center/one/onboarding` | `TRAMA_ONE_ENABLED` | `redirect("/center")` | **NESSUNA** in `app/center/layout.tsx` (11 voci sidebar, zero link a `/center/one`) | YES | **DEAD_OR_ORPHAN** (raggiungibile solo da redirect condizionato o URL diretto) |
| `/admin/one`, `/admin/one/onboarding` | `TRAMA_ONE_ENABLED` | `redirect("/admin")` | `/admin/one` sì (sidebar condizionale); `/admin/one/onboarding` no (solo drill-in da Command Center) | YES | `/admin/one` REAL_CURRENT; `/admin/one/onboarding` DEAD_OR_ORPHAN di navigazione diretta |

Con lo stato flag odierno (globale OFF, `role=platform_admin` ON, `cohort=trama-one-controlled-beta` ON fino al 2026-10-02): solo platform_admin e membri del cohort vedono questa superficie; chiunque altro viene rimandato silenziosamente a LEGACY.

### 1.5 LEGACY — Partner (`app/center/*`)

| Route | Data source (PRODUZIONE oggi, `6d7b102`) | Deployed (fix) | Stato |
|---|---|---|---|
| `/center` (dashboard root) | **100% `lib/mock-data.ts`** (centro fisso `demoCenterAdminCenterId`, prenotazioni/promozioni/ricavi finti), **nessun banner** | Fix reale in repo (`e9bf05a`), **NON deployato** | **MOCK_DEMO in produzione, undisclosed — P0** |
| `/center/activities` (+`[id]`, `new`, `[id]/calendar`) | Reale | YES | REAL_CURRENT |
| `/center/profile`, `/center/promotions`, `/center/attendance`, `/center/report-presenze`, `/center/prenotazioni`, `/center/group-requests`, `/center/richieste`, `/center/invites`, `/center/account*` | Reale | YES | REAL_CURRENT |
| `/center/servizi-consigliati` | Lista statica curata (non mock DB) | YES | REAL_CURRENT (STATIC_CONFIGURATION) |

### 1.6 LEGACY — Admin (`app/admin/*`)

| Route | Data source (PRODUZIONE oggi) | Deployed (fix) | Stato |
|---|---|---|---|
| `/admin` (dashboard root) | **100% `lib/mock-data.ts`**, nessuna disclosure | Fix `c27b5c3`, **NON deployato** | **MOCK_DEMO, undisclosed — P0** |
| `/admin/activities` | **100% mock**, nessuna disclosure | Fix `c27b5c3`, **NON deployato** | **MOCK_DEMO, undisclosed — P0** |
| `/admin/analytics` | Mista: `getGestoriActivitySummary()` reale + occupazione/tag/età/cross-sell mock, nessuna disclosure | Fix `c27b5c3`, **NON deployato** | MIXED_CURRENT_LEGACY, mock non dichiarato |
| `/admin/centers`, `/admin/centers/[id]` | Mock con badge parziale "Elenco demo" | Fix `1d698e8`, **NON deployato** | MOCK_DEMO, parzialmente dichiarato |
| `/admin/bookings` | Reale (fix pre-esistente) | YES | REAL_CURRENT |
| `/admin/tags`, `/admin/certifications`, `/admin/preferiti`, `/admin/presenze`, `/admin/richieste`, `/admin/group-requests`, `/admin/partner-offers`, `/admin/center-leads`, `/admin/segnalazioni-beta`, `/admin/feature-flags` | Reale | YES | REAL_CURRENT |
| `/admin/legal` | Reale, view-only su `legal_documents` | **NO** | REAL_CURRENT (non ancora live) |

### 1.7 Cross-tenant / utility

| Route | Stato | Deployed |
|---|---|---|
| `/auth/login`, `/auth/reset-password`, `/auth/candidati(+conferma)` | REAL_CURRENT | login: parzialmente NO (wiring Legal Gate) |
| `/auth/callback` (route.ts) | REAL_CURRENT, fail-closed su Legal Gate | **NO** |
| `/auth/legal-pending` | REAL_CURRENT (READY_OFF, flag off) | **NO** |
| `/privacy`, `/terms` | REAL_CURRENT (READY_OFF, 0 documenti pubblicati) | **NO** |
| `/booking/[id]`, `/booking/[id]/success` | REAL_CURRENT | YES |
| `/activity/[id]` | REAL_CURRENT (condiviso Legacy+NextGen) | fix recenti **NO** |
| `/calendar-center/[activityId]` | REAL_CURRENT | YES |
| `/share/planner/[token]` | REAL_CURRENT, pubblico read-only | YES |
| `/internal/beta-pipeline` (route.ts) | INTERNAL_ONLY, cron service-role | YES |

---

## 2. LEGACY REDIRECT GRAPH (sezione P0)

**Nessun caso di "TRAMA ONE → LEGACY" raggiungibile da un click utente ordinario**: `/one`, `/center/one`, `/admin/one` non sono linkate da nessun nav tranne `/admin/one` (condizionale). Sono tutte FEATURE OFF → LEGACY FALLBACK per *redirect automatico*, non per click:

| Source | Azione utente | Destinazione | Classificazione |
|---|---|---|---|
| `app/one/layout.tsx` | visita `/one` con flag off | `redirect("/")` | FEATURE OFF → LEGACY FALLBACK |
| `app/center/one/layout.tsx` | visita `/center/one` con flag off | `redirect("/center")` | FEATURE OFF → LEGACY FALLBACK |
| `app/admin/one/layout.tsx` | visita `/admin/one` con flag off | `redirect("/admin")` | FEATURE OFF → LEGACY FALLBACK |
| `app/center/page.tsx:maybeRedirectToOnboarding` | center_admin con onboarding incompleto, flag ON | `redirect("/center/one/onboarding")` | deep-link condizionato (solo per platform_admin/cohort) |

**`/center/one` è orfana**: la sidebar Partner (11 voci) non contiene alcun link. Raggiungibile solo da URL diretto o dal redirect condizionato sopra.

### NextGen ↔ Legacy (già risolti, verificati deployati)

| Source | Azione | Destinazione (storica, fino al 24/08) | Stato oggi |
|---|---|---|---|
| `NextgenBottomNav.tsx` "Prenotazioni" | tap bottom nav | puntava a `/prenotazioni` (LEGACY) | **Corretto** → `/nextgen/prenotazioni`, deployato |
| `NextgenBottomNav.tsx` "Profilo" | tap bottom nav | puntava a `/profile` (LEGACY) | **Corretto** → `/nextgen/profile`, deployato |

`VersionToggle.tsx` — bottone "Passa a NextGen/Torna a V1": comportamento dichiarato, non un leak, ma senza mapping 1:1 pagina-per-pagina (atterra sempre sulla Home dell'altro prodotto).

### CURRENT → MOCK (non dichiarato, in produzione oggi)

| Source | Azione | Destinazione | Classificazione |
|---|---|---|---|
| Login platform_admin | apre `/admin` | dati mock, nessun banner | **CURRENT → MOCK (undisclosed)** |
| Login center_admin | apre `/center` | centro/prenotazioni/promozioni finti, nessun banner | **CURRENT → MOCK (undisclosed) — P0 più grave dell'audit** |

### CURRENT → INCOMPLETE (dichiarato, basso rischio)

`profile_language_theme`, `payment_methods`, `receipts_invoices`, `prenotazioni_calendar_view`, `reminders_calendar_maps_integration`, `groups_discover_invites` — badge "Non ancora attivo/in arrivo", nessun fallback silenzioso.

### CURRENT → DEAD ROUTE / orfane

`/center/one` (nessuna voce nav), `/admin/one/onboarding` (solo drill-in da Command Center), `/nextgen/planner/logistica` (shim deprecato, nessun link).

### Auth/session fail-closed (Legal Gate, NON deployato)

`app/auth/callback/route.ts`: account nuovo con Termini non accettati → `redirect("/auth/legal-pending")`; successo → destinazione originale; nessuna sessione → `redirect("/auth/login")`.

---

## 3. VISUAL LEGACY VS TECHNICAL LEGACY

| Dipendenza | Classificazione | Nota |
|---|---|---|
| Dashboard mock Admin/Partner in produzione | **LEGACY_DATA_MODEL + LEGACY_BLOCKING_EVOLUTION** | Rotto oggi per un utente reale, non solo debito tecnico — priorità massima |
| Convivenza Legacy/NextGen senza enforcement | **LEGACY_NAVIGATION + LEGACY_TECH_DEBT_ONLY** | Stabile ma oneroso da mantenere; nessun rischio immediato per l'utente finché il cookie funziona |
| `activities.spots_left` mai sincronizzato | **LEGACY_DATA_MODEL** | Documentato, rischio MEDIO, non blocca |
| Modello "richiesta non riserva" | **LEGACY_LOGIC** | Di design (DEC-42), non un bug, ma mai spiegato al Parent in UI |
| `/nextgen/planner/logistica` redirect shim | **LEGACY_TECH_DEBT_ONLY** | Invisibile, nessun link attivo — KEEP THROUGH BETA |
| `/center/one`, `/admin/one/onboarding` orfane | **LEGACY_NAVIGATION** residuo di costruzione incrementale | Basso rischio, non user-facing per chi non ha il flag |
| `/nextgen/admin` stub statico | **LEGACY_COMPONENT** (placeholder mai sostituito) | Basso rischio, nessuna promessa fatta su quella pagina |

Nessuna di queste dipendenze, eccetto la prima, richiede una riscrittura urgente: il criterio "Legacy invisibile, stabile e coerente = KEEP THROUGH BETA" si applica a tutte tranne il finding P0.

---

## 4. Indice file per verifica indipendente

`lib/feature-flags/registry.ts` (registry, 2 flag: `TRAMA_ONE_ENABLED`, `LEGAL_TERMS_GATE`) · `lib/feature-flags/resolve.ts`/`evaluate.ts` (precedenza user>role>cohort>tenant>environment>global) · `lib/feature-registry/catalog.ts` (registro canonico mock/demo, 9 stati) · `components/VersionToggle.tsx` (cookie `bk_version`) · `app/admin/layout.tsx:14-37,76-85` (nav Admin) · `app/center/layout.tsx:102-173` (nav Partner, nessun link a `/center/one`) · `components/BottomNav.tsx` / `components/nextgen/NextgenBottomNav.tsx` (bottom nav, nessun cross-link residuo).
