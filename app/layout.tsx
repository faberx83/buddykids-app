import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Poppins } from "next/font/google";
// GO-LIVE · COMPLIANCE (09/10/2026): icone Tabler servite dal nostro dominio
// (pacchetto npm, stessa versione 3.19.0 che prima arrivava da jsDelivr).
// Nessuna richiesta a CDN di terze parti dal browser delle famiglie.
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";
import { DemoRoleProvider } from "@/components/DemoRoleProvider";
import RoleSwitcher from "@/components/RoleSwitcher";
import InstallPrompt from "@/components/InstallPrompt";
import VersionToggle from "@/components/VersionToggle";
import AppSplashOverlay from "@/components/AppSplashOverlay";
import { tenantForHost, TENANT_CONFIG, splashLinks } from "@/lib/tenant";

// GO-LIVE · COMPLIANCE (09/10/2026): Inter e Poppins con next/font. I file
// vengono scaricati UNA volta in fase di build e serviti dal nostro dominio:
// il browser non contatta più Google Fonts (nessun dato a terzi, nessun
// cookie banner necessario per i font). Stessi pesi di prima. Le variabili
// CSS sono usate da tailwind.config.ts (fontFamily.sans / fontFamily.poppins).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

async function currentTenantConfig() {
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const tenant = tenantForHost(host);
  return TENANT_CONFIG[tenant];
}

// Metadata dinamica: legge l'hostname della richiesta per servire titolo,
// manifest e icone del sottodominio giusto (famiglie / partner.* / admin.*).
export async function generateMetadata(): Promise<Metadata> {
  const config = await currentTenantConfig();
  return {
    title: config.title,
    description: config.description,
    manifest: config.manifest,
    icons: {
      icon: [
        { url: config.icon192, sizes: "192x192", type: "image/png" },
        { url: config.icon512, sizes: "512x512", type: "image/png" },
      ],
      apple: config.appleIcon,
      // Sprint correttivo (feedback Fabrizio): splash screen iOS personalizzato
      // (icona + wordmark + claim "Organizing childhood. Together." su sfondo
      // bianco per genitori/partner, navy per admin) — prima non esisteva,
      // Safari mostrava solo lo splash generato di default (icona su sfondo).
      other: splashLinks(config.splashPrefix),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const config = await currentTenantConfig();
  return {
    // BUGFIX (Fabrizio: "lo sfondo dietro al logo al login è ancora
    // sbagliato, azzurro/verde invece che bianco") — non è la pagina, è lo
    // status bar/chrome del browser (e lo sfondo dello splash PWA su
    // Android, insieme a manifest-*.json#background_color) dipinti con
    // `themeColor` (l'azzurro/verde di brand). `chromeColor` è bianco per
    // family/partner, navy per admin (vedi lib/tenant.ts) — `themeColor`
    // resta quello di brand per pulsanti/accenti, invariato.
    themeColor: config.chromeColor,
    // "cover" fa si' che env(safe-area-inset-*) restituisca il valore reale
    // dell'area coperta da tacche/pulsanti di navigazione del sistema
    // (es. gesture bar Android, home indicator iOS), invece di 0 sempre.
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await currentTenantConfig();
  const appName = config.title.split(" — ")[0];

  return (
    <html lang="it" className={`${inter.variable} ${poppins.variable}`}>
      <body className="font-sans antialiased">
        {/* BUGFIX (Fabrizio: "in apertura della PWA si vede ancora lo sfondo
            colorato... aggiungi anche nome TRAMA e claim") — vedi commento in
            components/AppSplashOverlay.tsx: Android non supporta uno splash
            nativo personalizzato, quindi questo overlay lo sostituisce.
            Montato qui (root layout, fuori da DemoRoleProvider ma non ha
            bisogno del contesto) cosi' copre sia LEGACY che NEXTGEN con
            un'unica istanza. */}
        <AppSplashOverlay
          logoSrc={config.splashLogo}
          wordmarkSrc={config.splashWordmark}
          claim={config.splashClaim}
          background={config.chromeColor}
        />
        <DemoRoleProvider>
          {children}
          <RoleSwitcher />
          {/* SPRINT 3 (NEXTGEN): questa istanza non deve comparire sotto
              /nextgen — lì c'è la sua, con manifest/tema/nome dedicati (vedi
              app/nextgen/layout.tsx) — altrimenti i due banner "Installa" si
              sovrapporrebbero. */}
          <InstallPrompt appName={appName} themeColor={config.themeColor} routeExclude="/nextgen" />
          {/* Toggle LEGACY/NEXTGEN (richiesta di Fabrizio) — montato UNA sola
              volta qui: dato che app/nextgen/layout.tsx è annidato dentro
              questo layout radice, copre automaticamente anche tutte le
              pagine NEXTGEN, senza doverlo duplicare lì. Si nasconde da solo
              su /center, /admin, /nextgen/center, /nextgen/admin, /auth
              (vedi VersionToggle.tsx). */}
          <VersionToggle />
        </DemoRoleProvider>
      </body>
    </html>
  );
}
