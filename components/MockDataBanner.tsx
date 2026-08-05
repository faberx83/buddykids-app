// TRAMA ONE — Addendum Sezione B (Feature Control Center): requisito
// "banner di modalità demo" per ogni funzionalità in stato MOCK_DEMO
// (lib/feature-registry/catalog.ts). Componente unico, riusabile sia in
// Legacy sia in NEXTGEN (colori ambra neutri, non legati ai token
// pre-rebrand né a trama-*, per non dover mantenere due varianti) —
// wiring iniziale solo sulle due Home (vedi nota in
// lib/data/activities.ts, isMockActivitiesArray).
export default function MockDataBanner({
  visible,
  message,
}: {
  visible: boolean;
  message?: string;
}) {
  if (!visible) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#F0D599] bg-[#FFF7E6] px-4 py-2.5 text-xs text-[#9a6b00]">
      <i className="ti ti-alert-triangle mt-0.5 flex-shrink-0 text-sm" />
      <span>
        {message ?? "Stai vedendo attività dimostrative: al momento non ci sono dati reali disponibili per questa zona."}
      </span>
    </div>
  );
}
