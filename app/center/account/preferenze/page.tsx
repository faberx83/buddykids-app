import PageHeader from "@/components/PageHeader";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import { getGestoreAccountProfile } from "@/lib/data/profile";

// Sotto-pagina dedicata "Preferenze" — stessa struttura del profilo genitore.
export default async function GestorePreferenzePage() {
  const profile = await getGestoreAccountProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Preferenze" backHref="/center/account" />
      <div className="px-5 py-4">
        <ProfilePreferencesSection initialLanguage={profile.language} initialTheme={profile.theme} />
      </div>
    </div>
  );
}
