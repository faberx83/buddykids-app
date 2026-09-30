// TRAMA — TEST PIPELINE NUOVO ACCOUNT (30/09/2026). Bolla temporanea
// "Test nuovo Claude · build <sha> · <data ora>" mostrata in alto al centro
// nelle aree Genitori, Gestori e Admin, SOLO quando
// BUILD_INFO_BUBBLE_ENABLED risolve true per l'utente corrente (decisione
// presa server-side in lib/build-info-bubble.ts, questo componente è puramente
// presentazionale e non risolve mai un flag da solo).
//
// pointer-events-none: non intercetta MAI tap/click, quindi non può coprire
// né bloccare pulsanti sottostanti (header, chip Beta, campanella, chat).
// Da rimuovere a test concluso: vedi lib/build-info-bubble.ts.

export default function BuildInfoBubble({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div
      role="status"
      data-testid="build-info-bubble"
      className="pointer-events-none fixed left-1/2 z-[70] -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 6px)",
        background: "#6F63C5",
        color: "#FFFFFF",
        opacity: 0.92,
      }}
    >
      Test nuovo Claude · {label}
    </div>
  );
}
