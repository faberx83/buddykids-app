import type { Metadata } from "next";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cleanSource } from "@/lib/landing/waitlist";
import CentriView from "@/components/landing/CentriView";
import { centersContactAddress } from "@/lib/centers/pilot-emails";
import { extractEmailAddress } from "@/lib/email";

// TRAMA — PAGINA PER I CENTRI (27/10/2026, P0 di claude/INIZIATIVA_partner_admin_v2.md).
// Pubblica (proxy.ts la esclude dal login), sempre raggiungibile col suo link:
// è la destinazione della campagna verso i centri. Il flag
// CENTER_PILOT_FLOW_ENABLED decide solo il collegamento da /benvenuto.
// ?da=… (es. "mail1") passa alla candidatura e a centers_landing_viewed;
// mai IP, mai cookie; le anteprime dei link non contano.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TRAMA per i centri — Fatevi trovare quando la scuola chiude",
  description:
    "Iscrizioni anche per giorni singoli, richieste e presenze in un posto solo, le famiglie nel momento giusto. Pilota a Milano: gratuito per i centri fondatori.",
  openGraph: {
    title: "TRAMA per i centri",
    description: "Pilota a Milano: gratuito per i centri fondatori. Iscrizioni, richieste e presenze in un posto solo.",
    images: [{ url: "/og/trama-private-beta.png", width: 1200, height: 630 }],
  },
};

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|skype|discord|headless/i;

async function recordView(source: string | null) {
  try {
    const ua = (await headers()).get("user-agent") ?? "";
    if (!ua || BOT_UA.test(ua) || !isSupabaseConfigured) return;
    const service = createServiceClient();
    await service?.from("product_events").insert({ event_name: "centers_landing_viewed", detail: source ?? "diretto" });
  } catch {
    // osservabilità best-effort: la pagina si apre comunque
  }
}

export default async function CentriPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const source = cleanSource(first(params.da) ?? first(params.utm_source));
  await recordView(source);
  const candidatiHref = `/auth/candidati?da=${encodeURIComponent(source ?? "centri")}`;
  return <CentriView candidatiHref={candidatiHref} contactEmail={centersContactAddress(process.env, extractEmailAddress)} />;
}
