# PRE-MICRO-PILOT GATE STATUS

**TRAMA — PRE-MICRO-PILOT CLOSURE GATE.** Decisione Fabrizio, 25/08/2026 ("La Wave 1 è accettata"). Report finale richiesto in §7 del messaggio operativo. AS_OF: 25/08/2026, dopo i commit `1d698e8` (R-01), `a204d2c` (R-08), `8386237` (Privacy v2).

## 1. PASS/FAIL sintetico (campi richiesti da Fabrizio)

| Campo | Stato | Nota |
|---|---|---|
| **Admin real-center list** | **PASS** | R-01 chiuso oggi. `/admin/centers` e `/admin/centers/[id]` mostrano dati Supabase reali (11 centri), non più `lib/mock-data.ts`. Classificazione test/demo euristica visibile. Non-admin negato (TC-N672, preesistente via `AccessGate`). Test: TC-085/TC-085b/TC-087 in `tests/admin/gestione.spec.ts` (richiedono deploy live per essere eseguiti). |
| **Privacy technical readiness** | **PARTIAL** | Framework tecnico v2 pronto (4 tabelle coerenti: `legal_documents`/`legal_acceptances`/`consent_events`/`parental_declarations`), coerenza riverificata e 3 problemi reali corretti (vedi §2). **Non applicato** (nessuna `apply_migration` eseguita). Testo legale reale: **PENDING EXTERNAL REVIEW**, mai dichiarato conforme GDPR. |
| **migration_27 readiness** | **READY TO APPLY, NON APPLICATA** | v2 completa di PRE-CHECK/SQL/POST-CHECK/ROLLBACK. SHA-256: `e89efd877506dc0ae7a64f6e694d6aa783d881ade7293524a516f4c52604401b`. Applicazione resta azione di Fabrizio. |
| **Resend readiness** | **FAIL (non operativo) — fallback manuale FORMALIZZATO oggi** | `RESEND_API_KEY` non configurata in produzione (verificato: 0 righe `email_delivery_status='sent'` su `bookings`). Gate elevato a MUST BEFORE MICRO PILOT. Procedura di fallback manuale concreta e proporzionata alla scala pilot (query SQL + contatto telefonico/WhatsApp) scritta in `GATE_RESEND_API_KEY.md` — soddisfa la condizione "Resend operativo OPPURE fallback formalizzato", ma resta un'azione di Fabrizio decidere se attivarlo o configurare Resend prima del pilot. |
| **Next security readiness** | **PENDING (per piano, non un gap)** | `package.json` ancora `next@16.2.10` (verificato). Piano invariato da Wave 1: eseguire SOLO dal 26/08/2026 in poi (release `16.3.3` copre sia le 7 CVE HIGH di luglio sia la CRITICAL di agosto in un solo upgrade). Nessuna azione oggi per costruzione — eseguire prima sarebbe stato un errore, non un progresso. |
| **RC2 readiness** | **NON ASSEGNATA** | Vedi §3: 6 dei 9 item chiusi, 2 apertamente non chiudibili oggi (Resend operativo, Next patch live — entrambi per motivi strutturali/temporali, non per lavoro mancante), 1 parziale (Privacy: framework pronto, non applicato). |
| **Remaining manual gates** | Vedi §4 | 5 gate genuinamente manuali, nessuno bypassabile da codice. |
| **Blockers al primo utente reale** | Vedi §5 | — |

## 2. Privacy/Termini — cosa è cambiato oggi (dettaglio task #559)

Verifica di coerenza richiesta da Fabrizio contro 7 punti (`legal_documents`, `legal_acceptances`, `consent_events`, dichiarazione genitoriale, marketing separato, versioning Termini, Privacy Notice non trattata come consenso). Risultato: **3 problemi reali trovati**, tutti corretti in `migration_27` v2 (non applicata):

1. **Incoerenza corretta**: la Privacy Notice in v1 condivideva il vocabolario "accepted/declined/withdrawn" del marketing (un consenso revocabile) — concettualmente sbagliato, un'informativa Art. 13 non si "ritira". Ora in tabella dedicata `legal_acceptances`, solo "accettato".
2. **Gap di integrità referenziale colmato**: versione documento ora è una vera foreign key (`legal_documents`), non più una stringa libera.
3. **Scoperta via query Supabase reale**: `profiles.marketing_consent` esiste **già** in produzione da `migration_06` (sprint precedente, indipendente), già letta/scritta da `updateMarketingConsentAction()` — il requisito "marketing separato" era già soddisfatto da uno sprint precedente. v1 lo avrebbe ri-aggiunto per errore.
4. **Gap colmato** (era esplicitamente aperto in v1 §6): dichiarazione di responsabilità genitoriale sui dati dei bambini — nuova tabella `parental_declarations`, verificata contro `kids.parent_id` in scrittura.

Stato legale: **PENDING EXTERNAL REVIEW**, invariato. Nessuna riga di alcun documento di questo programma dichiara conformità GDPR.

## 3. Perché RC2 non è assegnata — i 9 item

