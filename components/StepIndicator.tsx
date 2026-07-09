export default function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Settimane", "Bambini", "Pagamento"];

  const dotClass = (i: number) => {
    if (i < step) return "bg-sky text-white";
    if (i === step) return "bg-sky text-white shadow-[0_0_0_4px_rgba(77,175,239,0.2)]";
    return "bg-[#F0F2F5] text-ink-3";
  };

  return (
    <>
      <div className="flex flex-shrink-0 items-center px-5 pt-[18px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${dotClass(
                i
              )}`}
            >
              {i}
            </div>
            {i < 3 && (
              <div
                className={`h-0.5 flex-1 transition-colors ${
                  i < step ? "bg-sky" : "bg-[#F0F2F5]"
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
            // L'ultima label ("Pagamento") non ha spazio a destra (il 3° pallino
            // è a filo bordo): centrarla in un box fisso da 30px la faceva
            // sporgere oltre il bordo dello schermo. Qui resta larghezza
            // naturale e ancorata a destra, cosi cresce verso sinistra invece
            // che tagliarsi contro il margine.
            className={`whitespace-nowrap text-[10px] font-medium ${
              i + 1 === step ? "font-bold text-sky" : "text-ink-3"
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
