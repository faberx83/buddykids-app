"use client";

import { useRouter } from "next/navigation";
import TramaThread from "@/components/nextgen/TramaThread";
import InquiryConversationList, { type ConversationRow } from "@/components/inquiries/InquiryConversationList";
import { goBackInApp } from "@/lib/nextgen/in-app-history";

// TRAMA — MESSAGGI CON IL CENTRO COME CONVERSAZIONE (27/10/2026): elenco V2
// (stessa testata di Salvati). Una conversazione per centro e attività.
export default function MessaggiV2View({ rows }: { rows: ConversationRow[] }) {
  const router = useRouter();
  return (
    <div data-nav-v2 className="-mb-40 flex min-h-[calc(100%+10rem)] flex-col gap-4 bg-trama-page px-5 pb-24 pt-[14px]">
      <header className="flex items-start gap-1">
        <button
          type="button"
          onClick={() => goBackInApp(router, "/nextgen/profile")}
          aria-label="Indietro"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-[22px] text-ink active:bg-black/[0.04]"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" />
        </button>
        <div className="flex flex-1 flex-col pt-1.5">
          <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">Messaggi con i centri</h1>
          <TramaThread className="mt-1.5" />
          <span className="mt-1.5 text-[13px] text-ink-2">Una conversazione per ogni attività: scrivi e rispondi sempre nella stessa.</span>
        </div>
      </header>
      <InquiryConversationList
        rows={rows}
        viewer="parent"
        hrefBase="/nextgen/richieste"
        emptyText="Non hai ancora scritto a nessun centro. Trovi “Contatta il gestore” nella scheda di ogni attività."
      />
    </div>
  );
}
