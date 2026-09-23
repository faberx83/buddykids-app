# TRAMA ONE Build Sprint 5 — Matrice pagina-per-pagina / route-per-route

Artefatto obbligatorio prerequisito richiesto da `SPRINT_GOVERNANCE.md` (ogni sprint estende questa matrice) prima dell'implementazione di Sprint 5 — CenterLead, referral e incentivi.

## Scope Sprint 5 (`SPRINT_GOVERNANCE.md`, deliberatamente ridotto rispetto all'epic completo)

`SPRINT_GOVERNANCE.md` fissa lo scope a: "suggerimento centro non iscritto; CenterLead (nuova tabella additiva); dedupe; claim; reward/commission in shadow mode/manuale (mai automatico prima del ledger reale)". Fuori scope esplicito: "qualunque automazione economica reale (pagamenti, ledger)".

**Nota di riconciliazione con la fonte di design completa**: `docs/trama-one/derived/TRAMA_Product_Architecture_CX_Handbook_Draft_1.2_Referral_Incentives.md` (§9, §B.2, §B.4, CR-049/050/051/052) definisce un modello di dominio molto più ampio — `CenterLead`, `DemandContext`, `CenterInvitation`, `CenterClaim`, `ReferralAttribution`, `ReferralReward`, `PartnerIncentive`, `IncentiveRuleVersion` come entità separate, con state machine economica completa (`pending → eligible → earned → issued → redeemed`). Lo stesso documento (§B.5) dichiara però esplicitamente: "CR-049 può essere implementata in forma minima (suggestion + CenterLead + stato)... CR-051/052 sono un esperimento economico separato... restano feature-flagged e preferibilmente in shadow mode; non devono bloccare la journey core". `SPRINT_GOVERNANCE.md` ha già recepito questa riduzione (un'unica tabella additiva `center_leads`, nessuna automazione economica) — questo documento non riapre quella decisione, la esegue.

## Riconciliazione AS-IS — verificata leggendo il codice, non assunta

| Requisito Sprint 5 | Stato AS-IS (verificato nel codice) | Evidenza |
|---|---|---|
| **Tabella `center_leads` / oggetto CenterLead** | **Non esiste** — nessuna tabella con questo nome o scopo in `supabase/schema.sql` o in nessuna `migration_*.sql` (01-16) | `grep -rn "center_lead" supabase/` → 0 risultati prima di questo sprint |
| **Suggerimento centro non iscritto (Genitore)** | **Mancante** — nessuna UI/azione per segnalare un centro assente | Nessun form "Suggerisci un centro" in `app/(main)/search` o `app/nextgen/search`; nessuna action in `app/actions/` con questo scopo |
| **Coda Admin per lead/referral** | **Mancante** — non confuso con nessuna coda esistente | `/admin/richieste` = SLA messaggistica `activity_inquiries` (Sprint 4, invariata); `/admin/group-requests` = richieste di creazione gruppo (dominio Community, invariata); `/admin/certifications` = certificazioni attività (invariata). Nessuna delle tre è riusabile per CenterLead senza confusione di dominio — serve una coda dedicata `/admin/center-leads` |
| **`invites` (tabella esistente, possibile ambiguità di naming)** | **Dominio completamente distinto, non toccato** | `public.invites` (schema.sql riga 1058) è il codice promo che un Gestore già iscritto genera per invitare NUOVI GENITORI (sconto 10% sulla prima prenotazione, `redeem_invite_discount()`) — nessuna relazione con la segnalazione di un CENTRO non iscritto. `SPRINT_GOVERNANCE.md` lo cita esplicitamente: "nessuna regressione attesa su `invites` (tabella distinta, non toccata)" — confermato, questo sprint non la referenzia in alcun modo |
| **`family_invites` (altra tabella "invites")** | **Altro dominio distinto, non toccato** | Inviti di un genitore verso un secondo genitore per unirsi alla stessa Famiglia (Sprint 5.5 NextGen) — nessuna relazione con CenterLead |
| **Reward/commission economico reale** | **Non esiste alcuna infrastruttura di pagamento/ledger** | Confermato in `CORE_DOMAIN_SOURCE_OF_TRUTH.md` §10: nessuna tabella `payments`/`charges`/`refunds`, nessuna integrazione gateway. Coerente con lo scope esplicito di Sprint 5 (shadow mode/manuale, mai automatico) — non c'è nulla da "automatizzare per errore" perché l'infrastruttura sottostante non esiste |
| **Onboarding Partner esistente (claim → diventa centro reale)** | **Riusabile senza modifiche** | Il flusso "Diventa Partner" esistente (`app/actions/onboarding.ts`, state machine `center_onboarding_state` LEAD→...→APPROVED, Sprint 1) resta l'unico percorso reale per trasformare un centro in un'entità pubblicabile/prenotabile. `center_leads` NON introduce una seconda via di pubblicazione: il "claim" di Sprint 5 collega solo un lead esistente a un centro che ha comunque attraversato l'onboarding normale — coerente con DDL-023 della fonte di design ("Il centro non iscritto è un lead di offerta, non un listing pubblico... solo dopo claim, onboarding e approvazione il centro e le sue attività diventano pubblici/prenotabili") |

## Route/oggetti nuovi previsti da questo sprint

| Route/oggetto nuovo | Portale | Natura | Note di preservazione |
|---|---|---|---|
| `public.center_leads` (migration_17, additiva) | — | Nuova tabella, nessuna colonna esistente alterata | Rollback = drop sicuro (nessuna FK in ingresso da altre tabelle) |
| Form "Suggerisci un centro" | Genitore (NextGen, punto di ingresso da Scopri/Ricerca zero-risultati) | Nuovo componente, nessuna route esistente modificata strutturalmente | Non introduce un listing pubblico (DDL-023): crea solo una riga `center_leads`, mai un'attività visibile/prenotabile |
| `/center-leads` (sezione "I tuoi suggerimenti", Genitore) | Genitore | Nuova pagina, sola lettura delle proprie segnalazioni | Nessun dato riservato di Partner/Admin esposto (AC-049-05) |
| `/admin/center-leads` | Admin | Nuova pagina, pattern analogo a `/admin/certifications` | Aggiunta a `navItems` in `app/admin/layout.tsx`, nessuna voce esistente rimossa/riordinata |

## Esito

Nessuna capability AS-IS a rischio di regressione identificata: `center_leads` è additiva su ogni fronte (tabella nuova, nessuna colonna esistente toccata, nessuna route esistente modificata, `invites`/`family_invites` dominii distinti confermati intatti). Prerequisito documentale di Sprint 5 soddisfatto.

**Decisione di riuso**: pattern "coda Admin + azione review" già collaudato da Certificazione servizio (Sprint storico, task #169-174) — stessa struttura data-layer/azioni/UI, applicata al nuovo dominio CenterLead senza inventare un pattern nuovo.

## Chiusura Sprint 5 — Definition of Done

- **Migrazione additiva**: `supabase/migration_17_center_leads.sql` (non applicata da Claude, per Fabrizio, con pre-check/post-check/rollback — stesso formato di migration_16).
- **RBAC/RLS**: 4 policy verificate per costruzione (select/insert/update/delete), genitore limitato alle proprie righe e a `status='suggested'`/`reward_status='not_applicable'` in insert, solo Admin scrive triage/claim/reward.
- **Happy/alternative/negative path**: happy = suggerimento→qualifica→claim; alternative = duplicato aggregato via dedupe_key; negative = utente non autenticato reindirizzato al login (TC-N606), genitore non può auto-approvarsi (enforced da RLS, non solo UI).
- **Stati loading/empty/error**: stato vuoto "Non hai ancora segnalato nessun centro" (Genitore) e "Nessuna segnalazione attiva/chiusa" (Admin); errori del form (`suggestCenterLeadAction`) mostrati inline.
- **Test**: `tests/one/center-leads.spec.ts`, TC-N600-606 (7 test, `PENDING LOCAL VERIFICATION` — richiedono deploy reale, non eseguiti da Claude).
- **Verifiche statiche**: `tsc --noEmit`, `eslint`, `next build` puliti su tutti i file toccati (vedi commit).
- **Nessun dato test in produzione**: nessun seed automatico, i dati di test vengono creati solo dall'esecuzione reale della suite (stesso `cleanup-test-data.mjs` esistente, non esteso in questo sprint perché `center_leads` non richiede precondizioni).
- **Rollback**: `center_leads` additiva e indipendente (nessuna FK in ingresso da altre tabelle) — rollback sicuro, sezione dedicata nella migrazione.
- **CR/DDL/Transition Register aggiornati**: DEC-46 (`DECISION_LOG.md`), backlog vincolante Sprint 6 già inserito in evidence patch precedente (§16.6), `TRANSITION_REGISTER.md` aggiornato.

**Esito complessivo**: Sprint 5 chiuso. Nessuna regressione Legacy/NextGen (nessun file applicativo esistente modificato oltre `app/admin/layout.tsx` per la nuova voce di nav e `app/nextgen/profile/ProfileNextgenClient.tsx`/`app/nextgen/search/SearchDiscoveryClient.tsx` per i due nuovi punti di ingresso, entrambi additivi). Test PENDING LOCAL VERIFICATION per la stessa ragione di ogni sprint precedente: nessun browser reale disponibile lato Claude.
