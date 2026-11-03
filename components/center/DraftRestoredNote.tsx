// UX-PARTNER-007: riga che dice che una bozza è stata ripresa, con "Scarta" esplicito.
export default function DraftRestoredNote({ onDiscard, legacy = false }: { onDiscard: () => void; legacy?: boolean }) {
  return (
    <div
      role="status"
      data-testid="draft-restored"
      className={`flex flex-wrap items-center gap-2 px-4 py-3 text-[13.5px] ${
        legacy ? "mb-4 rounded-lg border border-[#E8EBF0] bg-white text-ink" : "rounded-2xl bg-[#FBF1DA] text-ink"
      }`}
    >
      <span className="flex-1">Abbiamo ripreso quello che avevate scritto e non era ancora salvato.</span>
      <button type="button" onClick={onDiscard} className="min-h-[36px] rounded-full px-3 font-semibold text-[#8A6410] underline">
        Scarta e ricomincia
      </button>
    </div>
  );
}
