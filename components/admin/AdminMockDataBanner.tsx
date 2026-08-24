// PRE-LAUNCH REMEDIATION WAVE 1 — R-01 (decisione Fabrizio, 24/08/2026):
// le pagine Admin "classiche" (Dashboard root, Attività, Analisi, Centri)
// leggono da lib/mock-data.ts in modo INCONDIZIONATO — nessuna di queste
// query legge mai Supabase, a differenza del resto dell'app dove il mock è
// solo un fallback condizionato. La superficie operativa canonica della Beta
// è /admin/one (Command Center, dati reali) — queste pagine restano
// raggiungibili per compatibilità storica (nessun codice rimosso in questa
// fase) ma con un banner permanente e inequivocabile, così nessun Admin può
// scambiare questi numeri per dati di produzione.
export default function AdminMockDataBanner({
  cta,
  description = "Questa pagina mostra dati di esempio statici, non prenotazioni/centri/attività reali.",
}: {
  /** Link opzionale verso la superficie reale equivalente (es. Command Center). */
  cta?: { href: string; label: string };
  /** Testo descrittivo, personalizzabile per pagine con contenuto misto reale/demo. */
  description?: string;
}) {
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-[#E8543E] bg-[#FDEDEA] px-4 py-3"
    >
      <div className="flex items-center gap-2">
        <i className="ti ti-alert-triangle text-lg text-[#E8543E]" aria-hidden="true" />
        <span className="text-sm font-bold uppercase tracking-wide text-[#B23A2C]">
          Demo — dati non reali
        </span>
        <span className="text-sm text-[#8A2E23]">{description}</span>
      </div>
      {cta ? (
        <a
          href={cta.href}
          className="whitespace-nowrap rounded-md bg-[#E8543E] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
        >
          {cta.label} →
        </a>
      ) : null}
    </div>
  );
}
