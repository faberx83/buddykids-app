"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { approveActivationAction, requestActivationChangesAction, setActivationCheckAction } from "@/app/actions/center-activation";
import type { ActivationStep, AdminBucket } from "@/lib/centers/activation";
import type { CenterOnboardingStatus } from "@/lib/onboarding/types";
import type { ActivationHistoryEntry } from "@/lib/data/center-activation";

// TRAMA — PORTALE CENTRI V2, FASE 1 (27/10/2026): Admin → Centri da attivare.
// Filtri (tocca a TRAMA / tocca al centro / attivi / sospesi), elenco con la
// mini-timeline, dettaglio con i controlli automatici del profilo, le due
// verifiche di TRAMA, nota, "Approva e rendi visibile" / "Chiedi una
// modifica", storico. Grafica V2 su un pannello chiaro (l'Admin è scuro).

export interface AdminActivationRow {
  centerId: string;
  name: string;
  city: string | null;
  source: string | null;
  adminEmails: string[];
  bucket: AdminBucket;
  status: CenterOnboardingStatus | null;
  percent: number;
  checks: { label: string; done: boolean }[];
  steps: ActivationStep[];
  referentConfirmed: boolean;
  activitiesChecked: boolean;
  canApprove: boolean;
  waitingDays: number | null;
  changesNote: string | null;
  history: ActivationHistoryEntry[];
}

const FILTERS: { key: AdminBucket; label: string }[] = [
  { key: "trama", label: "Tocca a TRAMA" },
  { key: "centro", label: "Tocca al centro" },
  { key: "attivi", label: "Attivi" },
  { key: "sospesi", label: "Sospesi" },
];

const STATUS_LABEL: Record<string, string> = {
  LEAD: "da iniziare",
  CLAIMED: "profilo in compilazione",
  SUBMITTED: "inviato, da verificare",
  CHANGES_REQUESTED: "modifica richiesta",
  APPROVED: "attivo",
  SUSPENDED: "sospeso",
};

