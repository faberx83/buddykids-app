# TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL
## Architecture Audit + Claude Effort Estimate

**Status: ANALYSIS ONLY. Nothing in this report has been implemented.** No code was written, no branch created, no migration applied, no flag registered, no Supabase/Vercel setting touched, no commit made. `git status` in the repository was clean throughout this research (verified below, §2).

This report evaluates whether TRAMA should adopt a **trunk-based, dark-release model**: all new capabilities built and deployed to production on `main` only, invisible to real users behind runtime feature flags, visible first only to an INTERNAL cohort (you + a small allowlist you control), promoted INTERNAL → PILOT → GLOBAL entirely from the Admin UI with no new deploy — as an alternative to the separate-environment "Evolution Lab" model from the prior report.

---

## 1. Executive summary

The central finding of this research changes the shape of the recommendation: **you already built most of the infrastructure this report was asked to design.** What the original Evolution Lab report treated as a 2-flag, no-UI feature-flag system is, after actually reading the code, a considerably more mature release-control system:

- A full CRUD Admin UI for flag overrides, with audit trail (who/when), expiry management, and a purpose-built "expiring soon" alert — built specifically to prevent a repeat of a real incident (TC-N409: an override expired silently, nobody noticed).
- A canonical **Feature Registry** (`lib/feature-registry/catalog.ts`) with a **9-state lifecycle** (`LIVE`, `BETA_ENABLED`, `READY_OFF`, `MOCK_DEMO`, `INCOMPLETE`, `BLOCKED`, `EXPIRED`, `POST_BETA`, `DEPRECATED`) that already covers most of what this report was asked to design as a "feature lifecycle model" (§16).
- A working **beta cohort system** with self-service invite codes (`?beta=CODE` URL, auto-enrollment on signup) and an Admin **Pilot dashboard** tracking who is in the cohort and what they've actually done.
- A working **deploy notification pipeline** (`deploy_events`, `/internal/deploy-notify`, Admin banner) that already answers "did the last deploy succeed" without a terminal.
- Batch activate/deactivate actions for "every Beta-ready feature" with a typed `"GLOBAL"` confirmation gate for the highest-blast-radius scope.

None of this was purpose-built for a dark-release model — it was built incrementally for TRAMA ONE's Beta rollout — but it is, almost entirely, the same mechanism a dark-release model needs. This report's job shifts from "design a release control system" to "extend an existing one, honestly, with the gaps named precisely."

**Preview of the verdict** (full recap in §32): **GO WITH CONDITIONS.** The model is sound for additive, flag-off-by-default capabilities that don't touch existing production tables. It needs one real new concept (an `internal_preview` scope, distinct from the existing cohort mechanism, for pre-Beta visibility) and one piece of honest hardening (`deploy.sh`'s `vercel --prod`-publishes-working-tree gap) before it's safe to use for capabilities that write to new tables from cron/webhooks. Two of the eight proposed capabilities (Delegations, Location Strategy) need a stricter path than "just add a flag" — detailed in §14.

---

## 2. Method and verification scope

This report is grounded in files actually read and a live, read-only Supabase check — not assumption. Everything cited below was opened in full during this research pass (this session), not carried over from memory of the prior report:

- `lib/feature-flags/registry.ts`, `evaluate.ts`, `resolve.ts` (full)
- `lib/beta-cohorts/membership.ts` (full)
- `supabase/migration_07_feature_flags_foundation.sql`, `migration_08_beta_cohort_memberships.sql`, `migration_30_beta_invite_codes.sql`, `migration_33_deploy_events.sql` (full)
- `app/admin/feature-flags/page.tsx`, `FeatureFlagsAdminClient.tsx` (full, 559 lines), `lib/data/feature-flag-overrides.ts` (full), `app/actions/feature-flag-overrides.ts` (full)
- `lib/feature-registry/catalog.ts` (full, 456 lines — the canonical Feature Registry)
- `app/admin/one/page.tsx` (Command Center), `app/admin/one/pilot/PilotAdminClient.tsx` (Pilot dashboard)
- `app/actions/kids.ts` (real Server Action gating precedent)
- `lib/telemetry/known-events.ts` (product_events whitelist)
- `deploy.sh` (full, re-read this pass for the notify/hardening sections)
- A repo-wide grep for changelog/release-notes/version-tracking precedent (§10)
- `docs/trama-one/package/TRAMA_DOCUMENTATION_CHANGELOG.md` (to characterize what kind of changelog already exists)

**No write action occurred.** No `Write`/`Edit` call touched anything under the repository during this research; no `apply_migration`/`execute_sql` write call was made (Supabase access this session was read-only, consistent with standing governance); no `git` mutation command was run. This report itself was written to a path outside the repository, exactly as the Evolution Lab report was.

Where a claim could not be verified from code (e.g., exact kill-switch propagation latency in a live browser session, §26), it is marked **ASSUMPTION TO VALIDATE** rather than stated as fact — consistent with your "code + current DB beats historical documentation" principle and the "no false precision" instruction.

---

## 3. The existing feature-flag engine — re-verified

Two layers, cleanly separated:

**Registry (code, `lib/feature-flags/registry.ts`)** — today exactly 2 flags: `TRAMA_ONE_ENABLED` and `LEGAL_TERMS_GATE`, both `defaultValue: false`. Adding a flag is a one-line addition to a typed object; no migration required for the flag itself.

**Runtime overrides (DB, `feature_flag_overrides`)** — the only way to turn a flag on for anyone is a row in this table. Six scopes: `global`, `environment`, `user`, `role`, `tenant`, `cohort`.

**`evaluateFlag()`** (`lib/feature-flags/evaluate.ts`) is a pure function, fully unit-tested, zero I/O. **Re-verified this pass**: the scope precedence array is

```
user > role > cohort > tenant > environment > global
```

read directly from `SCOPE_PRECEDENCE` in `evaluate.ts`. This confirms the claim made in the prior Evolution Lab report — it was not re-derived from memory, it was re-read from the source this session. Scope-value matching normalizes via `lower(trim())` for every scope except `user` (exact UUID) and `global` (always `null`).

**`resolveFeatureFlag()`** (`lib/feature-flags/resolve.ts`, server-only) does the actual DB read via `createServiceClient()` (service_role, bypasses RLS) and **fails safe to `false`** on any error, exception, or unknown flag name. This fail-closed behavior is the single most important property for a dark-release model: a bug in the flag-resolution path hides a feature, it never accidentally reveals one.

**Expired-override detection** (`findRecentlyExpiredMatchingOverride`, 72h grace window): distinguishes "no override ever existed" from "an override just expired" and persists a distinct `product_events` row (`feature_flag_silent_fallback_expired_override`) instead of silently returning `false` with no trace. This was built after a real incident (TC-N409, an expired `TRAMA_ONE_ENABLED` override went unnoticed) — it is the direct precedent for this report's "kill without realizing" risk (§30, R-07).

**Classification: REUSE, unchanged.** This layer needs zero new tables, zero new columns, zero schema changes to support dark release. It needs one new **scope value convention** (§12) — not new code.

---

## 4. `feature_flag_overrides` — schema and RLS, re-verified

