# TRAMA ONE — MVP September Readiness Matrix (Sezione 2)

Sezione 2 di "TRAMA ONE — Final MVP September Readiness e Admin Feature Control Center". Segue la Production Truth (Sezione 1, `MVP_PRODUCTION_TRUTH.md`), approvata da Fabrizio con 7 integrazioni obbligatorie. Ogni punto sotto è verificato dal vivo (query di sola lettura Supabase, progetto `eagsgfxunwyyxwwilldy`, o lettura diretta del codice sorgente) — mai dalla documentazione precedente. Le migrazioni 15-21 restano confermate applicate (Sezione 1): non riaperte, non rieseguite.

## 0. Readiness Matrix per dominio (sintesi trasversale)

Stato attuale di ogni dominio funzionale rilevante per un GO/NO-GO di settembre, con l'evidenza che lo sostiene — nessuna riga assume uno stato dalla documentazione precedente senza controllo dal vivo in questa sessione o nella Sezione 1.

| Dominio | Stato | Evidenza | Azione residua |
|---|---|---|---|
| P0 Partner — journey candidatura→login→dashboard | **GO** | Bug RLS `profiles.WITH CHECK` chiuso (migration_22, non ancora applicata da Fabrizio — vedi sotto), redirect confermato funzionante da Fabrizio dopo lo script di sblocco | Fabrizio deve ancora applicare `migration_22_profiles_admin_write_rls_fix.sql` per la correzione strutturale (lo sblocco puntuale del suo account è già attivo) |
| P0 Partner — Spotlight/tour onboarding | **GO CON CONDIZIONE** | Tour funzionante dopo arruolamento in beta cohort; bug reale trovato e chiuso oggi (seed `activity_days` mancante bloccava lo step "Configura i Giorni spot") | Fabrizio deve eseguire `script_backfill_activity_days_seed.sql` per le 2 attività già esistenti senza giorni |
| P0 Parent — journey continuità (Context Object) | **NON VERIFICATO IN QUESTA SESSIONE** | Sezione 8 del programma (task #471), non ancora iniziata | Da eseguire in sequenza |
| Feature flag / Controlled Beta Cohort | **GO** | Punti 1-4 sotto: 3 membership coerenti, resolver verificato su 5 contesti, precedenza reale documentata, override `role=platform_admin` classificato come policy intenzionale | Nessuna |
| Candidati Partner (form pubblico) | **GO** | Punto 5 sotto: candidatura reale creata e processata dopo il reload schema cache | Nessuna |
| Deploy pipeline (repo↔produzione) | **APERTO** | Punto 6 sotto: HEAD/origin/main coincidono (`faf6e0f`), commit live in produzione non verificabile da questo sandbox | Fabrizio deve confermare il commit live dopo il prossimo deploy |
| Email transazionali (accettazione/rifiuto Partner) | **APERTO** | Punto 7 sotto: 16/16 bookings con `email_delivery_status=NULL`, nessun test end-to-end reale mai eseguito | Fabrizio deve eseguire un ciclo richiesta→risposta reale |
| Migrazioni 15-21 | **GO** (non riaperto) | Confermato applicato in Sezione 1, per istruzione esplicita non ri-verificato qui | Nessuna |
| Sidebar/menu desktop e mobile (bug UX) | **GO** | Fix committati e verificati (tsc/eslint puliti) in questa sessione | In attesa del prossimo deploy per andare live |
| Link di invito genitore (host sbagliato) | **GO** | Fix committato e verificato in questa sessione | In attesa del prossimo deploy per andare live |
| Visual Acceptance Gate (§15, 3 breakpoint) | **APERTO (pregresso)** | DEC-61: gate aperto, richiede screenshot reali da Fabrizio, mai chiuso completamente | Da chiudere da Fabrizio, fuori perimetro di questa sessione |

Le righe "APERTO" sono le uniche condizioni residue per un GO pieno di settembre — tutte richiedono un'azione reale di Fabrizio (deploy, test browser, o entrambi), coerente con l'istruzione di fermarsi solo lì.

## 1. Inventario completo `beta_cohort_memberships`

Query dal vivo (`select * from beta_cohort_memberships left join profiles`), 05/08/2026:

| Utente/entità | Ruolo | Coorte | Scadenza | Stato (`active`) | Accesso effettivo oggi |
|---|---|---|---|---|---|
| `faberx83+test-genitore@gmail.com` (`e1787fd6-…`) | `parent` | `trama-one-controlled-beta` | 2026-10-02 14:24 | `true` | **Sì** — membership valida (non scaduta) |
| `faberx83+test-gestore@gmail.com` (`68cf46f3-…`) | `center_admin` | `trama-one-controlled-beta` | 2026-10-02 14:24 | `true` | **Sì** — membership valida |
| `faberx83+partnernew@gmail.com` (`847bc128-…`) | `center_admin` | `trama-one-controlled-beta` | 2026-10-04 13:57 | `true` | **Sì** — arruolato oggi stesso (script `script_enroll_partnernew_beta_cohort.sql`, eseguito da Fabrizio) |

Totale: **3 righe**, nessuna riga spuria, nessun centro/famiglia pilota reale arruolato (coerente con DEC-57: "nessuna aggiunta, per ora, di famiglie o centri pilot reali" — vincolo ancora rispettato, l'unica aggiunta di oggi è un account di test di Fabrizio stesso, non un pilota reale).

## 2. Verifica del resolver `TRAMA_ONE_ENABLED`

`feature_flag_overrides` per questo flag, query dal vivo:

| scope | scope_value | enabled | expires_at |
|---|---|---|---|
| `cohort` | `trama-one-controlled-beta` | `true` | 2026-10-02 14:24 (non scaduto) |
| `global` | *(null)* | `false` | 2026-08-03 14:24 (**scaduto**, ininfluente) |
| `role` | `platform_admin` | `true` | *(null — nessuna scadenza)* |

Nessuna riga `scope=user`, `scope=tenant`, `scope=environment`. Risoluzione simulata eseguendo a mano `evaluateFlag()` (`lib/feature-flags/evaluate.ts`) contro questi dati reali, per i 5 contesti richiesti:

| Contesto | userId | role | In coorte? | Risultato | Perché (scope che ha vinto) |
|---|---|---|---|---|---|
| `platform_admin` | qualunque | `platform_admin` | irrilevante | **true** | `role=platform_admin` (override permanente) |
| Parent test (`e1787fd6-…`) | sì | `parent` | sì | **true** | `cohort=trama-one-controlled-beta` (nessun override `role=parent`) |
| Partner test (`68cf46f3-…` o `847bc128-…`) | sì | `center_admin` | sì | **true** | `cohort=trama-one-controlled-beta` (nessun override `role=center_admin`) |
| Utente autenticato fuori coorte (es. un `parent`/`center_admin` qualunque non arruolato) | sì | `parent`/`center_admin` | no | **false** | Nessun match su alcuno scope applicabile → `defaultValue` del registry (`false`). L'override `global` esiste ma è **scaduto** (2026-08-03), quindi filtrato da `isExpired()` prima ancora di essere valutato — il risultato è `false` per il default, non per quell'override disabilitato: distinzione verificata nel codice (`evaluateFlag`, righe 153-162), non assunta. |
| Anonimo (nessuna sessione) | no | `null` | no (nessun `userId` → `getActiveCohortKeys` non viene nemmeno chiamata, `cohortKeys=[]`) | **false** | Stesso motivo: nessun override applicabile, `defaultValue=false` |

## 3. Evidenza della precedenza reale

**Correzione rispetto alla richiesta**: la precedenza indicata nel messaggio ("user / center / cohort / role / global / default") **non corrisponde al codice**, verificato leggendo `lib/feature-flags/evaluate.ts` (`SCOPE_PRECEDENCE`, righe 30-37) e `lib/feature-flags/registry.ts` (`FeatureFlagScope`, righe 15-21):

- **Non esiste alcuno scope `center`** nel sistema. Gli scope validi sono esattamente 6: `global`, `environment`, `user`, `role`, `tenant`, `cohort`.
- La precedenza reale, dalla più alla meno specifica, è: **`user` > `role` > `cohort` > `tenant` > `environment` > `global`**, poi `defaultValue` del registry se nessuno scope ha un override applicabile (non scaduto e con `scopeMatchesContext` vero).

Questo significa concretamente che un override `role` (come `platform_admin`) vince SEMPRE su un override `cohort`, se entrambi fossero applicabili alla stessa persona — verificato nel codice (`for (const scope of SCOPE_PRECEDENCE) { const match = applicable.find(...); if (match) return match.enabled; }`, righe 157-160: il primo scope della lista con un match vince, senza guardare gli altri). Nel dataset attuale questo non produce mai un conflitto osservabile (nessuno ha contemporaneamente un override `role` diverso da `platform_admin` e una membership `cohort`), ma è la regola reale da tenere a mente per l'Admin Feature Control Center (Sezione 4).

## 4. Classificazione dell'override `role=platform_admin` senza `expires_at`

**Policy strutturale intenzionale**, non un override dimenticato. Evidenza diretta in `docs/trama-one/analysis/DECISION_LOG.md`, DEC-57: *"nuovo override `scope=role`, `scope_value='platform_admin'`, `enabled=true`, `expires_at=null` — verificato PRIMA di aggiungerlo, leggendo `app/one/layout.tsx`/`app/admin/one/layout.tsx`, che nessun bypass strutturale per platform_admin esistesse già (nessuna duplicazione), **politica di non-scadenza per questo ruolo dichiarata deliberata**"*.

Non richiede quindi una scadenza da aggiungere: è l'accesso permanente e intenzionale del team interno alle feature TRAMA ONE, distinto per costruzione dall'accesso a termine della Controlled Beta Cohort (che invece ha sempre una scadenza esplicita, punto 1 sopra). Nessuna azione necessaria su questo punto.

## 5. Verifica candidatura reale dopo il reload della schema cache

Confermato dal vivo, query su `center_leads`:

| Campo | Valore |
|---|---|
| `id` | `5cd2b8f8-f5de-42a2-97b3-64df1c455e5f` |
| `lead_type` | `self_candidacy` |
| `candidate_email` | `faberx83+partnernew@gmail.com` |
| `suggested_name` | "Centro estivo prova candidatura" |
| `status` | `claimed` |
| `claimed_center_id` | `f572aa29-c070-46e0-bd98-5c3ce6dd25ed` |
| `created_at` | 2026-08-05 13:28:49 |
| `claimed_at` | 2026-08-05 13:29:39 |

- **Record `center_leads` creato**: sì, confermato (il form `/auth/candidati` ha scritto con successo dopo il reload — l'errore "schema cache" segnalato nello screenshot iniziale non si è ripresentato).
- **Visibilità nella coda Admin**: confermata indirettamente ma in modo inequivocabile — lo stato `claimed` con `claimed_center_id` valorizzato è raggiungibile SOLO tramite l'azione "Approva e crea centro" della coda `/admin/center-leads` (`CenterLeadsAdminClient.tsx`); non esiste altro percorso che scriva quello stato. Il record era quindi visibile e stato processato correttamente.
- **Classificazione TECHNICAL_TEST**: confermata. È l'unica riga `self_candidacy` esistente nel database, creata dallo stesso Fabrizio con un nome esplicitamente di test ("Centro estivo prova candidatura"), non una candidatura di un centro pilota reale — coerente con la stessa convenzione di naming già usata per gli altri record di test individuati in DEC-64 (prefisso "[TEST]"/nome auto-esplicativo).

## 6. Riconciliazione repository/produzione dopo il prossimo deploy

**Stato ATTUALE (pre-deploy)**, verificato dal vivo:

| Elemento | Valore |
|---|---|
| HEAD locale | `faf6e0f` — "fix(invites): il link di invito genitore deve sempre puntare al tenant famiglia" |
| `origin/main` (fetch reale, non cache) | `faf6e0f` — identico a HEAD |
| Working tree | Pulito |
| Commit testato da Fabrizio (`TEST_SCOPE=critical`, 12:45) | `3248621` |
| Commit live in produzione (ultimo `vercel --prod --force` riuscito, oggi ~15:14) | Non verificabile da questo sandbox (nessuna credenziale Vercel: `vercel whoami` → "No existing credentials found") — **stimato** `1a1d03b` per ordine cronologico dei commit rispetto al log del deploy incollato da Fabrizio, ma non confermato via API |
| Commit non ancora ri-deployati (rispetto alla stima sopra) | `595caca` (seed `activity_days`), `db54260` (script backfill), `faf6e0f` (fix host invito) — 3 commit |

**Azione richiesta a Fabrizio** per chiudere questo punto con certezza (non eseguibile da qui): dopo il prossimo `bash deploy.sh`, incollare l'output — in particolare la riga `githubCommitSha` nella risposta dell'API Vercel (visibile con `--debug`) o il commit mostrato nella dashboard Vercel → Deployments → riga "Production" — così da confermare che coincida con `HEAD`/`origin/main` di quel momento. Finché questo dato non arriva da un'azione reale di Fabrizio, questo punto resta **aperto per costruzione** (nessuna credenziale Vercel in questo ambiente, coerente con la governance: i deploy sono sempre un'azione manuale di Fabrizio).

## 7. Golden Journey richiesta→risposta: `email_delivery_status`

Query dal vivo su `bookings.email_delivery_status`:

| Valore | Conteggio |
|---|---|
| `NULL` | 16 (100% delle righe esistenti) |
| `sent` | 0 |
| `failed` | 0 |
| `not_configured` | 0 |
| `no_recipient` | 0 |

**Nessuna riga ha mai attraversato il codice che scrive questa colonna** (`recordEmailDeliveryStatus()`, `app/actions/booking-response.ts` righe 43-57) — il NULL uniforme non è un'anomalia, è l'assenza totale di un test end-to-end reale (richiesta genitore → risposta Partner) da quando questo codice è stato scritto (Sprint 6, DEC-49).

**Su `RESEND_API_KEY`**: non posso leggere variabili d'ambiente Vercel da questo sandbox (nessun accesso). L'evidenza di codice mostra che, se la chiave NON fosse configurata, la prima risposta reale di un Partner scriverebbe `email_delivery_status='not_configured'` (non `NULL`) — verificato in `lib/email.ts` riga 19 (`isEmailConfigured = Boolean(RESEND_API_KEY)`) e `booking-response.ts` righe 66-71. **Non è quindi possibile affermare oggi, con evidenza reale, se la chiave è configurata o meno** — serve un test end-to-end reale: Fabrizio esegue un ciclo richiesta genitore → risposta Partner (accetta o rifiuta) su un `booking_day`/`booking_week` reale, poi si rilegge `email_delivery_status` per quella riga. Tre esiti possibili e cosa significano:
- `sent` → chiave configurata, invio riuscito.
- `failed` (con `email_delivery_error` valorizzato) → chiave configurata ma invio fallito (dominio non verificato su Resend, destinatario non valido, ecc. — l'errore esatto è nella colonna).
- `not_configured` → chiave assente, comportamento "disattivato" per design, non un bug.

Questo punto resta **aperto**, richiede un'azione reale di Fabrizio (richiesta → risposta), non eseguibile da qui.

## 8. Sintesi — cosa è chiuso e cosa resta aperto in questa sezione

| Punto richiesto | Stato |
|---|---|
| 1. Inventario `beta_cohort_memberships` | **Chiuso** — 3 righe, nessuna anomalia |
| 2. Verifica resolver 5 contesti | **Chiuso** — tutti e 5 risolti con evidenza |
| 3. Precedenza reale | **Chiuso** — precedenza reale documentata, **discrepanza corretta** rispetto alla richiesta (nessuno scope `center`, ordine reale user>role>cohort>tenant>environment>global) |
| 4. Classificazione override `role=platform_admin` | **Chiuso** — policy strutturale intenzionale (DEC-57), nessuna scadenza da aggiungere |
| 5. Candidatura post-reload | **Chiuso** — record creato, visibile in coda Admin, classificato TECHNICAL_TEST |
| 6. Riconciliazione post-deploy | **Aperto** — richiede l'output del prossimo `bash deploy.sh` da Fabrizio (nessuna credenziale Vercel qui) |
| 7. `email_delivery_status` / `RESEND_API_KEY` | **Aperto** — richiede un ciclo richiesta→risposta reale da Fabrizio |

Procedo ora, come da istruzione, con il Feature Inventory (Sezione 3) senza fermarmi — i due punti aperti sopra (6 e 7) restano segnalati come condizioni indipendenti, non bloccano l'analisi statica del resto del programma.
