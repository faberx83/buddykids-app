# TRAMA — Capability Completeness Matrix

25/08/2026 — AUDIT ONLY. Ogni capability è valutata secondo i FIVE TRUTHS (CODE/DEPLOYMENT/DATA/JOURNEY/VALIDATION), mai compressi in un generico "DONE". Colonne: IMPLEMENTED, CURRENT REPO, DEPLOYED, REAL DATA, DISCOVERABLE, END-TO-END, AUTOMATED TESTED, LIVE TESTED, MOBILE VERIFIED, PILOT VALIDATED, LEGACY DEPENDENCY, MANUAL OPERATION, CUSTOMER PROMISABLE. Valori: YES / PARTIAL / NO / N/A / NOT VERIFIED.

Nessuna riga di questa matrice ha mai PILOT VALIDATED = YES: nessun Micro Pilot con utenti reali è ancora stato eseguito. Evidenza taxonomy per riga importante: CODE_VERIFIED / DB_VERIFIED / STATIC_TESTED / LIVE_TESTED / DOCUMENT_ONLY / NOT_VERIFIED.

---

## PARENT

| Capability | Implemented | Current repo | Deployed | Real data | Discoverable | End-to-end | Auto tested | Live tested | Mobile verified | Pilot validated | Legacy dep. | Manual op. | Customer promisable | Completeness class |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Landing | YES | YES | YES | N/A | YES | YES | PARTIAL | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Signup | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Login | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Legal/Privacy pubblico | YES | YES | **NO** | N/A (0 doc) | NO (non deployato) | NO | PARTIAL | NO | NOT VERIFIED | NO | NO | Fabrizio deve pubblicare contenuto | NOT ANNOUNCED | BUILT NOT DEPLOYED |
| Family/household | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Add child | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Edit child | PARTIAL (solo avatar/interessi) | PARTIAL | YES | YES | YES | PARTIAL | PARTIAL | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | LIMITED BETA | FUNCTIONAL BUT UX INCOMPLETE |
| Delete child | NO | NO | N/A | N/A | N/A | N/A | N/A | N/A | N/A | NO | NO | NO | NOT ANNOUNCED | NOT IN SCOPE |
| Onboarding (nudge) | YES | YES | YES | YES | YES | YES (opzionale) | PARTIAL | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE WITH ACCEPTED LIMITATION |
| Home | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Planner | YES | YES | YES (fix testo NextGen NO) | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Search/filtri/discovery | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Mappa | YES | YES | YES | **NO (coordinate stubbate)** | YES | YES | PARTIAL | YES | NOT VERIFIED | NO | NO | NO | LIMITED BETA | FUNCTIONAL BUT OPS INCOMPLETE |
| Activity detail | YES | YES | fix recenti NO | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Favorites | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| "Riempi"/richiesta prenotazione | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| JourneyContext (correlationId unificato) | PARTIAL (infra sì, non collegato) | YES | YES | N/A | N/A (invisibile) | NO | PARTIAL | NOT VERIFIED | N/A | NO | NO | NO | ROADMAP (interno) | SCAFFOLD ONLY |
| Request/Booking | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Partial booking (per-giorno) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Alternative (proposta Partner) | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Rejected flow | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| My Activities / Le mie prenotazioni | YES | YES | YES (editor giorni NO) | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Groups/Community | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Sharing (link piano) | YES | YES | YES | YES | YES (NextGen) | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Reminders | YES | YES | YES | YES | YES (NextGen) | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Feedback/segnalazioni | YES | YES | YES | YES | YES (solo NextGen) | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA (NextGen only) | COMPLETE WITH ACCEPTED LIMITATION |
| Profile/settings | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Marketing preference | YES | YES | base sì, wiring gate NO | YES | YES | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE WITH ACCEPTED LIMITATION |
| Account deletion | PARTIAL (solo disattivazione) | YES | YES | YES | YES | PARTIAL | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | NO | NO | Assistenza deve riattivare manualmente | LIMITED BETA | FUNCTIONAL BUT OPS INCOMPLETE |
| School Calendar | **NO** | NO (solo schema DB) | NO | N/A | NO | NO | NO | NO | N/A | NO | NO | NO | ROADMAP | SCHEMA ONLY (vedi nota DB LIVE più sotto) |
| Email/notifiche | YES (codice) | YES | YES | N/A | N/A | PARTIAL (inerte) | YES | NOT VERIFIED | N/A | NO | NO | Fabrizio deve configurare Resend | LIMITED BETA | FUNCTIONAL BUT OPS INCOMPLETE |
| Support (contatta gestore) | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |

