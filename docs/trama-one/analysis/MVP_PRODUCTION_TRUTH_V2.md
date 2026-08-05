# TRAMA ONE — MVP Production Truth v2 (05/08/2026, seconda rilevazione)

Aggiornamento di `MVP_PRODUCTION_TRUTH.md` (v1, stessa giornata, mattina), richiesto esplicitamente da Fabrizio per un audit con lo stato più recente. Stessa metodologia di v1: nessuna assunzione, ogni riga verificata dal vivo — `git`/GitHub per il repository, query di sola lettura su Supabase (progetto `eagsgfxunwyyxwwilldy`) per DB/dati reali. Le sezioni sotto riportano solo ciò che è **cambiato** rispetto a v1 o che richiede una nuova evidenza; per il contesto completo (migrazioni 15-21, causa del bug schema cache, ecc.) v1 resta valido e non viene ripetuto.

## 1. Stato repository — aggiornato

| Elemento | v1 (mattina) | v2 (ora, verificato dal vivo) |
|---|---|---|
| HEAD locale | `ed1ddc7` | **`b0d0f21`** — "feat(admin): Sezione 4 TRAMA ONE — Catalogo funzionalità in /admin/feature-flags" |
| `origin/main` (fetch reale) | `ed1ddc7` | **`b0d0f21`**, identico a HEAD (`git fetch origin main` eseguito ora) |
| Working tree | Pulito | Pulito |
| Commit aggiunti da v1 a v2 | — | **12 commit**, elencati sotto |

Commit aggiunti dopo v1 (dal più vecchio al più recente):

1. `2d5eff2` — fix sidebar desktop overflow-y-auto
2. `9534a6d` — rilevare scritture RLS silenziosamente bloccate su `profiles`
3. `b781c5a` — **migration_22** (fix RLS `profiles.WITH CHECK`) + script sblocco account test
4. `1a1d03b` — script arruolamento Controlled Beta Cohort per l'account test Partner
5. `595caca` — seed automatico `activity_days` alla creazione di una nuova attività
6. `db54260` — script backfill `activity_days` per attività esistenti senza giorni
7. `faf6e0f` — fix link invito genitore (puntava al tenant Partner invece che Famiglia)
8. `5a9b93c` — MVP September Readiness Matrix (Sezione 2)
9. `3421afa` — Feature Inventory Complete (Sezione 3)
10. `0c87183` — Feature Registry canonico tipizzato (Sezione 5)
11. `f13595c` — selezione multipla giorni/settimane nel Calendario disponibilità
12. `b0d0f21` — Sezione 4, Catalogo funzionalità in `/admin/feature-flags`

**Nota sul deploy**: come in v1, questo sandbox non ha credenziali Vercel — non posso confermare quale di questi 12 commit sia realmente live in produzione. Fabrizio ha incollato l'esito di un `vercel --prod --force` riuscito **prima** di iniziare la sessione di oggi pomeriggio (quindi prima almeno dei commit 5-12) — resta un gate manuale aperto, invariato da v1: **serve un nuovo deploy** per portare in produzione tutto quanto sopra, e la conferma del commit live va letta dalla dashboard Vercel (`--debug` → `githubCommitSha`, o Deployments → riga Production).

## 2. migration_22 — CONFERMATA APPLICATA (chiude un punto aperto di v1)

v1 segnalava `migration_22_profiles_admin_write_rls_fix.sql` come scritta ma non ancora applicata da Fabrizio. Verificato ora dal vivo, leggendo la policy reale su `public.profiles`:

```
polname: "Profiles: un utente vede/modifica il proprio profilo"
using_expr:      (auth.uid() = id) OR is_platform_admin()
with_check_expr: (auth.uid() = id) OR is_platform_admin()
```

`with_check_expr` non è più `null` (il gap che causava il bug originale) — coincide esattamente con la migrazione. **Applicata, confermata.** Nessuna azione residua su questo punto.

## 3. `activity_days` — backfill CONFERMATO ESEGUITO (chiude un punto aperto di v1/Sezione 2)

v1/Sezione 2 segnalavano 2 attività reali ("test", "Prova FP") con zero righe `activity_days`, e uno script di backfill pronto ma non ancora eseguito. Verificato ora con una query di conteggio per attività:

| Attività | Giorni (prima) | Giorni (ora) |
|---|---|---|
| test | 0 | **30** |
| Prova FP | 0 | **30** |
| (altre 7 attività) | 5-30 (varie) | invariato |

Tutte e 9 le attività esistenti hanno oggi almeno 5 giorni di calendario, nessuna a zero. **Script eseguito con successo, confermato.** Nessuna azione residua su questo punto.

## 4. Email transazionali (`RESEND_API_KEY`) — evidenza reale ottenuta (chiude il punto più importante aperto da v1 e da Sezione 2 punto 7)

v1 e la Readiness Matrix (Sezione 2, punto 7) lasciavano aperta la domanda "la chiave è configurata?" perché tutte le 16 prenotazioni esistenti avevano `email_delivery_status = NULL` — nessun ciclo richiesta→risposta reale era mai transitato dal codice che scrive quel campo.

**Da allora è comparsa 1 riga reale** con lo stato valorizzato:

| `booking.id` | `status` | `email_delivery_status` | `email_delivery_attempted_at` |
|---|---|---|---|
| `0b5b1386-…` | `confirmed` | **`not_configured`** | 2026-08-05 14:19:14 |

