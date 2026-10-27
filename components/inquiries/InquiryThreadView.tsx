"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markInquiriesReadAction, replyToInquiryAction, sendInquiryMessageAction } from "@/app/actions/inquiries";
import { messageTimeLabel, type InquirySide } from "@/lib/inquiries/thread";
import type { InquiryThread } from "@/lib/data/inquiries";
import { goBackInApp } from "@/lib/nextgen/in-app-history";

// TRAMA — MESSAGGI CON IL CENTRO COME CONVERSAZIONE (27/10/2026).
// Una conversazione famiglia↔centro: messaggi in ordine, i propri a destra,
// e in fondo la casella per scrivere. La stessa vista per i due lati
// (viewer = "parent" nell'app famiglie, "center" nel portale centri), con la
// grafica V2. Aprirla segna la conversazione come letta per chi la apre.
export default function InquiryThreadView({
  thread,
  viewer,
  backHref,
  activityHref,
}: {
  thread: InquiryThread;
  viewer: InquirySide;
  backHref: string;
  activityHref: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thread.unread) void markInquiriesReadAction({ ids: [thread.id], side: viewer, read: true });
  }, [thread.id, thread.unread, viewer]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread.messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text) {
      setError(viewer === "center" ? "Scrivi una risposta prima di inviare" : "Scrivi un messaggio prima di inviare");
      return;
    }
    setError(null);
    setSending(true);
    const res =
      viewer === "center"
        ? await replyToInquiryAction({ inquiryId: thread.id, reply: text })
        : await sendInquiryMessageAction({ inquiryId: thread.id, message: text });
    setSending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDraft("");
    router.refresh();
  }

  const waiting = thread.messages.length > 0 && thread.messages[thread.messages.length - 1].side === "parent";

  return (
    <div data-nav-v2 className="flex min-h-[calc(100dvh-8rem)] flex-col bg-trama-page" data-testid="inquiry-thread">
      <header className="sticky top-0 z-10 flex items-start gap-1 border-b border-trama-line bg-trama-page/95 px-3 pb-3 pt-[14px] backdrop-blur">
        <button
          type="button"
          onClick={() => goBackInApp(router, backHref)}
          aria-label="Indietro"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[22px] text-ink active:bg-black/[0.04]"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col pt-1">
          <h1 className="truncate font-poppins text-[19px] font-semibold leading-tight text-ink">{thread.counterpartName}</h1>
          <span className="truncate text-[13px] text-ink-2">
            {activityHref ? (
              <Link href={activityHref} className="font-semibold text-trama-accent-ink">
                {thread.activityName}
              </Link>
            ) : (
              thread.activityName
            )}
            {viewer === "center" && thread.counterpartEmail ? ` · ${thread.counterpartEmail}` : ""}
          </span>
        </div>
      </header>

      <ol className="flex flex-1 flex-col gap-2.5 px-4 py-4" aria-label="Messaggi">
        {thread.messages.map((m) => {
          const mine = m.side === viewer;
          return (
            <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug ${
                  mine ? "rounded-br-md bg-trama-primary text-white" : "rounded-bl-md border border-trama-line bg-white text-ink"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-1 px-1 text-[11.5px] text-ink-2">
                {mine ? "Tu" : viewer === "parent" ? "Centro" : "Famiglia"} · {messageTimeLabel(m.createdAt)}
              </span>
            </li>
          );
        })}
        {waiting && viewer === "parent" && (
          <li className="self-center pt-1 text-center text-[12.5px] text-ink-2">Il centro ti risponde qui: ti avvisiamo quando scrive.</li>
        )}
        <div ref={endRef} />
      </ol>

      <div className="sticky bottom-0 border-t border-trama-line bg-white px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
        {error && (
          <p role="alert" className="mb-2 px-1 text-[13px] font-medium text-trama-orange">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="inquiry-reply" className="sr-only">
            {viewer === "center" ? "Rispondi" : "Scrivi al centro"}
          </label>
          <textarea
            id="inquiry-reply"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            maxLength={4000}
            placeholder={viewer === "center" ? "Rispondi alla famiglia…" : "Scrivi al centro…"}
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-trama-line bg-trama-page px-3.5 py-2.5 text-[16px] text-ink outline-none focus:border-trama-primary"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending}
            aria-label="Invia"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-trama-primary text-[20px] text-white active:bg-trama-primary-press disabled:opacity-60"
          >
            <i className={`ti ${sending ? "ti-loader-2 animate-spin" : "ti-send"}`} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
