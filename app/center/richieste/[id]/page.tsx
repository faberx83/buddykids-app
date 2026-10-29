import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { INQUIRY_THREADS_FLAG } from "@/lib/inquiries/thread";
import { getInquiryThread } from "@/lib/data/inquiries";
import InquiryThreadView from "@/components/inquiries/InquiryThreadView";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";

// TRAMA — una conversazione con una famiglia, lato centro (27/10/2026).
// La RLS di activity_inquiries fa vedere solo quelle delle attività del
// centro (o tutte a un Admin). Conversazione spenta → elenco di sempre.
export default async function CenterConversazionePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured) redirect("/center/richieste");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const threads = await resolveFeatureFlag({ flagName: INQUIRY_THREADS_FLAG, userId: user.id, role: "center_admin", tenant: "center" }).catch(() => false);
  if (!threads) redirect("/center/richieste");
  const thread = await getInquiryThread(id, "center");
  if (!thread) notFound();
  // Portale centri V2 (29/10/2026): si torna all'elenco unico, filtrato sui messaggi.
  const shell = await partnerShellEnabledForCurrentUser();
  return (
    <div className={`mx-auto max-w-2xl rounded-2xl border ${shell ? "border-partner-line bg-white" : "border-trama-line"}`}>
      <InquiryThreadView
        thread={thread}
        viewer="center"
        backHref={shell ? "/center/prenotazioni?tipo=messaggi" : "/center/richieste"}
        activityHref={null}
      />
    </div>
  );
}
