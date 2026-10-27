import Link from "next/link";
import { messageTimeLabel, previewLine, type InquiryMessage, type InquirySide } from "@/lib/inquiries/thread";

// TRAMA — MESSAGGI CON IL CENTRO COME CONVERSAZIONE (27/10/2026).
// Elenco delle conversazioni, una riga ciascuna: con chi (centro o
// famiglia), per quale attività, anteprima dell'ultimo messaggio, quando, e
// il pallino se c'è qualcosa di nuovo. Prima quelle con l'ultimo messaggio
// più recente. Stessa grafica V2 per famiglie e centri.
export interface ConversationRow {
  id: string;
  title: string; // centro (per la famiglia) o genitore (per il centro)
  activityName: string;
  unread: boolean;
  waitingForViewer: boolean; // l'ultimo messaggio è dell'altro lato
  lastMessage: InquiryMessage | null;
  lastMessageAt: string;
}

export default function InquiryConversationList({
  rows,
  viewer,
  hrefBase,
  emptyText,
}: {
  rows: ConversationRow[];
  viewer: InquirySide;
  hrefBase: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-trama-line bg-white px-5 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-trama-primary-soft text-trama-primary">
          <i className="ti ti-message-circle-2 text-[24px]" aria-hidden="true" />
        </span>
        <p className="max-w-[36ch] text-[14.5px] text-ink-2">{emptyText}</p>
      </section>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-trama-line overflow-hidden rounded-2xl border border-trama-line bg-white" data-testid="inquiry-list">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`${hrefBase}/${r.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-black/[0.02]">
            <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-trama-primary-soft text-trama-primary">
              <i className={`ti ${viewer === "parent" ? "ti-building-community" : "ti-user"} text-[19px]`} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2">
                <span className={`min-w-0 flex-1 truncate text-[15px] text-ink ${r.unread ? "font-bold" : "font-semibold"}`}>{r.title}</span>
                <span className="flex-shrink-0 text-[12px] text-ink-2">{messageTimeLabel(r.lastMessageAt)}</span>
              </span>
              <span className="truncate text-[13px] text-ink-2">{r.activityName}</span>
              <span className={`mt-0.5 line-clamp-2 text-[13.5px] ${r.unread ? "font-semibold text-ink" : "text-ink-2"}`}>
                {previewLine(r.lastMessage, viewer)}
              </span>
              {r.waitingForViewer && viewer === "center" && (
                <span className="mt-1.5 self-start rounded-full bg-trama-accent-soft px-2.5 py-0.5 text-[12px] font-semibold text-trama-accent-ink">
                  Da rispondere
                </span>
              )}
            </span>
            {r.unread && <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-trama-accent" aria-label="Nuovo" />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
