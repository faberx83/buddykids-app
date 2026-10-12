// TRAMA — RADAR (12/10/2026). Link: normalizzazione, protezione SSRF e
// lettura dei soli metadati pubblici. Funzioni PURE (testabili senza rete);
// la chiamata di rete vera è in lib/radar/url-fetch.ts.
//
// Brief §6: niente scraping aggressivo, niente login o paywall aggirati.
// Di una pagina si leggono SOLO <title>, meta description e OpenGraph.
// Per i social (Instagram, Facebook, TikTok) non si assume accesso al post:
// se i metadati non bastano, l'esito è UNCERTAIN e si chiede uno screenshot.

const TRACKING_PARAMS = /^(utm_\w+|fbclid|gclid|igshid|igsh|mc_cid|mc_eid|ref|ref_src|si|_ga)$/i;

const SOCIAL_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "fb.me", "m.facebook.com", "tiktok.com", "vm.tiktok.com",
  "x.com", "twitter.com", "threads.net", "youtube.com", "youtu.be", "wa.me", "whatsapp.com",
];

export function isSocialHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return SOCIAL_HOSTS.some((s) => h === s || h.endsWith(`.${s}`));
}

/**
 * URL canonico per riconoscere i doppioni: https, host minuscolo senza
 * "www.", niente frammento, niente parametri di tracciamento, niente "/"
 * finale. Null se non è un URL http(s) valido.
 */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";
  if (url.port === "443" || url.port === "80") url.port = "";
  const kept = [...url.searchParams.entries()].filter(([k]) => !TRACKING_PARAMS.test(k));
  url.search = "";
  for (const [k, v] of kept.sort(([a], [b]) => a.localeCompare(b))) url.searchParams.append(k, v);
  if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.replace(/\/+$/, "");
  let out = url.toString();
  if (url.pathname === "/" && !url.search) out = out.replace(/\/$/, "");
  return out;
}

/** Primo controllo SSRF, prima di qualunque rete: solo https, porta standard, niente host interni. */
export function isFetchableUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.port && url.port !== "443") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isIpLiteral(host) && isBlockedIp(host)) return false;
  return true;
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[") || host.includes(":");
}

/**
 * Indirizzi che non devono mai essere contattati dal server (SSRF):
 * privati, loopback, link-local (metadata cloud 169.254.169.254), CGNAT,
 * multicast, riservati; per IPv6 loopback, ULA, link-local e IPv4-mapped.
 */
export function isBlockedIp(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "").toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr)) {
    const [a, b] = addr.split(".").map(Number);
    if ([a, b].some((n) => n > 255)) return true;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (addr === "::" || addr === "::1") return true;
  if (addr.startsWith("::ffff:")) return isBlockedIp(addr.slice(7));
  if (/^f[cd]/.test(addr)) return true; // fc00::/7 ULA
  if (/^fe[89ab]/.test(addr)) return true; // fe80::/10 link-local
  if (addr.startsWith("ff")) return true; // multicast
  return false;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1].trim()) return decodeEntities(m[1].trim());
  }
  return null;
}

export interface PageMetadata {
  title: string | null;
  description: string | null;
  siteName: string | null;
}

/** Solo titolo, descrizione e nome del sito. Nient'altro della pagina viene letto. */
export function parsePageMetadata(html: string): PageMetadata {
  const head = html.slice(0, 200_000);
  const titleTag = head.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1];
  return {
    title: metaContent(head, "og:title") ?? (titleTag ? decodeEntities(titleTag.trim()) : null),
    description: metaContent(head, "og:description") ?? metaContent(head, "description"),
    siteName: metaContent(head, "og:site_name"),
  };
}

/** Metadati "di facciata" dei social (es. "Instagram", "Log in"): non dicono nulla del post. */
export function isGenericSocialMetadata(meta: PageMetadata): boolean {
  const t = `${meta.title ?? ""} ${meta.description ?? ""}`.toLowerCase().trim();
  if (!t) return true;
  return /^(instagram|facebook|tiktok|log in|accedi|login)\b/.test(t) || /log in or sign up|accedi o iscriviti|create an account/.test(t);
}
