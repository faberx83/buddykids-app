# TRAMA — PRE-LAUNCH 360° HEATMAP

AS_OF_COMMIT: `6d7b1021bdb38d6db2fc77ae4132a32616bedce3`
Stati: GREEN (verificato, nessun problema noto) · GREEN_WITH_GAP (funziona, gap noto minore) · AMBER (funziona parzialmente/rischio) · RED (blocca/non affidabile) · NOT_TESTED (non verificabile in questo audit) · N/A

Nessuna cella "verde" senza evidenza citata. Evidenza abbreviata; dettaglio completo nel Risk Register e nell'Executive Audit.

| Dominio | Parent | Partner | Admin | Cross-platform |
|---|---|---|---|---|
| **Product** | AMBER — banner "dati demo" non esteso a Search/Planner/Community (CODE_VERIFIED, R-vedi audit) | RED — dashboard 100% mock, no banner (R-02) | RED — root Dashboard/Attività/Analisi/Centri 100% mock, no banner; Feature Registry non li cataloga (R-01, R-12) | AMBER — Master Requirement Catalog stale 18gg (R-11) |
| **Functional** | GREEN_WITH_GAP — journey booking reale e testato (144 test critical, 94 pass, 0 fail su deploy 5d15377); Planner regressioni recenti senza test dedicati (R-09) | GREEN_WITH_GAP — Inbox/Availability reali; School Calendar 100% dormiente, nessun impatto | AMBER — Command Center reale (`/admin/one`), ma convive senza distinzione con superficie mock root | AMBER — cross-check Riempi→Ricerca→Booking funzionante ma JourneyContext tipizzato non ancora wired end-to-end |
| **Database** | GREEN — 0 orphan su kids/bookings/booking_kids (DB_VERIFIED) | GREEN — 0 orphan su activities/centers/onboarding (DB_VERIFIED) | GREEN — 0 orphan complessivo, 6/6 auth.users=profiles (DB_VERIFIED) | GREEN_WITH_GAP — RLS abilitata su tutte le 60 tabelle pubbliche (DB_VERIFIED); solo WARN performance (unindexed FK, multiple permissive policies) |
| **Security** | GREEN_WITH_GAP — nessun XSS/injection/secret esposto (CODE_VERIFIED) | GREEN_WITH_GAP — upload validati client-side, RLS storage non verificabile da codice | AMBER — `admin.ts` senza check applicativo esplicito, si affida a RLS (da confermare applicata) | RED — `next` 16.2.10 in range 4 advisory HIGH (SSRF/disclosure), da patchare prima del lancio (R-06) |
| **Privacy** | RED — nessuna informativa privacy, nessun consenso T&C a signup, dati di minori raccolti senza base giuridica documentata (R-03) | GREEN_WITH_GAP — Partner non vede birth_date/foto bambino nei flussi verificati (CODE_VERIFIED) | GREEN_WITH_GAP — nessuna visibilità Admin su dati bambino oltre il necessario | AMBER — RLS `kids` solo row-level (protezione column-level assente); cookie/tracking senza banner ma nessun tracker terzo (R-21, R-22) |
| **Regulatory** | NOT_TESTED — nessuna conclusione legale definitiva possibile da codice; vedi Compliance Gaps | NOT_TESTED — ruolo di TRAMA come intermediario/marketplace non qualificato legalmente | N/A | AMBER — EXTERNAL LEGAL REVIEW RECOMMENDED su età consenso minori (14 anni in Italia) e qualifica DSA (vedi Compliance Gaps) |
| **Accessibility** | RED — Planner: stato settimana solo-colore, nessun testo/icona (blocker WCAG 1.4.1, CODE_VERIFIED) | AMBER — form Partner con input privi di label in più file | AMBER — stessi pattern condivisi (PageHeader, spinner) | RED — heading hierarchy rotta su ~10 pagine NEXTGEN; nessun `aria-live` su stati async |
| **UX** | GREEN_WITH_GAP — feature incomplete correttamente etichettate "in arrivo", nessun dead-end trovato | GREEN_WITH_GAP — copy Partner/Gestore coerente lato utente | AMBER — due dashboard con fiducia opposta senza distinzione visiva | GREEN_WITH_GAP — nessun Lorem ipsum/placeholder trovato |
| **Visual/Brand** | AMBER — 1 hex hardcoded residuo (#D4622A), "shadow palette" non gestita | AMBER — stesso pattern | AMBER — stesso pattern | AMBER — coesistenza token trama-*/legacy per design, non un errore |
| **Mobile** | NOT_TESTED — nessun overflow di pagina trovato staticamente, ma nessuna verifica live 390×844 eseguita in questo audit | NOT_TESTED — griglia disponibilità richiede scroll orizzontale contenuto (`overflow-x-auto`), non verificato dal vivo | NOT_TESTED — tabella funnel stesso pattern | NOT_TESTED — richiede passata live (task #474/#526 già aperti, non eseguiti) |
| **Performance** | NOT_TESTED — nessuna misura TTFB/bundle eseguita in questo audit | NOT_TESTED | NOT_TESTED | AMBER — WARN performance Supabase (FK non indicizzate, RLS auth_rls_initplan, indici inutilizzati) — nessuno bloccante, tuning post-Beta |
| **Reliability** | AMBER — nessuna idempotenza su creazione booking (mitigata da disable-on-submit client-side) | AMBER — race condition reale su decremento `spots_left` (read-then-write, no atomic update) (R-07) | GREEN — nessun impatto Admin diretto | AMBER — nessun timeout esplicito su chiamate Supabase in azioni critiche |
| **Email** | RED — RESEND_API_KEY non configurata, notifiche booking/assenza non partono (confermato oggi via booking reale `email_delivery_status=not_configured`) | RED — stesso gate, notifiche accettazione/rifiuto Partner silenti | N/A | RED — gate manuale noto e già tracciato (task #484) |
| **Data quality** | RED — 0 famiglie reali, tutti gli account sono demo/test (DB_VERIFIED) | RED — 0 centri reali, 12 centri = 5 demo curati + 7 test/placeholder (DB_VERIFIED) | RED — stessa base dati, nessun contenuto pilota reale | RED — nessuna contaminazione KPI possibile oggi solo perché non c'è ancora nessun KPI reale da contaminare |
| **Feature control** | GREEN — flag `TRAMA_ONE_ENABLED` global=false, cohort scaduta correttamente gestita, resolver fail-closed su ogni errore (CODE_VERIFIED) | GREEN | GREEN | GREEN_WITH_GAP — override permanente per `platform_admin` da far confermare come intenzionale (R-26) |
| **Operations** | NOT_TESTED — nessun processo di supporto pilota documentato oltre Beta feedback UI | NOT_TESTED | AMBER — Command Center reale copre parte della coda operativa | AMBER — vedi Compliance/Operations audit in Executive |
| **Support** | NOT_TESTED — canale di supporto pilota non definito in questo audit | NOT_TESTED | NOT_TESTED | AMBER — Beta feedback esiste (Parent+Partner) ma nessun SLA/owner/escalation documentato |
| **Observability** | RED — nessun log persistito del journey booking (`product_events` non applicata) (R-04) | RED — stesso gap | N/A | RED — un booking rotto oggi richiederebbe che l'utente descriva tutto a voce |
| **Recovery** | NOT_TESTED | NOT_TESTED | NOT_TESTED | AMBER — kill-switch feature flag documentato e reale (RUNBOOK); nessun runbook di backup/restore DB generico (R-13) |
| **Pilot** | RED — 0 famiglie reali onboardate | RED — 0 centri reali onboardati | N/A | RED — Micro Pilot (§32) non ancora iniziato |

## Legenda evidenza sintetica
- DB_VERIFIED: query dirette Supabase (progetto `eagsgfxunwyyxwwilldy`), 24/08/2026.
- CODE_VERIFIED: lettura diretta di codice/migrazioni da parte di sub-agenti di ricerca dedicati, con riferimento file:riga nel Risk Register/Executive Audit.
- CONFIG_VERIFIED: `package.json`, config Supabase/advisor.
- NOT_TESTED: nessun test live/browser eseguito in questo audit (per policy: Claude non esegue deploy/test live in produzione — riservato a Fabrizio).
- LEGAL_REVIEW_REQUIRED e ASSUMPTION sono usati solo nella sezione Regulatory/Privacy, mai per dichiarare conformità.