Nota tecnica su School Calendar: le 4 tabelle DB (`school_calendars`, `school_calendar_events`, `kid_school_profiles`, `school_calendar_overrides`) risultano **live** su Supabase con 0 righe (DB_VERIFIED), ma questo non sposta la classificazione applicativa: zero codice, zero flag, zero UI, zero test le rendono comunque SCHEMA ONLY dal punto di vista prodotto.

---

## PARTNER

| Capability | Implemented | Current repo | Deployed | Real data | Discoverable | End-to-end | Auto tested | Live tested | Mobile verified | Pilot validated | Legacy dep. | Manual op. | Customer promisable | Completeness class |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Candidatura pubblica | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE-ASSISTED BETA | COMPLETE FOR BETA |
| Account/login | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Center ownership | YES (1:1 solo) | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | — | COMPLETE WITH ACCEPTED LIMITATION |
| Verifica identità | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | Admin approva manualmente | AVAILABLE-ASSISTED BETA | COMPLETE FOR BETA |
| Onboarding state machine + checklist | YES | YES | YES | YES | PARTIAL (gated flag) | YES | YES | YES | NOT VERIFIED | NO | NO | NO | LIMITED BETA (cohort-gated) | COMPLETE WITH ACCEPTED LIMITATION |
| Spotlight/walkthrough | YES | YES | YES | YES | PARTIAL (gated flag) | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | LIMITED BETA | COMPLETE WITH ACCEPTED LIMITATION |
| **Dashboard `/center`** | YES (fix) | YES | **NO — produzione mock** | **NO in produzione** | YES | NO (in produzione mostra dati altrui) | YES | **NO** | NOT VERIFIED | NO | **SÌ, P0** | NO | **NOT ANNOUNCED finché non deployato** | **MOCK (in produzione) / BUILT NOT DEPLOYED (fix)** |
| Center profile | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Activity creation (form singolo, non wizard multi-step) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE WITH ACCEPTED LIMITATION |
| Activity edit (tag/foto/dieta/certificazione) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Weeks | YES | YES | YES (label conteggio cosmetica mock) | PARTIAL | YES | YES | YES | YES | NOT VERIFIED | NO | Sì, minore | NO | AVAILABLE IN BETA | COMPLETE WITH ACCEPTED LIMITATION |
| Days (Giorni spot) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Multi-select bulk "Giornata particolare" (OD-02) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Availability/capacity (CAS) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Price/discounts/last-minute | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Publish/unpublish | **NO** | NO | N/A | N/A | N/A | N/A | N/A | N/A | N/A | NO | NO | NO | NOT ANNOUNCED | NOT IN SCOPE |
| Requests inbox (bookings) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Requests inbox (ticket genitori, single-turn) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE WITH ACCEPTED LIMITATION |
| Full accept/reject/alternative | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Partial accept (settimana) | **NO strutturato** (solo nota libera) | NO | N/A | N/A | PARTIAL | PARTIAL | N/A | N/A | N/A | NO | NO | NO | LIMITED BETA | FUNCTIONAL BUT UX INCOMPLETE |
| Partial accept (per-giorno) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Booking mgmt (cancel/rimborso per giorno) | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | Rimborso = solo calcolo, no pagamento reale | AVAILABLE-ASSISTED BETA | COMPLETE WITH ACCEPTED LIMITATION |
| Email/notifiche | YES (codice) | YES | YES | N/A | N/A | PARTIAL (inerte) | YES | NOT VERIFIED | N/A | NO | NO | Fabrizio deve configurare Resend | LIMITED BETA | FUNCTIONAL BUT OPS INCOMPLETE |
| Profile/settings Partner | YES | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Support (segnalazioni beta) | YES | YES | YES | YES | YES | YES | YES | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | AVAILABLE IN BETA | COMPLETE FOR BETA |
| Analytics Partner | **NO** | NO | N/A | N/A | N/A | N/A | N/A | N/A | N/A | NO | NO | NO | NOT ANNOUNCED | NOT IN SCOPE |
| Multi-site | **NO** (FK singola) | NO | N/A | N/A | N/A | N/A | N/A | N/A | N/A | NO | NO | NO | NOT ANNOUNCED | NOT IN SCOPE |

