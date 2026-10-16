import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProfilePrivacySection from "@/components/ProfilePrivacySection";
import { getParentProfile } from "@/lib/data/profile";

// TRAMA ONE (24/08/2026) — estratto da app/(main)/profile/privacy/page.tsx
// per essere riusato anche dal guscio NEXTGEN-native
// (app/nextgen/profile/impostazioni/privacy), stesso pattern già usato per
// "Le mie prenotazioni" (task #524): nessuna nuova query, solo il
// contenitore visivo cambia (showBrandIcon).
//
// BUGFIX preesistente (segnalato da Fabrizio) — raggiungibile sia dal
// profilo LEGACY che da quello NEXTGEN: niente backHref fisso, PageHeader
// ricade su router.back() e torna a dove l'utente era arrivato davvero.
export default async function PrivacyView({ showBrandIcon }: { showBrandIcon?: boolean }) {
  const profile = await getParentProfile();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Privacy e account" showBrandIcon={showBrandIcon} />
      <div className="px-5 py-4">
        <ProfilePrivacySection
          initialMarketingConsent={profile.marketingConsent}
          initialAccountStatus={profile.accountStatus}
        />
        {/* 16/10/2026 — i documenti si leggono anche da qui (nell'area famiglie
            dentro l'app, altrimenti le pagine pubbliche). */}
        <nav aria-label="Documenti" className="mt-5 flex flex-col overflow-hidden rounded-2xl border border-[#E9E6DF] bg-white">
          <Link
            href={showBrandIcon ? "/nextgen/informative/privacy" : "/privacy"}
            className="flex min-h-[52px] items-center justify-between border-b border-[#F0F2F5] px-4 text-[14.5px] font-semibold text-ink"
          >
            Informativa privacy
            <i className="ti ti-chevron-right text-[16px] text-ink-3" aria-hidden="true" />
          </Link>
          <Link
            href={showBrandIcon ? "/nextgen/informative/termini" : "/terms"}
            className="flex min-h-[52px] items-center justify-between px-4 text-[14.5px] font-semibold text-ink"
          >
            Termini di servizio
            <i className="ti ti-chevron-right text-[16px] text-ink-3" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </div>
  );
}
