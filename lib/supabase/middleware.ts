import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl, supabaseAnonKey, isSupabaseConfigured, cookieDomain } from "./env";

// Keeps the Supabase auth session fresh on every request. Wired up in
// proxy.ts at the project root (Next 16's renamed "middleware.ts"). No-ops
// until Supabase keys are set.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: cookieDomain ? { domain: cookieDomain } : undefined,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

// Legge SOLO il ruolo dell'utente loggato (per il gate multi-tenant dei
// sottodomini partner.*/admin.* in proxy.ts) senza propagare Set-Cookie — la
// sessione è già stata rinfrescata da updateSession() nella stessa richiesta.
export async function getRequestRole(
  request: NextRequest
): Promise<{ userId: string; role: string | null } | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: cookieDomain ? { domain: cookieDomain } : undefined,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // sola lettura: non serve propagare Set-Cookie da questa chiamata.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, role: profile?.role ?? null };
}
