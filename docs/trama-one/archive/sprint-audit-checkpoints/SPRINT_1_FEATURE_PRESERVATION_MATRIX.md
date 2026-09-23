# TRAMA ONE Build Sprint 1 — Matrice pagina-per-pagina / route-per-route

Artefatto obbligatorio prerequisito richiesto da `SPRINT_GOVERNANCE.md` (Feature Preservation Gate) e da `ASSUMPTION_LOG.md` V5, da produrre prima dell'avvio di Build Sprint 1. Copre tutte le route Partner/Admin realmente coinvolte dallo scope di questo sprint (state machine Center, verifica identità, checklist, Admin review, motore Walkthrough), verificando che nessuna capability AS-IS venga toccata, indebolita o rimossa.

## Metodo

Per ogni route AS-IS che si trova nello stesso perimetro di prodotto (onboarding/profilo Partner, gestione centri Admin) è verificato: file/componenti coinvolti, se lo sprint la tocca, e come resta preservata. Le nuove route TRAMA ONE sono elencate separatamente, tutte interne alle shell `/one` già create in Sprint 0 e dietro `TRAMA_ONE_ENABLED`.

## Route AS-IS nel perimetro (verificate, nessuna modificata)

| Route AS-IS | File | Sprint 1 la tocca? | Note di preservazione |
|---|---|---|---|
| `/center/profile` | `app/center/profile/page.tsx`, `CenterProfileClient.tsx`, `lib/data/center-admin.ts` | No | Pagina profilo centro (nome, città, contatti, sconti) invariata; lo stato onboarding TRAMA ONE vive in una tabella separata (`center_onboarding_state`), non in `centers` |
| `/center/activities`, `/center/activities/new`, `/center/activities/[id]` | Wizard attività esistente | No | Riga #18 `FEATURE_PARITY_MATRIX.md`: REUSE, responsabilità Sprint 1-2 ma nessuna modifica al wizard in QUESTO sprint (solo la state machine di onboarding del Centro, non del catalogo attività) |
| `/center/promotions` | `PromotionsClient.tsx` | No | Fuori perimetro Sprint 1 |
| `/center/invites` | `InvitesClient.tsx` | No | Fuori perimetro Sprint 1 |
| `/admin/centers`, `/admin/centers/[id]` | `app/admin/centers/page.tsx` (dati mock `lib/mock-data`), `[id]/page.tsx` | No | Lista/dettaglio centri esistente non modificata; le nuove Admin review cards vivono in `/admin/one`, una superficie separata |
| `/admin/certifications` | `CertificationsAdminClient.tsx`; `activity_certifications` | No | Riga #17 `FEATURE_PARITY_MATRIX.md`: REUSE, coda di approvazione invariata; il pattern (coda + decisione + audit) viene osservato come riferimento per l'Admin review di questo sprint, non modificato |
| `public.centers` (tabella) | `supabase/schema.sql` | No | Nessuna colonna aggiunta/alterata; lo stato onboarding è una tabella satellite additiva referenziata da `center_id`, per lo stesso principio già applicato in Sprint 0 (nessuna modifica a `profiles`/`centers` per il Feature Flag Engine) |
| `public.is_platform_admin()` | `supabase/schema.sql` | Riusata, non modificata | Le nuove funzioni SECURITY DEFINER di transizione stato la richiamano per il ramo Admin, stesso pattern Sprint 0 |
| `public.current_center_id()` | `supabase/schema.sql` | Riusata, non modificata | Le nuove funzioni la richiamano per verificare che il chiamante center_admin sia il proprietario del centro |

## Route/oggetti NUOVI introdotti da Sprint 1 (tutti dietro `TRAMA_ONE_ENABLED`, tutti interni alle shell `/one` già esistenti)

