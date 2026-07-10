import PageHeader from "@/components/PageHeader";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";

// Sotto-pagina dedicata "Sicurezza" (dentro Impostazioni) — prima era una
// sezione sempre visibile in linea nel profilo, ora una pagina propria
// raggiunta dal menu Impostazioni (vedi ProfileSettingsSection).
export default function ProfileSicurezzaPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Sicurezza" backHref="/profile" />
      <div className="px-5 py-4">
        <ProfileSecuritySection />
      </div>
    </div>
  );
}
