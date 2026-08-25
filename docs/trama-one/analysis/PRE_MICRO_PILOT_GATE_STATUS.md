# PRE-MICRO-PILOT GATE STATUS

**TRAMA — PRE-MICRO-PILOT CLOSURE GATE.** Decisione Fabrizio, 25/08/2026 ("La Wave 1 è accettata"). Report finale richiesto in §7 del messaggio operativo. AS_OF: 25/08/2026, dopo i commit `1d698e8` (R-01), `a204d2c` (R-08), `8386237` (Privacy v2).

**AGGIORNAMENTO 25/08/2026 (sera) — `migration_27` v2 applicata da Fabrizio in produzione (LIVE) e wiring tecnico completo costruito sopra (task #566-575, commit `a3b0c70`, `27de6ad`, `d9f6e38`, `b9f7f2f`, `34f23de`, `cb5276f`).** §1/§2/§3/§4/§5/§6 sotto aggiornati di conseguenza. Vedi §7 per lo stato R-03 finale.

**AGGIORNAMENTO 25/08/2026 (notte) — `migration_28` (difettosa, ricorsione RLS) sostituita da `migration_29` v2, LIVE e verificata PASS (task #605-607); service-role rimosso dal percorso di lettura di `/privacy` e `/terms`.** PUBLIC LEGAL ACCESS ora **READY** (tecnicamente — vedi `PRIVACY_TERMS_TECHNICAL_DESIGN.md` §9 e `MVP_PRODUCTION_TRUTH.md` §8 per il dettaglio completo). Il campo "Privacy technical readiness" in §1 resta invariato nel verdetto complessivo (BLOCKED BY LEGAL CONTENT, non dalla tecnica) — l'unico gate genuino rimasto è il testo legale reale, non più alcun gap RLS/service-role.

## 1. PASS/FAIL sintetico (campi richiesti da Fabrizio)

| Campo | Stato | Nota |
|---|---|---|
| **Admin real-center list** | **PASS** | R-01 chiuso oggi. `/admin/centers` e `/admin/centers/[id]` mostrano dati Supabase reali (11 centri), non più `lib/mock-data.ts`. Classificazione test/demo euristica visibile. Non-admin negato (TC-N672, preesistente via `AccessGate`). Test: TC-085/TC-085b/TC-087 in `tests/admin/gestione.spec.ts` (richiedono deploy live per essere eseguiti). |
| **Privacy technical readiness** | **TECHNICAL IMPLEMENTATION: BUILT/STATIC_TESTED; DATABASE: LIVE; LEGAL CONTENT: PENDING EXTERNAL REVIEW; LEGAL GATE: OFF; PILOT READINESS: BLOCKED BY LEGAL CONTENT** | `migration_27` v2 applicata da Fabrizio, LIVE (§7). Wiring tecnico completo costruito sopra: signup (checkbox Termini/Privacy/Marketing), route pubbliche `/privacy` e `/terms`, dichiarazione parentale, vista Admin view-only, feature flag `LEGAL_TERMS_GATE` (default `false`, GLOBAL OFF), 16 test nominati LEGAL-01..16. Testo legale reale: **PENDING EXTERNAL REVIEW**, mai dichiarato conforme GDPR — nessun utente reale vede oggi una schermata di consenso (gate OFF). **NON è uno stato CLOSED.** |
| **migration_27 readiness** | **APPLICATA, LIVE** | v2 applicata manualmente da Fabrizio in SQL Editor. POST-CHECK di sola lettura confermato: 4 tabelle presenti, RLS attiva su tutte, 8 policy corrispondenti esattamente alla migrazione, 0 righe in `legal_documents`. SHA-256: `e89efd877506dc0ae7a64f6e694d6aa783d881ade7293524a516f4c52604401b`. **Nessuna riapplicazione proposta o necessaria.** |
| **Resend readiness** | **FAIL (non operativo) — fallback manuale FORMALIZZATO oggi** | `RESEND_API_KEY` non configurata in produzione (verificato: 0 righe `email_delivery_status='sent'` su `bookings`). Gate elevato a MUST BEFORE MICRO PILOT. Procedura di fallback manuale concreta e proporzionata alla scala pilot (query SQL + contatto telefonico/WhatsApp) scritta in `GATE_RESEND_API_KEY.md` — soddisfa la condizione "Resend operativo OPPURE fallback formalizzato", ma resta un'azione di Fabrizio decidere se attivarlo o configurare Resend prima del pilot. |
| **Next security readiness** | **PENDING (per piano, non un gap)** | `package.json` ancora `next@16.2.10` (verificato). Piano invariato da Wave 1: eseguire SOLO dal 26/08/2026 in poi (release `16.3.3` copre sia le 7 CVE HIGH di luglio sia la CRITICAL di agosto in un solo upgrade). Nessuna azione oggi per costruzione — eseguire prima sarebbe stato un errore, non un progresso. |
| **RC2 readiness** | **NON ASSEGNATA** | Vedi §3: 6 dei 9 item chiusi, 3 apertamente non chiudibili oggi (Resend operativo, Next patch live, testo legale pubblicato — tutti per motivi strutturali/esterni, non per lavoro mancante). **`migration_27` LIVE non è di per sé sufficiente ad assegnare RC2** — il gate resta bloccato dal contenuto legale, non dalla tecnica. |
| **Remaining manual gates** | Vedi §4 | 5 gate genuinamente manuali, nessuno bypassabile da codice. |
| **Blockers al primo utente reale** | Vedi §5 | — |

## 2. Privacy/Termini — cosa è cambiato oggi (dettaglio task #559)

Verifica di coerenza richiesta da Fabrizio contro 7 punti (`legal_documents`, `legal_acceptances`, `consent_events`, dichiarazione genitoriale, marketing separato, versioning Termini, Privacy Notice non trattata come consenso). Risultato: **3 problemi reali trovati**, tutti corretti in `migration_27` v2 (non applicata):

1. **Incoerenza corretta**: la Privacy Notice in v1 condivideva il vocabolario "accepted/declined/withdrawn" del marketing (un consenso revocabile) — concettualmente sbagliato, un'informativa Art. 13 non si "ritira". Ora in tabella dedicata `legal_acceptances`, solo "accettato".
2. **Gap di integrità referenziale colmato**: versione documento ora è una vera foreign key (`legal_documents`), non più una stringa libera.
3. **Scoperta via query Supabase reale**: `profiles.marketing_consent` esiste **già** in produzione da `migration_06` (sprint precedente, indipendente), già letta/scritta da `updateMarketingConsentAction()` — il requisito "marketing separato" era già soddisfatto da uno sprint precedente. v1 lo avrebbe ri-aggiunto per errore.
4. **Gap colmato** (era esplicitamente aperto in v1 §6): dichiarazione di responsabilità genitoriale sui dati dei bambini — nuova tabella `parental_declarations`, verificata contro `kids.parent_id` in scrittura.

Stato legale: **PENDING EXTERNAL REVIEW**, invariato. Nessuna riga di alcun documento di questo programma dichiara conformità GDPR.

**Aggiornamento 25/08/2026 (sera)**: `migration_27` v2 applicata da Fabrizio in produzione (LIVE). Sopra lo schema live è stato costruito l'intero wiring tecnico (task #566-574): feature flag `LEGAL_TERMS_GATE` (default `false`, GLOBAL OFF, nessun override globale scritto), checkbox Termini/Privacy/Marketing al signup con scrittura versionata server-side, route pubbliche `/privacy` e `/terms` (stato "Documento in preparazione" finché nessun documento è PUBLISHED), dichiarazione parentale a creazione bambino, vista Admin view-only (`/admin/legal`), 16 test nominati LEGAL-01..16. Dettaglio completo in §7 e in `PRIVACY_TERMS_TECHNICAL_DESIGN.md`.

## 3. Perché RC2 non è assegnata — i 9 item

| # | Item | Stato | Motivo |
|---|---|---|---|
| 1 | Admin center operability | **Chiuso** (oggi, R-01) | — |
| 2 | Partner dashboard reale | **Chiuso** (Wave 1, R-02) | Verificato in sessione precedente, non ri-auditato in dettaglio oggi (nessun segnale di regressione) |
| 3 | Planner accessibility | **Chiuso** (Wave 1, R-19) | idem |
| 4 | Capacity atomicity | **Chiuso** (Wave 1, R-07) | idem |
| 5 | Planner regression tests | **Chiuso** (Wave 1, R-09) | idem |
| 6 | Admin hardening | **Chiuso** (Wave 1, R-14) | idem |
| 7 | Privacy technical framework | **BUILT/STATIC_TESTED — DATABASE LIVE — bloccato dal contenuto legale** | `migration_27` applicata e wiring tecnico completo costruito (oggi, sera). **Non chiudibile**: manca il testo legale reale validato/pubblicato (`legal_documents` ha 0 righe) — gate `LEGAL_TERMS_GATE` resta OFF per costruzione finché questo non arriva |
| 8 | Next.js security patch | **Aperto per piano** | Deliberatamente rimandato a dopo il 26/08/2026 (decisione Fabrizio, Wave 1) — non un gap di esecuzione |
| 9 | Resend configuration | **Aperto** | Non configurato; fallback manuale formalizzato oggi ma non ancora una sostituzione operativa testata |

**Conclusione**: anche assumendo 1-6 pienamente confermati, gli item 7-9 restano non chiudibili oggi per motivi strutturali (attesa di un rilascio esterno il 26/08, attesa di un account Resend di Fabrizio, attesa del testo legale reale validato/pubblicato da Fabrizio) — non per lavoro tecnico mancante da parte di Claude. **`migration_27` essere LIVE non basta a chiudere l'item 7**: il gate è ora bloccato esclusivamente dal contenuto legale, non dalla tecnica. **RC2 non va assegnata finché questi 3 non sono chiusi.**

## 4. Gate manuali reali rimanenti (nessuno bypassabile da codice)

1. **Resend**: creare account, verificare dominio, generare API key, impostare `RESEND_API_KEY`/`INVITE_FROM_EMAIL` su Vercel, redeploy — **oppure** attivare esplicitamente il fallback manuale documentato in `GATE_RESEND_API_KEY.md`.
2. **Privacy/Termini**: `migration_27` già applicata (LIVE) e wiring tecnico già costruito — resta solo: fornire/validare/pubblicare il testo legale reale (Termini, Privacy Notice, dichiarazione genitoriale) in `legal_documents`, poi abilitare `LEGAL_TERMS_GATE` (inizialmente solo su coorte di test, mai globalmente senza conferma esplicita).
3. **Next.js security**: dal 26/08/2026, confermare pubblicazione `16.3.3`, eseguire il piano in `NEXTJS_SECURITY_UPGRADE_PLAN.md` (upgrade, audit, test, commit) — **deploy resta di Fabrizio**.
4. **Deploy**: qualunque deploy in produzione (`bash deploy.sh`/`vercel --prod`) resta esclusivamente un'azione di Fabrizio, per governance concordata.
5. **Golden Journey / Visual Acceptance dal vivo**: i task #473 (Golden Journeys A-F) e #474/#526 (Visual Acceptance 3 formati) risultano **ancora pending** nel tracker di questa sessione — non chiusi da nessun lavoro recente. Vanno eseguiti (idealmente da Fabrizio o con supervisione, essendo verifiche visive/E2E su ambiente live) prima del Micro Pilot.

## 5. Blocchi al primo utente/centro reale (in ordine di dipendenza)

1. Testo legale reale (Termini/Privacy Notice/dichiarazione genitoriale), validato e pubblicato da Fabrizio in `legal_documents` — **senza questo, `LEGAL_TERMS_GATE` resta OFF per costruzione, nessun utente reale può vedere una schermata di consenso**.
2. ~~`migration_27` applicata + verificata~~ — **fatto** (LIVE, POST-CHECK confermato, §7). Wiring tecnico completo già costruito sopra.
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
- **`migration_27` applicata da Fabrizio + wiring tecnico completo** (task #564, #566-575, sessione del 25/08 sera): POST-CHECK live confermato; feature flag `LEGAL_TERMS_GATE`; signup wiring; route pubbliche `/privacy`/`/terms`; dichiarazione parentale; vista Admin view-only; 16 test LEGAL-01..16; documentazione aggiornata (questo file, Risk Register, Design, Decision Log, Migration Register). Nessuna migrazione riapplicata, nessun contenuto legale reale creato, nessun deploy eseguito, nessuna abilitazione globale del gate — tutto per costruzione, come richiesto esplicitamente.

## 7. Stato finale R-03 (Privacy & Terms) — 25/08/2026 sera

```
TECHNICAL IMPLEMENTATION: BUILT/STATIC_TESTED
DATABASE: LIVE
LEGAL CONTENT: PENDING EXTERNAL REVIEW
LEGAL GATE: OFF
PILOT READINESS: BLOCKED BY LEGAL CONTENT
```

Questo NON è uno stato CLOSED. `migration_27` v2 è LIVE in produzione (applicata da Fabrizio, POST-CHECK di sola lettura confermato: 4 tabelle, RLS attiva, 8 policy corrispondenti). Il wiring tecnico sopra è completo e verificato staticamente (tsc/eslint puliti, 8/16 test LEGAL eseguiti e verdi, 8/16 documentati come richiedenti deploy reale o fixture non ancora esistenti). Nessun testo legale reale esiste (`legal_documents` ha 0 righe): il gate resta bloccato esclusivamente da questo, non dalla tecnica. Prossimo gate manuale reale: Fabrizio redige/valida/pubblica Termini, Privacy Notice e dichiarazione parentale; solo allora `LEGAL_TERMS_GATE` potrà essere abilitato — inizialmente solo su una coorte di test, mai globalmente senza una nuova conferma esplicita.

## Fermata

Come richiesto esplicitamente da Fabrizio: **ci si ferma qui**. Ogni gate rimanente in §4 richiede un'azione che solo Fabrizio può compiere (account esterno, testo legale, conferma di un modello dati, o un deploy) — non c'è altro lavoro di codice o verifica automatizzabile che sblocchi ulteriormente questi punti oggi.
