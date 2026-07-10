"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ParentInquiry, InquiryStatus } from "@/lib/data/inquiries";
import { markInquiriesReadAction } from "@/app/actions/inquiries";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  aperta: "In attesa di risposta",
  risposta: "Risposta ricevuta",
  chiusa: "Chiusa",
};

const STATUS_CLASS: Record<InquiryStatus, string> = {
  aperta: "bg-yellow-light text-[#9a6b00]",
  risposta: "bg-green-light text-green",
  chiusa: "bg-bg text-ink-3",
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

// Segnalazione di Fabrizio: vuole un pallino/notifica quando arriva una
// risposta, e la possibilità di selezionare tutte le richieste e segnarle
// come lette/da leggere (stesso trattamento lato Gestore, vedi
// RichiesteClient.tsx). Il pallino compare quando readByParent è false
// (risposta nuova non ancora vista).
export default function RichiesteGenitoreClient({
  initialInquiries,
}: {
  initialInquiries: ParentInquiry[];
}) {
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = inquiries.length > 0 && selected.size === inquiries.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(inquiries.map((i) => i.id)));
  }

  async function markSelected(read: boolean) {
    if (selected.size === 0) return;
    setBusy(true);
    const ids = Array.from(selected);
    const result = await markInquiriesReadAction({ ids, side: "parent", read });
    setBusy(false);
    if (result.error) return;
    setInquiries((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, readByParent: read } : i)));
    setSelected(new Set());
  }

  // Raggruppamento per mese (segnalazione di Fabrizio: "vanno anche quelle
  // raggruppate con la stessa logica del registro" — stesso principio di
  // AttendanceClient.tsx, qui sul mese di creazione della richiesta). Le
  // richieste arrivano già ordinate per data decrescente (più recenti prima):
  // i bucket restano quindi in ordine cronologico decrescente.
  const monthBuckets = useMemo(() => {
    const buckets = new Map<string, { label: string; items: ParentInquiry[] }>();
    for (const inq of inquiries) {
      const monthKey = inq.createdAt.slice(0, 7);
      if (!buckets.has(monthKey)) buckets.set(monthKey, { label: monthLabel(inq.createdAt), items: [] });
      buckets.get(monthKey)!.items.push(inq);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, v]) => v);
  }, [inquiries]);

  return (
    <div className="px-5 py-4">
      {inquiries.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
          Non hai ancora contattato nessun centro. Trovi il tasto &quot;Contatta il gestore&quot;
          nella scheda di ogni attività.
        </p>
      )}

      {inquiries.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
            Seleziona tutte
          </label>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => markSelected(true)}
                disabled={busy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come lette
              </button>
              <button
                onClick={() => markSelected(false)}
                disabled={busy}
                className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] disabled:opacity-60"
              >
                Segna come da leggere
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {monthBuckets.map((bucket) => (
          <div key={bucket.label}>
            <div className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
              {bucket.label}
            </div>
            <div className="flex flex-col gap-2.5">
              {bucket.items.map((inq) => (
                <div key={inq.id} className="flex gap-2.5 rounded-lg border border-[#E8EBF0] bg-white p-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(inq.id)}
                    onChange={() => toggleOne(inq.id)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Link href={`/activity/${inq.activityId}`} className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
                        {!inq.readByParent && (
                          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Non letta" />
                        )}
                        {inq.activityName}
                      </Link>
                      <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASS[inq.status]}`}>
                        {STATUS_LABEL[inq.status]}
                      </span>
                    </div>
                    <p className="mb-2 text-xs text-ink-2">{inq.message}</p>
                    {inq.reply && (
                      <div className="rounded-md bg-sky-light p-2.5 text-xs text-ink">
                        <div className="mb-0.5 font-semibold text-sky">Risposta del centro</div>
                        {inq.reply}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
