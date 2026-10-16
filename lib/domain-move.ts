// TRAMA — TRASLOCO SU tramapp.it (16/10/2026).
//
// Fino a oggi l'app viveva su indirizzi provvisori *.vercel.app; da oggi il
// dominio vero è tramapp.it. Il login è legato all'indirizzo del sito (i
// cookie non passano da un dominio all'altro), quindi chi apre il vecchio
// indirizzo verrebbe rimandato al login. Per evitarlo:
//
//   1. proxy.ts, sul VECCHIO indirizzo, manda le aperture di pagina a
//      /auth/trasloco/avvio (stesso vecchio indirizzo);
//   2. quella route legge la sessione, controlla la release "trasloco-tramapp"
//      e rimanda a https://tramapp.it/auth/trasloco con la sessione nel
//      frammento (#...): il frammento non arriva mai a nessun server né nei
//      log, e viene cancellato dalla barra appena letto;
//   3. la pagina /auth/trasloco del NUOVO indirizzo lo passa a una server
//      action che controlla firma e scadenza (2 minuti) e apre la sessione.
//
// Qui solo funzioni pure (niente rete, niente cookie): testabili da
// tests/one/trasloco-dominio.spec.ts.

export {
  CANONICAL_FAMILY_HOST,
  CANONICAL_ROOT_DOMAIN,
  LEGACY_HOST_MAP,
  canonicalHostForLegacy,
  isCanonicalHost,
} from "@/lib/public-links";

/** Cookie sul vecchio indirizzo: "done" = già traslocato, si va sempre sul nuovo. */
export const MOVE_DONE_COOKIE = "trama_trasloco";
/** Cookie sul vecchio indirizzo: release spenta per questo utente, non ricontrollare per un'ora. */
export const MOVE_SKIP_COOKIE = "trama_trasloco_off";
export const MOVE_SKIP_SECONDS = 60 * 60;
export const MOVE_DONE_SECONDS = 60 * 60 * 24 * 365;
/** Validità del passaggio di sessione dal vecchio al nuovo indirizzo. */
export const HANDOFF_TTL_SECONDS = 120;

export const MOVE_START_PATH = "/auth/trasloco/avvio";
export const MOVE_LANDING_PATH = "/auth/trasloco";

/**
 * Solo percorsi interni ("/qualcosa"): mai "//altro-sito", "/\\altro", URL
 * assoluti o caratteri di controllo — niente redirect verso siti esterni.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (value.length > 2000) return fallback;
  return value;
}

export interface MoveRequestInfo {
  method: string;
  pathname: string;
  /** header sec-fetch-dest */
  fetchDest: string | null;
  /** header accept */
  accept: string | null;
  /** header rsc (navigazioni interne di Next) */
  rsc: string | null;
  /** header next-router-prefetch o purpose=prefetch */
  prefetch: boolean;
}

const STATIC_FILE = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|json|txt|xml|woff2?|ttf|webmanifest)$/i;

/**
 * Solo l'apertura di una pagina (non le chiamate API, i file, le navigazioni
 * interne di Next, i ritorni dal login via email che devono restare sul
 * vecchio indirizzo dove è nato il codice).
 */
export function isMoveCandidate(req: MoveRequestInfo): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (req.rsc || req.prefetch) return false;
  const p = req.pathname;
  if (
    p.startsWith("/api") ||
    p.startsWith("/_next") ||
    p.startsWith("/internal") ||
    p.startsWith("/manifest") ||
    p === "/sw.js" ||
    STATIC_FILE.test(p)
  ) {
    return false;
  }
  // /auth: si sposta solo la pagina di login; callback, reset password e il
  // trasloco stesso restano dove sono.
  if (p.startsWith("/auth") && p !== "/auth/login") return false;
  if (req.fetchDest) return req.fetchDest === "document";
  return (req.accept ?? "").includes("text/html");
}

// ─── Passaggio di sessione ────────────────────────────────────────────────

export interface HandoffPayload {
  /** access token Supabase */
  at: string;
  /** refresh token Supabase */
  rt: string;
  /** percorso dove tornare */
  n: string;
  /** secondi Unix di emissione */
  ts: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64 + "=".repeat((4 - (b64.length % 4)) % 4), "base64").toString("utf8");
}

export type Signer = (data: string) => string;

/** Frammento "#p=...&s=..." da appendere a https://<nuovo>/auth/trasloco. */
export function encodeHandoff(payload: HandoffPayload, sign: Signer): string {
  const p = toBase64Url(JSON.stringify(payload));
  return `p=${p}&s=${sign(p)}`;
}

export type HandoffCheck =
  | { ok: true; payload: HandoffPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Confronto a tempo costante (niente scorciatoie sul primo carattere diverso). */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function decodeHandoff(
  p: string,
  s: string,
  sign: Signer,
  nowSeconds: number,
  ttlSeconds = HANDOFF_TTL_SECONDS
): HandoffCheck {
  if (!p || !s || p.length > 8000 || s.length > 200) return { ok: false, reason: "malformed" };
  if (!sameString(sign(p), s)) return { ok: false, reason: "bad_signature" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(fromBase64Url(p));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const obj = parsed as Partial<HandoffPayload>;
  if (typeof obj.at !== "string" || typeof obj.rt !== "string" || typeof obj.ts !== "number" || typeof obj.n !== "string") {
    return { ok: false, reason: "malformed" };
  }
  if (nowSeconds - obj.ts > ttlSeconds || obj.ts - nowSeconds > 30) return { ok: false, reason: "expired" };
  return { ok: true, payload: { at: obj.at, rt: obj.rt, n: safeNextPath(obj.n), ts: obj.ts } };
}

/** Legge "p" e "s" da un frammento "#p=...&s=..." (lato browser). */
export function readHandoffFragment(hash: string): { p: string; s: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const p = params.get("p");
  const s = params.get("s");
  return p && s ? { p, s } : null;
}
