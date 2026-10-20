import type { Metadata } from "next";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cleanSource } from "@/lib/landing/waitlist";
import BenvenutoView from "@/components/landing/BenvenutoView";

// TRAMA — PAGINA DI BENVENUTO (20/10/2026, Fabrizio: "per chi non ha un
// account, una pagina su tramapp.it che spiega cos'è TRAMA"; "solo su invito,
// ma la pagina vorrei fosse accessibile e se qualcuno ci arriva mi interessa").
//
// - Sempre raggiungibile su /benvenuto (anche da collegati: in alto "Vai
//   all'app"). Con la release "pagina-benvenuto" a tutti, chi apre
//   tramapp.it senza account arriva qui invece che sulla pagina di accesso
//   (proxy.ts).
// - Il carosello di primo ingresso NON è ripetuto: si riusano solo le sue
//   schermate demo (dati fittizi) e i suoi testi (lib/nextgen/onboarding-slides.ts).
// - "Chiedi un invito" → lista d'attesa (app/actions/waitlist.ts).
// - Ogni visita lascia landing_viewed in product_events (solo da dove arriva,
//   ?da=… o utm_source; mai IP, mai cookie); le anteprime dei link
//   (WhatsApp, motori di ricerca) non contano.
// Promesse coerenti col prodotto: niente pagamenti in app, niente "centri
// verificati", beta gratuita su invito.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TRAMA — Il tempo dei tuoi figli, organizzato",
  description:
    "Attività, settimane, chi porta e chi ritira, ponti e vacanze scolastiche: tutto in un posto solo, insieme a chi ti aiuta. Beta gratuita su invito.",
  openGraph: {
    title: "TRAMA — Il tempo dei tuoi figli, organizzato",
    description: "Attività, settimane, chi porta e chi ritira, ponti e vacanze: tutto in un posto solo. Beta gratuita su invito.",
    images: [{ url: "/og/trama-private-beta.png", width: 1200, height: 630 }],
  },
};

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|skype|discord|headless/i;

async function recordView(source: string | null) {
  try {
    const ua = (await headers()).get("user-agent") ?? "";
    if (!ua || BOT_UA.test(ua) || !isSupabaseConfigured) return;
    const service = createServiceClient();
    await service?.from("product_events").insert({ event_name: "landing_viewed", detail: source ?? "diretto" });
  } catch {
    // osservabilità best-effort: la pagina si apre comunque
  }
}

export default async function BenvenutoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const source = cleanSource(first(params.da) ?? first(params.utm_source));
  await recordView(source);

  let loggedIn = false;
  if (isSupabaseConfigured) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      loggedIn = Boolean(user);
    } catch {
      loggedIn = false;
    }
  }

  return <BenvenutoView loggedIn={loggedIn} source={source} />;
}
