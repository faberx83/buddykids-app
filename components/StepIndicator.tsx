// nextgen (01/09/2026, segnalazione Fabrizio "grafica legacy" nel flusso di
// prenotazione): usato SOLO da app/booking/[id]/BookingClient.tsx (nessun
// altro call site), quindi sicuro da estendere con lo stesso pattern di
// GroupDetailClient.tsx senza rischiare di toccare pagine Legacy-only.
// Legacy (default false) resta invariato.
//
// FEATURE servizi extra (segnalazione Fabrizio 04/09/2026: "il genitore deve
// poter scegliere se accedere a tutti i servizi") — il wizard ora può avere
// 3 O 4 step (uno step "Servizi" in più solo se l'attività ne offre almeno
// uno, vedi BookingClient.tsx#hasAnyService): "step"/"labels" diventano
// generici invece dei 3 hardcoded di prima, così lo stesso componente
// funziona per entrambi i casi senza duplicazione.
export default function StepIndicator({
  step,
  labels = ["Settimane", "Bambini", "Pagamento"],
  nextgen = false,
}: {
  step: number;
  labels?: string[];
  nextgen?: boolean;
}) {
  const total = labels.length;
  const accentBg = nextgen ? "bg-trama-violet" : "bg-sky";
  const accentText = nextgen ? "text-trama-violet" : "text-sky";
  const accentRing = nextgen
    ? "shadow-[0_0_0_4px_rgba(111,99,197,0.2)]"
    : "shadow-[0_0_0_4px_rgba(77,175,239,0.2)]";

  const dotClass = (i: number) => {
    if (i < step) return `${accentBg} text-white`;
    if (i === step) return `${accentBg} text-white ${accentRing}`;
    return "bg-[#F0F2F5] text-ink-3";
  };

  return (
    <>
      <div className="flex flex-shrink-0 items-center px-5 pt-[18px]">
        {Array.from({ length: total }, (_, idx) => idx + 1).map((i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${dotClass(
                i
              )}`}
            >
              {i}
            </div>
            {i < total && (
              <div
                className={`h-0.5 flex-1 transition-colors ${
                  i < step ? accentBg : "bg-[#F0F2F5]"
                }`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between px-5 pt-1">
        {labels.map((label, i) => (
          <span
            key={label}
            // L'ultima label ("Pagamento") non ha spazio a destra (l'ultimo
            // pallino è a filo bordo): centrarla in un box fisso da 30px la
            // faceva sporgere oltre il bordo dello schermo. Qui resta
            // larghezza naturale e ancorata a destra, cosi cresce verso
            // sinistra invece che tagliarsi contro il margine.
            className={`whitespace-nowrap text-[10px] font-medium ${
              i + 1 === step ? `font-bold ${accentText}` : "text-ink-3"
            } ${i === labels.length - 1 ? "text-right" : "w-[30px] text-center"}`}
            style={i === 1 ? { marginLeft: 18 } : undefined}
          >
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
