import LegalPendingClient from "./LegalPendingClient";

export const dynamic = "force-dynamic";

// TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #579,
// 25/08/2026 sera). Destinazione fail-closed di app/auth/callback/route.ts
// quando LEGAL_TERMS_GATE è attivo per l'utente e nessuna acceptance dei
// Termini correnti risulta persistita (né dal bootstrap di signup né dal
// retry col client autenticato). Mai raggiunta da un utente reale oggi
// (gate globale OFF di default) — nessuna route esistente ci reindirizza
// se non questo backstop.
export default function LegalPendingPage() {
  return <LegalPendingClient />;
}
