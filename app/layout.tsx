import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DemoRoleProvider } from "@/components/DemoRoleProvider";
import RoleSwitcher from "@/components/RoleSwitcher";

export const metadata: Metadata = {
  title: "BuddyKids — Attività per bambini",
  description:
    "Trova, prenota e gestisci le attività extrascolastiche per i tuoi bambini.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4DAFEF",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        {/* Stessi font e icone del mockup approvato, caricati via CDN come nell'originale */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="font-sans antialiased">
        <DemoRoleProvider>
          {children}
          <RoleSwitcher />
        </DemoRoleProvider>
      </body>
    </html>
  );
}
