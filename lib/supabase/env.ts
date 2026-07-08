export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// True once real Supabase credentials have been provided in .env.local.
// Until then, the app runs entirely on the mock data in lib/mock-data.ts.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Dominio su cui scrivere il cookie di sessione — necessario per il
// multi-tenant a sottodomini (partner.tuodominio.it, admin.tuodominio.it):
// impostando ".tuodominio.it" (con il punto iniziale) il login fatto sul
// dominio principale resta valido anche sui sottodomini. Lasciare non
// impostato in locale/preview (i cookie restano legati all'host esatto).
export const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN || undefined;

export function warnIfNotConfigured(context: string) {
  if (!isSupabaseConfigured && process.env.NODE_ENV !== "production") {
    console.warn(
      `[Supabase] Chiavi non configurate — ${context} funzionerà solo dopo aver impostato NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local`
    );
  }
}
