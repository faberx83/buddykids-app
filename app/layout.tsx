import type { Metadata } from "next";
import "./globals.css";
import { DemoRoleProvider } from "@/components/DemoRoleProvider";
import RoleSwitcher from "@/components/RoleSwitcher";

export const metadata: Metadata = {
  title: "BuddyKids — Attività per bambini",
  description:
    "Trova, prenota e gestisci le attività extrascolastiche per i tuoi bambini.",
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
