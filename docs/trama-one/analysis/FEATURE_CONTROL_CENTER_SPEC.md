# TRAMA ONE — Feature Control Center, specifica (Addendum Sezione B)

Documento richiesto esplicitamente dal REALIGNMENT ADDENDUM (05/08/2026), Sezione 4/11: completare l'Admin Feature Control Center secondo la tassonomia tipizzata a 9 stati, le azioni batch con rollback, il banner demo-mode per le funzionalità MOCK_DEMO. Riusa integralmente l'infrastruttura già esistente (`/admin/feature-flags`, `lib/feature-flags/registry.ts`, `lib/feature-flags/resolve.ts`, `app/actions/feature-flag-overrides.ts`, `lib/feature-registry/catalog.ts`) — **nessun secondo motore di flag costruito**, come richiesto esplicitamente dall'Addendum.

## 1. Tassonomia — da 5 a 9 stati

La Sezione 4/5 originale (28/07-04/08) definiva 5 stati (`live`/`beta_gated`/`coming_soon`/`hidden_no_nav`/`mock_fallback`). L'Addendum ne richiede 9, in maiuscolo: `LIVE`/`BETA_ENABLED`/`READY_OFF`/`MOCK_DEMO`/`INCOMPLETE`/`BLOCKED`/`EXPIRED`/`POST_BETA`/`DEPRECATED`.

Mapping applicato (`lib/feature-registry/catalog.ts`, ogni voce ha il ragionamento specifico accanto in un commento):

| Vecchio stato | Nuovo stato | Motivo |
|---|---|---|
| `live` | `LIVE` | Corrispondenza diretta. |
| `beta_gated` | `BETA_ENABLED` | La Controlled Beta Cohort è oggi attivamente abilitata (override globale + coorte, MVP_PRODUCTION_TRUTH_V2.md §6) — non `READY_OFF`, che descrive un flag spento per chiunque. |
| `hidden_no_nav` (Spotlight restart) | `BETA_ENABLED` | Stessa famiglia/stesso flag del tour Spotlight, non una categoria residuale a sé. |
| `coming_soon` | `INCOMPLETE` | Badge "in arrivo" = nessuna logica reale completa dietro, non un interruttore spento su una feature altrimenti pronta. |
| `hidden_no_nav` (RoleSwitcher) | `BLOCKED` | Blocco strutturale e **permanente** (utility di sviluppo, si nasconde da sola con Supabase configurato) — non temporaneo. |
| `hidden_no_nav` (redirect shim Logistica) | `DEPRECATED` | Superata da Famiglia (Sprint 7), mantenuta solo per compatibilità bookmark. |
| `mock_fallback` | `MOCK_DEMO` | Corrispondenza diretta. |

`READY_OFF`, `EXPIRED`, `POST_BETA` sono tipizzati ma **nessuna voce del catalogo li usa oggi** — non c'è ancora una funzionalità Beta disattivata per tutti, un override scaduto in modo permanente, o una funzionalità promossa oltre la fase Beta. Restano nello schema per quando accadrà, non forzati su voci che non corrispondono.

## 2. Metadata per-feature aggiunti

`FeatureCatalogEntry` guadagna due campi opzionali:

- `riskLevel?: "low" | "medium" | "high"` — dichiarato esplicitamente solo dove non ovvio (oggi solo le 4 voci `MOCK_DEMO`, che già avevano il rischio in prosa nel campo `note`).
- `demoBannerRequired?: boolean` — vero solo per `activities_mock_fallback`, l'unica voce il cui fallback può attivarsi anche con Supabase **configurato** (le altre 3 voci `MOCK_DEMO` scattano solo senza Supabase configurato, condizione in cui l'intera app è già coerentemente in modalità demo — un banner locale sarebbe rumore).

## 3. Azioni batch — "Attiva tutte le Beta pronte" / rollback

Nuove azioni in `app/actions/feature-flag-overrides.ts`:

- `batchActivateBetaFeaturesAction({ scopeType, scopeValue })`
- `batchDeactivateBetaFeaturesAction({ scopeType, scopeValue })` — rollback esatto, stesso scope

Entrambe operano su `getBetaEnabledFlagNames()` (Sezione 5, dedup dei `flagName` con stato `BETA_ENABLED` nel catalogo) invece di un elenco scritto a mano: oggi risolve sempre a `["TRAMA_ONE_ENABLED"]` perché è l'unico flag che governa voci Beta, ma resta corretto se in futuro una seconda funzionalità Beta userà un flag diverso, senza dover toccare questo file.

