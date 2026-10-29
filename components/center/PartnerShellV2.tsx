"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PageLoadIndicator from "@/components/PageLoadIndicator";
import { NextgenToastProvider } from "@/components/nextgen/NextgenToastProvider";
import {
  UNSEEN_COUNT_EVENT,
  announceHeaderBell,
  requestOpenNotifications,
  type UnseenCountDetail,
} from "@/lib/nextgen/notification-bridge";
import {
  PARTNER_SUBTABS,
  PARTNER_TABS,
  activeSubTab,
  badgeLabel,
  partnerBackLink,
  sectionForPath,
  type PartnerBadges,
  type PartnerSection,
} from "@/lib/centers/partner-shell";

// TRAMA — PORTALE CENTRI V2, GUSCIO (28/10/2026, PARTNER_SHELL_V2_ENABLED).
// Fabrizio: "dobbiamo rivedere tutto il portale in ordine e pronto per una
// prima condivisione con potenziali partner".
// Al posto della barra laterale a 12 voci (components/dashboard/DashboardLayout.tsx,
// che resta per il portale di prima e per l'Admin): quattro sezioni, in basso
// su telefono e in alto su computer, come nell'app famiglie. Palette del
// portale centri (petrolio e senape, tailwind "partner-*"); caratteri, raggi
// e filo TRAMA uguali alle famiglie. Le pagine sono quelle di sempre.
// 29/10/2026, Fabrizio: "allinea font, logo ecc.", poi "il logo userei quello
// navy e non colorato": segno TRAMA navy; campanella nell'intestazione come nella
// Home V2 (non più il pulsante che galleggia in basso), conferme brevi
// ("Salvato") con lo stesso componente delle famiglie.

function HeaderBell() {
  const [unseen, setUnseen] = useState(0);
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    announceHeaderBell(true);
    function onCount(e: Event) {
      const detail = (e as CustomEvent<UnseenCountDetail | undefined>).detail;
      setUnseen(detail?.count ?? 0);
      setLabel(detail?.label ?? null);
    }
    window.addEventListener(UNSEEN_COUNT_EVENT, onCount);
    return () => {
      window.removeEventListener(UNSEEN_COUNT_EVENT, onCount);
      announceHeaderBell(false);
    };
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        requestOpenNotifications();
        setUnseen(0);
      }}
      aria-label={unseen > 0 ? label ?? `Notifiche, ${unseen} da leggere` : "Notifiche"}
      aria-haspopup="dialog"
      className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-partner-line bg-white text-partner-primary active:scale-95"
    >
      <i className="ti ti-bell text-[20px]" aria-hidden="true" />
      {unseen > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-trama-error px-1 text-[10px] font-bold text-white ring-2 ring-white"
        >
          {unseen > 9 ? "9+" : unseen}
        </span>
      )}
    </button>
  );
}

function SectionIcon({ icon, active }: { icon: string; active: boolean }) {
  return <i className={`ti ${icon} text-[22px] ${active ? "text-partner-primary" : "text-ink-2"}`} aria-hidden="true" />;
}

function Badge({ count, label }: { count: number; label: string }) {
  const text = badgeLabel(count);
  if (!text) return null;
  return (
    <span
      aria-label={label}
      className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-trama-error px-1 text-[11px] font-bold leading-none text-white"
    >
      {text}
    </span>
  );
}

