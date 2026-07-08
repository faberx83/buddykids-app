"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemoRole } from "@/components/DemoRoleProvider";
import { Role } from "@/lib/types";
import { DemoBadge } from "@/components/StatusBadge";
import PageLoadIndicator from "@/components/PageLoadIndicator";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function DashboardLogoutButton({ isAdmin, compact }: { isAdmin: boolean; compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    if (isSupabaseConfigured) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/auth/login");
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={handleLogout}
        aria-label="Esci dall'account"
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          isAdmin ? "text-navy-text2 hover:bg-navy-3" : "text-ink-2 hover:bg-bg"
        }`}
      >
        <i className="ti ti-logout text-lg" />
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        isAdmin ? "text-navy-text2 hover:bg-navy-3/60 hover:text-white" : "text-ink-2 hover:bg-bg hover:text-ink"
      }`}
    >
      <i className="ti ti-logout text-lg" />
      Esci dall&apos;account
    </button>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

// Tema visivo del pannello: "partner" (Gestore centro, teal chiaro) o
// "admin" (Admin piattaforma, dark navy) — riflette il sottodominio da cui
// si accede (partner.*/admin.*, vedi proxy.ts).
type DashboardVariant = "partner" | "admin";

export default function DashboardLayout({
  brand,
  brandEmoji,
  navItems,
  requiredRole,
  realRole,
  variant = "partner",
  children,
}: {
  brand: string;
  brandEmoji: string;
  navItems: NavItem[];
  requiredRole: Role;
  // Ruolo reale verificato lato server (da Supabase). `undefined` significa
  // "Supabase non configurato" — in quel caso si usa il ruolo demo come prima.
  // Quando è presente (anche `null`, es. profilo mancante), ha sempre la
  // precedenza sul ruolo demo: con account reali il selettore demo non conta.
  realRole?: Role | null;
  variant?: DashboardVariant;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { role: demoRole } = useDemoRole();
  const usingRealAuth = realRole !== undefined;
  const effectiveRole = usingRealAuth ? realRole : demoRole;
  // L'Admin piattaforma è un ruolo "superset": può entrare anche nelle
  // sezioni riservate al Gestore centro (utile anche per un unico account
  // che gestisce tutto in questa fase). Il Gestore centro resta invece
  // limitato alla propria sezione.
  const hasAccess = effectiveRole === requiredRole || effectiveRole === "platform_admin";

  if (!hasAccess) {
    return <AccessGate requiredRole={requiredRole} usingRealAuth={usingRealAuth} variant={variant} />;
  }

  const isAdmin = variant === "admin";

  return (
    <div className={isAdmin ? "min-h-screen bg-navy" : "min-h-screen bg-bg"}>
      <PageLoadIndicator color={isAdmin ? "#1A1D2E" : "#1FA88E"} />
      <div className="mx-auto flex max-w-6xl">
        <aside
          className={`sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col px-4 py-5 md:flex ${
            isAdmin
              ? "border-r border-navy-3 bg-navy-2"
              : "border-r border-[#E8EBF0] bg-white"
          }`}
        >
          <div className="mb-6 flex items-center gap-2 px-2">
            <span className="text-2xl">{brandEmoji}</span>
            <span className={`text-base font-bold ${isAdmin ? "text-white" : "text-ink"}`}>
              {brand}
            </span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isAdmin
                      ? active
                        ? "bg-navy-3 text-white"
                        : "text-navy-text2 hover:bg-navy-3/60 hover:text-white"
                      : active
                      ? "bg-partner-light text-partner"
                      : "text-ink-2 hover:bg-bg hover:text-ink"
                  }`}
                >
                  <i className={`ti ${item.icon} text-lg`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/"
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isAdmin
                ? "text-navy-text2 hover:bg-navy-3/60 hover:text-white"
                : "text-ink-2 hover:bg-bg hover:text-ink"
            }`}
          >
            <i className="ti ti-arrow-back-up text-lg" />
            Torna all&apos;app
          </Link>
          <DashboardLogoutButton isAdmin={isAdmin} />
        </aside>

        <div className="min-w-0 flex-1">
          {/* sticky: su mobile la barra (logo + pillole di navigazione) resta
              visibile in cima durante lo scroll invece di scorrere via con
              il contenuto della pagina (task #24). */}
          <div className={`sticky top-0 z-30 md:hidden ${isAdmin ? "bg-navy-2" : "bg-white"}`}>
            <header
              className={`flex items-center justify-between border-b px-5 py-3 ${
                isAdmin ? "border-navy-3 bg-navy-2" : "border-[#E8EBF0] bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{brandEmoji}</span>
                <span className={`text-sm font-bold ${isAdmin ? "text-white" : "text-ink"}`}>
                  {brand}
                </span>
              </div>
              <DashboardLogoutButton isAdmin={isAdmin} compact />
            </header>
            <nav
              className={`flex gap-1 overflow-x-auto border-b px-3 py-2 ${
                isAdmin ? "border-navy-3 bg-navy-2" : "border-[#E8EBF0] bg-white"
              }`}
            >
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isAdmin
                        ? active
                          ? "bg-navy-3 text-white"
                          : "bg-navy text-navy-text2"
                        : active
                        ? "bg-partner text-white"
                        : "bg-bg text-ink-2"
                    }`}
                  >
                    <i className={`ti ${item.icon} text-sm`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div
            className={`flex items-center gap-2 border-b px-5 py-2 md:px-8 ${
              isAdmin ? "border-navy-3 bg-navy-2" : "border-[#F0E6C8] bg-[#FFFBF0]"
            }`}
          >
            <DemoBadge label="Dati demo" />
            <span className={`text-xs ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>
              Dashboard, grafici e form di questa area sono ancora collegati a dati di esempio —
              le scritture reali arrivano nel prossimo step.
            </span>
          </div>
          <main className="p-5 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function AccessGate({
  requiredRole,
  usingRealAuth,
  variant,
}: {
  requiredRole: Role;
  usingRealAuth: boolean;
  variant: DashboardVariant;
}) {
  const { setRole } = useDemoRole();
  const isAdmin = variant === "admin";
  const accent = isAdmin ? "bg-navy hover:bg-navy-2" : "bg-partner hover:bg-[#1A9280]";
  const labels: Record<Role, string> = {
    parent: "Genitore",
    center_admin: "Gestore centro",
    platform_admin: "Admin piattaforma",
  };

  if (usingRealAuth) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-light text-3xl">
          🔒
        </div>
        <div className="text-lg font-bold text-ink">Accesso non autorizzato</div>
        <p className="max-w-sm text-sm text-ink-2">
          Il tuo account non ha i permessi di <strong>{labels[requiredRole]}</strong>. Se pensi
          sia un errore, contatta chi gestisce la piattaforma per farti assegnare il ruolo giusto.
        </p>
        <Link href="/" className={`rounded-md px-4 py-2.5 text-sm font-semibold text-white ${accent}`}>
          Torna all&apos;app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-light text-3xl">
        🔒
      </div>
      <div className="text-lg font-bold text-ink">Accesso riservato</div>
      <p className="max-w-sm text-sm text-ink-2">
        Questa sezione è pensata per il ruolo <strong>{labels[requiredRole]}</strong>. Passa a
        quel ruolo demo (in basso a destra) per vederla, oppure torna all&apos;app.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setRole(requiredRole)}
          className={`rounded-md px-4 py-2.5 text-sm font-semibold text-white ${accent}`}
        >
          Passa a {labels[requiredRole]}
        </button>
        <Link
          href="/"
          className="rounded-md border border-[#E8EBF0] bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Torna all&apos;app
        </Link>
      </div>
    </div>
  );
}
