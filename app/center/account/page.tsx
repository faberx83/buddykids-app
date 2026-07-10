import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import LogoutButton from "@/components/LogoutButton";
import { getGestoreAccountProfile } from "@/lib/data/profile";

// "Il mio account" — profilo PERSONALE del gestore (nome, telefono, data di
// nascita, password, preferenze, privacy). Distinto da /center/profile, che
// è il profilo del CENTRO (business: nome attività, indirizzo, contatti
// pubblici, sconti) — non va confuso con questa pagina.
export default async function GestoreAccountPage() {
  const profile = await getGestoreAccountProfile();

  return (
    <div className="animate-fade-in px-5 py-5">
      <div className="mb-4 rounded-lg bg-white p-3.5">
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

      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Sicurezza</div>
      <div className="mb-4">
        <ProfileSecuritySection />
      </div>

      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Preferenze</div>
      <div className="mb-4">
        <ProfilePreferencesSection
          initialLanguage={profile.language}
          initialTheme={profile.theme}
          initialNotifyEmail={profile.notifyEmail}
          initialNotifyPush={profile.notifyPush}
          initialNotifySms={profile.notifySms}
        />
      </div>

      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
        Privacy e account
      </div>
      <div className="mb-4">
        <ProfilePrivacySection
          initialMarketingConsent={profile.marketingConsent}
          initialAccountStatus={profile.accountStatus}
        />
      </div>

      <LogoutButton />
    </div>
  );
}
