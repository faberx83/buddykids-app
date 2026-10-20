"use client";

// TRAMA — ADMIN BETA COCKPIT · Decision log del report: osservazione →
// ipotesi → decisione → azione, con owner e data. Serve a trasformare i
// numeri in decisioni (e a ricordarsele la settimana dopo).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BetaDecision } from "@/lib/data/beta-cockpit";
import { createDecisionAction, setDecisionStatusAction } from "@/app/actions/beta-cockpit";

const FIELDS: { key: "observation" | "hypothesis" | "decision" | "action" | "owner"; label: string; placeholder: string; long: boolean }[] = [
  { key: "observation", label: "Osservazione", placeholder: "4 famiglie si fermano dopo il primo impegno", long: true },
  { key: "hypothesis", label: "Ipotesi", placeholder: "Inserire un impegno è troppo lungo", long: true },
  { key: "decision", label: "Decisione", placeholder: "Intervistare 2 famiglie prima di cambiare la UI", long: true },
  { key: "action", label: "Azione", placeholder: "Interviste entro venerdì", long: false },
  { key: "owner", label: "Owner", placeholder: "Fabrizio", long: false },
];

function fmt(iso: string) {
  return iso.split("-").reverse().join("/");
}

export default function DecisionLogClient({
  period,
  decisions,
  available,
}: {
  period: { from: string; to: string };
  decisions: BetaDecision[];
  available: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ observation: "", hypothesis: "", decision: "", action: "", owner: "", dueDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return <p className="text-sm text-ink-2">Il decision log arriva con la migration 46. Fino ad allora le decisioni vanno nel documento dell&apos;iniziativa.</p>;
  }

  const inPeriod = decisions.filter((d) => d.periodStart <= period.to && d.periodEnd >= period.from);
  const openElsewhere = decisions.filter((d) => d.status === "aperta" && !inPeriod.includes(d));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await createDecisionAction({ periodStart: period.from, periodEnd: period.to, ...form, dueDate: form.dueDate || null });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setForm({ observation: "", hypothesis: "", decision: "", action: "", owner: "", dueDate: "" });
      router.refresh();
    }
  }

  async function setStatus(id: string, status: BetaDecision["status"]) {
    const r = await setDecisionStatusAction(id, status);
    if (r.error) setError(r.error);
    else router.refresh();
  }

  const item = (d: BetaDecision) => (
    <li key={d.id} className={`rounded border border-[#E8EBF0] p-2 text-sm ${d.status !== "aperta" ? "opacity-60" : ""}`}>
      <div className="mb-1 text-[11px] text-ink-2">
        {fmt(d.periodStart)}–{fmt(d.periodEnd)} · {d.status}
        {d.owner && ` · ${d.owner}`}
        {d.dueDate && ` · entro ${fmt(d.dueDate)}`}
      </div>
      <p className="text-ink">
        <b>Osservazione:</b> {d.observation}
      </p>
      {d.hypothesis && (
        <p className="text-ink">
          <b>Ipotesi:</b> {d.hypothesis}
        </p>
      )}
      {d.decision && (
        <p className="text-ink">
          <b>Decisione:</b> {d.decision}
        </p>
      )}
      {d.action && (
        <p className="text-ink">
          <b>Azione:</b> {d.action}
        </p>
      )}
      <div className="mt-1 flex gap-1">
        {(["aperta", "fatta", "annullata"] as const)
          .filter((s) => s !== d.status)
          .map((s) => (
            <button key={s} type="button" onClick={() => setStatus(d.id, s)} className="rounded border border-[#E8EBF0] px-2 py-0.5 text-[11px] font-semibold text-ink">
              {s === "aperta" ? "Riapri" : s === "fatta" ? "Fatta" : "Annulla"}
            </button>
          ))}
      </div>
    </li>
  );

  return (
    <div>
      {inPeriod.length > 0 ? <ul className="mb-3 flex flex-col gap-2">{inPeriod.map(item)}</ul> : <p className="mb-3 text-sm text-ink-2">Nessuna decisione per questo periodo.</p>}
      {openElsewhere.length > 0 && (
        <>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-2">Ancora aperte da altri periodi</h3>
          <ul className="mb-3 flex flex-col gap-2">{openElsewhere.map(item)}</ul>
        </>
      )}
      <form onSubmit={submit} className="grid gap-2 rounded-lg bg-[#F7F9FC] p-3 md:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className={`flex flex-col gap-0.5 text-xs font-semibold text-ink ${f.long ? "md:col-span-2" : ""}`}>
            {f.label}
            {f.long ? (
              <textarea
                rows={2}
                value={form[f.key]}
                required={f.key === "observation"}
                placeholder={f.placeholder}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="rounded border border-[#E8EBF0] px-2 py-1 text-sm font-normal"
              />
            ) : (
              <input
                value={form[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                className="rounded border border-[#E8EBF0] px-2 py-1 text-sm font-normal"
              />
            )}
          </label>
        ))}
        <label className="flex flex-col gap-0.5 text-xs font-semibold text-ink">
          Data
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="rounded border border-[#E8EBF0] px-2 py-1 text-sm font-normal" />
        </label>
        <div className="flex items-end gap-2 md:col-span-2">
          <button type="submit" disabled={busy} className="rounded bg-trama-violet px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            Aggiungi al decision log
          </button>
          {error && <span className="text-xs text-[#C0392B]">{error}</span>}
        </div>
      </form>
    </div>
  );
}