Semantica:
- **Attiva**: per ogni flag Beta, crea un override `enabled:true` allo scope scelto se non esiste, altrimenti riattiva quello esistente (mai un duplicato — rispetta `idx_feature_flag_overrides_unique`).
- **Disattiva**: per ogni flag Beta, se esiste un override a quello scope lo imposta `enabled:false`; se non esiste non fa nulla (è già "off" per il default sicuro del registry — non un errore).

RBAC: nessuna nuova policy — le stesse azioni scrivono su `feature_flag_overrides`, già protetta da `is_platform_admin()` in RLS (`migration_07_feature_flags_foundation.sql`); un non-Admin riceve lo stesso messaggio leggibile (`friendlyError`) delle azioni CRUD esistenti.

**Conferma rinforzata per scope `global`**: l'Addendum richiede una conferma più forte per l'azione che impatta tutti gli utenti. UI (`FeatureFlagsAdminClient.tsx`, `BatchBetaControls`): scope `global` richiede di scrivere testualmente `GLOBAL` in un campo prima che il bottone esegua l'azione; gli altri scope (environment/user/role/tenant/cohort) usano un `window.confirm()` con lo scope e il valore mostrati esplicitamente. Nessuna delle due conferme è bypassabile lato client senza modificare il codice sorgente servito.

## 4. Banner demo-mode (MOCK_DEMO)

`isMockActivitiesArray()` (`lib/data/activities.ts`) rileva per riferimento se `getActivities()` è ricaduta sui dati finti (`mockActivities` è un array importato stabile, restituito sempre come lo stesso oggetto quando scatta il fallback — nessuna modifica a `getActivities()` stessa, zero rischio sui suoi 9 punti di chiamata esistenti).

`MockDataBanner` (nuovo componente, `components/MockDataBanner.tsx`) è cablato oggi in **2 punti** (i più visibili, primo contatto di un utente): Home Legacy (`app/(main)/page.tsx`) e Home NEXTGEN (`app/nextgen/HomeDashboardClient.tsx`), mostrato solo quando Supabase è configurato ma il fallback è comunque scattato (il caso "RISCHIO ALTO" originale).

**Deliberatamente non fatto in questo passaggio** (stesso principio conservativo già usato per `lib/journey-context.ts`, Sezione 8): propagare il controllo agli altri 7 punti di lettura di `getActivities()` (Ricerca Legacy/NEXTGEN, Planner, Community, Preferiti, Gruppi, pagina centro). Nessuno di questi è il primo punto di contatto di un utente nuovo, e toccarli tutti in un solo passaggio avrebbe un raggio d'azione che l'Addendum stesso chiede di evitare senza una ragione concreta per farlo ora.

## 5-bis. Requisito → stato (aggiornamento SAL Checkpoint, 05/08 pomeriggio)

As-of commit `8335d3b920b3694ba0b15cc8be45c17db89dfd0b`.

| Requisito | Previsto | Implementato | Verificato | Gap |
|---|---|---|---|---|
| Tassonomia a 9 stati tipizzati | Sì | Sì | Statico (tsc/eslint) | Nessuno stato usa ancora `READY_OFF`/`EXPIRED`/`POST_BETA` |
| Metadata per-feature (riskLevel/demoBannerRequired) | Sì | Sì | Statico | Solo le voci MOCK_DEMO dichiarano `riskLevel` esplicito |
| Azioni platform_admin-scoped | Sì | Sì | Statico | Nessun run live |
| Batch attiva/disattiva Beta con rollback | Sì | Sì | Statico + 3 test puri (eseguiti) + 1 E2E (scritto, non eseguito) | Nessun run live end-to-end |
| Conferma rinforzata scope globale | Sì | Sì | Statico | Nessun run live |
| Banner demo-mode MOCK_DEMO | Sì | Parziale (2/9 call site) | Statico | 7 call site restanti non coperti, deliberato (vedi §4) |
| Audit trail azioni batch | Parziale | `created_by`/`updated_by` sulla riga override | Statico | Nessun evento esplicito "batch eseguito da X" |
| RBAC | Sì | Sì (RLS invariata) | Statico | Nessun run live con utente non-Admin |

## 5. Cosa NON è stato fatto (onestamente, esplicito)

- **Nessun secondo motore di flag**: le azioni batch sono wrapper sopra `feature_flag_overrides`, non una tabella/servizio nuovo.
- **Nessuna migrazione SQL**: nessuno schema è cambiato, solo codice applicativo e un file di documentazione.
- **`READY_OFF`/`EXPIRED`/`POST_BETA`** restano tipizzati ma senza dati reali dietro — saranno popolati quando accadrà l'evento che descrivono (una Beta disattivata, un override scaduto in modo permanente, una promozione a Live).
- **Rollout completo del banner demo-mode**: 2 punti su 9, per design (vedi §4).
