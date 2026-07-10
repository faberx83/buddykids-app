import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileSettingsSection from "@/components/ProfileSettingsSection";
import LogoutButton from "@/components/LogoutButton";
import { getGestoreAccountProfile } from "@/lib/data/profile";

// "Il mio account" — profilo PERSONALE del gestore (nome, telefono, data di
// nascita, password, preferenze, privacy). Distinto da /center/profile, che
// è il profilo del CENTRO (business: nome attività, indirizzo, contatti
// pubblici, sconti) — non va confuso con questa pagina.
//
// La struttura "Impostazioni" (Sicurezza/Preferenze/Notifiche/Privacy e
// account) è lo STESSO componente condiviso usato dal profilo genitore
// (ProfileSettingsSection) — per restare sempre coerenti tra le due app.
// L'uscita dall'account vive SOLO qui (non più nella sidebar/header del
// pannello Gestore, per coerenza con l'app genitore).
export default async function GestoreAccountPage() {
  const profile = await getGestoreAccountProfile();

  return (
    <div className="animate-fade-in py-5">
      <div className="mx-5 mb-4 rounded-lg bg-white p-3.5">
        <ProfileHeaderClient
          initialFullName={profile.fullName}
          initialParentRole={null}
          initialAvatarUrl={profile.avatarUrl}
          email={profile.email}
          initialPhone={profile.phone}
          initialDateOfBirth={profile.dateOfBirth}
          initialGender={profile.gender}
          showRoleSelector={false}
        />
      </div>

      <ProfileSettingsSection basePath="/center/account" />

      <div className="mt-4">
        <LogoutButton />
      </div>
    </div>
  );
}
