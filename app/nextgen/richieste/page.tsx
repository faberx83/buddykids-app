import RichiesteView from "@/components/RichiesteView";
import { getInquiriesForParent } from "@/lib/data/inquiries";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { INQUIRY_THREADS_FLAG } from "@/lib/inquiries/thread";
import MessaggiV2View from "./MessaggiV2View";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Le mie richieste",
// stesso pattern di app/nextgen/prenotazioni (task #524): chiude uno dei
// rimandi legacy segnalati da Fabrizio. Nessuna nuova query: riusa
// RichiesteView + i dati di sempre, eredita bottom nav/layout NEXTGEN
// venendo da dentro app/nextgen/*.
//
// 27/10/2026 (messaggi con il centro come conversazione, INQUIRY_THREADS_ENABLED):
// "Messaggi", una riga per conversazione in grafica V2; si apre la
// conversazione in /nextgen/richieste/[id]. Spento: come prima.
export default async function NextgenRichiestePage() {
  let threads = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) threads = await resolveFeatureFlag({ flagName: INQUIRY_THREADS_FLAG, userId: user.id, role: "parent" }).catch(() => false);
  }
  const inquiries = await getInquiriesForParent();
  if (threads) {
    return (
      <MessaggiV2View
        rows={inquiries.map((i) => ({
          id: i.id,
          title: i.centerName || i.activityName,
          activityName: i.activityName,
          unread: !i.readByParent,
          waitingForViewer: i.lastMessage?.side === "center",
          lastMessage: i.lastMessage ?? null,
          lastMessageAt: i.lastMessageAt ?? i.createdAt,
        }))}
      />
    );
  }
  return <RichiesteView inquiries={inquiries} showBrandIcon />;
}
