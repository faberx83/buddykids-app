"use client";

// TRAMA — ADMIN BETA COCKPIT · Card della survey beta in Home (dietro
// BETA_SURVEY_ENABLED). Chiusa mostra una riga; aperta, le domande una sotto
// l'altra. "Più tardi" la nasconde per qualche giorno. Stesso stile della
// riga "Dicci cosa ne pensi".

import { useState } from "react";
import type { SurveyDefinition } from "@/lib/beta-cockpit/survey";
import { snoozeBetaSurveyAction, submitBetaSurveyAction } from "@/app/actions/beta-cockpit";

export default function BetaSurveyCard({ survey }: { survey: SurveyDefinition }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "hidden">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "hidden") return null;

  if (state === "done") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-trama-line bg-white px-4 py-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-light text-[#2d8f52]">
          <i className="ti ti-check text-[20px]" aria-hidden="true" />
        </span>
        <span className="text-[14px] font-semibold text-ink">Grazie, le risposte sono arrivate.</span>
      </div>
    );
  }

  const choiceMissing = survey.questions.some((q) => q.type === "choice" && !answers[q.id]);

  async function send() {
    setError(null);
    setState("sending");
    const r = await submitBetaSurveyAction(survey.id, answers);
    if (r.error) {
      setError(r.error);
      setState("idle");
    } else setState("done");
  }

  async function later() {
    setState("hidden");
    await snoozeBetaSurveyAction(survey.id);
  }

  return (
    <section aria-label={survey.title} className="rounded-2xl border border-trama-line bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-trama-accent-soft text-trama-accent-ink">
          <i className="ti ti-list-check text-[20px]" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold text-ink">{survey.title}</span>
          <span className="text-[12.5px] leading-snug text-ink-2">{survey.intro}</span>
        </span>
        <i className={`ti ${open ? "ti-chevron-up" : "ti-chevron-down"} flex-shrink-0 text-[18px] text-ink-3`} aria-hidden="true" />
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-trama-line px-4 pb-4 pt-3">
          {survey.questions.map((q, i) => (
            <fieldset key={q.id} className="flex flex-col gap-2">
              <legend className="mb-1 text-[14px] font-semibold text-ink">
                {i + 1}. {q.text}
              </legend>
              {q.type === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {q.options!.map((o) => {
                    const selected = answers[q.id] === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
                        className={`min-h-[40px] rounded-full border px-3.5 text-[13.5px] font-medium ${
                          selected ? "border-trama-navy bg-trama-navy text-white" : "border-trama-line bg-white text-ink"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  maxLength={600}
                  rows={2}
                  placeholder={q.placeholder ?? "Facoltativo"}
                  className="w-full rounded-xl border border-trama-line px-3 py-2 text-[14px] text-ink outline-none focus:border-trama-navy"
                />
              )}
            </fieldset>
          ))}
          {error && <p className="text-[13px] text-[#B3261E]">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={choiceMissing || state === "sending"}
              onClick={send}
              className="min-h-[44px] flex-1 rounded-full bg-trama-primary px-4 text-[14.5px] font-semibold text-white disabled:opacity-40"
            >
              {state === "sending" ? "Invio…" : "Invia"}
            </button>
            <button type="button" onClick={later} className="min-h-[44px] rounded-full px-4 text-[14px] font-medium text-ink-2">
              Più tardi
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
