import PageHeader from "@/components/PageHeader";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";

// Sotto-pagina dedicata "Sicurezza" — stessa struttura del profilo genitore
// (vedi app/(main)/profile/sicurezza), condivisa per coerenza tra le due app.
export default function GestoreSicurezzaPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Sicurezza" backHref="/center/account" />
      <div className="px-5 py-4">
        <ProfileSecuritySection />
      </div>
    </div>
  );
}