From `migration_07_feature_flags_foundation.sql`: `id, flag_name, scope_type, scope_value, enabled, expires_at, created_by, updated_by, created_at, updated_at`, an `updated_at` auto-trigger, 3 unique indexes (one per: global, user, normalized-scoped), and 4 RLS policies (select/insert/update/delete) all gated on `is_platform_admin()`. A CHECK constraint (`feature_flag_scope_value_consistency`) already enforces "global has no value, every other scope requires one" **at the database level** — the Admin Server Actions (§ below) re-validate the same rule in application code before the insert, so a bad request gets a readable Italian error message instead of a raw Postgres error.

**Audit trail was not bolted on after the fact — it shipped with the table.** `created_by`/`updated_by` are populated by every write path (`createFeatureFlagOverrideAction`, `updateFeatureFlagOverrideAction`, `extendFeatureFlagOverrideAction`, the batch actions) from `supabase.auth.getUser()`, never trusted from client input. This is exactly the "confirmation/audit/timestamp/actor" requirement of §18 — already built, not proposed.

**Classification: REUSE, unchanged.**

---

## 5. The existing Admin Feature Flags UI — a major finding

This is the single biggest correction to the prior report's implicit assumption. `app/admin/feature-flags/FeatureFlagsAdminClient.tsx` (559 lines) is not a stub — it is close to a working "Release Control Room" already:

| Capability this report was asked to design | Already exists at |
|---|---|
| List every flag + every override, with status | `entries.map(...)`, `STATUS_LABEL` (active / expiring_soon / expired / no_expiry) |
| Toggle an override on/off | `toggleEnabled()` → `updateFeatureFlagOverrideAction` |
| Create a scoped override (any of the 6 scopes) | the per-flag "Aggiungi override" form, scope dropdown driven by `allowedScopes` |
| Extend an expiring override | `extend(flagName, id, 24)` / `extend(..., 24*7)` — "+24h" / "+7gg" buttons |
| Remove an expiry (make permanent) | `clearExpiry()` |
| Delete an override | `remove()` |
| Audit: who created/last touched, when | `Creato da {row.createdByEmail} il {formatDateTime(row.createdAt)} · ultima modifica di {row.updatedByEmail}...` — rendered on every override row |
| Warn before an expired override goes unnoticed | `hasAlert` badge ("⚠ Verificare scadenza"), computed from `status === "expiring_soon" \| "expired"` |
| One-click activate/deactivate **all** Beta-ready features for a scope | `BatchBetaControls` — `batchActivateBetaFeaturesAction` / `batchDeactivateBetaFeaturesAction`, discovering flags dynamically from the catalog (§6), not hardcoded |
| Extra confirmation for the highest-blast-radius action | typed `"GLOBAL"` text confirmation required for `scopeType === "global"`; `window.confirm()` for narrower scopes |
| A read-only "what exists, where, what state" view of every capability — flag-gated or not | `FeatureCatalogSection`, rendering `getFeatureCatalog()` (§6), filterable by area |

**Classification: REUSE for the mechanism (CRUD/audit/expiry/batch), EXTEND for two additions** this report needs on top of it: (a) an `internal_preview` scope value convention and a visual affordance for it (§12, §15), and (b) a promotion/demotion *workflow* concept — "move this flag's cohort scope from `internal-preview` to `pilot-wave-1` to nothing" — which today requires deleting one override and creating another manually (functionally possible today, not yet a guided one-click flow, §18).

---

## 6. The Feature Registry (`lib/feature-registry/catalog.ts`) — the lifecycle model already half-exists

This file is distinct from the flag registry (§3): it catalogs **every relevant capability**, flag-gated or not, with a status drawn from a 9-value enum:

```
LIVE · BETA_ENABLED · READY_OFF · MOCK_DEMO · INCOMPLETE · BLOCKED · EXPIRED · POST_BETA · DEPRECATED
```

Each entry carries: `key`, `label`, `area` (parent/partner/admin/cross_tenant), `status`, `description`, optional `flagName`, `sourceFiles` (traceability), optional `note`, optional `riskLevel`, optional `demoBannerRequired`. It is populated by hand from reading real code, not derived automatically — an explicit, stated design choice ("populated ONLY with entries verified by reading real code, not assumed").

This is materially the same shape as the "feature lifecycle state model in plain language" requested in §16 of the original spec. It is not identical — `READY_OFF`/`BLOCKED`/`MOCK_DEMO`/`DEPRECATED` describe *why* something is invisible, where a dark-release model needs to describe *how far along the rollout* something is — but it is close enough that inventing a parallel lifecycle model would fragment, not clarify. §16 below proposes extending this enum rather than replacing it.

**Classification: REUSE the mechanism (typed catalog, read-only Admin view), EXTEND the enum.**

---

## 7. Beta cohort system — membership, invites, and a real gap

`lib/beta-cohorts/membership.ts::getActiveCohortKeys(userId)` is server-only, uses the service client (bypasses RLS by design — no user, including the user themselves, has read access to their own cohort membership via a direct query), and fails safe to `[]` on any error.

`beta_cohort_memberships` (migration_08): `user_id, cohort_key, active, expires_at, created_by, updated_by, created_at, updated_at`, unique on `(user_id, cohort_key)`, RLS admin-only in all four directions — **no self-read policy exists on purpose**, so a user cannot discover or infer their own cohort membership by querying the table directly.

`beta_invite_codes` (migration_30) closes a real gap that existed until this migration: previously, getting a new user into the Beta cohort required Fabrizio to manually `INSERT` a row *after* they'd already registered. This migration adds self-service enrollment: a `?beta=CODE` URL parameter is captured at `supabase.auth.signUp()`, read by the existing `handle_new_user()` trigger, and used to atomically enroll the new profile into a cohort — with the new branch of that trigger wrapped in its own `BEGIN...EXCEPTION WHEN OTHERS THEN NULL...END` block so a bug in the Beta-enrollment logic **can never block registration itself** (the single highest-risk function in the app). A companion `get_beta_invite_preview()` function (security definer) lets the unauthenticated signup form show "valid invite / invalid invite" without ever exposing `redeemed_count` or `cohort_key` to an anonymous caller.

**This is directly reusable for an INTERNAL cohort.** The `cohort_key` column is free text — nothing stops using `cohort_key = 'internal-preview'` alongside the existing `'trama-one-controlled-beta'`, with a *second* invite code (e.g. a code Fabrizio never shares beyond his own test accounts) pointing at it. No schema change needed.

**Classification: REUSE, unchanged** — the cohort-scope mechanism in `evaluateFlag()` already resolves any `cohort_key` string; `internal-preview` is just a new string, not a new mechanism.

---

## 8. Command Center and Pilot Admin — re-verified at code level

`/admin/one` (`app/admin/one/page.tsx`) is a real aggregation page, not a placeholder: it pulls `getCommandCenterQueues()` (7 operational queues across onboarding/bookings/requests/center-leads/certifications/BETA reports/feature-flags), a walkthrough funnel, and links out to `/admin/one/pilot`. It is explicitly documented in its own comments as *not* a replacement for the per-domain Admin pages — "Separation of duties" is cited by name — it is an entry point with pre-computed priority, not a new place to act.

`/admin/one/pilot` (`PilotAdminClient.tsx`) already tracks, per user in the Beta cohort: registration date, role, cohort membership + active/inactive, onboarding status (not_started/in_progress/completed/skipped), first and last "meaningful action," last sign-in, and a derived status (`invited_registered` / `onboarding` / `activated` / `returning` / `not_yet_active`) — filterable. This is a working precedent for "who's actually using the thing I dark-released," directly relevant to an INTERNAL cohort's observability needs, though today it is scoped to the single Beta cohort key, not parameterized per cohort (§ extension note in §17).

