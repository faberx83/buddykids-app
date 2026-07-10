// Badge "NEXTGEN" — unico elemento visivo condiviso di questo sprint (Sprint
// 0: solo infrastruttura, nessun redesign). Serve solo a rendere sempre
// riconoscibile, in ogni pagina NEXTGEN, che si sta guardando la V2 e non la
// V1 (LEGACY) durante i test A/B con utenti reali.
export default function NextgenBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
      <i className="ti ti-sparkles text-[11px]" />
      NextGen
    </span>
  );
}