export default function PartnerShellV2({
  centerName,
  accountInitials,
  accountAvatarUrl,
  badges,
  children,
}: {
  centerName: string;
  accountInitials: string;
  accountAvatarUrl?: string | null;
  badges: PartnerBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/center";
  const section = sectionForPath(pathname);
  const subTabs = PARTNER_SUBTABS[section] ?? [];
  const activeSub = activeSubTab(pathname);
  const back = partnerBackLink(pathname);

  const badgeFor = (key: PartnerSection) => (key === "richieste" ? badges.richieste : key === "oggi" ? badges.oggi : 0);
  const badgeText = (key: PartnerSection, n: number) =>
    key === "richieste" ? `${n} da guardare` : `${n} check-in da confermare`;

  return (
    <div data-partner-v2 className="min-h-screen bg-partner-page font-sans text-ink">
      <PageLoadIndicator color="#0E5A63" />

      <header className="sticky top-0 z-30 border-b border-partner-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-6">
          <Link href="/center" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Oggi, portale centri TRAMA">
            <img src="/brand/trama-logo-mark-navy.png" alt="" aria-hidden="true" className="h-[26px] w-auto flex-shrink-0" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-partner-primary">Portale centri</span>
              <span className="truncate font-poppins text-[15px] font-semibold text-ink">{centerName}</span>
            </span>
          </Link>

          <nav aria-label="Sezioni del portale" className="hidden items-center gap-1 md:flex">
            {PARTNER_TABS.map((tab) => {
              const active = tab.key === section;
              const n = badgeFor(tab.key);
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[40px] items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${
                    active ? "bg-partner-soft text-partner-primary" : "text-ink-2 hover:bg-partner-page hover:text-ink"
                  }`}
                >
                  <i className={`ti ${tab.icon} text-[18px]`} aria-hidden="true" />
                  {tab.label}
                  <Badge count={n} label={badgeText(tab.key, n)} />
                </Link>
              );
            })}
          </nav>

          <HeaderBell />
          <Link
            href="/center/account"
            aria-label="Il mio account"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-partner-soft text-[13px] font-bold text-partner-primary"
          >
            {accountAvatarUrl ? <img src={accountAvatarUrl} alt="" className="h-full w-full object-cover" /> : accountInitials}
          </Link>
        </div>

        {subTabs.length > 0 && (
          <div className="mx-auto max-w-5xl px-4 pb-2.5 md:px-6">
            <nav aria-label="Viste della sezione" className="flex gap-1.5 overflow-x-auto">
              {subTabs.map((t) => {
                const active = t.href === activeSub;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[36px] flex-shrink-0 items-center rounded-full border px-3.5 text-[13.5px] font-semibold transition-colors ${
                      active
                        ? "border-partner-primary bg-partner-primary text-white"
                        : "border-partner-line bg-white text-ink-2 hover:text-ink"
                    }`}
                  >
                    {t.label}
                    {(badges.bySubTab[t.href] ?? 0) > 0 && (
                      <span
                        className={`ml-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                          active ? "bg-white text-partner-primary" : "bg-trama-error text-white"
                        }`}
                        aria-label={`${badges.bySubTab[t.href]} da guardare`}
                      >
                        {badgeLabel(badges.bySubTab[t.href])}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      <NextgenToastProvider>
        <main className="mx-auto max-w-5xl px-4 pb-32 pt-5 md:px-6 md:pb-16">
          {/* 29/10/2026: "mancano i pulsanti per tornare indietro" (partnerBackLink). */}
          {back && (
            <Link
              href={back.href}
              data-testid="partner-back"
              className="-mt-1 mb-3 inline-flex min-h-[40px] items-center gap-1 text-[14px] font-semibold text-partner-primary"
            >
              <i className="ti ti-chevron-left text-[18px]" aria-hidden="true" />
              {back.label}
            </Link>
          )}
          {children}
        </main>
      </NextgenToastProvider>

      <nav
        aria-label="Sezioni del portale"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-partner-line bg-white pt-1.5 md:hidden"
        style={{ paddingBottom: "calc(0.6rem + env(safe-area-inset-bottom))" }}
      >
        {PARTNER_TABS.map((tab) => {
          const active = tab.key === section;
          const n = badgeFor(tab.key);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[50px] flex-col items-center justify-center gap-[3px] active:scale-95"
            >
              {active && (
                <span aria-hidden="true" className="absolute top-0 h-[3px] w-6 rounded-full bg-partner-primary" />
              )}
              <span className="relative">
                <SectionIcon icon={tab.icon} active={active} />
                {n > 0 && (
                  <span className="absolute -right-3 -top-1.5">
                    <Badge count={n} label={badgeText(tab.key, n)} />
                  </span>
                )}
              </span>
              <span className={`font-poppins text-[11px] ${active ? "font-semibold text-partner-primary" : "font-medium text-ink-2"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
