# Capability Isolation Standard — "Gate at every I/O boundary"

Approvato ed introdotto durante l'implementazione dell'infrastruttura Release/Promotion "TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL" (10/09/2026). Non è un nuovo meccanismo: è il pattern già usato in produzione da `app/actions/kids.ts` (gate su `LEGAL_TERMS_GATE`, fail-closed), reso esplicito e checklist-abile per ogni futura capability costruita dietro flag e rilasciata in produzione mentre è ancora invisibile alla maggior parte degli utenti (modello "dark release": stesso codice, stesso database, visibilità controllata via `feature_flag_overrides`).

Vedi `TRAMA_DARK_RELEASE_MODEL_REPORT.md` §13 per l'analisi completa che ha originato questo standard.

## La regola in una frase

**Ogni Server Action, route API, cron, webhook, invio email/push, chiamata a un'API esterna e scrittura DB nuovi ri-verificano il proprio flag, indipendentemente da cosa ha già verificato la pagina che li ha chiamati.** Una pagina gated non basta: una Server Action è raggiungibile direttamente (URL/devtools/replay), un cron non passa mai da una pagina.

## Checklist, per ogni nuova capability dietro flag

1. **Registrare il flag** in `lib/feature-flags/registry.ts` con `defaultValue: false` e `allowedScopes` che includa `"cohort"` (necessario per lo scope `internal-preview`, vedi `lib/releases/visibility.ts`).
2. **Page/layout**: risolvono il flag server-side (`resolveFeatureFlag`) e restituiscono un 404/redirect normale se `false` — mai una pagina rotta.
3. **Server Action**: ri-verifica il flag ALL'INTERNO dell'azione stessa, non solo nella pagina/form che la chiama — esattamente come `app/actions/kids.ts` verifica `LEGAL_TERMS_GATE` dentro `addKidAction`, non solo nel form.
4. **Route API / webhook**: stessa verifica, prima di qualunque effetto collaterale (scrittura, chiamata esterna, invio).
5. **Cron**: filtra il proprio working set per appartenenza a coorte PRIMA di agire (query `WHERE user_id IN (SELECT user_id FROM beta_cohort_memberships WHERE cohort_key = '...' AND active)`), o verifica il flag per destinatario — un cron non gated processa TUTTI gli utenti indipendentemente dalla visibilità della feature.
6. **Push / email**: la lista destinatari deve già essere filtrata per coorte PRIMA della chiamata a `sendPushToUser`/invio email — non esiste (e non conviene costruire) un gate globale "non inviare a chi non deve vedere X".
7. **Chiamata a un'API esterna a pagamento**: gated alla chiamata stessa, non solo al rendering del risultato — altrimenti una capability "dark" genera costo/side-effect reali su un provider esterno con zero beneficio visibile.
8. **Nuova tabella DB**: RLS indipendente dal flag — RLS decide CHI POSSIEDE la riga, il flag decide SE LA FEATURE È VISIBILE. Confondere i due significa che un bug nel flag diventa un bug di accesso ai dati, molto peggio.
9. **Nuovo evento `product_events`**: aggiunto alla whitelist di `lib/telemetry/known-events.ts` solo se specifico della capability e privo di PII — stessa review già richiesta per ogni voce esistente.

## Cosa NON fare

- Non costruire un wrapper/HOC generico "gated component" finché non serve davvero — la checklist sopra si applica punto per punto, a mano, finché il numero di capability dark in parallelo non giustifica un'astrazione.
- Non gated-are solo la UI e assumere che il resto "tanto non ci arriva nessuno" — è esattamente il ragionamento che questa checklist esiste per evitare.
- Non usare `global` come scope iniziale per un flag nuovo — parte sempre da `cohort: "internal-preview"` (vedi `lib/releases/visibility.ts`), mai da `global`.

## Esempio reale già in produzione (precedente, non nuovo)

```ts
// app/actions/kids.ts
const legalGateEnabled = await resolveFeatureFlag({
  flagName: "LEGAL_TERMS_GATE",
  userId: user.id,
});
if (legalGateEnabled && !hasAcceptedParentalDeclaration) {
  return { error: "..." };
}
```

Questo pattern, applicato punto per punto della checklist sopra, è tutto ciò che serve — nessuna nuova libreria.
