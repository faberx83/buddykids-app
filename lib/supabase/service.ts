import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// SPRINT 8 — client "di servizio" con la service_role key: bypassa
// interamente le RLS (a differenza di lib/supabase/server.ts, che resta
// sempre soggetto alle policy). Usato SOLO da endpoint interni/di
// automazione lato server (vedi app/internal/beta-pipeline/route.ts),
// MAI esposto al browser: la service_role key va impostata come variabile
// d'ambiente SUPABASE_SERVICE_ROLE_KEY — senza prefisso NEXT_PUBLIC_, quindi
// Next.js la esclude per costruzione da qualsiasi bundle client — solo nelle
// impostazioni del progetto su Vercel (mai in NEXT_PUBLIC_*, mai in un file
// che finisce nel bundle browser).
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
