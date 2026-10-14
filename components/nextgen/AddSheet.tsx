"use client";

// TRAMA — NUOVA BARRA (14/10/2026, tavola "TRAMA Navigazione · proposta",
// schermata 2). Il pulsante + al centro della barra apre questo foglio dal
// basso: tre cose diverse che in TRAMA si "aggiungono". Solo link verso
// flussi già esistenti (nessuna azione nuova):
//   - Un impegno        → modulo degli impegni del Planner (solo con il flag
//                          EXTERNAL_PLANNER_ITEMS_ENABLED, altrimenti nascosto)
//   - Chi accompagna    → settimana corrente del Planner
//   - Un altro genitore → Gruppi (inviti)
// "Cerca attività" resta nella scheda Scopri: non si duplica qui.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { NEW_EXTERNAL_ITEM_HREF } from "@/lib/planner/new-external-item-link";

function mondayOfTodayRome(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .slice(0, 10);
  const d = new Date(parts + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default function AddSheet({
  open,
  onClose,
  addItemEnabled,
  radarEnabled = false,
}: {
  open: boolean;
  onClose: () => void;
  addItemEnabled: boolean;
  /** RADAR (14/10/2026, "il pulsante per aggiungere dépliant e foto dove è finito?"): con RADAR_ENABLED il + offre anche "Una scoperta". */
  radarEnabled?: boolean;
}) {
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const options = [
    ...(addItemEnabled
      ? [
          {
            href: NEW_EXTERNAL_ITEM_HREF,
            icon: "ti-calendar-plus",
            title: "Un impegno",
            detail: "Nuoto, inglese, un campus: anche se il centro non è su TRAMA",
            primary: true,
          },
        ]
      : []),
    {
      href: `/nextgen/planner?mode=calendario&week=${mondayOfTodayRome()}`,
      icon: "ti-car",
      title: "Chi accompagna",
      detail: "Chi porta e chi ritira, giorno per giorno",
      primary: !addItemEnabled,
    },
    ...(radarEnabled
      ? [
          {
            href: "/nextgen/search?radar=1",
            icon: "ti-photo-plus",
            title: "Una scoperta",
            detail: "Un volantino, una foto o un link trovati fuori da TRAMA",
            primary: false,
          },
        ]
      : []),
    {
      href: "/nextgen/groups",
      icon: "ti-user-plus",
      title: "Un altro genitore",
      detail: "Invitalo a organizzarvi insieme in un gruppo",
      primary: false,
    },
  ];

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="presentation">
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(23,42,77,0.45)]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sheet-h"
        className="relative flex flex-col gap-1.5 rounded-t-3xl bg-white px-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-8px_30px_rgba(23,42,77,0.18)]"
      >
        <span aria-hidden="true" className="mb-2 h-1 w-10 self-center rounded-full bg-[#D6DAE3]" />
        <h2 id="add-sheet-h" className="mb-1.5 font-poppins text-[18px] font-semibold text-ink">
          Cosa aggiungi?
        </h2>
        {options.map((o, i) => (
          <Link
            key={o.title}
            ref={i === 0 ? firstLinkRef : undefined}
            href={o.href}
            onClick={onClose}
            className={`flex min-h-[64px] items-center gap-3.5 rounded-[12px] p-3 text-ink active:scale-[0.99] ${o.primary ? "bg-trama-primary-soft" : ""}`}
          >
            <span
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] ${
                o.primary ? "bg-trama-primary text-white" : "bg-[#F1F3F6] text-trama-navy"
              }`}
            >
              <i className={`ti ${o.icon} text-[22px]`} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{o.title}</span>
              <span className="text-[12.5px] leading-snug text-ink-2">{o.detail}</span>
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
