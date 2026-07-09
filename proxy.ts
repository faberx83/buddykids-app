import { NextResponse, type NextRequest } from "next/server";
import { updateSession, getRequestRole, getRequestUserId } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { tenantForHost, TENANT_CONFIG } from "@/lib/tenant";

// ─────────────────────────────────────────────────────────────────
// Multi-tenant a sottodomini:
//   - dominio principale  (es. buddykids.app)          → app famiglie
//   - partner.<dominio>   (es. partner.buddykids.app)   → dashboard Gestore
//     centro — richiede profiles.role = "center_admin" (o "platform_admin")
//   - admin.<dominio>     (es. admin.buddykids.app)     → pannello Admin
//     piattaforma — richiede profiles.role = "platform_admin"
//
// Le pagine reali continuano a vivere sotto /center e /admin (invariato):
// qui riscriviamo internamente l'URL così che, per esempio,
// partner.buddykids.app/attivita serva app/center/attivita/page.tsx senza
// mostrare "/center" nella barra degli indirizzi.
// ─────────────────────────────────────────────────────────────────

function mainDomainUrl(request: NextRequest, rawHost: string): URL {
  const url = request.nextUrl.clone();
  // Con alias .vercel.app "sciolti" (non sottodomini dello stesso dominio,
  // vedi lib/tenant.ts) non c'è un prefisso partner./admin. da togliere per
  // ricavare il dominio famiglie — va indicato esplicitamente.
  const configuredMainHost = process.env.NEXT_PUBLIC_MAIN_HOST;
  url.host = configuredMainHost || rawHost.replace(/^partner\.|^admin\./, "");
  url.pathname = "/";
  url.search = "";
  return url;
}

function sameSiteLoginUrl(request: NextRequest): URL {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";
  return url;
}

function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

export async function proxy(request: NextRequest) {
  // Preferiamo l'header Host/X-Forwarded-Host: dietro proxy/load-balancer (e
  // in alcuni setup di "next start") request.nextUrl.hostname può riflettere
  // l'host interno invece di quello richiesto dal browser.
  const rawHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    request.nextUrl.hostname;
  const hostname = rawHost.split(":")[0];
  const { pathname } = request.nextUrl;

  // 1) Manifest PWA diverso per sottodominio (nome/colore/icona) — vedi
  // public/manifest-{family,partner,admin}.json.
  if (pathname === "/manifest.json") {
    const tenant = tenantForHost(hostname);
    return NextResponse.rewrite(new URL(TENANT_CONFIG[tenant].manifest, request.url));
  }

  // 2) Rinfresca sempre la sessione Supabase (comportamento preesistente,
  // invariato per il dominio famiglie).
  const sessionResponse = await updateSession(request);

  const tenant = tenantForHost(hostname);
  if (tenant === "family") {
    // Gate qui (invece di lasciare che sia solo app/(main)/layout.tsx a
    // rimandare al login) per poter preservare la pagina di destinazione con
    // ?next=... — indispensabile per i link di invito (es. "Invita famiglie"
    // in un Gruppo, che punta a /groups/join/[id]): senza questo, chi riceve
    // il link su WhatsApp senza avere ancora un account veniva rimandato al
    // login e, dopo essersi registrato, atterrava sulla Home invece che
    // tornare a unirsi al gruppo.
    if (
      isSupabaseConfigured &&
      !pathname.startsWith("/auth") &&
      !pathname.startsWith("/api")
    ) {
      const userId = await getRequestUserId(request);
      if (!userId) {
        const loginUrl = request.nextUrl.clone();
        const nextPath = `${pathname}${request.nextUrl.search || ""}`;
        loginUrl.pathname = "/auth/login";
        loginUrl.search = `?next=${encodeURIComponent(nextPath)}`;
        return copyCookies(sessionResponse, NextResponse.redirect(loginUrl));
      }
    }
    return sessionResponse;
  }

  // 3) Percorsi condivisi tra tutti i tenant, esenti dal gate di ruolo E dalla
  // riscrittura verso /center o /admin: pagine di login/callback e chiamate
  // interne Next/API. Indispensabile perché — quando i cookie di sessione non
  // sono condivisi col dominio principale (es. alias .vercel.app temporanei,
  // dove non si può impostare NEXT_PUBLIC_COOKIE_DOMAIN) — bisogna poter fare
  // login direttamente su partner./admin.*: se il gate scattasse anche qui,
  // chi non è ancora autenticato verrebbe rimandato indietro prima ancora di
  // poter inserire le credenziali.
  // I file manifest-{family,partner,admin}.json veri e propri (quelli a cui
  // punta il <link rel="manifest"> generato da app/layout.tsx) vanno esclusi
  // anche loro dalla riscrittura sotto — altrimenti finiscono riscritti verso
  // /center/manifest-partner.json o /admin/manifest-admin.json (che non
  // esistono, 404), e il browser non trova più nessun manifest valido.
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/manifest") ||
    pathname === "/sw.js"
  ) {
    return sessionResponse;
  }

  // 4) Sottodomini protetti: serve il ruolo giusto (platform_admin è un
  // ruolo superset e passa anche il gate di partner.*).
  // In modalità demo (Supabase non configurato) il controllo è saltato, per
  // poter vedere in anteprima i tre layout senza account reali.
  if (isSupabaseConfigured) {
    const requiredRole = tenant === "partner" ? "center_admin" : "platform_admin";
    const identity = await getRequestRole(request);
    const hasAccess = identity?.role === requiredRole || identity?.role === "platform_admin";

    if (!hasAccess) {
      // Non autenticato: mandalo al login dello STESSO host (partner./admin.),
      // non al dominio principale — coi cookie non condivisi (alias .vercel.app
      // temporanei) rimandarlo al dominio famiglie lo farebbe finire sempre lì
      // senza mai vedere un login per questa sezione.
      if (!identity) {
        return copyCookies(sessionResponse, NextResponse.redirect(sameSiteLoginUrl(request)));
      }
      // Autenticato ma con il ruolo sbagliato: qui sì, torna al dominio
      // principale (mostrare di nuovo il login non servirebbe a nulla).
      return copyCookies(sessionResponse, NextResponse.redirect(mainDomainUrl(request, rawHost)));
    }
  }

  // 5) Riscrive internamente verso /center o /admin, senza cambiare la URL
  // visibile nel browser.
  const prefix = tenant === "partner" ? "/center" : "/admin";
  if (!pathname.startsWith(prefix)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
    return copyCookies(sessionResponse, NextResponse.rewrite(url));
  }

  return sessionResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static, _next/image (static files)
     * - favicon.ico
     * - image/font files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
