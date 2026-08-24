import CenterLeadsView from "@/components/CenterLeadsView";

// TRAMA ONE Build Sprint 5 — "I tuoi suggerimenti" (Genitore). Sola lettura
// delle proprie segnalazioni di centri non iscritti (J11). Condivisa tra
// LEGACY e NEXTGEN come le altre pagine sotto (main) — vedi
// app/(main)/presenze/page.tsx per lo stesso pattern (nessun backHref fisso,
// PageHeader ricade su router.back()).
//
// TRAMA ONE (24/08/2026) — JSX estratto in components/CenterLeadsView.tsx per
// essere riusato anche dal guscio NEXTGEN-native (app/nextgen/center-leads),
// stesso pattern di "Le mie prenotazioni" (task #524).
export default function CenterLeadsPage() {
  return <CenterLeadsView />;
}
