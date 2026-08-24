"use client";

// TRAMA ONE Parent Spotlight sprint (24/08/2026) — questo componente è ora un
// thin wrapper attorno al motore generico (components/spotlight/
// SpotlightEngine.tsx, dove vive tutta la logica overlay/cutout/popover,
// invariata da questa estrazione). Esiste solo per fornire l'UNICO
// comportamento Partner-specifico che non è generico: il link di deep-link
// mostrato sul badge "target non trovato" per lo step configure_spot_days
// (spotlightMissingHint) deve apparire SOLO su una vera pagina
// /center/activities/[id] (mai su /new, mai sulla lista) — vedi DEC-69.
//
// Montato una sola volta in app/center/layout.tsx (persiste su ogni pagina
// Partner, sopravvive alla navigazione).
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import SpotlightEngine from "@/components/spotlight/SpotlightEngine";

function canLinkFromHere(pathname: string): boolean {
  return /^\/center\/activities\/[^/]+$/.test(pathname) && !pathname.endsWith("/new");
}

export default function PartnerSpotlight({ progress }: { progress: WalkthroughProgressSummary | null }) {
  return <SpotlightEngine progress={progress} canLinkFromHere={canLinkFromHere} />;
}
