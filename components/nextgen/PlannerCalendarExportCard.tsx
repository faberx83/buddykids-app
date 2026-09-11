"use client";

// TRAMA — Calendar Export V1 · ANTEPRIMA INTERNA (11/09/2026, richiesta di
// Fabrizio). §6 della spec (UX): copy principale "Esporta calendario",
// microcopy "Porta gli impegni TRAMA nel calendario che usi ogni giorno." —
// DELIBERATAMENTE non "Sincronizza calendario" (questa V1 non è una sync,
// solo un export puntuale). Il badge "Anteprima interna" NON vive qui: è
// montato una sola volta a livello di pagina (PlannerClient.tsx, accanto a
// NextgenBadge — stesso pattern "corner ribbon" già in produzione), questo
// componente si limita a non esistere affatto quando `enabled` è false
// (§7: "nessuna CTA per un utente normale" — non un CSS display:none, il
// componente ritorna null e quindi non emette nulla nel DOM).
//
// §8 della spec: l'export è interamente CLIENT-SIDE — buildPlannerCalendarIcsDataUrl
// gira nel browser sugli item già ricevuti come prop dalla Server Component
// (app/nextgen/planner/page.tsx), nessuna chiamata di rete per generare il
// file. L'unica chiamata server è l'evento di analytics opzionale
// (logCalendarExportCreatedAction, fire-and-forget, mai bloccante).

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

  return <PlannerCalendarExportCardBody items={items} />;
}

function PlannerCalendarExportCardBody({ items }: { items: PlannerCalendarItemForIcs[] }) {
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
    <div className="mb-4 rounded-xl border-[1.5px] border-[#E8EBF0] bg-white p-4">
      <p className="mb-1 text-sm font-bold text-ink">Esporta calendario</p>
      <p className="mb-3 text-xs text-ink-2">Porta gli impegni TRAMA nel calendario che usi ogni giorno.</p>
      {hasItems && icsHref ? (
        <a
          href={icsHref}
          download={plannerCalendarIcsFilename()}
          onClick={handleDownload}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-trama-violet py-3 text-xs font-bold text-white transition-opacity active:opacity-80"
        >
          <i className={`ti ${exported ? "ti-check" : "ti-calendar-plus"} text-sm`} />
          {exported ? "Scaricato" : "Scarica file .ics"}
        </a>
      ) : (
        <p className="text-xs text-ink-3">Nessun impegno confermato da esportare al momento.</p>
      )}
    </div>
  );
}
