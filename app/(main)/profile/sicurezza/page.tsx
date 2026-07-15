import PageHeader from "@/components/PageHeader";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";

// Sotto-pagina dedicata "Sicurezza" (dentro Impostazioni) — prima era una
// sezione sempre visibile in linea nel profilo, ora una pagina propria
// raggiunta dal menu Impostazioni (vedi ProfileSettingsSection).
export default function ProfileSicurezzaPage() {
  return (
    <div className="animate-fade-in">
      {/* BUGFIX (segnalato da Fabrizio) — raggiungibile sia dal profilo LEGACY
          che da quello NEXTGEN: niente backHref fisso, PageHeader ricade su
          router.back() e torna a dove l'utente era arrivato davvero. */}
      <PageHeader title="Sicurezza" />
      <div className="px-5 py-4">
        <ProfileSecuritySection />
      </div>
    </div>
  );
}