**Questo è evidenza diretta, non dedotta**: `not_configured` è lo stato scritto SOLO quando `isEmailConfigured` (`lib/email.ts`, `Boolean(RESEND_API_KEY)`) risulta `false` al momento della risposta Partner (`app/actions/booking-response.ts`). Conclusione verificabile: **`RESEND_API_KEY` NON è configurata nell'ambiente di produzione**, oggi. Non è un bug applicativo — è una configurazione mancante da impostare su Vercel (Project Settings → Environment Variables) se si vuole che le notifiche email accettazione/rifiuto Partner funzionino davvero prima di settembre. Rimane in capo a Fabrizio (variabile d'ambiente Vercel, azione fuori dalla portata di questo sandbox).

Le altre 15 prenotazioni restano `NULL` (nessun ciclo risposta Partner passato su di esse) — invariato, coerente.

## 5. `center_leads` — crescita numerica, natura invariata

v1/Sezione 2 riportavano 1 sola riga (`self_candidacy`, test di Fabrizio). Ora la tabella conta **10 righe**: 1 `self_candidacy` (lo stesso record di prima, classificato `TECHNICAL_TEST`) + **9 `parent_referral`**, tutte con `suggested_name` nel formato `"[TEST] Centro Segnalato <timestamp>"` e `candidate_email = null` — pattern di naming identico ai fixture automatici di Playwright (coerente con la convenzione già documentata in DEC-64). **Nessuna candidatura o segnalazione di un centro/genitore reale**: la crescita è interamente dovuta a run di test, non a traffico reale. Nessuna azione richiesta, ma da tenere presente per non contare questi numeri come attività pilota reale in un report a terzi.

## 6. Feature flag / Controlled Beta Cohort — invariato

`feature_flag_overrides` e `beta_cohort_memberships` risultano identici a quanto già documentato in Sezione 2 (3 righe ciascuna, nessuna aggiunta/rimozione): nessun override globale permanente, cohort con scadenza esplicita (2026-10-02), override `role=platform_admin` senza scadenza confermato come policy intenzionale (DEC-57). Nessuna azione.

## 7. Lavoro applicativo aggiunto da v1 a v2 (non presente nella Readiness Matrix di stamattina)

- **Calendario disponibilità (Gestore)**: selezione multipla giorni/settimane, richiesta esplicita di Fabrizio a metà giornata — implementata, verificata (`tsc`/`eslint` puliti), commit `f13595c`.
- **Admin Feature Control Center (Sezione 4 del programma)**: estesa `/admin/feature-flags` con una sezione "Catalogo funzionalità" sola lettura sul registro canonico (Sezione 5) — commit `b0d0f21`.

## 8. Sintesi — cosa è chiuso ORA che non lo era in v1/Sezione 2

| Punto | v1 / mattina | v2 / ora |
|---|---|---|
| migration_22 applicata | Aperto (scritta, non applicata) | **Chiuso** — confermato in DB |
| Backfill `activity_days` | Aperto (script pronto, non eseguito) | **Chiuso** — confermato in DB, 0 attività a zero giorni |
| `RESEND_API_KEY` configurata? | Non osservabile (tutti NULL) | **Chiuso con evidenza reale: NO, non configurata** — azione residua per Fabrizio (env var Vercel) |
| Deploy repo→produzione | Aperto (nessuna credenziale Vercel) | **Ancora aperto** — 12 commit nuovi da verificare live dopo il prossimo deploy |
| `center_leads` reali (pilota) | 0 | **Ancora 0** — la crescita a 10 righe è solo rumore di test, non pilota reale |

**Uniche azioni residue reali per Fabrizio**: (a) eseguire un nuovo deploy e confermare il commit live; (b) decidere se/quando impostare `RESEND_API_KEY` su Vercel prima di settembre, visto che oggi le email di accettazione/rifiuto Partner non partono per design (chiave assente), non per errore.

## 9. Sezioni 7 e 8 del programma — lavorate dopo questo audit, stato onesto

Aggiunta a valle della prima stesura di questo documento (stesso pomeriggio), per tenere l'audit allineato al lavoro appena committato:

- **Sezione 7 (Chiusura P0 Partner)** — **Chiusa**. Gap DEC-58/DEC-62 (`app/center/page.tsx` non reindirizzava mai un `center_admin` con centro non `APPROVED` verso l'onboarding) risolto in modo additivo: redirect condizionato a `TRAMA_ONE_ENABLED` (stesso resolver/tenant della route di destinazione, per non creare un loop per chi è fuori Controlled Beta Cohort). Commit `19b6449`.
- **Sezione 8 (Chiusura P0 Parent, Context Object)** — **Parzialmente chiusa, onestamente non oltre**. Creata l'infrastruttura condivisa (`lib/journey-context.ts`, tipo `JourneyContext` + encode/decode) e corretto un bug reale isolato (Ricerca NEXTGEN riceveva già un deep-link col bambino selezionato ma non lo leggeva mai). **Non fatto**, deliberatamente: migrare i 4 punti esistenti (card attività → dettaglio → prenotazione) dai parametri piatti attuali (`week`/`kid`/`source`/`cid`) al nuovo oggetto unico — tocca il percorso di prenotazione reale in produzione, e questo programma richiede evidenza di un Golden Journey (Sezione 10, non ancora fatta) prima di modificare quel percorso specifico. Commit `030713e`.
