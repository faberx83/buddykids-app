import LegalPublicPage from "@/components/LegalPublicPage";

export const dynamic = "force-dynamic";

// 16/10/2026 — Informativa privacy dentro l'app (stesso testo verificato di /privacy).
export default function InAppPrivacyPage() {
  return <LegalPublicPage type="privacy_notice" title="Informativa privacy" variant="app" />;
}
