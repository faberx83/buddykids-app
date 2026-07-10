import PageHeader from "@/components/PageHeader";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import { getParentProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Preferenze" (dentro Impostazioni).
export default async function ProfilePreferenzePage() {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Preferenze" backHref="/profile" />
      <div className="px-5 py-4">
        <ProfilePreferencesSection initialLanguage={profile.language} initialTheme={profile.theme} />
      </div>
    </div>
  );
}
