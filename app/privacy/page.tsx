import LegalPublicPage from "@/components/LegalPublicPage";

export const dynamic = "force-dynamic";

// Pagina pubblica dell'Informativa privacy (Art. 13 GDPR): sola lettura, senza
// login, mai un'accettazione (l'informativa non è un consenso). 16/10/2026:
// mostra il testo versionato di lib/legal/texts.ts — vedi LegalPublicPage.
export default function PrivacyNoticePage() {
  return <LegalPublicPage type="privacy_notice" title="Informativa privacy" />;
}
