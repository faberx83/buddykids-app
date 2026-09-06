"use client";

import { useState } from "react";
import Link from "next/link";
import { ParentInquiry, InquiryStatus } from "@/lib/data/inquiries";
import { markInquiriesReadAction } from "@/app/actions/inquiries";

const STATUS_LABEL: Record<InquiryStatus, string> = {
  aperta: "In attesa di risposta",
  risposta: "Risposta ricevuta",
  chiusa: "Chiusa",
};

// Pallino di stato al posto della pill colorata a testo pieno (occupava
// troppo spazio orizzontale per una riga "semplice") — stessa mappatura
// colori di prima, ora solo come indicatore puntiforme.
const STATUS_DOT_CLASS: Record<InquiryStatus, string> = {
  aperta: "bg-[#F2B84B]",
  risposta: "bg-green",
  chiusa: "bg-ink-3",
};

// FIX (segnalazione Fabrizio 06/09/2026, punto 2: "'le mie richieste'
// ancora piu compatta, riga semplice, per data?") — il raggruppamento per
// mese (con relativo header) è stato sostituito da una data breve per
// riga: più compatto e più letterale rispetto a "per data" di quanto lo
// fosse il bucket mensile.
const MONTH_LABELS_SHORT_IT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function shortDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH_LABELS_SHORT_IT[d.getUTCMonth()]}`;
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
  // FIX (segnalazione Fabrizio 05/09/2026, punto 7: "'Le mie richieste'
  // devono avere una vista piu sintetica e asciutta") — prima ogni riga
  // mostrava sempre per intero sia il messaggio inviato sia l'eventuale
  // risposta del centro, rendendo l'elenco lungo e pesante da scorrere
  // quando ci sono molte richieste. Ora ogni riga è collassata a una sola
  // riga di anteprima (nome attività, stato, accenno al testo) e si espande
  // al tocco per leggere il messaggio e la risposta per intero — stesso
  // principio "accordion" già usato altrove nell'app (es. Planner Timeline).
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

      {/* FIX (segnalazione Fabrizio 06/09/2026, punto 2) — lista piatta,
          ordinata per data (le richieste arrivano già ordinate per
          createdAt decrescente), una riga per richiesta con la sua data
          esplicita invece del bucket mensile: più compatta e più
          letteralmente "per data". */}
      <div className="flex flex-col divide-y divide-[#F0F2F5] rounded-lg border border-[#E8EBF0] bg-white">
        {inquiries.map((inq) => {
          const isExpanded = expandedId === inq.id;
          return (
            <div key={inq.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-black/[0.02]"
                aria-expanded={isExpanded}
              >
                <input
                  type="checkbox"
                  checked={selected.has(inq.id)}
                  onChange={() => toggleOne(inq.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 flex-shrink-0"
                />
                <span className="w-7 flex-shrink-0 text-[11px] text-ink-3">{shortDateLabel(inq.createdAt)}</span>
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT_CLASS[inq.status]}`}
                  title={STATUS_LABEL[inq.status]}
                />
                {!inq.readByParent && (
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FF6B6B]" aria-label="Non letta" />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{inq.activityName}</span>
                <i
                  className={`ti ti-chevron-down flex-shrink-0 text-[13px] text-ink-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pl-[68px]">
                  <div className="mb-1.5 text-[11px] font-semibold text-ink-3">{STATUS_LABEL[inq.status]}</div>
                  <Link href={`/activity/${inq.activityId}`} className="mb-2 inline-block text-[11px] font-semibold text-trama-violet">
                    Vedi attività
                  </Link>
                  <p className="mb-2 text-xs text-ink-2">{inq.message}</p>
                  {inq.reply && (
                    <div className="rounded-md bg-sky-light p-2.5 text-xs text-ink">
                      <div className="mb-0.5 font-semibold text-sky">Risposta del centro</div>
                      {inq.reply}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
