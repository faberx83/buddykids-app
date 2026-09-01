import { TodayResponsibilityEntry } from "@/lib/data/responsibilities";
import { RESPONSIBLE_OPTIONS } from "@/lib/nextgen/responsibility-options";

// FEATURE (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — richiesta
// esplicita di Fabrizio: "reminder giornaliero in home tutti i giorni
// (Vado io, ritira nonna)"). Mostra SOLO quello che è già stato deciso
// (i vuoti sono già coperti separatamente dal Coordination Signal
// "responsibility_unassigned_today", priorità più alta in Home — vedi
// lib/data/coordination-signal.ts) — nessuna duplicazione tra i due.
function labelFor(entry: TodayResponsibilityEntry): string {
  if (entry.responsible === "altro") return entry.responsibleLabel?.trim() || "Altro";
  return RESPONSIBLE_OPTIONS.find((o) => o.value === entry.responsible)?.label ?? "";
}

function emojiFor(entry: TodayResponsibilityEntry): string {
  if (entry.responsible === "altro") return "✏️";
  return RESPONSIBLE_OPTIONS.find((o) => o.value === entry.responsible)?.emoji ?? "";
}

export default function TodayResponsibilityReminder({ items }: { items: TodayResponsibilityEntry[] }) {
  const byKid = new Map<string, { kidName: string; andata?: TodayResponsibilityEntry; ritorno?: TodayResponsibilityEntry }>();
  for (const item of items) {
    if (!item.responsible) continue; // i vuoti li segnala il Coordination Signal, non questo reminder
    const entry = byKid.get(item.kidId) ?? { kidName: item.kidName };
    entry[item.moment] = item;
    byKid.set(item.kidId, entry);
  }
  const rows = Array.from(byKid.values());
  if (rows.length === 0) return null;

  return (
    <div className="mt-2.5 rounded-xl border border-[#E8EBF0] bg-white px-3.5 py-2.5">
      {rows.map((row, i) => (
        <div
          key={row.kidName + i}
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2 ${i > 0 ? "mt-1.5" : ""}`}
        >
          {rows.length > 1 && <span className="font-semibold text-ink">{row.kidName}</span>}
          {/* Niente coniugazioni ("Vado io"/"Va nonna"...): con 6 possibili
              responsabili la coniugazione corretta cambierebbe caso per
              caso — "Andata/Ritorno: [chi]" resta chiaro e inequivocabile
              per chiunque. */}
          {row.andata && (
            <span>
              {emojiFor(row.andata)} Andata: <b className="font-semibold text-ink">{labelFor(row.andata)}</b>
            </span>
          )}
          {row.ritorno && (
            <span>
              {emojiFor(row.ritorno)} Ritorno: <b className="font-semibold text-ink">{labelFor(row.ritorno)}</b>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
