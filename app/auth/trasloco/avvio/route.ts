import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, cookieDomain } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { tenantForHost } from "@/lib/tenant";
import { persistProductEvent } from "@/lib/telemetry/events";
import {
  canonicalHostForLegacy,
  encodeHandoff,
  safeNextPath,
  MOVE_DONE_COOKIE,
  MOVE_DONE_SECONDS,
  MOVE_LANDING_PATH,
  MOVE_SKIP_COOKIE,
  MOVE_SKIP_SECONDS,
} from "@/lib/domain-move";
import { domainMoveSigner } from "@/lib/domain-move-server";

// TRAMA — TRASLOCO SU tramapp.it (16/10/2026). Gira SOLO sul vecchio
// indirizzo (*.vercel.app): proxy.ts ci manda qui le aperture di pagina.
// Release spenta per questo utente → si torna alla pagina richiesta, senza
// ricontrollare per un'ora. Release accesa → nuovo indirizzo, con la
// sessione se c'è (vedi lib/domain-move.ts).

export const dynamic = "force-dynamic";

const FLAG = "DOMAIN_MOVE_TRAMAPP_ENABLED";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(request: NextRequest) {
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const newHost = canonicalHostForLegacy(rawHost);

  const stay = () => {
    const res = NextResponse.redirect(new URL(next, request.nextUrl.origin), 307);
    res.cookies.set(MOVE_SKIP_COOKIE, "1", { path: "/", maxAge: MOVE_SKIP_SECONDS, sameSite: "lax", secure: true });
    return noStore(res);
  };

  const signer = domainMoveSigner();
  if (!newHost || !isSupabaseConfigured || !signer) return stay();

  const tenant = tenantForHost(rawHost.split(":")[0]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const enabled = await resolveFeatureFlag({ flagName: FLAG, userId: user?.id ?? null, tenant }).catch(() => false);
  if (!enabled) return stay();

  const target = `https://${newHost}`;

  if (!user) {
    return noStore(NextResponse.redirect(`${target}${next}`, 307));
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token || !session.refresh_token) {
    return noStore(NextResponse.redirect(`${target}${next}`, 307));
  }

  await persistProductEvent({ event: "domain_move_handoff", tenant, detail: newHost }).catch(() => undefined);

  const fragment = encodeHandoff(
    { at: session.access_token, rt: session.refresh_token, n: next, ts: Math.floor(Date.now() / 1000) },
    signer
  );
  const res = NextResponse.redirect(`${target}${MOVE_LANDING_PATH}#${fragment}`, 303);

  // La sessione ora vive sul nuovo indirizzo: qui la si dimentica SENZA
  // chiamare il logout di Supabase (chiuderebbe anche quella nuova, è la
  // stessa) e senza riusare il refresh token da questo lato.
  if (!cookieDomain) {
    for (const c of request.cookies.getAll()) {
      if (c.name.startsWith("sb-")) res.cookies.set(c.name, "", { path: "/", maxAge: 0 });
    }
  }
  res.cookies.set(MOVE_DONE_COOKIE, "done", { path: "/", maxAge: MOVE_DONE_SECONDS, sameSite: "lax", secure: true });
  return noStore(res);
}
