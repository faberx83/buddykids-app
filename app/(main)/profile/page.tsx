import MenuItem from "@/components/MenuItem";
import LogoutButton from "@/components/LogoutButton";
import ProfileKidsSection from "@/components/ProfileKidsSection";
import ProfileHeaderClient from "@/components/ProfileHeaderClient";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import { getKidsForUser } from "@/lib/data/kids";
import { getParentProfile } from "@/lib/data/profile";
import { DemoBadge } from "@/components/StatusBadge";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string; addKid?: string }>;
}) {
  const [profile, kids, params] = await Promise.all([
    getParentProfile(),
    getKidsForUser(),
    searchParams,
  ]);
  const { fullName, email, parentRole, avatarUrl } = profile;
  const autoOpenEdit = params.complete === "1";
  const autoOpenAddKid = params.addKid === "1";

  return (
    <div className="animate-fade-in">
      <div
        className="flex-shrink-0 px-5 pb-6 pt-5"
        style={{
          background: "linear-gradient(160deg,#E8F6FD 0%,#E3F9F5 100%)",
        }}
      >
        <ProfileHeaderClient
          initialFullName={fullName}
          initialParentRole={parentRole}
          initialAvatarUrl={avatarUrl}
          email={email}
          autoOpenEdit={autoOpenEdit}
          initialPhone={profile.phone}
          initialDateOfBirth={profile.dateOfBirth}
          initialGender={profile.gender}
        />
        <div className="mb-1.5 flex justify-end">
          <DemoBadge label="Numeri demo" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat num="12" label="Prenotazioni" />
          <Stat num="3" label="Gruppi" />
          <Stat num="€85" label="Risparmiati" />
        </div>
      </div>

      <ProfileKidsSection initialKids={kids} autoOpenAddKid={autoOpenAddKid} />

      <div className="px-5 pt-2">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Attività
        </div>
        <MenuItem
          icon="ti-ticket"
          iconBg="#E8F6FD"
          iconColor="#4DAFEF"
          main="Le mie prenotazioni"
          sub="Elenco prenotazioni in arrivo"
          comingSoon
        />
        <MenuItem
          icon="ti-heart"
          iconBg="#FFF8E7"
          iconColor="#c49a00"
          main="Preferiti"
          sub="Non ancora attivi"
          comingSoon
        />
        <MenuItem
          icon="ti-bus"
          iconBg="#E8F9EE"
          iconColor="#52C87A"
          main="Navetta"
          sub="Tracciamento live non ancora disponibile"
          comingSoon
        />
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Sicurezza
        </div>
        <ProfileSecuritySection />
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Preferenze
        </div>
        <ProfilePreferencesSection
          initialLanguage={profile.language}
          initialTheme={profile.theme}
          initialNotifyEmail={profile.notifyEmail}
          initialNotifyPush={profile.notifyPush}
          initialNotifySms={profile.notifySms}
        />
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Privacy e account
        </div>
        <ProfilePrivacySection
          initialMarketingConsent={profile.marketingConsent}
          initialAccountStatus={profile.accountStatus}
        />
      </div>

      <div className="px-5 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
          Supporto
        </div>
        <MenuItem icon="ti-message-circle" iconBg="#F4F6FA" iconColor="#6B7280" main="Chat con organizzatori" sub="Rispondiamo in 2 ore" comingSoon />
        <MenuItem icon="ti-file-invoice" iconBg="#F4F6FA" iconColor="#6B7280" main="Ricevute e fatture" comingSoon />
      </div>

      <LogoutButton />
      <div className="h-4" />
    </div>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div className="rounded-md bg-white px-2 py-2.5 text-center">
      <div className="text-lg font-bold text-ink">{num}</div>
      <div className="mt-0.5 text-[10px] font-medium text-ink-2">{label}</div>
    </div>
  );
}