| Nuovo elemento | Tipo | Perimetro |
|---|---|---|
| `/center/one/onboarding` | Route (Partner) | Stato onboarding, checklist, verifica identità, submit |
| `/admin/one/onboarding` | Route (Admin) | Review cards, decisione, audit |
| `/one` (walkthrough demo) | Estensione della shell Parent esistente | Dimostrazione minima motore Walkthrough generico (step benvenuto/completamento profilo) |
| `center_onboarding_state` | Tabella | Stato macchina a stati Center |
| `center_onboarding_checklist_completions` | Tabella | Checklist onboarding |
| `center_identity_verifications` | Tabella | Verifica identità |
| `center_onboarding_audit_log` | Tabella | Audit transizioni |
| `tutorial_progress` | Tabella | Motore Walkthrough generico (riusabile per qualunque `tutorial_key`, non solo onboarding Center) |
| `public.center_claim_onboarding()`, `public.center_submit_onboarding()`, `public.admin_review_center_onboarding()` | Funzioni SECURITY DEFINER | Transizioni di stato controllate lato server, nessuna RLS UPDATE aperta lato client |

## Classificazione capability AS-IS coinvolte per contiguità di dominio

| Capability | Classificazione | Motivazione |
|---|---|---|
| Profilo Centro (`/center/profile`) | RETAIN_AS_IS | Nessuna modifica; lo stato onboarding è un dominio separato |
| Wizard attività Partner | RETAIN_AS_IS (in questo sprint) | Confermata REUSE per Sprint 1-2 nella matrice generale, ma nessuna riga toccata in Sprint 1: la state machine Center non modifica `activities` |
| Lista/dettaglio Centri Admin | RETAIN_AS_IS | Superficie Admin separata (`/admin/one/onboarding` è nuova, non sostituisce `/admin/centers`) |
| Coda approvazione Certificazioni | RETAIN_AS_IS | Pattern osservato per coerenza UX, implementazione indipendente |

## Aggiornamento — Audit Remediation (migration_10, trigger auto-LEAD)

L'audit esterno di Sprint 1 ha richiesto la chiusura di un gap: nessun meccanismo creava automaticamente una riga `LEAD` in `center_onboarding_state` per i centri creati DOPO Sprint 1 (la convenzione "riga assente = APPROVED", corretta per i centri pre-esistenti, si applicava indistintamente anche a quelli nuovi — DEC-25). Introdotto un trigger `AFTER INSERT` su `public.centers` (`migration_10_center_onboarding_auto_lead.sql`).

| Route/oggetto AS-IS coinvolto | Sprint 1 Remediation lo tocca? | Note di preservazione |
|---|---|---|
| `public.centers` (tabella) | Sì, ma solo in AGGIUNTA: un trigger `AFTER INSERT` | Nessuna colonna aggiunta/alterata, nessun trigger su UPDATE/DELETE, nessun cambiamento di comportamento per le righe già esistenti (il trigger si attiva solo su nuovi INSERT, mai retroattivamente) |
| `app/actions/admin.ts` → `createCenterAndAssignAction()` | No | Nessuna modifica: continua a fare un semplice INSERT su `centers`; il trigger si attiva automaticamente, in modo trasparente al codice applicativo |
| `supabase/seed.sql`, `supabase/seed-test-data.sql` | No (comportamento invariato) | Gli script di seed continuano a funzionare senza modifiche; dopo l'applicazione di migration_10 ogni nuovo centro che inseriscono riceverà anch'esso automaticamente una riga LEAD (comportamento collaterale accettabile, coerente con l'obiettivo del trigger di coprire OGNI canale di inserimento) |
| Centri pre-esistenti (creati prima di migration_10) | No | Nessun backfill, nessuna riga retroattiva — confermato dal post-check della migrazione (conteggio `center_onboarding_state` invariato subito dopo il commit) |

## Esito

Nessuna capability AS-IS risulta a rischio. Tutte le nuove tabelle/funzioni sono additive e referenziano `centers`/`profiles` solo in lettura tramite chiave esterna, senza alterarne lo schema. Tutte le nuove route sono interne alle shell `/one` già dietro flag, il cui fallback a `TRAMA_ONE_ENABLED=false` resta quello certificato in Sprint 0. Verifica V5 di `ASSUMPTION_LOG.md` soddisfatta: matrice prodotta prima dell'avvio dell'implementazione. Il trigger introdotto dalla Audit Remediation (migration_10) è additivo, non retroattivo, e non altera alcun comportamento AS-IS su `public.centers`.
