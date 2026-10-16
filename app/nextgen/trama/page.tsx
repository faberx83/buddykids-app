// TRAMA — NUOVA BARRA (14/10/2026, tavola "TRAMA Navigazione · proposta",
// schermata 4). "Cos'è TRAMA": il posto del marchio dopo che l'avatar ha
// preso il posto del logo in Home. Pagina statica, nessun dato.
// La sezione "Chi c'è dietro" della tavola resta fuori finché Fabrizio non
// dà il testo: niente segnaposto visibili agli utenti.

import Link from "next/link";

const STEPS = [
  { title: "Mettete in fila le settimane", body: "Quello che i figli fanno già, anche fuori da TRAMA." },
  { title: "Riempite i buchi", body: "Centri e attività vicini per le settimane libere e i giorni di scuola chiusa." },
  { title: "Organizzatevi insieme", body: "Chi porta, chi ritira, e con quali altre famiglie." },
];

export default function CosETramaPage() {
  return (
    <div className="flex min-h-full flex-col gap-[22px] bg-trama-page px-5 pb-8 pt-3.5">
      <header className="flex items-center gap-2">
        <Link
          href="/nextgen/profile"
          aria-label="Torna al profilo"
          className="-ml-2.5 flex h-11 w-11 items-center justify-center rounded-full text-trama-navy active:bg-black/[0.04]"
        >
          <i className="ti ti-chevron-left text-[22px]" aria-hidden="true" />
        </Link>
        <span className="text-[14px] text-ink-2">Profilo</span>
      </header>

      <div className="flex flex-col items-start gap-3">
        <img src="/brand/trama-logo-mark.png" alt="TRAMA" className="h-12 w-auto" />
        <h1 className="font-poppins text-[26px] font-semibold leading-tight text-ink">Cos&apos;è TRAMA</h1>
        <p className="text-[15px] leading-relaxed text-[#374151]">
          Il posto dove una famiglia tiene insieme le settimane dei figli: scuola, attività, centri estivi e chi
          accompagna chi.
        </p>
      </div>

      <section
        aria-labelledby="come-h"
        className="flex flex-col gap-3.5 rounded-2xl border border-trama-line bg-white p-[18px]"
      >
        <h2 id="come-h" className="font-poppins text-[17px] font-semibold text-ink">
          Come funziona
        </h2>
        <ol className="flex flex-col gap-3.5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-trama-primary-soft text-[13px] font-bold text-trama-primary">
                {i + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold text-ink">{s.title}</span>
                <span className="text-[13px] leading-snug text-ink-2">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <nav aria-label="Informazioni" className="flex flex-col rounded-2xl border border-trama-line bg-white">
        <Link href="/nextgen/profile" className="flex min-h-[50px] items-center justify-between border-b border-[#F0F2F5] px-4 text-[14px] font-semibold text-trama-accent-ink">
          Scrivici da &quot;Aiutaci a migliorare TRAMA&quot;
          <i className="ti ti-chevron-right text-[16px] text-ink-3" aria-hidden="true" />
        </Link>
        <Link href="/nextgen/informative/privacy" className="flex min-h-[50px] items-center justify-between border-b border-[#F0F2F5] px-4 text-[14px] font-semibold text-ink">
          Informativa privacy
          <i className="ti ti-chevron-right text-[16px] text-ink-3" aria-hidden="true" />
        </Link>
        <Link href="/nextgen/informative/termini" className="flex min-h-[50px] items-center justify-between px-4 text-[14px] font-semibold text-ink">
          Termini di servizio
          <i className="ti ti-chevron-right text-[16px] text-ink-3" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
