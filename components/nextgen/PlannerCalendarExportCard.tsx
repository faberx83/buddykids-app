"use client";

// TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026, richiesta di
// Fabrizio). §6 della spec originale (UX): copy principale "Esporta
// calendario", microcopy "Porta gli impegni TRAMA nel calendario che usi
// ogni giorno." — DELIBERATAMENTE non "Sincronizza calendario" (questa V1
// non è una sync, solo un export puntuale). Il badge "Anteprima interna" NON
// vive qui: è montato una sola volta a livello di pagina (PlannerClient.tsx,
// accanto a NextgenBadge — stesso pattern "corner ribbon" già in
// produzione), questo componente si limita a non esistere affatto quando
// `enabled` è false (§7: "nessuna CTA per un utente normale" — non un CSS
// display:none, il componente ritorna null e quindi non emette nulla nel
// DOM).
//
// §8 della spec: l'export è interamente CLIENT-SIDE — buildPlannerCalendarIcsDataUrl
// gira nel browser sugli item già ricevuti come prop dalla Server Component
// (app/nextgen/planner/page.tsx), nessuna chiamata di rete per generare il
// file. L'unica chiamata server è l'evento di analytics opzionale
// (logCalendarExportCreatedAction, fire-and-forget, mai bloccante).
//
// TRAMA — SCHOOL CALENDAR UX REFINEMENT (§7-8-31, 14/09/2026): questa non è
// più una card grande e prominente in cima al Planner — è ora una UTILITY
// ROW compatta, montata dentro "Calendario e Chi fa cosa?" (PlannerClient.tsx),
// in fondo al blocco, dopo le informazioni operative. §31: "Spostare la UI
// di Calendar Export NON deve cambiare: gating; analytics; generatore ICS;
// semantica eventi; override runtime" — infatti sotto, `enabled`/`items`
// arrivano identici a prima, solo il markup/posizionamento sono cambiati.

import { useState } from "react";
import { buildPlannerCalendarIcsDataUrl, plannerCalendarIcsFilename, type PlannerCalendarItemForIcs } from "@/lib/ics";
import { logCalendarExportCreatedAction } from "@/app/actions/calendar-export";

export default function PlannerCalendarExportCard({
  enabled,
  items,
}: {
  enabled: boolean;
  items: PlannerCalendarItemForIcs[];
}) {
  // §7 — un utente normale (flag non risolto per lui) non deve mai vedere
  // nessuna CTA: nessun ramo sotto questo return viene mai renderizzato per
  // lui, non solo nascosto via stile.
  if (!enabled) return null;

  return <PlannerCalendarExportRow items={items} />;
}

function PlannerCalendarExportRow({ items }: { items: PlannerCalendarItemForIcs[] }) {
  const [exported, setExported] = useState(false);
  const hasItems = items.length > 0;
  const icsHref = hasItems ? buildPlannerCalendarIcsDataUrl(items) : null;

  function handleDownload() {
    setExported(true);
    // Fire-and-forget: il download è già avviato dal browser tramite l'<a
    // href> sottostante, questa chiamata non deve mai bloccarlo né farlo
    // fallire in caso di errore di rete.
    void logCalendarExportCreatedAction(items.length);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#E8EBF0] pt-3">
      <div className="flex min-w-0 items-start gap-2">
        <i className="ti ti-calendar-download mt-0.5 flex-shrink-0 text-[17px] text-trama-violet" />
        <div className="min-w-0">
          <p className="font-poppins text-[13px] font-semibold text-ink">Esporta calendario</p>
          {hasItems ? (
            <p className="text-[12px] text-ink-2">Porta i tuoi impegni nel calendario personale.</p>
          ) : (
            <p className="text-[12px] text-ink-3">Nessun impegno da esportare</p>
          )}
        </div>
      </div>
      {hasItems && icsHref && (
        <a
          href={icsHref}
          download={plannerCalendarIcsFilename()}
          onClick={handleDownload}
          className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border border-trama-violet px-3.5 text-[13px] font-semibold text-trama-violet transition-opacity active:opacity-70"
        >
          <i className={`ti ${exported ? "ti-check" : "ti-download"} text-[14px]`} />
          {exported ? "Scaricato" : "Scarica .ics"}
        </a>
      )}
    </div>
  );
}
