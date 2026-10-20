import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { tenantForHost } from "@/lib/tenant";
import { isCanonicalHost } from "@/lib/public-links";

// TRAMA — robots.txt (20/10/2026). Prima non esisteva: /robots.txt finiva sul
// controllo di accesso (rimando alla pagina di login) e i lettori automatici
// (motori di ricerca, ChatGPT e simili) lo interpretavano come "vietato tutto",
// quindi non riuscivano ad aprire nemmeno la pagina di benvenuto.
// Ora: sul dominio famiglie (tramapp.it) si possono leggere SOLO le pagine
// pubbliche — benvenuto, privacy, termini e le immagini del marchio; l'app
// resta esclusa. Portali Partner/Admin e indirizzi provvisori: esclusi del tutto.

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get("host") ?? "").split(":")[0];
  const publicSite = tenantForHost(host) === "family" && isCanonicalHost(host);
  if (!publicSite) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: ["/benvenuto", "/privacy", "/terms", "/brand/", "/og/"], disallow: "/" }],
    sitemap: "https://tramapp.it/sitemap.xml",
  };
}
