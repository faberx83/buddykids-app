// TRAMA ONE — Telemetry minima e correlationId (Build Sprint 0)
//
// Scope volutamente minimo: SOLO generazione/propagazione di un
// correlationId all'interno di una singola richiesta e un logger
// strutturato lato server. Il sistema di eventi/analytics completo (E11,
// tassonomia eventi, persistenza) resta fuori scope fino a TRAMA ONE Build
// Sprint 6, come da docs/trama-one/analysis/SPRINT_GOVERNANCE.md.
//
// Nota sulla persistenza del correlationId: in questo sprint il
// correlationId è generato una volta per richiesta ai layout /one e usato
// solo per correlare i log EMESSI DURANTE quella stessa richiesta (accesso
// alla route, risoluzione flag, eventuale errore/fallback). Non viene
// scritto in un cookie: farlo da un Server Component non è supportato da
// Next.js (i cookie si possono scrivere solo da Server Action o Route
// Handler) e proxy.ts, l'unico punto che potrebbe farlo per ogni richiesta,
// resta esplicitamente non modificato in questo sprint. La persistenza
// cross-richiesta (correlationId di sessione) è quindi rinviata — vedi
// docs/trama-one/TRANSITION_REGISTER.md.
//
// Usato in (Build Sprint 0):
//  1. accesso alle route /one (app/one/layout.tsx, app/center/one/layout.tsx, app/admin/one/layout.tsx)
//  2. risoluzione feature flag (lib/feature-flags/resolve.ts)
//  3. errori di database/resolver (lib/feature-flags/resolve.ts, lib/beta-cohorts/membership.ts)
//  4. fallback (i tre layout /one, quando TRAMA_ONE_ENABLED risolve a false)

export interface TelemetryLogEntry {
  event: string;
  correlationId?: string | null;
  /** "family" | "partner" | "admin" — mai un identificativo utente. */
  tenant?: string | null;
  /** "parent" | "center_admin" | "platform_admin" — mai nome/email. */
  role?: string | null;
  /** Dettaglio tecnico breve (es. nome flag + esito, causa errore) — MAI dati personali. */
  detail?: string | null;
}

/**
 * Genera un nuovo correlationId (UUID v4 via Web Crypto API, disponibile sia
 * in runtime Node.js sia Edge — nessuna dipendenza dal modulo Node "crypto",
 * per restare compatibile con qualunque runtime scelgano in futuro i layout
 * /one senza bisogno di modificarlo).
 */
export function generateCorrelationId(): string {
  return globalThis.crypto.randomUUID();
}

const CORRELATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Riusa un correlationId già ricevuto (es. da un header di una chiamata
 * interna futura) se ha un formato valido, altrimenti ne genera uno nuovo.
 * In Sprint 0 i tre layout /one chiamano sempre questa funzione senza un
 * valore esistente (nessuna propagazione cross-richiesta ancora attiva), ma
 * la firma è pronta per quando la propagazione verrà aggiunta (Sprint 6).
 */
export function getOrCreateCorrelationId(existing?: string | null): string {
  if (existing && CORRELATION_ID_PATTERN.test(existing)) return existing;
  return generateCorrelationId();
}

// Campi che non devono MAI comparire in un log di questo modulo. Non è un
// filtro runtime su un payload libero (qui non esiste un payload libero: lo
// shape di TelemetryLogEntry è chiuso e non accetta oggetti arbitrari), è la
// lista di riferimento usata in revisione/code review per verificare che
// nessun campo qui sotto venga mai aggiunto a TelemetryLogEntry.
export const TELEMETRY_FORBIDDEN_FIELDS = [
  "name",
  "fullName",
  "email",
  "phone",
  "address",
  "childName",
  "kidName",
  "token",
  "secret",
  "password",
  "rawRow",
] as const;

/**
 * Log strutturato minimo, solo server-side (mai chiamato da codice client).
 * Emette SOLO: nome evento, correlationId, tenant, ruolo, un dettaglio
 * tecnico breve, timestamp. Nessun userId, nessun dato personale, nessuna
 * riga grezza di database.
 */
export function logTelemetryEvent(entry: TelemetryLogEntry): void {
  const safeEntry = {
    event: entry.event,
    correlationId: entry.correlationId ?? null,
    tenant: entry.tenant ?? null,
    role: entry.role ?? null,
    detail: entry.detail ?? null,
    timestamp: new Date().toISOString(),
  };
  // Log strutturato minimo (Sprint 0): console server-side, nessuna
  // persistenza. La persistenza in un sistema eventi dedicato è scope di
  // Build Sprint 6 (E11 Analytics/experiment framework).
  console.log("[trama-one-telemetry]", JSON.stringify(safeEntry));
}