**Classification: REUSE the pattern and most of the code paths; EXTEND to parameterize by cohort key instead of hardcoding the one Beta cohort, if an INTERNAL Admin view distinct from the Pilot view is wanted** (see §17 for the recommendation that it likely should not be a separate page).

---

## 9. `deploy_events` and `product_events` — re-verified, and already wired to a real notification path

`deploy_events` (migration_33): `id, status ('ok'|'ko'), branch, commit_sha, test_scope, test_result, message, created_at`. RLS: platform_admin-only *read*; there is **no insert/update/delete policy for authenticated users at all** — the only writer is the `/internal/deploy-notify` endpoint using the service_role key, called by `deploy.sh` itself via a `trap 'notify_deploy $?' EXIT` (so it fires on success, on a blocked preflight, or on any command failing under `set -e` — not just the happy path). The Admin app renders a banner from the latest row. `DEPLOY_NOTIFY_SECRET` is best-effort: if unset or the endpoint doesn't respond within 10s, the notification is silently skipped and **never blocks the deploy**.

`product_events` uses a **deliberate whitelist**, not a blacklist: `lib/telemetry/known-events.ts` (`KNOWN_PRODUCT_EVENTS`) lists exactly which event names are allowed to persist — an event not on the list still logs via `logTelemetryEvent()` (console) but is never written to the DB until someone consciously adds it, specifically to prevent an unreviewed field slipping past the "no PII" rule (`TELEMETRY_FORBIDDEN_FIELDS`). Today's whitelist: route access/fallback, the expired-flag-override event, walkthrough step events, Spotlight overlay events, `booking_created`, `group_created`/`group_joined`, `carpool_offer_created`/`carpool_request_created`, `checkin_push_cron_run`.

**This is directly reusable infrastructure for a "release" concept**: `deploy_events` already answers "what commit is live, did it work" at the *deploy* granularity; it says nothing about which *features* that deploy turned on. §19-21 build on top of this rather than duplicating it.

**Classification: REUSE, unchanged.**

---

## 10. Changelog / release notes / version tracking — searched, and a real gap confirmed

A repo-wide search for changelog/release-notes/version-tracking precedent found 15 files. Of those, the one that looks most relevant — `docs/trama-one/package/TRAMA_DOCUMENTATION_CHANGELOG.md` — is, on inspection, **a changelog of the *documentation package*, not of the product or its releases**: its entries read "Package version: v4 (OD-02 closed)", "As-of commit," and describe when requirement-catalog/traceability-matrix documents were updated to reflect newly-live features — a documentation-QA artifact, not a user- or Admin-facing release log.

**Conclusion: no source of truth for "what shipped, when, to whom" exists at the product level.** `deploy_events` says which commit deployed and whether it succeeded technically; the Feature Registry (§6) says what state each capability is in *right now*; neither says "release 2026-09-15 turned on School Calendar Intelligence for the internal cohort." This is a genuine, confirmed gap — not something to build a workaround for, but something §20 proposes closing with the smallest possible addition.

---

## 11. Real-world precedent for server-side capability gating

`app/actions/kids.ts` gates child creation on `LEGAL_TERMS_GATE` via `resolveFeatureFlag`, fail-closed, directly inside a Server Action — not just in page-level layout components. A grep across the repo (performed in the prior Evolution Lab research, not repeated here since the finding stands) found **30 files** already calling `resolveFeatureFlag`, spanning individual `page.tsx` files and Server Actions, not only the three top-level `/one` layouts. This matters because it means the pattern this report needs to formalize for capability isolation (§13) is not a new idea being introduced to the codebase — it is the dominant existing idiom, just not yet written down as a named pattern with a checklist.

---

## 12. Designing the INTERNAL_PREVIEW cohort mechanism

**Server-side.** No new mechanism needed — reuse `cohort` scope end-to-end (§3, §7):

