"use client";

// TRAMA — ADMIN BETA COCKPIT · Triage dei feedback (ADAPT della coda
// Segnalazioni BETA): viste per tipo, cinque stati, tag manuali, nota,
// collegamento alla famiglia. Le famiglie continuano a vedere i tre stati
// di sempre (Da capire → In gestione, Non ora → Risolto).

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  EXTENDED_STATUSES,
  FEEDBACK_STATUS_DEF,
  FEEDBACK_VIEWS,
  inFeedbackView,
  type CockpitFeedbackRow,
  type CockpitFeedbackStatus,
  type FeedbackView,
} from "@/lib/beta-cockpit/feedback";
import { betaFeedbackCategoryLabel } from "@/lib/nextgen/beta-feedback-shared";
import { updateFeedbackTriageAction } from "@/app/actions/beta-cockpit";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
}

export default function FeedbackTriageClient({ initial, extended }: { initial: CockpitFeedbackRow[]; extended: boolean }) {
  const [items, setItems] = useState(initial);
  const [view, setView] = useState<FeedbackView>("tutti");
  const [status, setStatus] = useState<CockpitFeedbackStatus | "tutti">("tutti");
  const [tag, setTag] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { tags: string; note: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allTags = useMemo(() => Array.from(new Set(items.flatMap((i) => i.tags))).sort(), [items]);
  const shown = items.filter((i) => inFeedbackView(i, view) && (status === "tutti" || i.status === status) && (!tag || i.tags.includes(tag)));

  async function save(item: CockpitFeedbackRow, nextStatus: CockpitFeedbackStatus) {
    const d = drafts[item.id] ?? { tags: item.tags.join(", "), note: item.adminNote ?? "" };
    setBusy(item.id);
    setError(null);
    const r = await updateFeedbackTriageAction(item.id, { status: nextStatus, tags: d.tags, adminNote: d.note });
    setBusy(null);
    if (r.error) {
      setError(r.error);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus, tags: r.tags ?? i.tags, adminNote: d.note || null } : i)));
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {FEEDBACK_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${view === v.key ? "bg-trama-violet text-white" : "border border-[#E8EBF0] bg-white text-ink"}`}
          >
            {v.label} ({items.filter((i) => inFeedbackView(i, v.key)).length})
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-ink-2">Stato:</span>
        {(["tutti", ...FEEDBACK_STATUS_DEF.map((s) => s.value)] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-2.5 py-1 font-semibold ${status === s ? "bg-trama-navy text-white" : "border border-[#E8EBF0] bg-white text-ink"}`}
          >
            {s === "tutti" ? "Tutti" : FEEDBACK_STATUS_DEF.find((x) => x.value === s)!.label}
          </button>
        ))}
        {allTags.length > 0 && (
          <>
            <span className="ml-2 text-ink-2">Tag:</span>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? null : t)}
                className={`rounded-full px-2.5 py-1 font-semibold ${tag === t ? "bg-trama-navy text-white" : "border border-[#E8EBF0] bg-white text-ink"}`}
              >
                #{t}
              </button>
            ))}
          </>
        )}
      </div>
      {!extended && (
        <p className="mb-2 rounded border border-orange-mid bg-orange-light px-2 py-1 text-xs text-ink">
          &quot;Da capire&quot;, &quot;Non ora&quot; e i tag arrivano con la migration 46. Fino ad allora funzionano Nuovo, Da fare e Fatto.
        </p>
      )}
      {error && <p className="mb-2 text-xs font-semibold text-[#C0392B]">{error}</p>}

      {shown.length === 0 ? (
        <p className="py-2 text-sm text-ink-2">Nessun feedback qui.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((item) => {
            const d = drafts[item.id] ?? { tags: item.tags.join(", "), note: item.adminNote ?? "" };
            const st = FEEDBACK_STATUS_DEF.find((s) => s.value === item.status)!;
            return (
              <li key={item.id} className="rounded-lg border border-[#E8EBF0] bg-white p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-2">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{st.label}</span>
                  <span>{fmt(item.at)}</span>
                  {item.surveyId ? <span>Survey {item.surveyId === "survey_1" ? "giorno 3" : "giorno 14"}</span> : <span>{betaFeedbackCategoryLabel(item.category) ?? "Senza tipo"}</span>}
                  {!item.surveyId && <span>· {item.area}</span>}
                  {item.familyKey && (
                    <Link href={`/admin/beta/famiglia/${encodeURIComponent(item.familyKey)}`} className="font-semibold text-trama-violet underline">
                      {item.familyLabel ?? "famiglia"}
                    </Link>
                  )}
                  {item.tags.map((t) => (
                    <span key={t} className="rounded bg-[#F1F3F6] px-1.5 text-ink">
                      #{t}
                    </span>
                  ))}
                </div>
                <p className="whitespace-pre-line text-sm text-ink">{item.message}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <input
                    aria-label="Tag"
                    value={d.tags}
                    disabled={!extended}
                    placeholder="tag, separati da virgola"
                    onChange={(e) => setDrafts((x) => ({ ...x, [item.id]: { ...d, tags: e.target.value } }))}
                    className="rounded border border-[#E8EBF0] px-2 py-1 text-xs text-ink disabled:bg-[#F7F9FC]"
                  />
                  <input
                    aria-label="Nota"
                    value={d.note}
                    placeholder="nota (la vede anche la famiglia, in Le mie segnalazioni)"
                    onChange={(e) => setDrafts((x) => ({ ...x, [item.id]: { ...d, note: e.target.value } }))}
                    className="rounded border border-[#E8EBF0] px-2 py-1 text-xs text-ink"
                  />
                  <div className="flex flex-wrap gap-1">
                    {FEEDBACK_STATUS_DEF.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        disabled={busy === item.id || (!extended && EXTENDED_STATUSES.includes(s.value))}
                        onClick={() => save(item, s.value)}
                        className={`rounded px-2 py-1 text-[11px] font-semibold disabled:opacity-40 ${item.status === s.value ? "bg-trama-navy text-white" : "border border-[#E8EBF0] text-ink"}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
