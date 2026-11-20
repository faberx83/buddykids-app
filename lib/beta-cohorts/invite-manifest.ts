// TRAMA — ICONA CON L'INVITO DENTRO (20/11/2026). Vedi app/manifest-invito/route.ts.
// Copia di public/manifest-family.json (stesso nome, icone e colori) con
// start_url che riporta il codice beta; id "/" = stessa app di prima.

export const FAMILY_MANIFEST_BASE = {
  name: "TRAMA",
  short_name: "TRAMA",
  description: "Trova, prenota e gestisci le attività estive per i tuoi bambini.",
  id: "/",
  scope: "/",
  start_url: "/",
  display: "standalone",
  background_color: "#FFFFFF",
  theme_color: "#FFFFFF",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} as const;

/** Da dove riparte l'icona aggiunta dalla pagina d'invito. */
export function inviteStartUrl(code: string | null): string {
  return code ? `/auth/login?beta=${encodeURIComponent(code)}&da=app` : "/";
}

export function manifestForInvite(code: string | null) {
  return { ...FAMILY_MANIFEST_BASE, start_url: inviteStartUrl(code) };
}