function when(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function historyLine(h: ActivationHistoryEntry): string {
  if (h.fromStatus === h.toStatus) return h.note ?? "Aggiornamento";
  const to = STATUS_LABEL[h.toStatus] ?? h.toStatus.toLowerCase();
  return h.note ? `${to} · ${h.note}` : to;
}

export default function ActivationAdminClient({ rows }: { rows: AdminActivationRow[] }) {
  const router = useRouter();
  const counts = useMemo(() => {
    const c: Record<AdminBucket, number> = { trama: 0, centro: 0, attivi: 0, sospesi: 0 };
    for (const r of rows) c[r.bucket] += 1;
    return c;
  }, [rows]);
  const [filter, setFilter] = useState<AdminBucket>(counts.trama > 0 ? "trama" : "centro");
  const shown = rows.filter((r) => r.bucket === filter);
  const [selectedId, setSelectedId] = useState<string | null>(shown[0]?.centerId ?? null);
  const selected = rows.find((r) => r.centerId === selectedId) ?? shown[0] ?? null;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ error?: string }>, ok: string) {
    setMessage(null);
    setBusy(key);
    const res = await fn().catch(() => ({ error: "Operazione non riuscita, riprova." }));
    setBusy(null);
    if (res.error) return setMessage(res.error);
    setMessage(ok);
    router.refresh();
  }

  return (
    <div data-nav-v2 className="rounded-[20px] bg-trama-page p-5 text-ink md:p-7" data-testid="admin-activation">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-2">Admin · Centri</span>
          <h1 className="font-poppins text-[26px] font-semibold text-trama-navy">Centri da attivare</h1>
        </div>
        <div role="tablist" aria-label="Filtro" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setSelectedId(rows.find((r) => r.bucket === f.key)?.centerId ?? null);
                setMessage(null);
              }}
              className={`min-h-[38px] rounded-full px-3.5 text-[13.5px] font-semibold ${
                filter === f.key ? "bg-trama-navy text-white" : "border border-[#D9DDE5] bg-white text-trama-navy"
              }`}
            >
              {f.label} · {counts[f.key]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-2xl border border-trama-line bg-white p-5 text-[14px] text-ink-2">
          Nessun centro in attivazione. I centri arrivano qui quando approvi una candidatura in Segnalazioni centri.
        </p>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Elenco" className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5">
          {shown.length === 0 && rows.length > 0 && (
            <p className="rounded-2xl border border-trama-line bg-white p-4 text-[14px] text-ink-2">Nessun centro in questo gruppo.</p>
          )}
          {shown.map((r) => {
            const isSel = selected?.centerId === r.centerId;
            return (
              <button
                key={r.centerId}
                type="button"
                onClick={() => {
                  setSelectedId(r.centerId);
                  setMessage(null);
                  setNote("");
                }}
                aria-pressed={isSel}
                className={`flex flex-col gap-2 rounded-[18px] bg-white px-4 py-3.5 text-left ${isSel ? "border-2 border-trama-navy" : "border border-trama-line"}`}
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-trama-navy">{r.name}</span>
                  {r.waitingDays !== null && r.bucket !== "attivi" && (
                    <span className="text-[12px] text-ink-2">{r.waitingDays === 0 ? "da oggi" : `da ${r.waitingDays} ${r.waitingDays === 1 ? "giorno" : "giorni"}`}</span>
                  )}
                </span>
                <span className="text-[13.5px] text-ink-2">
                  {[r.city, r.source ? `arrivata da: ${r.source}` : null, r.bucket === "centro" ? `profilo ${r.percent}%` : null].filter(Boolean).join(" · ")}
                </span>
                <span className="flex items-center gap-1.5" aria-label={`Stato: ${STATUS_LABEL[r.status ?? "APPROVED"]}`}>
                  {r.steps.map((s, i) => (
                    <span key={s.key} className="flex flex-1 items-center gap-1.5 last:flex-none">
                      <span
                        className={`h-3 w-3 flex-shrink-0 rounded-full ${
                          s.state === "done" ? "bg-trama-navy" : s.state === "current" ? "border-[3px] border-trama-accent" : "border-2 border-[#D5D1C8]"
                        }`}
                      />
                      {i < r.steps.length - 1 && <span className={`h-[2px] flex-1 ${s.state === "done" ? "bg-trama-navy" : "bg-trama-line"}`} />}
                    </span>
                  ))}
                </span>
                <span className="self-start rounded-full bg-trama-accent-soft px-2.5 py-0.5 text-[12px] font-bold text-trama-accent-ink">
                  {STATUS_LABEL[r.status ?? "APPROVED"]}
                </span>
              </button>
            );
          })}
        </section>

        {selected && (
          <section aria-labelledby="det-h" className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-[20px] border border-trama-line bg-white p-5">
            <div className="flex flex-col gap-1">
              <h2 id="det-h" className="font-poppins text-[22px] font-semibold text-trama-navy">
                {selected.name}
              </h2>
              <span className="text-[14px] text-ink-2">
                {[selected.city, selected.adminEmails.length > 0 ? `gestore: ${selected.adminEmails.join(", ")}` : "accesso non ancora creato"]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>

            <ol aria-label="Passi dell'attivazione" className="grid grid-cols-5 gap-1.5">
              {selected.steps.map((s) => (
                <li
                  key={s.key}
                  aria-current={s.state === "current" ? "step" : undefined}
                  className={`flex flex-col gap-1 border-t-[3px] pt-2 ${
                    s.state === "done" ? "border-trama-navy" : s.state === "current" ? "border-trama-accent" : "border-trama-line"
                  }`}
                >
                  <span className={`text-[13px] font-bold ${s.state === "current" ? "text-trama-accent-ink" : s.state === "done" ? "text-trama-navy" : "text-ink-2"}`}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">Profilo ({selected.percent}%, automatico)</span>
                <ul className="flex flex-col gap-1.5 text-[14px]">
                  {selected.checks.map((c) => (
                    <li key={c.label} className="flex items-start gap-2">
                      <i className={`ti ${c.done ? "ti-check text-[#1E8F6A]" : "ti-circle text-ink-3"} mt-0.5 text-[16px]`} aria-hidden="true" />
                      <span className={c.done ? "text-ink" : "text-ink-2"}>
                        {c.label}
                        {!c.done && <span className="sr-only"> (manca)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">Verifica di TRAMA</span>
                <label className="flex items-start gap-2.5 text-[14px] leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    checked={selected.referentConfirmed}
                    disabled={busy !== null || selected.bucket === "attivi"}
                    onChange={(e) =>
                      void run("ref", () => setActivationCheckAction(selected.centerId, "referent", e.target.checked), "Salvato.")
                    }
                  />
                  <span>Referente e telefono confermati con la telefonata</span>
                </label>
                <label className="flex items-start gap-2.5 text-[14px] leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 flex-shrink-0"
                    checked={selected.activitiesChecked}
                    disabled={busy !== null || selected.bucket === "attivi"}
                    onChange={(e) =>
                      void run("act", () => setActivationCheckAction(selected.centerId, "activities", e.target.checked), "Salvato.")
                    }
                  />
                  <span>Attività controllate (date, età, orari, posti)</span>
                </label>
              </div>
            </div>

            {selected.bucket !== "attivi" && (
              <div className="flex flex-col gap-2 border-t border-[#F0EEE8] pt-4">
                <label htmlFor="act-note" className="text-[13px] font-bold text-trama-navy">
                  Nota per il centro (se chiedi una modifica)
                </label>
                <textarea
                  id="act-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Es. Nel Ponte dell'Immacolata manca l'orario di uscita."
                  className="w-full resize-none rounded-[12px] border border-trama-line px-3 py-2.5 text-[14px] outline-none focus:border-trama-primary"
                />
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={!selected.canApprove || busy !== null}
                    onClick={() => void run("approve", () => approveActivationAction(selected.centerId), "Centro attivato: le sue attività ora sono visibili alle famiglie.")}
                    className="min-h-[46px] rounded-[12px] bg-trama-primary px-[18px] text-[14.5px] font-semibold text-white disabled:bg-[#B9C0CC]"
                  >
                    {busy === "approve" ? "…" : "Approva e rendi visibile"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null || selected.status !== "SUBMITTED"}
                    onClick={() =>
                      void run("changes", () => requestActivationChangesAction(selected.centerId, note), "Modifica chiesta: il centro la vede nel portale e per email.")
                    }
                    className="min-h-[46px] rounded-[12px] border border-[#D9DDE5] bg-white px-[18px] text-[14.5px] font-semibold text-trama-navy disabled:opacity-50"
                  >
                    {busy === "changes" ? "…" : "Chiedi una modifica"}
                  </button>
                </div>
                <span className="text-[12.5px] text-ink-2">
                  {selected.status === "SUBMITTED"
                    ? "“Approva” si attiva con le due spunte. Al centro arriva un’email in entrambi i casi."
                    : "Il centro non ha ancora inviato il profilo: le decisioni si prendono dopo l’invio."}
                </span>
              </div>
            )}

            {message && (
              <p role="status" className="text-[13.5px] font-medium text-trama-navy">
                {message}
              </p>
            )}

            {selected.history.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-[#F0EEE8] pt-3.5">
                <span className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-ink-2">Storico</span>
                {selected.history.map((h, i) => (
                  <span key={`${h.createdAt}-${i}`} className="text-[13.5px] text-ink-2">
                    {when(h.createdAt)} · {historyLine(h)}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