| # | Item | Stato | Motivo |
|---|---|---|---|
| 1 | Admin center operability | **Chiuso** (oggi, R-01) | — |
| 2 | Partner dashboard reale | **Chiuso** (Wave 1, R-02) | Verificato in sessione precedente, non ri-auditato in dettaglio oggi (nessun segnale di regressione) |
| 3 | Planner accessibility | **Chiuso** (Wave 1, R-19) | idem |
| 4 | Capacity atomicity | **Chiuso** (Wave 1, R-07) | idem |
| 5 | Planner regression tests | **Chiuso** (Wave 1, R-09) | idem |
| 6 | Admin hardening | **Chiuso** (Wave 1, R-14) | idem |
| 7 | Privacy technical framework | **Parziale** | Framework pronto e coerente (oggi, v2), ma **non applicato** — nessuna tabella esiste ancora in produzione |
| 8 | Next.js security patch | **Aperto per piano** | Deliberatamente rimandato a dopo il 26/08/2026 (decisione Fabrizio, Wave 1) — non un gap di esecuzione |
| 9 | Resend configuration | **Aperto** | Non configurato; fallback manuale formalizzato oggi ma non ancora una sostituzione operativa testata |

**Conclusione**: anche assumendo 1-6 pienamente confermati, gli item 7-9 restano non chiudibili oggi per motivi strutturali (attesa di un rilascio esterno il 26/08, attesa di un account Resend di Fabrizio, attesa di conferma del modello Privacy da parte di Fabrizio prima di applicare `migration_27`) — non per lavoro tecnico mancante da parte di Claude. **RC2 non va assegnata finché questi 3 non sono chiusi.**

## 4. Gate manuali reali rimanenti (nessuno bypassabile da codice)

1. **Resend**: creare account, verificare dominio, generare API key, impostare `RESEND_API_KEY`/`INVITE_FROM_EMAIL` su Vercel, redeploy — **oppure** attivare esplicitamente il fallback manuale documentato in `GATE_RESEND_API_KEY.md`.
2. **Privacy/Termini**: confermare il modello v2 (4 tabelle), fornire/validare il testo legale reale (Termini, Privacy Notice, dichiarazione genitoriale), poi applicare `migration_27_privacy_terms_consent.sql` su Supabase (PRE-CHECK/POST-CHECK/ROLLBACK già pronti nel file).
3. **Next.js security**: dal 26/08/2026, confermare pubblicazione `16.3.3`, eseguire il piano in `NEXTJS_SECURITY_UPGRADE_PLAN.md` (upgrade, audit, test, commit) — **deploy resta di Fabrizio**.
4. **Deploy**: qualunque deploy in produzione (`bash deploy.sh`/`vercel --prod`) resta esclusivamente un'azione di Fabrizio, per governance concordata.
5. **Golden Journey / Visual Acceptance dal vivo**: i task #473 (Golden Journeys A-F) e #474/#526 (Visual Acceptance 3 formati) risultano **ancora pending** nel tracker di questa sessione — non chiusi da nessun lavoro recente. Vanno eseguiti (idealmente da Fabrizio o con supervisione, essendo verifiche visive/E2E su ambiente live) prima del Micro Pilot.

## 5. Blocchi al primo utente/centro reale (in ordine di dipendenza)

1. Testo legale reale (Termini/Privacy Notice/dichiarazione genitoriale) — **senza questo, nessuna migrazione 27 applicabile con contenuto reale**.
2. `migration_27` applicata + verificata (POST-CHECK del file).
3. Resend operativo **o** fallback manuale attivato esplicitamente da Fabrizio per la durata del pilot.
4. Next.js aggiornato a `16.3.3` (dal 26/08/2026).
5. Golden Journey Parent/Partner e Visual Acceptance eseguiti live e verdi (task #473/#474 tuttora pending).
6. Deploy in produzione del commit finale (azione di Fabrizio).

## 6. Cosa è stato fatto in questa sessione (riepilogo)

- **R-01** (task #557): `/admin/centers` e dettaglio resi reali, test aggiunti, commit `1d698e8`.
- **R-08** (task #558): gate email elevato a MUST BEFORE MICRO PILOT, fallback manuale formalizzato, commit `a204d2c`.
- **Privacy/Termini** (task #559): `migration_27` riverificata e corretta a v2 (3 problemi reali risolti), **non applicata**, commit `8386237`.
- **Next.js security** (task #560): stato confermato, piano invariato, nessuna azione (per costruzione).
- **RC2** (task #561): confermato NON assegnabile, 3 motivi documentati sopra.
- **Micro Pilot criteria** (task #562): verificati via query Supabase reali dove applicabile (product_events: 992 righe popolate; centers: 11; email_delivery_status: nessun 'sent').

## Fermata

Come richiesto esplicitamente da Fabrizio: **ci si ferma qui**. Ogni gate rimanente in §4 richiede un'azione che solo Fabrizio può compiere (account esterno, testo legale, conferma di un modello dati, o un deploy) — non c'è altro lavoro di codice o verifica automatizzabile che sblocchi ulteriormente questi punti oggi.
