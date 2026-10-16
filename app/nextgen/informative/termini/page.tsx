import LegalPublicPage from "@/components/LegalPublicPage";

export const dynamic = "force-dynamic";

// 16/10/2026 — Termini di servizio dentro l'app (stesso testo verificato di /terms).
export default function InAppTermsPage() {
  return <LegalPublicPage type="terms" title="Termini di servizio" variant="app" />;
}
