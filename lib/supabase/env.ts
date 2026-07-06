export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// True once real Supabase credentials have been provided in .env.local.
// Until then, the app runs entirely on the mock data in lib/mock-data.ts.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function warnIfNotConfigured(context: string) {
  if (!isSupabaseConfigured && process.env.NODE_ENV !== "production") {
    console.warn(
      `[Supabase] Chiavi non configurate — ${context} funzionerà solo dopo aver impostato NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local`
    );
  }
}
