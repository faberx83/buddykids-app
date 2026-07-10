import type { AccountStatus, Language, Theme } from "@/lib/data/profile";
import ProfileSecuritySection from "@/components/ProfileSecuritySection";
import ProfilePreferencesSection from "@/components/ProfilePreferencesSection";
import ProfileNotificheSection from "@/components/ProfileNotificheSection";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";

// Blocco unico "Impostazioni" con le 4 sottosezioni (Sicurezza/Preferenze/
// Notifiche/Privacy e account) — condiviso identico tra il profilo genitore
// (app/(main)/profile/page.tsx) e "Il mio account" del gestore
// (app/center/account/page.tsx), così restano sempre allineati: qualsiasi
// modifica a questa struttura si applica automaticamente a entrambi.
export default function ProfileSettingsSection({
  language,
  theme,
  notifyEmail,
  notifyPush,
  notifySms,
  marketingConsent,
  accountStatus,
}: {
  language: Language;
  theme: Theme;
  notifyEmail: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  marketingConsent: boolean;
  accountStatus: AccountStatus;
}) {
  return (
    <div className="px-5 pt-3">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">Impostazioni</div>

      <div className="mb-1.5 text-xs font-bold text-ink">Sicurezza</div>
      <div className="mb-3">
        <ProfileSecuritySection />
      </div>

      <div className="mb-1.5 text-xs font-bold text-ink">Preferenze</div>
      <div className="mb-3">
        <ProfilePreferencesSection initialLanguage={language} initialTheme={theme} />
      </div>

      <div className="mb-1.5 text-xs font-bold text-ink">Notifiche</div>
      <div className="mb-3">
        <ProfileNotificheSection
          initialNotifyEmail={notifyEmail}
          initialNotifyPush={notifyPush}
          initialNotifySms={notifySms}
        />
      </div>

      <div className="mb-1.5 text-xs font-bold text-ink">Privacy e account</div>
      <div>
        <ProfilePrivacySection
          initialMarketingConsent={marketingConsent}
          initialAccountStatus={accountStatus}
        />
      </div>
    </div>
  );
}
