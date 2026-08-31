"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// TRAMA — Push notifications (31/08/2026). Registra/rimuove la subscription
// del browser corrente (endpoint+chiavi, vedi supabase/migration_31_push_
// subscriptions.sql) — chiamate dal componente client che gestisce il
// permesso (components/nextgen/PushPermissionToggle.tsx). RLS della tabella
// ("solo le proprie", vedi migration) rende questi due insert/delete già
// sicuri di per sé: qui verifichiamo comunque la sessione esplicitamente
// PRIMA di toccare il DB, stesso principio "mai fidarsi solo di un livello"
// già seguito nel resto del progetto.

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function subscribeToPushAction(input: PushSubscriptionInput): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  // Upsert su endpoint (unique, vedi migration): lo stesso browser/device
  // che richiede di nuovo il permesso (es. dopo aver cancellato i dati del
  // sito) restituisce spesso lo stesso endpoint — un upsert evita righe
  // duplicate per lo stesso device invece di doverle deduplicare altrove.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) return { error: error.message };
  return {};
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: "Supabase non configurato" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non autenticato" };

  // Filtro esplicito su user_id OLTRE a endpoint: ridondante rispetto a RLS
  // (che già impedirebbe di cancellare la riga di un altro utente) ma
  // rende l'intento leggibile senza dover risalire alla policy per capirlo.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
  if (error) return { error: error.message };
  return {};
}

// Usato dal componente client per sapere, al caricamento della pagina, se
// QUESTO device ha già una subscription attiva prima ancora di chiedere a
// pushManager.getSubscription() (che è già la fonte di verità reale lato
// browser) — utile principalmente come fallback se pushManager non è ancora
// pronto. Ritorna solo un booleano, mai l'endpoint/le chiavi: non serve al
// client conoscerle di nuovo, le ha già lui stesso se la subscription esiste.
export async function hasActivePushSubscriptionAction(endpoint: string): Promise<boolean> {
  if (!isSupabaseConfigured || !endpoint) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}
