import RichiesteClient from "./RichiesteClient";
import { getInquiriesForCenter } from "@/lib/data/inquiries";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { INQUIRY_THREADS_FLAG } from "@/lib/inquiries/thread";
import InquiryConversationList from "@/components/inquiries/InquiryConversationList";
import { redirect } from "next/navigation";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";

// "Le richieste" del centro — ticketing semplice dai genitori (vedi
// ContactCenterButton nella scheda attività, lib/data/inquiries.ts). Il
// gestore legge il messaggio e scrive una risposta unica; la risposta torna
// visibile al genitore in /richieste ("Le mie richieste").
//
// 27/10/2026 (messaggi come conversazione, INQUIRY_THREADS_ENABLED risolto
// per il gestore): elenco delle conversazioni in grafica V2, "Da rispondere"
// in cima; ognuna si apre in /center/richieste/[id]. Spento: come prima.
export default async function CenterRichiestePage() {
  // Portale centri V2 (29/10/2026): i messaggi stanno nell'elenco unico di Richieste.
  if (await partnerShellEnabledForCurrentUser()) redirect("/center/prenotazioni?tipo=messaggi");
  let threads = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) threads = await resolveFeatureFlag({ flagName: INQUIRY_THREADS_FLAG, userId: user.id, role: "center_admin", tenant: "center" }).catch(() => false);
  }
  const inquiries = await getInquiriesForCenter();
  if (!threads) return <RichiesteClient initialInquiries={inquiries} />;

  const rows = inquiries.map((i) => ({
    id: i.id,
    title: i.parentName,
    activityName: i.activityName,
    unread: !i.readByCenter,
    waitingForViewer: (i.lastMessage?.side ?? "parent") === "parent",
    lastMessage: i.lastMessage ?? null,
    lastMessageAt: i.lastMessageAt ?? i.createdAt,
  }));
  const toAnswer = rows.filter((r) => r.waitingForViewer);
  const others = rows.filter((r) => !r.waitingForViewer);

  return (
    <div data-nav-v2 className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Messaggi dalle famiglie</h1>
        <p className="text-[14px] text-ink-2">
          Una conversazione per famiglia e attività: rispondete sempre nella stessa, la famiglia vede tutto lo scambio.
        </p>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-2">Da rispondere ({toAnswer.length})</h2>
        <InquiryConversationList rows={toAnswer} viewer="center" hrefBase="/center/richieste" emptyText="Nessuna famiglia aspetta una risposta." />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-ink-2">Risposte date ({others.length})</h2>
        <InquiryConversationList rows={others} viewer="center" hrefBase="/center/richieste" emptyText="Ancora nessuna conversazione con risposta." />
      </section>
    </div>
  );
}
