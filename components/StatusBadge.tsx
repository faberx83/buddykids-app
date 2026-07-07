// Badge riutilizzabili per segnalare, PRIMA che l'utente clicchi, che una
// funzione non è ancora collegata a Supabase (DemoBadge) oppure non esiste
// ancora del tutto (ComingSoonBadge). Servono a rendere visibile lo stato
// reale dell'app durante questa fase di collegamento dati.

export function DemoBadge({ label = "Demo" }: { label?: string }) {
  return (
    <span
      title="Le modifiche non vengono ancora salvate su Supabase"
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#FFF3D6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A6B00]"
    >
      <i className="ti ti-flask text-[11px]" />
      {label}
    </span>
  );
}

export function ComingSoonBadge({ label = "Presto" }: { label?: string }) {
  return (
    <span
      title="Funzionalità non ancora attiva"
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#F0F2F5] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3"
    >
      <i className="ti ti-clock text-[11px]" />
      {label}
    </span>
  );
}
