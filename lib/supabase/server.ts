import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabaseAnonKey, warnIfNotConfigured } from "./env";

// Server-side Supabase client. Use inside Server Components, Route Handlers,
// and Server Actions. Reads/writes the auth cookie via next/headers.
export async function createClient() {
  warnIfNotConfigured("createClient (server)");
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component sometimes — safe to ignore
            // when middleware is already refreshing the session.
          }
        },
      },
    }
  );
}
