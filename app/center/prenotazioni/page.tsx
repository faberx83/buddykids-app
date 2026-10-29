import PrenotazioniClient from "./PrenotazioniClient";
import { getBookingsForCenter } from "@/lib/data/center-bookings";
import { getInquiriesForCenter } from "@/lib/data/inquiries";
import { getGroupRequestsForCenter } from "@/lib/data/group-requests";
import { partnerShellEnabledForCurrentUser } from "@/lib/centers/partner-v2-flag";
import { filterFromQuery } from "@/lib/centers/partner-inbox";
import InboxV2 from "@/components/center/InboxV2";

// TRAMA ONE Build Sprint 4 (DEC-42, PCR-013/PCR-015) — Inbox prenotazioni del
// Partner: risposta (accetta/rifiuta/proponi), accettazione per giorno,
// stesso principio di /center/richieste (ticketing) applicato a
// public.bookings/booking_days invece di activity_inquiries.
//
// PORTALE CENTRI V2 (29/10/2026, PARTNER_SHELL_V2_ENABLED): con il guscio V2
// questa è la sezione "Richieste": prenotazioni, messaggi e richieste di
// gruppo in un elenco solo (components/center/InboxV2.tsx). Stesso indirizzo
// di prima, così i link delle email e delle notifiche portano qui.
// ?tipo=prenotazioni|messaggi|gruppi apre già filtrato.
export const dynamic = "force-dynamic";

export default async function CenterPrenotazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  const bookings = await getBookingsForCenter();
  if (await partnerShellEnabledForCurrentUser()) {
    const [inquiries, groups] = await Promise.all([getInquiriesForCenter(), getGroupRequestsForCenter()]);
    return (
      <InboxV2
        initialBookings={bookings}
        initialFilter={filterFromQuery((await searchParams).tipo)}
        messages={inquiries.map((i) => ({
          id: i.id,
          parentName: i.parentName,
          parentEmail: i.parentEmail,
          activityName: i.activityName,
          activitySlug: i.activityId,
          createdAt: i.createdAt,
          lastMessageAt: i.lastMessageAt,
          readByCenter: i.readByCenter,
          lastSide: i.lastMessage?.side === "center" ? "center" : i.lastMessage ? "parent" : i.reply ? "center" : "parent",
          lastText: i.lastMessage?.body ?? i.reply ?? i.message,
        }))}
        initialGroups={groups.map((g) => ({
          id: g.id,
          groupName: g.groupName,
          activityName: g.activityName,
          kidsCount: g.kidsCount,
          discountPercent: g.discountPercent,
          status: g.status,
          createdAt: g.createdAt,
          message: g.message || undefined,
        }))}
      />
    );
  }
  return <PrenotazioniClient initialBookings={bookings} />;
}
