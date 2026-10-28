"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BriefingModel } from "@/lib/nextgen/daily-briefing";

// TRAMA — IL BUONGIORNO IN APP (28/10/2026, Fabrizio: "si può fare che
// cliccando sulla notifica si apra un pop-up sull'app con il buongiorno
// strutturato simile a quello che si riceve via mail?").
// La notifica del buongiorno porta a /nextgen?buongiorno=<data>: la Home si
// apre con questo foglio dal basso, con le stesse sezioni dell'email (Oggi,
// Chi accompagna, Scuola chiusa) e lo stesso pulsante. Chiudendo si resta in
// Home (il parametro sparisce dall'indirizzo, così ricaricando non si riapre).

export default function BuongiornoSheet({ model }: { model: BriefingModel }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    router.replace("/nextgen", { scroll: false });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close è stabile per l'uso che ne facciamo (router e setter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  return (
    <div data-nav-v2 className="fixed inset-0 z-[60] flex flex-col justify-end" role="presentation" data-testid="buongiorno-sheet">
      <button type="button" aria-label="Chiudi" onClick={close} className="absolute inset-0 bg-[rgba(23,42,77,0.45)]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="buongiorno-title"
        className="relative mx-auto flex max-h-[88%] w-full max-w-[560px] flex-col rounded-t-3xl bg-trama-page shadow-[0_-8px_30px_rgba(23,42,77,0.18)]"
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-4">
          <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="mt-0.5 h-9 w-auto" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 id="buongiorno-title" className="font-poppins text-[22px] font-semibold leading-tight text-trama-navy">
              {model.hello}!
            </h2>
            <span className="text-[14px] text-ink-2">Ecco la giornata di {model.dayLabel}.</span>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Chiudi"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F1F3F6] text-trama-navy"
          >
            <i className="ti ti-x text-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <h3 className="pb-1.5 pt-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-trama-accent-ink">Oggi</h3>
          <ul className="flex flex-col gap-1.5">
            {model.entries.length === 0 && (
              <li className="rounded-[12px] border border-trama-line bg-white px-3 py-2.5 text-[15px] font-semibold text-trama-navy">
                Nessun impegno in agenda
              </li>
            )}
            {model.entries.map((e, i) => (
              <li key={`${e.time}-${i}`} className="rounded-[12px] border border-trama-line bg-white px-3 py-2.5 text-[15px] leading-snug text-trama-navy">
                <span className="text-ink-2">{e.time}</span>&nbsp; <b>{e.title}</b>
                {e.kids && <span className="text-ink-2"> · {e.kids}</span>}
              </li>
            ))}
          </ul>

          {model.slots.length > 0 && (
            <>
              <h3 className="pb-1.5 pt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-trama-accent-ink">
                Chi accompagna{model.missingCount > 0 ? ` · ${model.missingCount} da decidere` : ""}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {model.slots.map((s, i) => (
                  <li key={`${s.kidName}-${s.momentLabel}-${i}`} className="rounded-[12px] border border-trama-line bg-white px-3 py-2.5 text-[15px] leading-snug text-trama-navy">
                    <span className="text-ink-2">
                      {s.kidName} · {s.momentLabel}
                    </span>
                    &nbsp; {s.label ? <b>{s.label}</b> : <b className="text-[#7A4500]">da decidere</b>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {model.closureText && (
            <>
              <h3 className="pb-1.5 pt-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-trama-accent-ink">Scuola chiusa</h3>
              <p className="rounded-[12px] border border-trama-line bg-white px-3 py-2.5 text-[15px] font-semibold leading-snug text-trama-navy">
                {model.closureText}
              </p>
            </>
          )}

          <div className="flex flex-col gap-2 pt-5">
            <Link
              href={model.cta.href}
              className="flex min-h-[50px] items-center justify-center rounded-[12px] bg-trama-primary px-5 text-[15px] font-semibold text-white active:bg-trama-primary-press"
            >
              {model.cta.label}
            </Link>
            <button type="button" onClick={close} className="flex min-h-[44px] items-center justify-center text-[15px] font-semibold text-trama-accent-ink">
              Vai alla Home
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
