import { TodayResponsibilityEntry } from "@/lib/data/responsibilities";
import { resolveResponsibleDisplay } from "@/lib/nextgen/responsibility-options";
// "import type": stesso motivo di ParentRole altrove in questo modulo
// client-safe — nessun import server-only nel bundle client.
import type { ParentRole } from "@/lib/data/profile";

// FEATURE (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — richiesta
// esplicita di Fabrizio: "reminder giornaliero in home tutti i giorni
// (Vado io, ritira nonna)"). Mostra SOLO quello che è già stato deciso
// (i vuoti sono già coperti separatamente dal Coordination Signal
// "responsibility_unassigned_today", priorità più alta in Home — vedi
// lib/data/coordination-signal.ts) — nessuna duplicazione tra i due.
//
// TRAMA BETA v1.1.1 — FINAL GAP CLOSURE (punto 8 — "non duplicare la
// funzione di mapping: riusa/estrai helper condiviso"). labelFor/emojiFor
// (due implementazioni ad-hoc, non contestuali al parent_role) sono state
// sostituite da resolveResponsibleDisplay, la STESSA funzione ora usata dal
// selettore "Chi fa cosa?" del Planner (PlannerCalendarView usa
// resolveResponsibleOptions, che condivide la stessa risoluzione
// Mamma/Papà/Partner) — "Partner" qui diventa "Mamma"/"Papà" quando
// parent_role è noto, esattamente come nel Planner. Per le persone custom
// (responsible="altro") il nome mostrato resta quello reale
// (responsible_label, già denormalizzato al salvataggio con il
// display_name della persona — vedi app/actions/responsibilities.ts): nessun
// cambiamento necessario per mostrare correttamente "Zio Marco" qui.
export default function TodayResponsibilityReminder({
  items,
  parentRole,
}: {
  items: TodayResponsibilityEntry[];
  parentRole: ParentRole | null;
}) {
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
          {row.andata &&
            (() => {
              const d = resolveResponsibleDisplay(row.andata, parentRole);
              return (
                <span>
                  {d.emoji} Andata: <b className="font-semibold text-ink">{d.label}</b>
                </span>
              );
            })()}
          {row.ritorno &&
            (() => {
              const d = resolveResponsibleDisplay(row.ritorno, parentRole);
              return (
                <span>
                  {d.emoji} Ritorno: <b className="font-semibold text-ink">{d.label}</b>
                </span>
              );
            })()}
        </div>
      ))}
    </div>
  );
}
