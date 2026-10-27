import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { INQUIRY_THREADS_FLAG } from "@/lib/inquiries/thread";
import { getInquiryThread } from "@/lib/data/inquiries";
import InquiryThreadView from "@/components/inquiries/InquiryThreadView";

// TRAMA — una conversazione con il centro, lato famiglia (27/10/2026).
// Conversazione spenta (INQUIRY_THREADS_ENABLED) → si torna all'elenco di
// sempre (le notifiche di risposta puntano già qui).
export default async function NextgenConversazionePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured) redirect("/nextgen/richieste");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/nextgen/richieste/${id}`)}`);
  const threads = await resolveFeatureFlag({ flagName: INQUIRY_THREADS_FLAG, userId: user.id, role: "parent" }).catch(() => false);
  if (!threads) redirect("/nextgen/richieste");
  const thread = await getInquiryThread(id, "parent");
  if (!thread) notFound();
  return (
    <InquiryThreadView
      thread={thread}
      viewer="parent"
      backHref="/nextgen/richieste"
      activityHref={thread.activitySlug ? `/activity/${thread.activitySlug}` : null}
    />
  );
}
