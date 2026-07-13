// Preferenza "versione app" (LEGACY vs NEXTGEN) — richiesta di Fabrizio: un
// toggle per passare dall'una all'altra "coerente su tutta l'app", più
// semplice da gestire rispetto ad avere solo pagine/app diverse (che restano
// comunque disponibili separatamente, vedi public/manifest-nextgen.json).
// Salvata in un cookie normale (non httpOnly: deve poter essere letta anche
// lato client da VersionToggle.tsx, che decide il redirect insieme a
// "display-mode: standalone", leggibile solo nel browser).
export type AppVersion = "legacy" | "nextgen";

const COOKIE_NAME = "bk_version";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readVersionPreference(): AppVersion | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(legacy|nextgen)`));
  return match ? (match[1] as AppVersion) : null;
}

export function writeVersionPreference(version: AppVersion) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${version}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
