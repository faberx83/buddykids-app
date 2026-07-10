"use client";

import { useState } from "react";
import { CenterInquiry, InquiryStatus } from "@/lib/data/inquiries";
import { replyToInquiryAction } from "@/app/actions/inquiries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STATUS_LABEL: Record<InquiryStatus, { label: string; cls: string }> = {
  aperta: { label: "Da rispondere", cls: "bg-orange-light text-[#d4622a]" },
  risposta: { label: "Risposto", cls: "bg-green-light text-[#2d8f52]" },
  chiusa: { label: "Chiusa", cls: "bg-bg text-ink-3" },
};

// Ticketing semplice: un messaggio del genitore, una risposta del gestore
// (nessuno scambio multi-turno) — vedi ContactCenterButton e
// lib/data/inquiries.ts per il resto del flusso.
export default function RichiesteClient({
  initialInquiries,
}: {
  initialInquiries: CenterInquiry[];
}) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function sendReply(id: string) {
    const reply = (drafts[id] ?? "").trim();
    if (!reply) {
      setErrorId(id);
      return;
    }
    setErrorId(null);
    setBusyId(id);
    const result = await replyToInquiryAction({ inquiryId: id, reply });
    setBusyId(null);
    if (result.error) {
      setErrorId(id);
      return;
    }
    setInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "risposta", reply } : i))
    );
  }

  const open = inquiries.filter((i) => i.status === "aperta");
  const answered = inquiries.filter((i) => i.status !== "aperta");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Le mie richieste</h1>
        <p className="text-sm text-ink-2">
          Messaggi ricevuti dai genitori dalla scheda delle tue attività (&quot;Contatta il
          gestore&quot;). Una risposta per richiesta.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le richieste reali una volta
          collegato.
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Da rispondere ({open.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {open.map((inq) => (
            <div key={inq.id} className="px-4 py-3.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-ink">{inq.activityName}</div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[inq.status].cls}`}>
                  {STATUS_LABEL[inq.status].label}
                </span>
              </div>
              <div className="mb-2 text-xs text-ink-2">
                {inq.parentName}
                {inq.parentEmail ? ` · ${inq.parentEmail}` : ""}
              </div>
              <p className="mb-2.5 rounded-md bg-bg p-2.5 text-xs text-ink">{inq.message}</p>
              <textarea
                value={drafts[inq.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [inq.id]: e.target.value }))}
                rows={2}
                placeholder="Scrivi la tua risposta…"
                className="mb-2 w-full resize-none rounded-md border border-[#E8EBF0] px-3 py-2 text-sm outline-none focus:border-sky"
              />
              {errorId === inq.id && (
                <p className="mb-2 text-xs font-medium text-orange">
                  Scrivi una risposta prima di inviare.
                </p>
              )}
              <button
                onClick={() => sendReply(inq.id)}
                disabled={busyId === inq.id}
                className="rounded-md bg-partner px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {busyId === inq.id ? "Invio…" : "Invia risposta"}
              </button>
            </div>
          ))}
          {open.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Nessuna richiesta in attesa di risposta.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Storico ({answered.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {answered.map((inq) => (
            <div key={inq.id} className="px-4 py-3.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-ink">{inq.activityName}</div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[inq.status].cls}`}>
                  {STATUS_LABEL[inq.status].label}
                </span>
              </div>
              <div className="mb-2 text-xs text-ink-2">{inq.parentName}</div>
              <p className="mb-2 rounded-md bg-bg p-2.5 text-xs text-ink">{inq.message}</p>
              {inq.reply && (
                <div className="rounded-md bg-sky-light p-2.5 text-xs text-ink">
                  <div className="mb-0.5 font-semibold text-sky">La tua risposta</div>
                  {inq.reply}
                </div>
              )}
            </div>
          ))}
          {answered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Ancora nessuna richiesta risolta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
