import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import PhoneShell from "@/components/PhoneShell";
import InstallPrompt from "@/components/InstallPrompt";
import NextgenBottomNav from "@/components/nextgen/NextgenBottomNav";
import { NextgenToastProvider } from "@/components/nextgen/NextgenToastProvider";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { splashLinks } from "@/lib/tenant";

// SPRINT 0 (NEXTGEN — V2 in parallelo a LEGACY): guscio minimo dell'area
// genitore NEXTGEN. Stesso guard di autenticazione di app/(main)/layout.tsx
// (LEGACY, non toccato), ma componente NUOVO e separato: le prossime sprint
// potranno restyilizzare questo layout senza alcun impatto su LEGACY.
// Riuso: PhoneShell (unico componente visivo LEGACY riutilizzato in questo
// sprint) + stesso client Supabase/autenticazione/DB.
//
// SPRINT 3 — richiesta di Fabrizio: poter installare NEXTGEN come app SEPARATA
// da LEGACY sullo stesso telefono ("così le ho tutte e due"). Metadata/manifest
// dedicati (scope "/nextgen" — vedi public/manifest-nextgen.json) fanno sì che
// il browser la consideri un'app installabile DIVERSA da quella con scope "/".
// L'export statico "metadata" qui sotto vince su quello dinamico di
// app/layout.tsx (generateMetadata) SOLO per le rotte sotto /nextgen — nessuna
// modifica al comportamento delle altre rotte.
export const metadata: Metadata = {
  title: "TRAMA",
  description: "La nuova esperienza TRAMA: planner familiare, copertura settimane e consigli su misura.",
  manifest: "/manifest-nextgen.json",
  icons: {
    icon: [
      { url: "/icon-nextgen-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-nextgen-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon-nextgen.png",
    // Sprint correttivo: stesso splash iOS (icona a colori + claim su bianco)
    // del tenant famiglia LEGACY — NEXTGEN e' comunque "app genitori".
    other: splashLinks("/splash/nextgen"),
  },
};

export const viewport: Viewport = {
  themeColor: "#6F63C5",
  viewportFit: "cover",
};

export default async function NextgenLayout({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login?next=/nextgen");
  }

  return (
    <PhoneShell>
      <NextgenToastProvider>
        <div className="flex h-full min-h-0 flex-col">
          <div className="no-scrollbar flex-1 overflow-y-auto">{children}</div>
          <NextgenBottomNav />
        </div>
      </NextgenToastProvider>
      {/* Istanza DEDICATA a NEXTGEN: appName diverso ("TRAMA" vs quello di
          LEGACY, vedi lib/tenant.ts) -> chiave di dismiss separata in
          localStorage, e nessun routeExclude (è già scoped a /nextgen dal
          punto in cui è mountata). Quella "storica" in app/layout.tsx si
          autoesclude qui (routeExclude), quindi non appare mai insieme a
          questa. swScope="/nextgen" (BUG FIX): registra il service worker su
          uno scope diverso da quello di LEGACY ("/"), altrimenti Chrome
          unifica le due app sotto un'unica identità installata (vedi
          commento in components/InstallPrompt.tsx). */}
      <InstallPrompt appName="TRAMA" themeColor="#6F63C5" swScope="/nextgen" />
    </PhoneShell>
  );
}