---

## ADMIN

| Capability | Implemented | Current repo | Deployed | Real data | Discoverable | End-to-end | Auto tested | Live tested | Pilot validated | Legacy dep. | Manual op. | Customer promisable | Completeness class |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard root | YES (fix) | YES | **NO — produzione mock** | NO in produzione | YES | NO in produzione | YES | **NO** | NO | Sì | NO | N/A (interno) | MOCK (produzione) / BUILT NOT DEPLOYED |
| Command Center (`/admin/one`) | YES | YES | YES | YES | PARTIAL (gated flag, ma platform_admin sempre acceso) | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Centers list/detail | YES (fix) | YES | **NO — produzione mock parziale** | NO in produzione | YES | PARTIAL | YES | **NO** | NO | Sì | NO | N/A (interno) | MOCK (produzione) / BUILT NOT DEPLOYED |
| Candidacy queue + "Approva e crea centro" | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Onboarding review + identity | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Activities (admin view) | YES (fix) | YES | **NO — produzione mock** | NO in produzione | YES | NO in produzione | YES | **NO** | NO | Sì | NO | N/A (interno) | MOCK (produzione) / BUILT NOT DEPLOYED |
| Bookings | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Requests (richieste/group-requests) | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| CenterLead mgmt | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Feedback/segnalazioni beta (view Admin) | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Feature Control Center | YES | YES | YES | YES | YES | YES | YES | YES | NO | NO | NO | N/A (interno) | COMPLETE FOR BETA |
| Audit trail generico | **PARTIAL** (solo onboarding-scoped) | PARTIAL | YES | YES | PARTIAL | NO | NOT VERIFIED | NOT VERIFIED | NO | NO | NO | N/A (interno) | FUNCTIONAL BUT OPS INCOMPLETE |
| Analytics | YES (fix parziale) | YES | **PARZIALE — parte mock in produzione** | PARZIALE in produzione | YES | PARTIAL | YES | PARTIAL | NO | Sì | NO | N/A (interno) | MIXED / BUILT NOT DEPLOYED (parte) |
| Data quality | **NO** | NO | N/A | N/A | N/A | N/A | N/A | N/A | NO | NO | NO | N/A | NOT IN SCOPE |
| Legal documents (view) | YES | YES | **NO** | N/A (0 doc) | NO (non deployato) | NO | PARTIAL | NO | NO | NO | NO | N/A (interno) | BUILT NOT DEPLOYED |
| Support (ops dedicato) | **NO** (solo ticketing) | NO | N/A | N/A | N/A | N/A | N/A | N/A | NO | NO | NO | N/A | NOT IN SCOPE |
| Pilot operations (cron interno) | YES | YES | YES | YES | N/A (interno) | YES | YES | YES | NO | NO | NO | N/A | COMPLETE FOR BETA |

---

## Note di lettura

- Ogni riga "MOCK (produzione) / BUILT NOT DEPLOYED" rappresenta lo stesso identico problema di fondo (fix pronto, deploy fermo) applicato a superfici diverse — vedi `TRAMA_PLATFORM_PRODUCT_TRUTH.md` §3 per l'analisi consolidata del P0.
- Nessuna riga in tutta la matrice ha "Pilot validated: YES" — questo è per costruzione, non un'omissione: il Micro Pilot reale non è ancora iniziato.
- "Mobile verified" è quasi ovunque NOT VERIFIED: questo audit è stato condotto per lettura di codice (CODE_VERIFIED/DB_VERIFIED/STATIC_TESTED), non con rendering reale su dispositivo — vedi gap aperto in `TRAMA_PLATFORM_PRODUCT_TRUTH.md` (Visual/Mobile Acceptance, sezione 18/§11 del prompt originale, non eseguita in questo passaggio: richiede uno step dedicato con screenshot reali a 390×844/768/1440, non ancora fatto).
