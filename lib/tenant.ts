// Configurazione condivisa del multi-tenant a sottodomini (usata sia da
// proxy.ts che da app/layout.tsx per leggere l'hostname e servire il
// manifest/tema corretto).

export type Tenant = "family" | "partner" | "admin";

// Hostname "alias" espliciti, in aggiunta al pattern partner./admin.<dominio>.
// Servono per un multi-tenant temporaneo SENZA un dominio proprio: es. finché
// non si possiede buddykids.app si possono usare alias .vercel.app gratuiti
// (es. buddykids-partner.vercel.app, buddykids-admin.vercel.app), impostando
// NEXT_PUBLIC_PARTNER_HOSTS / NEXT_PUBLIC_ADMIN_HOSTS (liste separate da
// virgola) nelle variabili d'ambiente di Vercel. Quando poi si avrà il
// dominio vero, questi si possono lasciare vuoti: il pattern partner./admin.
// continua a funzionare da solo.
function extraHosts(envVar: string | undefined): string[] {
  return (envVar || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

const EXTRA_PARTNER_HOSTS = extraHosts(process.env.NEXT_PUBLIC_PARTNER_HOSTS);
const EXTRA_ADMIN_HOSTS = extraHosts(process.env.NEXT_PUBLIC_ADMIN_HOSTS);

export function tenantForHost(hostname: string): Tenant {
  if (hostname.startsWith("partner.") || EXTRA_PARTNER_HOSTS.includes(hostname)) return "partner";
  if (hostname.startsWith("admin.") || EXTRA_ADMIN_HOSTS.includes(hostname)) return "admin";
  return "family";
}

export interface TenantConfig {
  title: string;
  description: string;
  manifest: string;
  themeColor: string;
  icon192: string;
  icon512: string;
  appleIcon: string;
  splashPrefix: string;
}

// Sprint correttivo (feedback Fabrizio): "l'icona della pwa e' piccola
// rispetto al riquadro" — le icone icon-*.png/apple-touch-icon*.png sono
// state rigenerate (script one-off, non versionato) con il marchio piu'
// grande (~78% del riquadro invece di ~55%), stesso colore/sfondo di prima
// per ciascun tenant. In piu': "voglio vedere l'icona, il claim ma su base
// bianca" (genitori/partner) — vedi splash screen iOS sotto, e Login
// (LoginForm.tsx) con sfondo bianco invece del precedente off-white/grigio.
export const SPLASH_SIZES: { w: number; h: number }[] = [
  { w: 1284, h: 2778 },
  { w: 1170, h: 2532 },
  { w: 1125, h: 2436 },
  { w: 828, h: 1792 },
  { w: 750, h: 1334 },
  { w: 640, h: 1136 },
];

export const TENANT_CONFIG: Record<Tenant, TenantConfig> = {
  family: {
    title: "TRAMA — Attività per bambini",
    description: "Trova, prenota e gestisci le attività extrascolastiche per i tuoi bambini.",
    manifest: "/manifest-family.json",
    themeColor: "#4DAFEF",
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
    appleIcon: "/apple-touch-icon.png",
    splashPrefix: "/splash/family",
  },
  partner: {
    title: "TRAMA Partner — Gestione centro",
    description: "Gestisci attività, calendario e promozioni del tuo centro estivo su TRAMA.",
    manifest: "/manifest-partner.json",
    themeColor: "#1FA88E",
    icon192: "/icon-partner-192.png",
    icon512: "/icon-partner-512.png",
    appleIcon: "/apple-touch-icon-partner.png",
    splashPrefix: "/splash/partner",
  },
  admin: {
    title: "TRAMA Admin — Piattaforma",
    description: "Pannello di controllo piattaforma TRAMA: centri, attività, prenotazioni e analisi.",
    manifest: "/manifest-admin.json",
    themeColor: "#1A1D2E",
    icon192: "/icon-admin-192.png",
    icon512: "/icon-admin-512.png",
    appleIcon: "/apple-touch-icon-admin.png",
    splashPrefix: "/splash/admin",
  },
};

// Genera i tag <link rel="apple-touch-startup-image"> per lo splash screen
// iOS (Android non supporta uno splash personalizzato: usa solo icona +
// background_color del manifest, gia' impostato). Ogni dimensione e'
// abbinata alla combinazione device-width/device-height/pixel-ratio dei
// modelli iPhone piu' diffusi (portrait) — se il device del genitore non
// corrisponde esattamente, Safari ricade sullo splash generato di default
// (icona su sfondo), nessun errore.
const SPLASH_MEDIA: Record<string, string> = {
  "1284x2778": "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
  "1170x2532": "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
  "1125x2436": "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
  "828x1792": "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
  "750x1334": "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
  "640x1136": "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
};

export function splashLinks(splashPrefix: string): { rel: string; url: string; media: string }[] {
  return SPLASH_SIZES.map(({ w, h }) => ({
    rel: "apple-touch-startup-image",
    url: `${splashPrefix}-${w}x${h}.png`,
    media: `${SPLASH_MEDIA[`${w}x${h}`]} and (orientation: portrait)`,
  }));
}
