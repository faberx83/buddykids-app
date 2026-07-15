"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
// "import type": BetaFeedbackItem è solo un'interfaccia — con "import type"
// il compilatore la elimina dal bundle client, cosi lib/data/beta-feedback.ts
// (che importa lib/supabase/server) non viene mai trascinato qui per errore
// (stesso bug di build già risolto altrove, vedi lib/nextgen/address-kinds.ts).
import type { BetaFeedbackItem, BetaFeedbackStatus } from "@/lib/nextgen/beta-feedback-shared";

const STATUS_LABEL: Record<BetaFeedbackStatus, { label: string; className: string }> = {
  nuovo: { label: "Nuovo", className: "bg-[#F4F6FA] text-ink-2" },
  in_gestione: { label: "In gestione", className: "bg-[#FFF7E8] text-[#9a6b00]" },
  risolto: { label: "Risolto", className: "bg-green-light text-green" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export default function SegnalazioniClient({ items }: { items: BetaFeedbackItem[] }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader title="Le mie segnalazioni" onBack={() => router.push("/nextgen/profile")} showBrandIcon />
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-xs text-ink-2">
          Sezione temporanea per la fase BETA: qui trovi lo stato delle segnalazioni inviate dalla CTA
          &quot;Segnala un problema&quot;, aggiornato quando il team le prende in carico o le risolve.
        </p>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
            <i className="ti ti-message-report mb-2 text-2xl text-ink-3" />
            <p className="text-xs text-ink-2">Non hai ancora inviato nessuna segnalazione.</p>
          </div>
        ) : (
          items.map((item) => {
            const statusInfo = STATUS_LABEL[item.status];
            return (
              <div key={item.id} className="rounded-2xl bg-white p-4">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-ink-3">{item.area}</span>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold ${statusInfo.className}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-[13.5px] text-ink">{item.message}</p>
                {item.adminNote && (
                  <div className="mt-2 rounded-xl bg-bg p-2.5 text-[12px] text-ink-2">
                    <span className="font-semibold text-ink">Risposta del team: </span>
                    {item.adminNote}
                  </div>
                )}
                <div className="mt-2 text-[10.5px] text-ink-3">{formatDate(item.createdAt)}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
