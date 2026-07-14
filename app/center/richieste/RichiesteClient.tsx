"use client";

import { useMemo, useState } from "react";
import { CenterInquiry, InquiryStatus } from "@/lib/data/inquiries";
import { replyToInquiryAction, markInquiriesReadAction } from "@/app/actions/inquiries";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STATUS_LABEL: Record<InquiryStatus, { label: string; cls: string }> = {
  aperta: { label: "Da rispondere", cls: "bg-orange-light text-trama-orange" },
  risposta: { label: "Risposto", cls: "bg-green-light text-[#2d8f52]" },
  chiusa: { label: "Chiusa", cls: "bg-bg text-ink-3" },
};

const MONTH_LABELS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTH_LABELS_IT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Raggruppamento per mese (segnalazione di Fabrizio: "vanno anche quelle
// raggruppate con la stessa logica del registro" — stessa logica di
// AttendanceClient.tsx / RichiesteGenitoreClient.tsx, qui applicata sia allo
// storico che alle richieste da rispondere).
function useMonthBuckets(items: CenterInquiry[]) {
  return useMemo(() => {
    const buckets = new Map<string, { label: string; items: CenterInquiry[] }>();
    for (const inq of items) {
      const monthKey = inq.createdAt.slice(0, 7);
      if (!buckets.has(monthKey)) buckets.set(monthKey, { label: monthLabel(inq.createdAt), items: [] });
      buckets.get(monthKey)!.items.push(inq);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }, [items]);
}

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
  // Selezione multipla + segna come letta/da leggere (segnalazione di
  // Fabrizio, stesso trattamento lato Genitore in RichiesteGenitoreClient.tsx).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
      prev.map((i) => (i.id === id ? { ...i, status: "risposta", reply, readByCenter: true } : i))
    );
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === inquiries.length ? new Set() : new Set(inquiries.map((i) => i.id))
    );
  }

  async function markSelected(read: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selected);
    const result = await markInquiriesReadAction({ ids, side: "center", read });
    setBulkBusy(false);
    if (result.error) return;
    setInquiries((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, readByCenter: read } : i)));
    setSelected(new Set());
  }

  const open = inquiries.filter((i) => i.status === "aperta");
  const answered = inquiries.filter((i) => i.status !== "aperta");
  const allSelected = inquiries.length > 0 && selected.size === inquiries.length;
  const openBuckets = useMonthBuckets(open);
  const answeredBuckets = useMonthBuckets(answered);

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

      {inquiries.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
            Seleziona tutte
          </label>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => markSelected(true)}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come lette
              </button>
              <button
                onClick={() => markSelected(false)}
                disabled={bulkBusy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come da leggere
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Da rispondere ({open.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {openBuckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="bg-bg px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
                {bucket.label}
              </div>
              {bucket.items.map((inq) => (
                <div key={inq.id} className="flex gap-2.5 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(inq.id)}
                    onChange={() => toggleOne(inq.id)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {!inq.readByCenter && (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Non letta" />
                        )}
                        {inq.activityName}
                      </div>
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
                </div>
              ))}
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
          {answeredBuckets.map((bucket) => (
            <div key={bucket.label}>
              <div className="bg-bg px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
                {bucket.label}
              </div>
              {bucket.items.map((inq) => (
                <div key={inq.id} className="flex gap-2.5 px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(inq.id)}
                    onChange={() => toggleOne(inq.id)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {!inq.readByCenter && (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Non letta" />
                        )}
                        {inq.activityName}
                      </div>
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
                </div>
              ))}
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
