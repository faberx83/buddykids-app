"use client";

// TRAMA ONE Parent Spotlight sprint (24/08/2026) — equivalente lato Genitore
// di components/spotlight/PartnerSpotlight.tsx: stesso motore generico
// (SpotlightEngine, nessuna modifica al motore), nuovo percorso
// "discover_book_parent" definito in lib/walkthrough/registry.ts (cerca →
// filtra per settimana → apri scheda → prenota → Planner).
//
// Montato in app/nextgen/layout.tsx (persiste su ogni pagina Genitore
// NEXTGEN), stesso gate additivo TRAMA_ONE_ENABLED/Controlled Beta Cohort
// del lato Partner (vedi commento in app/nextgen/layout.tsx: se il flag
// risolve a false, progress resta null e questo componente non renderizza
// nulla — nessun redirect, nessun blocco).
//
// Nessuno step di questo percorso usa spotlightMissingHint (ogni target
// vive sulla stessa pagina raggiunta dallo step precedente: /nextgen/search
// per i primi tre, /activity/[id] per la prenotazione, qualunque pagina per
// il nav Planner) — nessun canLinkFromHere da passare, a differenza del
// wrapper Partner.
import type { WalkthroughProgressSummary } from "@/lib/walkthrough/data";
import SpotlightEngine from "@/components/spotlight/SpotlightEngine";

export default function ParentSpotlight({ progress }: { progress: WalkthroughProgressSummary | null }) {
  return <SpotlightEngine progress={progress} />;
}
