// TRAMA — Admin → Le mie notifiche (20/11/2026).
// Richiesta di Fabrizio: "vorrei che si potessero anche spegnere da
// profilo..come per i genitori". Iniziativa:
// claude/INIZIATIVA_avvisi_admin_beta.md (Project).
// REUSE: stesse preferenze di genitori e centri (profiles.notify_push e
// notify_email, updatePreferencesAction) e stessa attivazione push del
// dispositivo (lib/push/client). Nessuna colonna nuova.
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import AdminNotificationPrefs from "./AdminNotificationPrefs";

export const dynamic = "force-dynamic";

export default async function AdminNotifichePage() {
  let notifyPush = true;
  let notifyEmail = true;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("notify_push, notify_email").eq("id", user.id).maybeSingle();
      notifyPush = (data as { notify_push?: boolean | null } | null)?.notify_push ?? true;
      notifyEmail = (data as { notify_email?: boolean | null } | null)?.notify_email ?? true;
    }
  }
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Le mie notifiche</h1>
        <p className="mt-1 text-sm text-navy-text2">Cosa ti arriva durante la beta e come spegnerlo. Gli account di prova non generano mai avvisi.</p>
      </div>
      <AdminNotificationPrefs initialNotifyPush={notifyPush} initialNotifyEmail={notifyEmail} />
    </div>
  );
}
