"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoRole } from "@/components/DemoRoleProvider";
import { Role } from "@/lib/types";
import { DemoBadge } from "@/components/StatusBadge";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export default function DashboardLayout({
  brand,
  brandEmoji,
  navItems,
  requiredRole,
  realRole,
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
    return <AccessGate requiredRole={requiredRole} usingRealAuth={usingRealAuth} />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col border-r border-[#E8EBF0] bg-white px-4 py-5 md:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <span className="text-2xl">{brandEmoji}</span>
            <span className="text-base font-bold text-ink">{brand}</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    active ? "bg-sky-light text-sky" : "text-ink-2 hover:bg-bg hover:text-ink"
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
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-bg hover:text-ink"
          >
            <i className="ti ti-arrow-back-up text-lg" />
            Torna all&apos;app
          </Link>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-[#E8EBF0] bg-white px-5 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xl">{brandEmoji}</span>
              <span className="text-sm font-bold text-ink">{brand}</span>
            </div>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-[#E8EBF0] bg-white px-3 py-2 md:hidden">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-sky text-white" : "bg-bg text-ink-2"
                  }`}
                >
                  <i className={`ti ${item.icon} text-sm`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 border-b border-[#F0E6C8] bg-[#FFFBF0] px-5 py-2 md:px-8">
            <DemoBadge label="Dati demo" />
            <span className="text-xs text-ink-2">
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
}: {
  requiredRole: Role;
  usingRealAuth: boolean;
}) {
  const { setRole } = useDemoRole();
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
        <Link
          href="/"
          className="rounded-md bg-sky px-4 py-2.5 text-sm font-semibold text-white"
        >
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
          className="rounded-md bg-sky px-4 py-2.5 text-sm font-semibold text-white"
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
