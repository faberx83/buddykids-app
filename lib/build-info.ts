// TRAMA — TEST PIPELINE NUOVO ACCOUNT (30/09/2026, richiesta di Fabrizio).
//
// Informazioni sulla build attualmente servita: commit (short SHA) e ora di
// costruzione. Modulo PURO (nessun import server-only, nessun accesso a
// Supabase) così è testabile "[no browser]" in
// tests/one/build-info-bubble.spec.ts.
//
// Fonti:
//   - TRAMA_BUILD_SHA  → inlined da next.config.mjs a build time, valorizzato
//     da VERCEL_GIT_COMMIT_SHA (variabile di sistema Vercel, presente anche
//     nei deploy da CLI quando la cartella è un repo git).
//   - TRAMA_BUILD_TIME → inlined da next.config.mjs a build time (ISO 8601).
// Se una delle due manca, il label lo dice esplicitamente ("sha n/d") invece
// di inventare un valore: un "n/d" in produzione è esso stesso un'informazione
// utile (vuol dire che Vercel non ha passato il commit alla build).

export interface BuildInfo {
  /** Primi 7 caratteri del commit, o null se non disponibile. */
  shortSha: string | null;
  /** Data/ora della build in ISO 8601, o null se non disponibile. */
  builtAt: string | null;
}

type EnvLike = Record<string, string | undefined>;

export function getBuildInfo(env: EnvLike = process.env): BuildInfo {
  const rawSha = (env.TRAMA_BUILD_SHA || env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const rawTime = (env.TRAMA_BUILD_TIME || "").trim();
  return {
    shortSha: rawSha ? rawSha.slice(0, 7) : null,
    builtAt: rawTime && !Number.isNaN(Date.parse(rawTime)) ? rawTime : null,
  };
}

/** "build aa9764e · 30/09 14:01" (ora di Roma). */
export function formatBuildLabel(info: BuildInfo, timeZone = "Europe/Rome"): string {
  const sha = info.shortSha ?? "sha n/d";
  if (!info.builtAt) return `build ${sha}`;
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(info.builtAt));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `build ${sha} · ${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}
