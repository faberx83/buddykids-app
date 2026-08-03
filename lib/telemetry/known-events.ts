// TRAMA ONE Build Sprint 6 — E11, registro eventi prodotto noti.
//
// Estratto deliberatamente da lib/telemetry/events.ts (che ha "import
// server-only" ed è quindi non importabile in Node puro fuori dal bundler
// di Next.js): questo file NON ha alcuna dipendenza I/O e nessun import
// "server-only", esattamente come lib/command-center/priority.ts è
// separato da lib/data/command-center.ts nello stesso sprint — la logica
// pura vive qui, così tests/one/product-events.spec.ts (eseguito col
// runner Playwright grezzo, senza bundler Next in mezzo) può importarlo
// direttamente senza errori di risoluzione modulo.
//
// Whitelist deliberata (non blacklist): un evento non presente qui continua
// a essere loggato via logTelemetryEvent() (comportamento Sprint 0
// invariato) ma NON viene scritto su product_events finché qualcuno non lo
// aggiunge qui consapevolmente — previene la persistenza silenziosa di un
// evento non ancora verificato per assenza di PII (vedi
// TELEMETRY_FORBIDDEN_FIELDS in lib/telemetry/correlation.ts).
export const KNOWN_PRODUCT_EVENTS = [
  // app/one/layout.tsx, app/center/one/layout.tsx, app/admin/one/layout.tsx
  "one_route_access",
  "one_route_fallback",
  // lib/feature-flags/resolve.ts — evento critico DEC-48 (override scaduto
  // che avrebbe potuto sembrare una decisione deliberata).
  "feature_flag_silent_fallback_expired_override",
  // app/actions/walkthrough.ts — nuovi eventi Sprint 6 (task #418
  // "hardening walkthrough" si baserà su questi dati).
  "walkthrough_step_started",
  "walkthrough_step_completed",
  "walkthrough_step_skipped",
  "walkthrough_restarted",
] as const;

export type KnownProductEvent = (typeof KNOWN_PRODUCT_EVENTS)[number];

export function isKnownProductEvent(event: string): event is KnownProductEvent {
  return (KNOWN_PRODUCT_EVENTS as readonly string[]).includes(event);
}
