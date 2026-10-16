import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { familyInviteDestination } from "@/lib/public-links";

// TRAMA — LINK CORTI PER GLI INVITI (16/10/2026): https://tramapp.it/i/<chiave>
// al posto di /auth/login?next=%2Fnextgen%2F... Chiave = token dell'invito
// o codice della famiglia (vedi lib/public-links.ts). Collegato → dritto alla
// pagina; non collegato → accesso/registrazione, poi la pagina.
// Pubblico per costruzione (escluso dal controllo di accesso in proxy.ts):
// non legge né mostra dati, decide solo dove mandare.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const dest = familyInviteDestination(decodeURIComponent(key));
  const origin = request.nextUrl.origin;
  if (!dest) return NextResponse.redirect(new URL("/", origin), 307);

  let loggedIn = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    loggedIn = Boolean(user);
  }
  const target = loggedIn ? dest : `/auth/login?next=${encodeURIComponent(dest)}`;
  const res = NextResponse.redirect(new URL(target, origin), 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
