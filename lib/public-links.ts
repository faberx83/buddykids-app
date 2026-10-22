// TRAMA — INDIRIZZI PUBBLICI E LINK CORTI (16/10/2026).
//
// Da oggi l'indirizzo di TRAMA è tramapp.it (partner./admin. per i portali).
// Ogni link che esce dall'app — inviti, condivisioni, email — deve puntare lì,
// anche se chi lo genera sta ancora usando un vecchio indirizzo *.vercel.app.
// In locale e nelle anteprime resta l'indirizzo corrente (per i test).
//
// Modulo puro (niente Node, niente rete): usabile sia lato server sia nei
// componenti client.

export const CANONICAL_ROOT_DOMAIN = "tramapp.it";
export const CANONICAL_FAMILY_HOST = "tramapp.it";
export const CANONICAL_FAMILY_ORIGIN = `https://${CANONICAL_FAMILY_HOST}`;

/** Vecchi indirizzi → nuovi (per tenant). */
export const LEGACY_HOST_MAP: Readonly<Record<string, string>> = {
  "buddykids-app.vercel.app": "tramapp.it",
  "buddykids-partner.vercel.app": "partner.tramapp.it",
  "buddykids-admin.vercel.app": "admin.tramapp.it",
};

export function bareHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().split(":")[0];
}

export function canonicalHostForLegacy(host: string | null | undefined): string | null {
  return LEGACY_HOST_MAP[bareHost(host)] ?? null;
}

export function isCanonicalHost(host: string | null | undefined): boolean {
  const h = bareHost(host);
  return h === CANONICAL_ROOT_DOMAIN || h.endsWith(`.${CANONICAL_ROOT_DOMAIN}`);
}

/** Produzione (vecchio o nuovo indirizzo) → sempre https://tramapp.it. Altrove: null. */
export function productionFamilyOrigin(host: string | null | undefined): string | null {
  return isCanonicalHost(host) || canonicalHostForLegacy(host) ? CANONICAL_FAMILY_ORIGIN : null;
}

/** Origine per i link verso le famiglie, partendo dall'indirizzo della pagina corrente (lato browser). */
export function familyOriginFromLocation(loc: { host: string; origin: string }): string {
  return productionFamilyOrigin(loc.host) ?? loc.origin;
}

// ─── Link corti per gli inviti ────────────────────────────────────────────
//
//   https://tramapp.it/i/<chiave>
//
// La chiave è il token dell'invito (12 caratteri, o un vecchio UUID) oppure
// il codice della famiglia (6-8 caratteri, senza 0/O/1/I): app/i/[key]
// decide dove portare, con il login se serve.

export const SHORT_INVITE_PREFIX = "/i/";

const FAMILY_CODE = /^[A-HJ-NP-Z2-9]{6,8}$/;
const INVITE_TOKEN = /^[A-Za-z0-9-]{10,64}$/;

export function shortInviteUrl(origin: string, key: string): string {
  return `${origin.replace(/\/$/, "")}${SHORT_INVITE_PREFIX}${key}`;
}

/**
 * 22/10/2026 — stesso invito, ma sotto /nextgen (app/nextgen/i/[key]): su
 * Android, con TRAMA installata, il link apre l'app invece del browser. Usato
 * nelle email e nei link condivisi dalla V2; i vecchi /i/<chiave> funzionano ancora.
 */
export const APP_INVITE_PREFIX = "/nextgen/i/";
export function appInviteUrl(origin: string, key: string): string {
  return `${origin.replace(/\/$/, "")}${APP_INVITE_PREFIX}${key}`;
}

export function familyInviteDestination(key: string): string | null {
  const k = (key ?? "").trim();
  if (FAMILY_CODE.test(k)) return `/nextgen/profile/famiglia?code=${k}`;
  if (INVITE_TOKEN.test(k)) return `/nextgen/planner/famiglia?accept=${encodeURIComponent(k)}`;
  return null;
}

const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Token invito corto (12 caratteri da 57: ~70 bit, non indovinabile). */
export function newShortInviteToken(len = 12): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += TOKEN_CHARS[bytes[i] % TOKEN_CHARS.length];
  return out;
}
