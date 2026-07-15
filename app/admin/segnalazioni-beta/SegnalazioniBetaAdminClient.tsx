"use client";

import { useMemo, useState } from "react";
import type { BetaFeedbackItem, BetaFeedbackStatus, BetaFeedbackSource } from "@/lib/nextgen/beta-feedback-shared";
import { computeBetaFeedbackCounts } from "@/lib/nextgen/beta-feedback-shared";
import { updateBetaFeedbackStatusAction } from "@/app/actions/beta-feedback";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// SPRINT 5 (NEXTGEN) — coda Admin "Segnalazioni BETA". Stesso pattern di
// CertificationsAdminClient.tsx: stato locale seedato dal server, filtri
// derivati (non query params), aggiornamento ottimistico dopo l'azione.
//
// app_source distingue "da dove arriva" la segnalazione (richiesta esplicita
// di Fabrizio: "dovranno avere una label che identifica se app genitori o
// gestori, su cui poi implementeremo stesso meccanismo") — oggi tutte le
// righe sono "genitori" (unica app con la CTA), ma la UI è già pronta a
// mostrare "gestore" quando quella fase verrà implementata, senza modifiche.
const STATUS_LABEL: Record<BetaFeedbackStatus, { label: string; cls: string }> = {
  nuovo: { label: "Nuovo", cls: "bg-orange-light text-trama-orange" },
  in_gestione: { label: "In gestione", cls: "bg-[#FFF7E8] text-[#9a6b00]" },
  risolto: { label: "Risolto", cls: "bg-green-light text-[#2d8f52]" },
};

const SOURCE_LABEL: Record<BetaFeedbackSource, { label: string; cls: string }> = {
  genitori: { label: "App genitori", cls: "bg-[#F0EEFF] text-[#6F63C5]" },
  gestore: { label: "App gestori", cls: "bg-[#E8F6FD] text-[#4DAFEF]" },
};

type StatusFilter = BetaFeedbackStatus | "tutti";

export default function SegnalazioniBetaAdminClient({ initialItems }: { initialItems: BetaFeedbackItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("tutti");
  const [areaFilter, setAreaFilter] = useState<string>("tutte");

  const counts = useMemo(() => computeBetaFeedbackCounts(items), [items]);
  const areaOptions = useMemo(() => ["tutte", ...counts.byArea.map((a) => a.area)], [counts]);

  const filtered = items.filter(
    (i) => (statusFilter === "tutti" || i.status === statusFilter) && (areaFilter === "tutte" || i.area === areaFilter)
  );

  async function updateStatus(id: string, status: BetaFeedbackStatus) {
    setBusyId(id);
    const result = await updateBetaFeedbackStatusAction(id, status, noteDraft[id]);
    setBusyId(null);
    if (!result.error) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status, adminNote: noteDraft[id] || i.adminNote } : i)));
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Segnalazioni BETA</h1>
        <p className="text-sm text-navy-text2">
          Bug e suggerimenti inviati dai genitori tramite la CTA &quot;Segnala un problema&quot; durante la
          fase BETA. Ogni riga mostra da quale app arriva (oggi solo App genitori — l&apos;App gestori userà lo
          stesso meccanismo in una fase successiva) e da quale sezione dell&apos;app.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le segnalazioni reali una volta collegato.
        </div>
      )}

      {/* Report: conteggio totale + per stato + per area/sottosezione */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-xs text-ink-2">Totale</div>
          <div className="text-xl font-bold text-ink">{counts.total}</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-xs text-ink-2">Nuove</div>
          <div className="text-xl font-bold text-trama-orange">{counts.byStatus.nuovo}</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-xs text-ink-2">In gestione</div>
          <div className="text-xl font-bold text-[#9a6b00]">{counts.byStatus.in_gestione}</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-xs text-ink-2">Risolte</div>
          <div className="text-xl font-bold text-[#2d8f52]">{counts.byStatus.risolto}</div>
        </div>
      </div>

      {counts.byArea.length > 0 && (
        <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
          <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">Per area/sottosezione</div>
          <div className="divide-y divide-[#F0F2F5]">
            {counts.byArea.map((a) => (
              <div key={a.area} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-semibold text-ink">{a.area}</span>
                <span className="text-xs text-ink-2">
                  {a.total} totali · {a.nuovo} nuove · {a.inGestione} in gestione · {a.risolto} risolte
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtri */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["tutti", "nuovo", "in_gestione", "risolto"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              statusFilter === s ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-white text-ink-2"
            }`}
          >
            {s === "tutti" ? "Tutti" : STATUS_LABEL[s].label}
          </button>
        ))}
        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="rounded-full border border-[#E8EBF0] bg-white px-3 py-1.5 text-xs font-semibold text-ink-2"
        >
          {areaOptions.map((a) => (
            <option key={a} value={a}>
              {a === "tutte" ? "Tutte le aree" : a}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Segnalazioni ({filtered.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {filtered.map((item) => (
            <div key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${SOURCE_LABEL[item.appSource].cls}`}>
                    {SOURCE_LABEL[item.appSource].label}
                  </span>
                  <span className="rounded-full bg-[#F4F6FA] px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                    {item.area}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_LABEL[item.status].cls}`}>
                    {STATUS_LABEL[item.status].label}
                  </span>
                </div>
                <div className="text-sm text-ink">{item.message}</div>
                <div className="mt-0.5 text-[11px] text-ink-3">
                  {item.parentName || "Genitore"} · {item.pagePath} · {new Date(item.createdAt).toLocaleDateString("it-IT")}
                </div>
                {item.status !== "risolto" && (
                  <input
                    value={noteDraft[item.id] ?? item.adminNote ?? ""}
                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Nota facoltativa per il genitore (es. cosa è stato fatto)"
                    className="mt-2 w-full max-w-sm rounded-md border border-[#E8EBF0] bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                  />
                )}
                {item.status === "risolto" && item.adminNote && (
                  <div className="mt-1 text-[11px] text-ink-3">Nota: {item.adminNote}</div>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1.5">
                {item.status !== "in_gestione" && (
                  <button
                    onClick={() => updateStatus(item.id, "in_gestione")}
                    disabled={busyId === item.id}
                    className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    In gestione
                  </button>
                )}
                {item.status !== "risolto" && (
                  <button
                    onClick={() => updateStatus(item.id, "risolto")}
                    disabled={busyId === item.id}
                    className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Risolto
                  </button>
                )}
                {item.status !== "nuovo" && (
                  <button
                    onClick={() => updateStatus(item.id, "nuovo")}
                    disabled={busyId === item.id}
                    className="text-[11px] font-semibold text-ink-3 underline"
                  >
                    Riapri
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Nessuna segnalazione con questi filtri.</p>
          )}
        </div>
      </div>
    </div>
  );
}
