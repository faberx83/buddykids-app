import LegalPublicPage from "@/components/LegalPublicPage";

export const dynamic = "force-dynamic";

// Pagina pubblica dei Termini di servizio: sola lettura, senza login.
// L'accettazione versionata avviene solo in registrazione (app/actions/legal.ts).
// 16/10/2026: mostra il testo versionato di lib/legal/texts.ts — vedi LegalPublicPage.
export default function TermsOfServicePage() {
  return <LegalPublicPage type="terms" title="Termini di servizio" />;
}
