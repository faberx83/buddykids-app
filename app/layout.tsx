import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { DemoRoleProvider } from "@/components/DemoRoleProvider";
import RoleSwitcher from "@/components/RoleSwitcher";
import InstallPrompt from "@/components/InstallPrompt";
import VersionToggle from "@/components/VersionToggle";
import { tenantForHost, TENANT_CONFIG } from "@/lib/tenant";

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
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const config = await currentTenantConfig();
  return {
    themeColor: config.themeColor,
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
    <html lang="it">
      <head>
        {/* Stessi font e icone del mockup approvato, caricati via CDN come nell'originale */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"
        />
        {/* Poppins aggiunto per il rebrand TRAMA (titoli/hero, vedi
            tailwind.config.ts#fontFamily.poppins) — Inter resta il font di
            default per tutto il resto, invariato. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
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
