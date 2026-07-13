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
}

export const TENANT_CONFIG: Record<Tenant, TenantConfig> = {
  family: {
    title: "TRAMA — Attività per bambini",
    description: "Trova, prenota e gestisci le attività extrascolastiche per i tuoi bambini.",
    manifest: "/manifest-family.json",
    themeColor: "#4DAFEF",
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
    appleIcon: "/apple-touch-icon.png",
  },
  partner: {
    title: "TRAMA Partner — Gestione centro",
    description: "Gestisci attività, calendario e promozioni del tuo centro estivo su TRAMA.",
    manifest: "/manifest-partner.json",
    themeColor: "#1FA88E",
    icon192: "/icon-partner-192.png",
    icon512: "/icon-partner-512.png",
    appleIcon: "/apple-touch-icon-partner.png",
  },
  admin: {
    title: "TRAMA Admin — Piattaforma",
    description: "Pannello di controllo piattaforma TRAMA: centri, attività, prenotazioni e analisi.",
    manifest: "/manifest-admin.json",
    themeColor: "#1A1D2E",
    icon192: "/icon-admin-192.png",
    icon512: "/icon-admin-512.png",
    appleIcon: "/apple-touch-icon-admin.png",
  },
};
