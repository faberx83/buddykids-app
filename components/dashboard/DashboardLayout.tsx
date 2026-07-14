"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDemoRole } from "@/components/DemoRoleProvider";
import { Role } from "@/lib/types";
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

// Badge circolare in alto a destra (iniziali o foto profilo) che porta alla
// pagina account del ruolo — coerente con il badge della Home genitore.
// Sostituisce il logout persistente in sidebar/header: l'uscita dall'account
// vive dentro quella pagina (vedi app/center/account/page.tsx).
function AccountBadge({
  href,
  initials,
  avatarUrl,
  isAdmin,
}: {
  href: string;
  initials?: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Vai al tuo account"
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${
        isAdmin ? "bg-navy-3 text-white" : "bg-partner-light text-partner"
      }`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL Supabase Storage, non ottimizzabile senza config extra
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </Link>
  );
}

// BRANDING TRAMA — sostituisce l'header emoji+testo ("🏫 TRAMA Partner",
// "🛠️ TRAMA Admin") con il vero logo del brand kit ufficiale, nella variante
// monocromatica corretta: NAVY su sfondo chiaro (sidebar Partner) e WHITE su
// sfondo scuro (sidebar Admin, già bg-navy). Il testo "TRAMA" resta implicito
// nel simbolo: accanto mostriamo solo l'etichetta di ruolo ("Partner"/
// "Admin"), altrimenti si leggerebbe "TRAMA" due volte.
function BrandMark({ isAdmin, size = 26 }: { isAdmin: boolean; size?: number }) {
  return (
    <img
      src={isAdmin ? "/brand/trama-logo-mark-white.png" : "/brand/trama-logo-mark-navy.png"}
      alt="TRAMA"
      style={{ height: size, width: "auto" }}
      className="flex-shrink-0"
    />
  );
}

function brandRoleLabel(brand: string): string {
  return brand.replace(/^TRAMA\s*/i, "").trim() || "TRAMA";
}

// Attivo su corrispondenza esatta OPPURE su sotto-rotte (es.
// /center/activities/[id] deve evidenziare "Attività" come
// /center/activities) — tranne per la voce "radice" della sezione (Dashboard,
// primo item dell'array), che altrimenti risulterebbe SEMPRE attiva insieme a
// qualunque altra voce (ogni altra rotta comincia per forza con lo stesso
// prefisso "/center/", "/admin/", ecc.).
function isNavItemActive(pathname: string, href: string, rootHref: string): boolean {
  if (href === rootHref) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  // Etichetta del gruppo sopra la voce (es. "Oggi"/"Gestione") — se due voci
  // consecutive hanno la stessa etichetta, l'intestazione si stampa solo una
  // volta sopra la prima. Se assente (es. Admin), niente intestazioni: la
  // lista resta piatta come prima.
  sectionLabel?: string;
  // Numero da mostrare come pallino rosso accanto alla voce (es. richieste
  // gruppo in attesa) — nascosto se 0/assente.
  badgeCount?: number;
}

// Tema visivo del pannello: "partner" (Gestore centro, teal chiaro) o
// "admin" (Admin piattaforma, dark navy) — riflette il sottodominio da cui
// si accede (partner.*/admin.*, vedi proxy.ts).
type DashboardVariant = "partner" | "admin";

export default function DashboardLayout({
  brand,
  navItems,
  requiredRole,
  realRole,
  variant = "partner",
  accountHref,
  accountInitials,
  accountAvatarUrl,
  children,
}: {
  brand: string;
  // brandEmoji rimosso: l'header ora mostra il vero simbolo TRAMA (BrandMark)
  // invece dell'emoji placeholder — vedi commento sopra BrandMark.
  navItems: NavItem[];
  requiredRole: Role;
  // Ruolo reale verificato lato server (da Supabase). `undefined` significa
  // "Supabase non configurato" — in quel caso si usa il ruolo demo come prima.
  // Quando è presente (anche `null`, es. profilo mancante), ha sempre la
  // precedenza sul ruolo demo: con account reali il selettore demo non conta.
  realRole?: Role | null;
  variant?: DashboardVariant;
  // Badge profilo in alto a destra (coerente con l'app genitore) — se
  // presente, sostituisce i pulsanti di logout in sidebar/header: l'uscita
  // dall'account vive dentro la pagina di destinazione (es. /center/account),
  // non più come azione sempre visibile in giro per l'app.
  accountHref?: string;
  accountInitials?: string;
  accountAvatarUrl?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { role: demoRole } = useDemoRole();
  const usingRealAuth = realRole !== undefined;
  const effectiveRole = usingRealAuth ? realRole : demoRole;

  // Menu mobile: segnalazione di Fabrizio ("da mobile lo metterei con il
  // classico menu laterale che si apre con le 3 lineette..com'è ora è un po'
  // difficile da navigare") — prima era una barra di pillole orizzontali
  // scorrevoli sotto l'header, ora è un cassetto laterale (drawer) con la
  // STESSA lista di voci/intestazioni di sezione della sidebar desktop. Si
  // chiude cliccando una voce, il retro (backdrop) o la X — niente effect
  // per sincronizzarlo col pathname: ogni Link del cassetto lo chiude già
  // esplicitamente in onClick (vedi renderNavItem), che basta ed evita
  // setState sincroni dentro un effect.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // L'Admin piattaforma è un ruolo "superset": può entrare anche nelle
  // sezioni riservate al Gestore centro (utile anche per un unico account
  // che gestisce tutto in questa fase). Il Gestore centro resta invece
  // limitato alla propria sezione.
  const hasAccess = effectiveRole === requiredRole || effectiveRole === "platform_admin";

  if (!hasAccess) {
    return <AccessGate requiredRole={requiredRole} usingRealAuth={usingRealAuth} variant={variant} />;
  }

  const isAdmin = variant === "admin";

  // Voce di navigazione con intestazione di sezione — condivisa tra la
  // sidebar desktop e il cassetto mobile (prima erano due liste JSX
  // duplicate). "onNavigate" chiude il cassetto mobile dopo un click; è
  // undefined nella sidebar desktop, dove non serve.
  function renderNavItem(item: NavItem, i: number, onNavigate?: () => void) {
    const active = isNavItemActive(pathname, item.href, navItems[0]?.href ?? item.href);
    const showSectionHeader = item.sectionLabel && item.sectionLabel !== navItems[i - 1]?.sectionLabel;
    return (
      <div key={item.href}>
        {showSectionHeader && (
          <div
            className={`px-3 pb-1 text-[10.5px] font-bold uppercase tracking-wide ${
              isAdmin ? "text-navy-text2/70" : "text-ink-3"
            } ${i > 0 ? "pt-3.5" : ""}`}
          >
            {item.sectionLabel}
          </div>
        )}
        <Link
          href={item.href}
          onClick={onNavigate}
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
          <span className="flex-1">{item.label}</span>
          {Boolean(item.badgeCount) && (
            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF6B6B] px-1 text-[10px] font-bold text-white">
              {item.badgeCount}
            </span>
          )}
        </Link>
      </div>
    );
  }

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
          <div className="mb-6 flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2">
              <BrandMark isAdmin={isAdmin} />
              <span className={`text-base font-bold ${isAdmin ? "text-white" : "text-ink"}`}>
                {brandRoleLabel(brand)}
              </span>
            </div>
            {accountHref && (
              <AccountBadge
                href={accountHref}
                initials={accountInitials}
                avatarUrl={accountAvatarUrl}
                isAdmin={isAdmin}
              />
            )}
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navItems.map((item, i) => renderNavItem(item, i))}
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
          {!accountHref && <DashboardLogoutButton isAdmin={isAdmin} />}
        </aside>

        <div className="min-w-0 flex-1">
          {/* sticky: su mobile l'header resta visibile in cima durante lo
              scroll (task #24). Segnalazione di Fabrizio: la barra di
              pillole orizzontali era "un po' difficile da navigare" — ora è
              un pulsante hamburger che apre un cassetto laterale con la
              STESSA lista/organizzazione a sezioni della sidebar desktop. */}
          <div className={`sticky top-0 z-30 md:hidden ${isAdmin ? "bg-navy-2" : "bg-white"}`}>
            <header
              className={`flex items-center justify-between border-b px-5 py-3 ${
                isAdmin ? "border-navy-3 bg-navy-2" : "border-[#E8EBF0] bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Apri il menu"
                  className={`-ml-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md ${
                    isAdmin ? "text-navy-text2 hover:bg-navy-3" : "text-ink-2 hover:bg-bg"
                  }`}
                >
                  <i className="ti ti-menu-2 text-xl" />
                </button>
                <BrandMark isAdmin={isAdmin} size={22} />
                <span className={`text-sm font-bold ${isAdmin ? "text-white" : "text-ink"}`}>
                  {brandRoleLabel(brand)}
                </span>
              </div>
              {accountHref ? (
                <AccountBadge
                  href={accountHref}
                  initials={accountInitials}
                  avatarUrl={accountAvatarUrl}
                  isAdmin={isAdmin}
                />
              ) : (
                <DashboardLogoutButton isAdmin={isAdmin} compact />
              )}
            </header>
          </div>

          {drawerOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setDrawerOpen(false)}
                aria-hidden="true"
              />
              <aside
                className={`absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col overflow-y-auto px-4 py-5 ${
                  isAdmin ? "bg-navy-2" : "bg-white"
                }`}
              >
                <div className="mb-6 flex items-center justify-between gap-2 px-2">
                  <div className="flex items-center gap-2">
                    <BrandMark isAdmin={isAdmin} />
                    <span className={`text-base font-bold ${isAdmin ? "text-white" : "text-ink"}`}>
                      {brandRoleLabel(brand)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Chiudi il menu"
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      isAdmin ? "text-navy-text2 hover:bg-navy-3" : "text-ink-2 hover:bg-bg"
                    }`}
                  >
                    <i className="ti ti-x text-lg" />
                  </button>
                </div>
                <nav className="flex flex-1 flex-col gap-1">
                  {navItems.map((item, i) => renderNavItem(item, i, () => setDrawerOpen(false)))}
                </nav>
                <Link
                  href="/"
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isAdmin
                      ? "text-navy-text2 hover:bg-navy-3/60 hover:text-white"
                      : "text-ink-2 hover:bg-bg hover:text-ink"
                  }`}
                >
                  <i className="ti ti-arrow-back-up text-lg" />
                  Torna all&apos;app
                </Link>
                {!accountHref && <DashboardLogoutButton isAdmin={isAdmin} />}
              </aside>
            </div>
          )}
          {/* BUG TROVATO+CORRETTO (parte del "punto della situazione" chiesto
              da Fabrizio): questo banner "Dati demo" era mostrato in modo
              indiscriminato su OGNI pagina Gestore/Admin, anche su quelle
              ormai reali (Richieste, Registro/Report presenze, i nuovi
              pannelli Admin...) — diventando un'affermazione falsa e
              fuorviante. Le pagine ancora davvero collegate a dati di
              esempio (Centri/Tag/Fornitori Admin, Inviti, Profilo centro,
              Promozioni, calendario disponibilità) mostrano già il proprio
              DemoBadge locale nel punto preciso in cui serve — il banner
              generico qui non aggiunge più informazione corretta. */}
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
