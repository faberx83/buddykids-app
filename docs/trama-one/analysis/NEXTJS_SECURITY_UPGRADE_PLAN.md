# NEXT.JS SECURITY UPGRADE — piano (R-06, task #550)

**Wave 1 #12, 24/08/2026.** Piano pronto oggi. **Esecuzione intenzionalmente rimandata** a dopo la Security Release ufficiale Next.js del 26/08/2026 (decisione Fabrizio) — vedi §3 per il motivo.

## 1. Stato attuale (verificato oggi, 24/08/2026)

`package.json`: `"next": "^16.2.10"`. `npm audit --omit=dev` segnala 4 advisory HIGH sulla dipendenza `next` (più 2 transitive, `postcss`/`sharp`, incluse nelle stesse righe di audit):

- **CVE-2026-64641** — DoS in App Router con Server Actions (HIGH)
- **CVE-2026-64642** — Middleware/Proxy bypass con Turbopack + singolo locale (HIGH) — **non applicabile a questo repo**: nessun `next.config.js` con `i18n.locales`, nessun uso di Turbopack in produzione (verificato: `next.config.js` non ha chiave `i18n`, script `build` usa `next build` standard)
- **CVE-2026-64645** — SSRF in `rewrites()`/`redirects()` (HIGH) — **non applicabile**: `next.config.js` non definisce `rewrites`/`redirects`
- **CVE-2026-64649** — SSRF in Server Actions su custom server (HIGH) — potenzialmente applicabile (l'app usa Server Actions estensivamente in `app/actions/*`)
- CVE-2026-64643/64644/64646/64647/64648 (MEDIUM) — disclosure endpoint interni, DoS su Image Optimization SVG, cache confusion — applicabili in generale, nessuna mitigazione specifica nota

Fonte: [July 2026 Security Release](https://nextjs.org/blog/july-2026-security-release) (Next.js). Queste sono già state **patchate da Vercel il 20/07/2026** in `16.2.11`/`15.5.21`/`16.3.0` — il repo è fermo a `16.2.10`, cioè **una patch di sicurezza indietro rispetto a quanto già disponibile oggi**.

## 2. Rilascio in arrivo (26/08/2026)

Fonte: [Upcoming Next.js August Security Release](https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026) (pubblicato 20/08/2026 da Vercel). Il 26/08/2026 Vercel pubblicherà **16.3.3** e **15.5.24**, con la correzione di **una vulnerabilità CRITICAL** aggiuntiva — dettagli e CVE non ancora divulgati (per policy, Vercel pubblica l'advisory completo solo il giorno del rilascio).

## 3. Perché aspettare il 26/08 invece di patchare subito a 16.2.11

Aggiornare oggi a `16.2.11` risolverebbe le 7 CVE di luglio ma lascerebbe scoperta la vulnerabilità CRITICAL del 26/08 — quindi servirebbe comunque un secondo upgrade+test entro pochi giorni. Decisione (Fabrizio): un solo upgrade a `16.3.3` (quando disponibile) copre entrambi i round, dimezza il lavoro di verifica/regressione e riduce la finestra totale di esposizione rispetto a due deploy separati ravvicinati. Il rischio residuo di restare su `16.2.10` per altri 2 giorni è giudicato accettabile per un prodotto ancora privo di dati di pilot reali (nessun utente reale esposto oggi).

## 4. Piano di esecuzione (dal 26/08/2026 in poi, non prima)

1. Confermare che `16.3.3` sia effettivamente pubblicato e leggere l'advisory completo (potrebbe rivelare che serve anche un cambio di configurazione, non solo un bump di versione).
2. `npm install next@16.3.3` (aggiorna anche il `postcss` vendorizzato dentro `next`, dipendenza transitiva già segnalata).
3. `npm audit fix` per la vulnerabilità `nanoid` residua (non collegata a `next`, generatori non-sicuri con size zero/negativo) — verificare che non rompa nulla (uso di `nanoid` nel repo, se presente, va controllato prima).
4. Rileggere il changelog Next 16.3.x per breaking change rilevanti (in particolare qualunque cambiamento a Server Actions, dato l'uso estensivo in `app/actions/*`).
5. Verifica statica: `npx tsc --noEmit -p .`, `npx eslint . --quiet`, `npm run build` (deve completare senza errori).
6. Eseguire la suite `TEST_SCOPE=critical` (non l'intera suite, per contenere i tempi) e confermare 0 nuovi fallimenti rispetto alla baseline nota.
7. Verifica manuale mirata sulle Server Actions più sensibili (creazione booking, risposta Partner, upload certificazioni/verifica identità) — le CVE di luglio riguardano proprio Server Actions.
8. Commit dedicato e granulare (solo `package.json`/`package-lock.json` + eventuali fix di compatibilità), messaggio esplicito con riferimento alle CVE chiuse.
9. **Deploy**: resta di Fabrizio (`bash deploy.sh` / `vercel --prod`), come da governance concordata — Claude non lo esegue.

## 5. Rollback

Se il build o la suite critical rompono qualcosa dopo l'upgrade: `git revert` del commit dedicato (isolato per costruzione al solo bump di dipendenza) ripristina `16.2.10` in un singolo comando, senza toccare altro codice applicativo.

## 6. Stato di questo piano

Preparato e pronto oggi (24/08/2026). **Non eseguito**: in attesa che il 26/08/2026 sia trascorso e `16.3.3` sia realmente pubblicato — eseguire questo piano prima di quella data patcherebbe solo le CVE di luglio, lasciando scoperta quella critical in arrivo tra 48 ore.

Sources:
- [Upcoming Next.js August Security Release](https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026)
- [July 2026 Security Release](https://nextjs.org/blog/july-2026-security-release)
