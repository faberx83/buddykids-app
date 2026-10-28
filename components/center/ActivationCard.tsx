"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirmCancellationRulesAction, submitActivationAction } from "@/app/actions/center-activation";
import type { ActivationView } from "@/lib/centers/activation";

// TRAMA — PORTALE CENTRI V2, FASE 1 (27/10/2026): la card "Attivazione del
// centro" in cima a Oggi (tavole 1 e 2 del mock "TRAMA Partner V2").
// Timeline a 5 passi; nel passo Profilo l'anello con la % e l'elenco di cosa
// manca, ognuno col suo pulsante; "Invia a TRAMA" attivo solo al 100%;
// dopo l'invio "Tocca a TRAMA"; se TRAMA chiede una modifica, la nota.
// Tutta la logica è in lib/centers/activation.ts.

const RING_R = 22;
const RING_C = 2 * Math.PI * RING_R;

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long" }).format(new Date(iso));
}

export default function ActivationCard({ view }: { view: ActivationView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"submit" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy("submit");
    const res = await submitActivationAction().catch(() => ({ error: "Non siamo riusciti a inviare, riprova." }));
    setBusy(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function confirmCancellation() {
    setError(null);
    setBusy("cancel");
    const res = await confirmCancellationRulesAction().catch(() => ({ error: "Non siamo riusciti a salvare, riprova." }));
    setBusy(null);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  const onProfile = view.current === "profilo";
  const submittedOn = formatDay(view.submittedAt);

  return (
    <section
      data-nav-v2
      aria-labelledby="att-h"
      data-testid="activation-card"
      className="mb-4 flex flex-col gap-4 rounded-[20px] border border-trama-line bg-white p-[18px]"
    >
      <div className="flex flex-col gap-1">
        <h2 id="att-h" className="font-poppins text-[19px] font-semibold text-trama-navy">
          Attivazione del centro
        </h2>
        <p className="text-[14px] leading-snug text-ink-2">{view.headline}</p>
      </div>

      <ol aria-label="Passi dell'attivazione" className="grid grid-cols-5">
        {view.steps.map((s, i) => (
          <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className="relative flex flex-col items-center gap-1.5">
            {i < view.steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-[13px] h-[2px] w-full ${s.state === "done" ? "bg-trama-navy" : "bg-trama-line"}`}
              />
            )}
            <span
              className={`relative flex h-7 w-7 items-center justify-center rounded-full ${
                s.state === "done"
                  ? "bg-trama-navy text-white"
                  : s.state === "current"
                    ? "border-2 border-trama-accent bg-white"
                    : "border-2 border-[#D5D1C8] bg-white"
              }`}
            >
              {s.state === "done" && <i className="ti ti-check text-[15px]" aria-hidden="true" />}
              {s.state === "current" && <span className="h-2.5 w-2.5 rounded-full bg-trama-accent" aria-hidden="true" />}
            </span>
            <span
              className={`text-center text-[11.5px] ${
                s.state === "current" ? "font-bold text-trama-accent-ink" : s.state === "done" ? "font-semibold text-trama-navy" : "text-ink-2"
              }`}
            >
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {onProfile ? (
        <>
          <div className="flex items-center gap-3.5 rounded-2xl bg-trama-accent-soft px-3.5 py-3">
            <div className="relative h-14 w-14 flex-shrink-0">
              <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Profilo completo al ${view.percent} per cento`}>
                <circle cx="28" cy="28" r={RING_R} fill="none" stroke="#FFFFFF" strokeWidth="6" />
                <circle
                  cx="28"
                  cy="28"
                  r={RING_R}
                  fill="none"
                  stroke="#6F63C5"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(RING_C * view.percent) / 100} ${RING_C}`}
                  transform="rotate(-90 28 28)"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-trama-navy">{view.percent}%</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-trama-accent-ink">Tocca a voi</span>
              <span className="text-[15px] font-semibold text-trama-navy">
                Profilo: {view.done} {view.done === 1 ? "cosa fatta" : "cose fatte"} su {view.total}
              </span>
              <span className="text-[13px] text-ink-2">Il resto lo controlla TRAMA durante la verifica.</span>
            </div>
          </div>

          {view.changesNote && (
            <div className="flex flex-col gap-1.5 rounded-2xl border border-[#F3D9A8] bg-[#FFF6E6] px-4 py-3" data-testid="activation-changes">
              <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#8A5A00]">TRAMA vi chiede una modifica</span>
              <p className="text-[14px] leading-snug text-ink">“{view.changesNote}”</p>
              <span className="text-[12.5px] text-ink-2">Correggete e poi reinviate qui sotto.</span>
            </div>
          )}

          <ul aria-label="Cosa serve per l'approvazione" className="flex flex-col">
            {view.checks.map((c, i) => (
              <li key={c.key} className={`flex items-center gap-3 py-2.5 ${i < view.checks.length - 1 ? "border-b border-[#F0EEE8]" : ""}`}>
                {c.done ? (
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#2DBA8C] text-white" aria-label="Fatto">
                    <i className="ti ti-check text-[13px]" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="h-6 w-6 flex-shrink-0 rounded-full border-2 border-[#D5D1C8]" aria-label="Da fare" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-[14.5px] text-ink ${c.done ? "" : "font-semibold"}`}>{c.label}</span>
                  {!c.done && <span className="text-[12.5px] text-ink-2">{c.hint}</span>}
                </span>
                {!c.done &&
                  (c.key === "cancellation" ? (
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={confirmCancellation}
                        disabled={busy !== null}
                        className="flex min-h-[36px] items-center rounded-full bg-trama-navy px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                      >
                        {busy === "cancel" ? "…" : "Conferma"}
                      </button>
                      <Link href={c.href} className="flex min-h-[36px] items-center px-1 text-[13px] font-semibold text-trama-accent-ink">
                        Cambia
                      </Link>
                    </span>
                  ) : (
                    <Link
                      href={c.href}
                      className="flex min-h-[36px] flex-shrink-0 items-center rounded-full border border-[#D9DDE5] px-3 text-[13px] font-semibold text-trama-navy"
                    >
                      {c.cta}
                    </Link>
                  ))}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!view.canSubmit || busy !== null}
              className="min-h-[50px] rounded-[12px] bg-trama-primary px-5 text-[15px] font-semibold text-white active:bg-trama-primary-press disabled:bg-[#B9C0CC]"
              data-testid="activation-submit"
            >
              {busy === "submit" ? "Invio…" : view.changesNote ? "Reinvia a TRAMA" : "Invia a TRAMA per la verifica"}
            </button>
            {!view.canSubmit && (
              <span className="text-center text-[12.5px] text-ink-2">Si attiva quando le {view.total} cose sono fatte</span>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3.5 rounded-2xl bg-[#F7F6F2] px-3.5 py-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-trama-line bg-white text-trama-navy">
            <i className="ti ti-clock-hour-4 text-[22px]" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-2">Tocca a TRAMA</span>
            <span className="text-[15px] font-semibold text-trama-navy">
              {view.suspended ? "Attivazione sospesa" : submittedOn ? `Inviato il ${submittedOn}` : "Profilo inviato"}
            </span>
            <span className="text-[13px] text-ink-2">
              {view.suspended
                ? "Scriveteci per capire come riattivarla."
                : "Vi telefoniamo e controlliamo le attività. Rispondiamo entro 2 giorni lavorativi."}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13.5px] font-medium text-trama-orange">
          {error}
        </p>
      )}

      <div className="flex items-start gap-2.5 border-t border-[#F0EEE8] pt-3.5">
        <i className="ti ti-eye mt-0.5 text-[18px] text-ink-2" aria-hidden="true" />
        <p className="text-[13px] leading-snug text-ink-2">
          Le famiglie vedono le vostre attività dopo la verifica. Intanto potete preparare tutto e vedere{" "}
          <Link href="/center/profile" className="font-semibold text-trama-accent-ink">
            come vi vedranno
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