1. A new, small, human-curated cohort key: `internal-preview` (or `internal-preview-<capability>` if per-capability isolation within the internal group is ever needed — not recommended to start, see below).
2. Membership assigned the same way `beta-wave-1` is assigned today: either a manual `INSERT` into `beta_cohort_memberships` (fastest, zero new code, matches how the *first* Beta cohort members were onboarded before invite codes existed), or a second `beta_invite_codes` row with `cohort_key = 'internal-preview'` and a code you never share outside your own test accounts (reuses migration_30's mechanism exactly, §7).
3. Every gated code path — Server Action, API route, cron job, notification/email/push send, webhook handler, DB write, external API call, analytics event — calls `resolveFeatureFlag(flagName, { userId, cohortKeys: await getActiveCohortKeys(userId) })` and treats `false` as "behave exactly as if this capability doesn't exist," per the existing fail-closed convention (§3). This is not new design — it is applying the existing `app/actions/kids.ts` pattern (§11) to every new surface, which is precisely what §13 formalizes as a named, checklist-backed pattern.

**Why not a boolean column or env var instead of the cohort mechanism:** a boolean column on `profiles` was explicitly considered and rejected for the *Beta* cohort (migration_08's own comment: "a column on `profiles` would be subject to existing RLS on that table, which might let the user update their own record and self-assign a beta cohort"). The same reasoning applies with equal force to an internal cohort — arguably more so, since an internal cohort by definition includes accounts with more system access than a random Beta parent.

**UI-side.** Nothing new: `resolveFeatureFlag` already determines what a layout/page renders. The one UI addition genuinely new to this report is the visible internal-preview label (§15) — a rendering concern, not a gating concern.

**Non-UI surfaces — the part actually new to this report.** The prior architecture's UI-gating precedent (§11) doesn't automatically cover:
- **Cron jobs** (`checkin-reminders`, `travel-reminders`): today these run unconditionally for everyone matching their query. A dark-released capability's cron must filter its own query by cohort membership (`WHERE user_id IN (SELECT user_id FROM beta_cohort_memberships WHERE cohort_key = 'internal-preview' AND active)`), or call `resolveFeatureFlag` per recipient before sending. This must be written explicitly per capability — it is not automatic.
- **Push/email sends**: same as cron — the *recipient list* must already be internal-cohort-filtered before `sendPushToUser`/email dispatch is called; there is no global "don't send to non-internal users" gate today, and building one would be riskier (one bug silently blocks *all* push, including already-live features) than filtering at the query that builds the recipient list.
- **Webhooks / external API calls**: any new capability that calls an external paid API (Google Maps, a calendar provider) must gate the *call itself*, not just the UI that would display the result — otherwise a dark feature can generate real external cost or a real external side-effect (e.g., writing to a third-party calendar) for zero visible benefit and zero visibility that it happened. This is the single most likely place for a "dark but not actually invisible" bug (§30, R-04).
- **Analytics/`product_events`**: writing a new event name to `product_events` for a dark-released capability is safe by construction — it only ever describes something a user *did*, and the whitelist (§9) means it must be added deliberately anyway.

---

## 13. One reusable capability isolation pattern

Rather than inventing a new abstraction, this report proposes formalizing what `app/actions/kids.ts` already does as a named, repeatable checklist — **"Gate at every I/O boundary, not just the render path"**:

1. Register the flag in `lib/feature-flags/registry.ts` with `defaultValue: false` and `allowedScopes` including `cohort`.
2. Every **page/layout** that renders the capability's UI resolves the flag server-side and returns a normal 404/redirect (not a broken page) when `false` — existing convention, unchanged.
3. Every **Server Action** that performs a write for the capability re-checks the flag itself, independent of whether the calling page already checked — because a Server Action is reachable directly, not only via the page that links to it (this is exactly why `app/actions/kids.ts` checks `LEGAL_TERMS_GATE` inside the action, not only in the form that calls it).
4. Every **cron/webhook/external-API call** filters its own working set by cohort membership before doing anything with side effects (§12).
5. Every **new DB table** for the capability ships with RLS that does not depend on the flag at all — RLS enforces *who owns this row*, the flag enforces *whether the feature is visible*; conflating the two would mean a flag bug becomes a data-access bug, which is strictly worse.
6. New `product_events` entries are added to the whitelist only when the event is capability-specific and PII-free — same review as every existing entry (§9).

This is not a new library or new code to write — it's the shape every future capability's implementation plan should be checked against before it's called "dark-release-safe."

---

## 14. SAFE-DARK-DEPLOY matrix, per proposed capability

Grounded in the actual data-model findings from the prior Evolution Lab research (re-cited here, not re-derived): `bookings.activity_id` is `NOT NULL` (verified via schema query — structurally cannot represent an external/manual activity), `parent_addresses` is free-text only with zero geocoding, `lib/nextgen/planner-map-estimate.ts` is an explicit, deliberately-labeled stub (hash-based fake distance, always shown as "stimato"), and School Calendar Intelligence (migration_26, 4 tables) is **already applied in production with 0 rows and zero application code referencing it** — a real, existing example of a dark-deployed-but-inert capability, useful as a live case study rather than a hypothetical.

| Capability | New tables? | Touches existing tables? | External API/cost? | Safe for dark deploy as designed | Notes |
|---|---|---|---|---|---|
| School Calendar Intelligence | Yes (4, already applied) | No (deliberately not on `kids`) | No (manual data entry) | **Yes — already proven safe** | Live evidence: 0 rows, 0 app references, flag never registered, zero incidents. The template for every other row here. |
| External Planner Items | Yes (`external_planner_items`, new) | Additive read into `computeWeekStatus` | No | **Yes, with care** | `bookings.activity_id NOT NULL` forces a separate table — correct choice, same reasoning as School Calendar. The risk is the *read-side* extension of `computeWeekStatus`: must be additive (new branch), never a rewrite of existing week-status logic, or a dark bug corrupts a status real users already see. |
| Personal Calendar Sync (Level 1, `.ics` export) | No | No | No | **Yes, trivially** | `lib/ics.ts` already does single-event `.ics` generation client-side; extending it to multi-event stays client-only, no server capability to gate at all beyond the UI entry point. |
| Personal Calendar Sync (Level 2+, live sync to Google/Apple Calendar) | Yes (sync tokens/state) | No | **Yes — OAuth + provider API** | **Conditional** | OAuth tokens are the first genuinely new *security* surface in this list — storing a third-party credential is a materially different risk class than every other table here. Recommend treating this sub-capability as needing a short, explicit security review before any dark deploy, not just a flag. |
| Delegations / Pickup Authorization | Yes | Possibly (depends on final design — identity verification pattern) | No | **No — needs the stricter path** | This is the one capability in the original list that plausibly touches who-can-pick-up-a-child. A flag bug here doesn't "reveal an unfinished feature" — it can misrepresent an authorization decision. This should not go dark-live until its authorization logic has been tested against real data outside a live child-safety-adjacent flow, regardless of how mature the flag mechanism is. |
| Smart Departure (time estimate) | Possibly (`travel_reminders` extension) | Extends existing `travel_reminders` (migration_36, one manual reminder/parent) | No (unless real routing API added) | **Yes, as long as it stays manual-time-based** | Becomes the same "Conditional" case as Calendar Sync Level 2 the moment a real routing API is introduced (new external cost + new failure mode); safe today because `travel_reminders.target_time` is manually set, never calculated. |
| Location Strategy | Depends on design | No (today, `parent_addresses` is free text, zero geocoding) | **Yes, if it ever adds real geocoding/Maps** | **No, not as currently scoped** | `planner-map-estimate.ts` is an intentional stub specifically because no real geocoding exists. Dark-deploying a capability whose entire value proposition depends on an integration that doesn't exist yet isn't really "dark deploy the code and flip a flag" — it's "build the integration first," a different and larger effort than this report's other rows. |
| Smart Handover | Depends on design | No | No (unless paired with Delegations) | **Yes, if kept independent of Delegations** | Safe on its own; becomes as sensitive as Delegations the moment it's designed to *authorize* a handover rather than just *notify* about one — worth deciding explicitly which of the two it is before writing the flag. |
| Delay Notification to Center | No (additive, likely reuses `sendPushToUser`/notification infra) | No | No | **Yes, trivially** | Same shape as the existing `checkin_push_cron_run`/push infrastructure — lowest-risk row in this table. |

**Reading this table**: 5 of 8 are safe today with the existing mechanism plus §13's checklist. 3 need something beyond "add a flag" — either a security review (Calendar Sync Level 2+), a stricter-than-flag safety bar because of child-safety adjacency (Delegations), or an integration that doesn't exist yet (Location Strategy). None of the 8 requires the separate-environment "Evolution Lab" model from the prior report *purely because of dark-deploy safety* — but Delegations and Location Strategy would each benefit from a design review independent of which deployment model TRAMA chooses.

---

## 15. Internal-only visual preview indicator — proposed wording

A small, persistent, unmistakable marker — not a modal, not a banner requiring dismissal (those get muscle-memory-dismissed and then ignored, the same failure mode `hasAlert` in the flags UI was built to prevent, §5). Proposed: a small pill, consistent position (e.g. bottom-left, above any existing floating action buttons), visible only when the resolved flag's *matching* override has `scope_type = 'cohort'` and `scope_value = 'internal-preview'` specifically (not just "any flag is on for me" — an internal tester should see this exact label, a real Beta pilot user should not):

> **"Anteprima interna — solo TRAMA"**

with a smaller secondary line on tap/hover:
> "Stai vedendo una funzionalità non ancora pubblica. Non è per i test con utenti reali."

Deliberately avoids "Beta" (already used, with a different meaning, by `TRAMA_ONE_ENABLED`'s cohort) and avoids "Demo" (already means something specific and risky elsewhere in this codebase — `MOCK_DEMO` status in the Feature Registry, §6, where it specifically means "fake data," a meaning that must not be conflated with "real data, early feature"). This is not implemented — a component name only, for when it's built: `InternalPreviewBadge`, following the existing `AdminMockDataBanner` naming convention (§6, catalog entries `admin_dashboard_root_mock` etc.) so the two "this isn't what it looks like" indicators in the codebase read as a family, not two unrelated inventions.

---

## 16. Feature lifecycle state model, in plain language

Extending the existing `FeatureStatus` enum (§6) rather than replacing it — adding the states this report needs, keeping every state already in production use:

| Stage | Plain-language meaning | Maps to |
|---|---|---|
| **DEVELOPMENT** | Being built. Doesn't exist in production yet at all. | Not yet in the catalog (pre-existing convention: entries are added only once real, reachable code exists) |
| **INTERNAL** | Code is live in production, but only you (and anyone you've explicitly added) can see it. Real data, real database, invisible to everyone else. | **New status** — proposed addition to `FeatureStatus`: `INTERNAL_PREVIEW` |
| **PILOT** | Visible to the existing Controlled Beta Cohort — the same audience `BETA_ENABLED` already describes today. | `BETA_ENABLED` — **unchanged, reused as-is** |
| **GLOBAL** | On for everyone, no flag gate left doing meaningful work (flag can stay in the registry for a fast rollback, but the default no longer matters because the global override is `true`). | `POST_BETA` — **already exists, currently unused by any entry** ("no feature has yet graduated from Beta") — this is the natural landing state |
| **DISABLED** | Was live at some stage, deliberately turned off — not broken, not incomplete, a decision. | `READY_OFF` (flag off for everyone, feature otherwise complete) — **already exists**, currently used for the Legal Gate pending content review |

The two states already in the enum that this model doesn't need to touch (`MOCK_DEMO`, `INCOMPLETE`, `BLOCKED`, `DEPRECATED`, `EXPIRED`) keep their current meanings — they describe *why* something isn't visible, not *how far along a release it is*, and conflating the two would make the catalog harder to read, not easier.

**One naming collision to resolve explicitly, not silently**: today, `BETA_ENABLED` is described in the catalog's own comments as covering "the Controlled Beta Cohort," and this report's PILOT stage is that same audience. Recommend **not** renaming `BETA_ENABLED` — it's referenced by name in 5+ catalog entries and the batch-activate mechanism (`getBetaEnabledFlagNames()`) — and instead treating "PILOT" as this report's vocabulary for the same underlying state, documented once, rather than a second status value.

---

## 17. Admin "Release Control Room" — design

**Recommendation: this should not be a new page.** Building a fifth Admin surface (after Command Center, Pilot, Feature Flags, Feature Catalog) risks exactly the fragmentation the Feature Registry itself was built to prevent ("cosa esiste, dove vive, in che stato è, in un unico posto"). Instead: extend the existing `/admin/feature-flags` page, which already has the CRUD/audit/batch/catalog building blocks (§5), with:

1. **A promotion control per catalog entry** (§18) — visible only for entries whose status is `INTERNAL_PREVIEW` or `BETA_ENABLED`, since promotion only makes sense from those two states.
2. **A "who's in this cohort right now" expandable row**, reusing the Pilot dashboard's data layer (`lib/data/pilot-users.ts`) parameterized by `cohort_key` instead of hardcoded to the Beta cohort (§8's noted extension) — so "who's internal right now" and "who's piloting right now" render with the same component, not two.
3. **No new top-level nav entry.** The existing Command Center (§8) already links to Pilot; it should also link to Feature Flags if it doesn't already (worth a 2-minute check when this is actually built, not asserted here without having re-read that specific link).

This keeps "release control" as an evolution of a page you already trust and already use, not a sixth thing to learn.

---

## 18. Promotion/demotion flow via `feature_flag_overrides`

Mechanically, promoting a capability from INTERNAL to PILOT is: change (or add) the `cohort` override's `scope_value` from `internal-preview` to the Beta cohort key (or add a *second* cohort override rather than mutating the first, preserving history — recommended, since `feature_flag_overrides` rows are already treated as a log-like audit trail via `created_by`/`updated_at`, and deleting the internal-preview override on promotion would erase *when* internal-only visibility started).

Demoting (GLOBAL → DISABLED, or PILOT → back to INTERNAL) is: flip `enabled` to `false` on the relevant override, or delete the global override — both already one click in the existing UI (`toggleEnabled`, `remove`, §5).

**What's genuinely new here, not already built:** a single button that does "promote" as one guided action instead of two manual steps (add global override + optionally remove cohort override), with a confirmation step matching the existing `"GLOBAL"`-typed-confirmation pattern (§5) for any promotion that reaches `global` scope specifically — since that's the one promotion that can't be un-shown to someone who's already seen it. INTERNAL→PILOT (cohort→cohort) can stay a simple `window.confirm()`, consistent with how the existing batch actions already scale their confirmation strictness to blast radius.

Audit: already complete by construction (`created_by`/`updated_by`/timestamps on every override row, §4) — no new audit mechanism needed, only a UI affordance that surfaces "promoted from X to Y on {date} by {email}" by reading the override history, which requires the "preserve history, don't delete on promotion" choice above.

---

## 19. `releases` / `release_features` — new tables, or metadata-only?

**Recommendation: metadata-only, no new tables, for the dark-release model as scoped in this report.**

Reasoning: `deploy_events` already answers "what commit, when, did it work" (§9). The Feature Registry already answers "what state is each capability in, right now" (§6). What's missing (§10, confirmed gap) is only the *narrative* connective tissue — "this deploy is what turned on School Calendar for internal, this one promoted it to pilot." That narrative can live as a **markdown file per release** (§20) that references a `deploy_events.commit_sha` and a list of catalog `key`s, rather than a normalized DB schema. A `releases` table would need its own CRUD UI, its own RLS, its own migration — real cost — to answer a question two existing systems already answer separately; a markdown convention answers "what's the story" without adding a database surface for a single-operator project (§31).

If usage ever grows past "I read a markdown file occasionally" — e.g., if release notes need to be shown *inside the app* to internal testers, not just read by you in the repo — that's the point to revisit this as a real table, not before.

---

## 20. Release notes / changelog — proposed source of truth

A new file, `docs/trama-one/RELEASE_LOG.md`, append-only, one entry per promotion event (not per commit — `deploy_events` already covers commits), each entry naming: date, capability key(s) from the Feature Registry, the promotion (e.g. "INTERNAL → PILOT"), the commit SHA it corresponds to, and one sentence of why. This is deliberately the smallest possible addition that closes the §10 gap without duplicating `TRAMA_DOCUMENTATION_CHANGELOG.md` (which tracks documentation-package versions, a different concern, §10) or `deploy_events` (which tracks deploy success/failure, not feature visibility). Distinct from both, single source of truth for "who could see what, when."

---

## 21. Release detail view — what's useful vs. excessive

Judgment call, as asked: **a release detail view is not worth building as a UI.** The audience is one person (you) and the cadence is low (capability promotions, not every commit) — a markdown file (§20) opened in an editor already serves that need better than a page with its own loading states, empty states, and RLS to maintain. The one exception worth flagging: if the INTERNAL cohort ever grows beyond "you + a couple of accounts you personally created" to include a second real person (e.g., a co-founder or an early hire), a **read-only** release log page becomes worth the very small cost of rendering the same markdown file's content — still not worth a database table, just worth serving the existing file through the Admin UI instead of asking a second person to find it in the repo.

---

## 22. Minimal preflight-before-global-release check

Not a new automated gate — a short, explicit checklist to run through before flipping any override to `global`/`enabled=true`, mirroring the spirit of `deploy.sh`'s own preflight (branch/tree checks, §24) but for *feature* promotion rather than *code* deployment:

1. Has this capability been visible to the INTERNAL cohort for at least one real usage session (not just "the page loads")?
2. Does the catalog entry's `sourceFiles` list match what's actually live (§6's own stated discipline — "verified by reading code, not assumed")?
3. For any capability with an external API/cost (§14): has the cost been sanity-checked against the free-tier limits actually researched for this project (Evolution Lab report §pricing)?
4. Is there a `product_events` entry (§9) that will tell you whether real users are using it, once global?
5. Does turning this off again (the `READY_OFF` path) require anything beyond flipping the same override back — i.e., is rollback still just a flag flip, not a data-migration?

If the answer to #5 is "no, rollback needs more than a flag flip," that capability shouldn't have been dark-deployed as designed in the first place — it's a signal to revisit, not a reason to skip the checklist.

---

## 23. Version / tag strategy

**Recommendation: timestamp-based release identifiers, not semver, for now.** Semver (`v1.4.0`) encodes a promise about API compatibility that doesn't map cleanly onto "which internal cohort members can see which capability" — a dark-release model's unit of change is a *flag override*, not a *package version*. A simple `RELEASE_LOG.md` entry dated `2026-09-15` (§20) already gives an unambiguous, sortable identifier tied to a real commit SHA via `deploy_events`, without inventing a versioning scheme that has to mean something it structurally can't (there is no single "version number" for an app where different users see different capability sets simultaneously by design). If TRAMA ever ships an installable app with its own update cadence independent of the web deploy (out of scope here), that's the point semver would start meaning something — not before.

---

## 24. Minimum `deploy.sh` hardening needed (NOT implemented, proposal only)

The core risk, previously flagged and re-confirmed this pass by re-reading the script in full: `npx vercel --prod` (line 269) publishes the **literal local working tree**, not necessarily what was just pushed to `origin/main` two lines earlier. The existing preflight (dirty-tree block, branch block, push-failure block, §above) closes the *common* version of this gap — but none of those three checks catch the specific case of "the push to `origin/main` succeeded, but the local tree has since drifted from what got pushed" (e.g., a second terminal made a commit between the push and the `vercel --prod` call) — an edge case, not the everyday risk, but the one case none of the three existing guards covers.

**Minimum proposed hardening** (again: proposal only, not implemented):
- Immediately before `npx vercel --prod`, re-run `git rev-parse HEAD` and compare it against the SHA that was just pushed; if they differ, block with the same style of explicit, overridable error the other three preflight checks already use (`ALLOW_*` env var), rather than a silent proceed.
- This is a small, additive change to a script that already has three preflight gates using the identical pattern — it is not a redesign, just filling the one gap the existing three don't cover.

Given the low frequency of manual deploys (a single operator, not a CI pipeline triggering on every merge), this is low-urgency but cheap to close — worth doing once, not urgent enough to block adopting the dark-release model on its own, since the model's safety mostly rests on the flag-resolution fail-closed behavior (§3), not on deploy-script perfection.

---

## 25. The 12-step "how future features should be built" workflow — verified/extended

The workflow referenced from the prior report (discover AS-IS → identify gap → propose minimal solution → design data model → assess Planner/Booking impact → migration draft → flag registration → privacy review → effort estimate → risk assessment → test plan → recommendation, as followed for School Calendar Intelligence, §14's live case study) holds up under this pass's deeper read of the flag/cohort/catalog machinery — no step needs to be removed. **One step is worth making explicit rather than implicit**: step "flag registration" should now explicitly say *which* scope/cohort the flag starts in — `internal-preview` by default for anything new, never `global` on day one — since before this report, the workflow's own worked example (School Calendar) never actually registered its flag at all (§ Evolution Lab findings — the flag `SCHOOL_CALENDAR_INTELLIGENCE_ENABLED` was designed but never added to `registry.ts`), so the workflow document itself has never actually exercised the "register a flag with a specific starting scope" step in practice. Worth closing that loop the next time a capability from the original 8-item list actually gets built.

---

## 26. Kill-switch propagation time across layers

**ASSUMPTION TO VALIDATE where marked** — this section describes expected behavior from reading the code, not a measured live timing (no live browser session was run this pass, consistent with "no implementation, no live tests" governance).

- **Server (Server Actions, page renders, API routes, cron)**: immediate on next invocation. `resolveFeatureFlag` reads the DB on every call — there is no in-memory cache layer found in `resolve.ts`. Flipping an override takes effect on the very next server-side request. **High confidence** (read directly from the code, not assumed).
- **Client (already-rendered page)**: a client that already rendered the feature keeps showing it until the next navigation or refresh — there's no push-based "hide this now" mechanism, nor should there be one for a flag system (that would be considerably more complex for no real benefit at this cohort size). **High confidence** — same reasoning as any server-rendered Next.js app with no live-invalidation channel.
- **Session (already-authenticated user mid-session)**: same as client — the flag is re-evaluated on the next server round-trip that flows through `resolveFeatureFlag`, not held in the session itself. **High confidence**.
- **Service worker (PWA, NextGen scope)**: a cached shell could serve a stale client bundle briefly, but any data/gating call still goes through the live server — the service worker was verified in this session's earlier push-notification investigation to control *routing/caching of the shell*, not to cache API responses that carry flag-gated data. **Medium confidence** — this specific claim (that no API response is cached client-side) was not re-verified by reading `sw.js` in full this pass; flagged as **ASSUMPTION TO VALIDATE**.
- **Cron**: takes effect on the *next scheduled run*, not immediately — a cron already mid-execution when an override changes will finish with the old value, since `resolveFeatureFlag` is (presumably) called once near the top of the handler, not re-checked per recipient inside a loop. **ASSUMPTION TO VALIDATE** — worth confirming against the actual `checkin-reminders`/`travel-reminders` handler structure the next time either is touched, since this session re-read `checkin-reminders/route.ts` in full (§ earlier in this session) and it does not currently call `resolveFeatureFlag` at all (it has no flag gate today) — so this claim is inferred from the general pattern in `app/actions/kids.ts`, not observed in a cron specifically.
- **Push**: once a push notification has been sent, killing the flag doesn't recall it — same as any push system. The only mitigation is gating the *send*, not the *display*, consistent with §12's cron/push guidance.

**Practical implication**: for this cohort size (a handful of internal accounts), "up to one page refresh" propagation is not a real operational risk — it would matter far more at Beta/Global scale, where it already doesn't cause problems today (no incident referencing propagation delay was found in the TC-N409 postmortem or elsewhere).

---

## 27. Claude-effort estimate per capability (NOT human person-days)

This estimates *my* execution effort under this same governance model (research → static verification → commit, you apply migrations/deploy), not a generic engineering estimate. Ranges, not false-precision single numbers, per your standing instruction.

| Capability | Files/migrations touched | Tests added | Execution passes | Claude sessions | Agentic hours | Stops to you | Human minutes (yours) | Single-session completion probability | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| School Calendar Intelligence (finish what's designed) | ~8-12 files, 1 migration (exists, unapplied) | 8-12 (already scoped, TC-SCHOOL-01..12) | 2-3 | 1-2 | 4-8h | 2 (migration apply, flag scope confirm) | 15-30 min | ~70% (design + migration already exist, mostly execution) | High |
| External Planner Items | ~10-15 files, 1-2 migrations | 8-14 | 2-4 | 2 | 8-14h | 2-3 | 20-40 min | ~50% | Medium |
| Personal Calendar Sync Lvl 1 (multi-event .ics) | ~4-6 files, 0 migrations | 4-6 | 1-2 | 1 | 2-4h | 1 | 10-15 min | ~85% | High |
| Personal Calendar Sync Lvl 2+ (live sync, OAuth) | ~15-25 files, 2-3 migrations, new secrets | 12-20 | 3-5 | 3-4 | 16-30h | 4-5 (OAuth app setup, secrets, security review) | 45-90 min | ~15% (external OAuth setup is inherently multi-stop) | Low-Medium |
| Delegations / Pickup Authorization | ~15-20 files, 2-3 migrations | 12-18 | 3-4 | 3 | 14-24h | 4-5 (given child-safety-adjacency, more review stops than usual) | 45-75 min | ~20% | Low |
| Smart Departure (stays manual-time) | ~6-10 files, 1 migration (extend travel_reminders) | 6-10 | 2 | 1-2 | 6-10h | 2 | 15-25 min | ~60% | Medium |
| Location Strategy | Depends heavily on real-geocoding decision — **not estimable as scoped** | — | — | — | — | — | — | — | **Low — needs a scoping decision first, not an estimate** |
| Smart Handover (notification-only variant) | ~6-9 files, 1 migration | 6-9 | 2 | 1-2 | 5-9h | 2 | 15-25 min | ~65% | Medium |
| Delay Notification to Center | ~4-6 files, 0-1 migration | 4-6 | 1-2 | 1 | 3-5h | 1-2 | 10-20 min | ~80% | High |

**Location Strategy is deliberately left unestimated** — giving it a number would be false precision on top of an already-unscoped decision (§14: its value proposition depends on an integration that doesn't exist yet). The honest answer is "scope the geocoding decision first, then this table gets a row."

---

## 28. Release infrastructure effort vs. reduction for 5 subsequent features

**Building the INTERNAL_PREVIEW extension itself** (§12's cohort-key convention + §15's badge component + §17's page extension + §18's promotion button + §20's release log convention): ~10-16 files touched, 1 new component, 0 new migrations (reuses `beta_cohort_memberships`/`feature_flag_overrides` schema unchanged), 6-10 tests, 1-2 Claude sessions, 6-12 agentic hours, 3-4 stops to you (mainly: confirm the internal cohort membership approach, review the promotion-button confirmation copy, approve the badge wording).

**Marginal reduction per subsequent capability, once this exists**: for the 5 lowest-risk rows in §27's table (School Calendar, External Planner Items, Personal Calendar Sync Lvl 1, Smart Departure, Delay Notification — deliberately excluding the two flagged-as-harder rows), the INTERNAL_PREVIEW scaffolding removes roughly the "which cohort do I use, how do I label it, how do I promote it" decision-making from each one — estimated **1-2 fewer stops to you per capability**, and **~1-3 fewer agentic hours per capability** (mostly saved on re-deriving the gating pattern each time, since §13's checklist becomes copy-paste rather than re-invented). It does not reduce the core implementation effort of any single capability — building External Planner Items still takes what building it takes; what shrinks is the release-mechanics overhead layered on top.

---

## 29. "FABRIZIO REQUIRED" touchpoints, autonomy %, and time

| Touchpoint | When | Estimated time | Why it can't be Claude |
|---|---|---|---|
| Apply any new/extended migration | Once per capability with a schema change | 5-10 min | Standing governance — Claude never applies migrations |
| Confirm internal cohort membership (who's actually "internal") | Once, at INTERNAL_PREVIEW setup | 5 min | A judgment call about who you trust with pre-release visibility, not a technical decision |
| Deploy (`bash deploy.sh`) | Every release | 2-5 min (script already automates the rest) | Standing governance — Claude never deploys |
| Flip a promotion override (INTERNAL→PILOT→GLOBAL) via Admin UI | Per promotion | 1-2 min (once the button from §18 exists) | Deliberately a manual, confirmed action — this is the entire point of the model (nothing promotes itself) |
| Approve badge/label wording (§15) | Once | 2 min | Product voice decision |
| Security review sign-off for OAuth-based capabilities (Calendar Sync Lvl 2+) | Once per such capability | 20-40 min | Judgment call about acceptable third-party credential risk, not a static-analysis question |
| Review Delegations' authorization logic against real data before any promotion | Once, before PILOT | 30-60 min | Child-safety-adjacency — explicitly not a rubber-stamp step |

**Overall autonomy estimate for this model, across the 5 lower-risk capabilities**: roughly **75-85% Claude-autonomous** by agentic-hour share (research, implementation, static verification, tests, commits), with the remaining share concentrated in migration application, deploy, and promotion clicks — all deliberately kept manual by the model's own design, not because Claude is blocked from doing more. For Delegations and Calendar Sync Lvl 2+, autonomy drops to roughly **55-65%** given the extra review stops in the table above — a reflection of those two capabilities' real risk profile (§14), not a governance artifact.

---

## 30. Risks specific to "same code + same DB + prod dark release"

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | A dark feature's Server Action is called directly (not via its gated page) by someone who finds the URL/inspects network requests | Low-Medium | Medium (reveals an unfinished feature to one curious user, not a data breach) | §13's rule 3 — every Server Action re-checks the flag itself, independent of the page |
| R-02 | A cron job processes internal-cohort AND real users identically because its query wasn't filtered | Medium (this is a new discipline, not yet proven in a cron specifically, §26) | Medium-High (real users get a half-built feature's side effects — e.g. a stray push) | §12's explicit cron-filtering requirement; add to §22's preflight checklist |
| R-03 | A migration for a new table is written correctly but the RLS policy is copy-pasted wrong, exposing rows across parents | Low (existing RLS conventions are consistently followed across 30+ migrations reviewed this session and the prior one) | High (real data exposure) | Same RLS-review discipline already applied to every migration in this codebase; RLS review is independent of flag state (§13 rule 5) |
| R-04 | A dark feature calls a paid external API (Maps, a calendar provider) and the call isn't itself flag-gated, only the UI is | Medium (this is the newest kind of gate this report introduces, §12) | Medium (real cost accrues silently) | §12's explicit external-API-call gating requirement |
| R-05 | An override meant for `internal-preview` is accidentally created with `scope_type = 'global'` via a typo in the Admin form | Low (the existing typed-"GLOBAL"-confirmation UX, §5, is specifically designed to prevent exactly this) | High if it happens | Already mitigated by existing UI; extend the same confirmation pattern to the new promotion button (§18) |
| R-06 | Two people (you + a future hire) both have Admin access and promote/demote the same flag without coordinating | Low today (single operator, §31) | Low-Medium | Audit trail already shows who did what, when (§4) — sufficient at this team size; revisit if the team grows |
| R-07 | An internal-preview override silently expires (same failure mode as TC-N409) and nobody notices for days | Low (the `hasAlert`/expiring-soon mechanism, §5, already exists and already covers every scope, cohort included) | Medium (internal testers lose access, mistaken for a bug) | Already mitigated — no new work needed, just confirmed applicable to cohort-scoped overrides too |
| R-08 | A capability promoted to GLOBAL turns out to need rollback, but rollback requires more than a flag flip (e.g. data already written in an incompatible shape) | Medium for any capability that skips §22's preflight check #5 | High | §22's explicit preflight check exists specifically for this |
| R-09 | The Feature Registry catalog (§6) drifts from reality because a capability's flag scope changed but nobody updated its `note`/`status` | Medium (it's a hand-maintained file, by explicit design) | Low-Medium (misleads whoever reads the catalog, doesn't affect runtime) | Same discipline already stated in the file's own header comment — "populated only with verified entries" — needs to become a habit at promotion time, not new tooling |
| R-10 | An internal tester (you or an allowlisted account) reports a bug that's actually expected-incomplete behavior, wasting investigation time | Medium | Low | §15's visible preview badge exists specifically to make "this is known-incomplete" obvious in the moment, reducing false bug reports |
| R-11 | A capability with a new DB write path is dark-deployed, and a bug in that write path corrupts data for the *few* real internal-cohort rows before anyone notices | Low-Medium | Medium (small blast radius by definition — internal cohort is small) | This is the core safety property of the model itself: blast radius is capped at cohort size, unlike a bug in a GLOBAL-scoped feature |
| R-12 | `vercel --prod` publishes a working tree that has drifted from what was pushed (§24's confirmed gap) | Low (edge case, not the common path) | High if it happens (production may not match GitHub) | §24's proposed SHA-comparison preflight — not yet implemented |
| R-13 | A capability's flag defaults to `true` by mistake at registration time (typo, or copy-pasted from a wrong example) | Low (every existing flag is `defaultValue: false`, a consistent convention across the only 2 flags that exist) | High if it happens (feature goes live for everyone with no override needed) | Worth a one-line addition to §22's preflight: confirm `defaultValue: false` before first deploy of any new flag |
| R-14 | Two capabilities share a table (e.g. both extend `travel_reminders`) and one's dark rollout accidentally changes shared read logic used by the other, already-GLOBAL capability | Low for the specific 8 capabilities listed (mostly separate tables, §14) | High if it happens | §13 rule 4 (additive-only changes to existing read logic) directly addresses this; flagged specifically for Smart Departure, the one row in §14 that extends an existing table |
| R-15 | The INTERNAL cohort itself becomes a permanent parking lot for half-finished features that never get promoted or killed, cluttering the Feature Registry | Medium over a long time horizon (a process risk, not a technical one) | Low (mess, not danger) | §22's preflight + a habit of reviewing `INTERNAL_PREVIEW`-status catalog entries periodically — not a technical mitigation, a discipline one |

**Which capabilities are safe for this model vs. need real staging (Evolution Lab)**: re-stating §14's conclusion plainly — 6 of 8 (School Calendar, External Planner Items, Calendar Sync Lvl 1, Smart Departure, Smart Handover-as-notification, Delay Notification) are safe for dark-release as designed. Calendar Sync Lvl 2+ needs a security review gate, not a separate environment. Delegations needs a stricter safety bar because of child-safety-adjacency, independent of which deployment model is chosen — a separate staging environment does not, by itself, make an authorization bug safer; better testing against realistic data does, and that's achievable within the dark-release model too, just not skippable. Location Strategy needs a scoping decision (does real geocoding get built at all) before either model applies.

---

## 31. Governance stays minimal — explicit

Every proposal above is scaled to a 1-person-operator + Claude project, deliberately: no new role definitions, no new environments, no approval-chain beyond "Fabrizio confirms in the Admin UI" (already the existing pattern for every override change, §4-5), no new database tables where a markdown file suffices (§19-20), no new Admin page where extending an existing one suffices (§17). The one place this report recommends slightly more process than exists today — the preflight checklist (§22) and the promotion-confirmation UX (§18) — is process in the sense of "a checklist you personally run through," not a second person's sign-off. If TRAMA ever grows to more than one or two people with Admin access, R-06 (§30) is the signal to revisit — not before.

---

## 32. Recap block

```
DARK RELEASE MODEL: GO WITH CONDITIONS

EXISTING INFRASTRUCTURE MATURITY: HIGH — considerably more built than assumed
  before this research pass (Admin flag CRUD+audit, Feature Registry with
  9-state lifecycle, working beta-cohort + invite-code system, Pilot
  dashboard, deploy notification pipeline all already exist)

NEW SCHEMA REQUIRED: NONE — internal cohort reuses existing
  beta_cohort_memberships / feature_flag_overrides / beta_invite_codes tables
  unchanged, via a new cohort_key value ("internal-preview")

NEW CODE REQUIRED: SMALL — one badge component, one promotion-button UX
  addition to the existing Admin flags page, one markdown release-log
  convention, explicit cron/webhook/external-API gating discipline applied
  per future capability (not new infrastructure — an extension of an
  existing, proven pattern, app/actions/kids.ts)

SCOPE PRECEDENCE (re-verified this session): user > role > cohort > tenant >
  environment > global — confirmed directly from lib/feature-flags/
  evaluate.ts, not re-derived from memory

FAIL-SAFE BEHAVIOR: confirmed — resolveFeatureFlag fails closed (false) on
  any error; a bug hides a feature, never reveals one

CAPABILITIES SAFE FOR DARK RELEASE AS DESIGNED: 6 of 8
  (School Calendar Intelligence, External Planner Items, Personal Calendar
  Sync Level 1, Smart Departure, Smart Handover [notification variant],
  Delay Notification to Center)

CAPABILITIES NEEDING A STRICTER PATH: 2 of 8
  (Delegations/Pickup Authorization — child-safety-adjacency, needs a real
  data safety review regardless of deployment model;
  Personal Calendar Sync Level 2+ — OAuth/third-party credential storage,
  needs a security review gate before any dark deploy)

CAPABILITY NOT YET SCOPABLE: 1 of 8
  (Location Strategy — depends on an integration, real geocoding, that
  doesn't exist yet; needs a scoping decision, not an estimate)

DEPLOY SCRIPT HARDENING NEEDED: YES, SMALL — one SHA-comparison preflight
  check closes the one gap not already covered by the three existing
  preflight gates (branch/dirty-tree/push-failure). Proposal only, not
  implemented.

CHANGELOG/RELEASE-NOTES GAP: CONFIRMED REAL — no product-level release log
  exists today (only a documentation-package changelog, a different
  concern). Proposed fix: one markdown file, no new table.

NEW DB TABLES PROPOSED: ZERO (releases/release_features stays metadata-only,
  a markdown file, not a schema — §19)

VERSION STRATEGY RECOMMENDED: timestamp + commit SHA, not semver

RELEASE INFRA BUILD EFFORT (Claude): 1-2 sessions, 6-12 agentic hours,
  3-4 stops to Fabrizio, 0 new migrations

MARGINAL EFFORT REDUCTION FOR 5 SUBSEQUENT LOW-RISK CAPABILITIES:
  ~1-2 fewer stops and ~1-3 fewer agentic hours EACH — release-mechanics
  overhead shrinks, core implementation effort per capability does not

OVERALL CLAUDE AUTONOMY (lower-risk capabilities): ~75-85% of agentic effort
OVERALL CLAUDE AUTONOMY (Delegations / Calendar Sync L2+): ~55-65%

FABRIZIO-REQUIRED TOUCHPOINTS: migration application, deploy execution,
  promotion-button clicks (by design — nothing promotes itself), one-time
  cohort-membership confirmation, badge-wording approval, security
  sign-off for OAuth-based capabilities, safety review for Delegations

NAMED RISKS IDENTIFIED: 15 (R-01..R-15, §30) — highest-impact:
  R-03 (RLS misconfiguration on a new table), R-08 (rollback needs more
  than a flag flip), R-12 (vercel --prod working-tree drift, pre-existing
  and previously flagged, still open)

GOVERNANCE SCALE: kept minimal throughout — no new roles, no new approval
  chains, no new environments; 1-person-operator + Claude, matching current
  reality (§31)

NOTHING IN THIS REPORT WAS IMPLEMENTED. Repository git status remained
  clean throughout this research pass. No migration applied. No flag
  registered. No commit made. No deploy triggered.
```
