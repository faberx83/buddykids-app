// SPRINT 5.1 (NEXTGEN) — placeholder condiviso per le modalità del Planner
// non ancora implementate (Calendario/Mappa/Gruppi, arrivano nelle fasi
// 5.2/5.4/5.6). Stesso stile del placeholder "Vista calendario in arrivo"
// già usato in PrenotazioniClient.tsx (LEGACY-adjacent, non toccato):
// nessun vicolo cieco silenzioso, l'utente capisce che la scheda esiste ma
// non è ancora attiva.
export default function PlannerComingSoon({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#D8DEE8] bg-white p-6 text-center">
      <i className={`ti ${icon} mb-2 text-2xl text-ink-3`} />
      <div className="mb-1 text-sm font-bold text-ink">{title}</div>
      <p className="text-xs text-ink-2">{description}</p>
    </div>
  );
}
