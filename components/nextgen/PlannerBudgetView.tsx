"use client";

import { useState } from "react";
import { BudgetSummary } from "@/lib/nextgen/planner-insights";
import { setSeasonBudgetTargetAction } from "@/app/actions/profile";
import { useNextgenToast } from "@/components/nextgen/NextgenToastProvider";

// SPRINT 5.1 (NEXTGEN) — Planner, modalità Budget a schermo intero: budget
// pianificato (tetto impostabile dal genitore, NUOVO) vs speso reale (già
// esisteva come mini-card in Organizzazione), poi il dettaglio per figlio,
// per categoria e la media settimanale — richiesta esplicita del PRD
// "Family Planner". Interfaccia volutamente semplice/visuale, "evitando
// qualsiasi effetto foglio Excel" (richiesta di Fabrizio).
export default function PlannerBudgetView({
  budget,
  seasonBudgetTarget,
}: {
  budget: BudgetSummary;
  seasonBudgetTarget: number | null;
}) {
  const showToast = useNextgenToast();
  const [target, setTarget] = useState<number | null>(seasonBudgetTarget);
  const [editing, setEditing] = useState(seasonBudgetTarget === null);
  const [inputValue, setInputValue] = useState(seasonBudgetTarget?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percent = target && target > 0 ? Math.round((budget.totalSpent / target) * 100) : null;
  const overBudget = target !== null && budget.totalSpent > target;

  async function handleSave() {
    const amount = Number(inputValue.replace(",", "."));
    if (!inputValue.trim() || Number.isNaN(amount) || amount <= 0) {
      setError("Inserisci un importo valido per continuare");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await setSeasonBudgetTargetAction(amount);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setTarget(amount);
    setEditing(false);
    showToast("Budget stagionale salvato!");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pianificato vs speso */}
      <div className="nextgen-warm-shadow rounded-[20px] bg-white p-5">
        <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-3">Budget estate</div>

        {editing ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] text-ink-2">
              Quanto pensi di spendere in totale per questa estate? Ti aiuta a capire a colpo d&apos;occhio se sei in linea.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-ink-3">€</span>
              <input
                type="number"
                min={0}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Es. 1500"
                className="w-32 rounded-xl border border-[#E8EBF0] px-3 py-2 text-lg font-bold text-ink"
              />
            </div>
            {error && <div className="text-[12.5px] font-medium text-red-500">{error}</div>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleSave}
                className="rounded-full bg-trama-violet px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "Salvo…" : "Salva budget"}
              </button>
              {target !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setInputValue(target.toString());
                    setError(null);
                  }}
                  className="rounded-full bg-bg px-4 py-2 text-[13px] font-semibold text-ink-2"
                >
                  Annulla
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[28px] font-bold text-ink">€{target}</div>
                <div className="text-[11px] text-ink-3">Budget pianificato</div>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-bold text-ink">€{budget.totalSpent}</div>
                <div className="text-[11px] text-ink-3">Speso finora</div>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
              <div
                className={`h-full rounded-full transition-all ${overBudget ? "bg-trama-orange" : "bg-trama-violet"}`}
                style={{ width: `${Math.min(100, percent ?? 0)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11.5px]">
              <span className={overBudget ? "font-semibold text-trama-orange" : "text-ink-2"}>
                {overBudget ? `${percent}% — hai superato il budget` : `${percent}% utilizzato`}
              </span>
              <button type="button" onClick={() => setEditing(true)} className="font-semibold text-trama-violet">
                Modifica
              </button>
            </div>
          </>
        )}
      </div>

      {/* Costo medio settimanale */}
      <div className="rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-ink-2">Costo medio a settimana</span>
          <span className="text-base font-bold text-ink">€{budget.weeklyAverage}</span>
        </div>
        <p className="mt-1 text-[11px] text-ink-3">
          Calcolato sulle settimane in cui hai già organizzato almeno un&apos;attività.
        </p>
      </div>

      {/* Per figlio */}
      {budget.byKid.length > 0 && (
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-2.5 font-poppins text-[13px] font-bold text-ink">Per figlio</div>
          <div className="flex flex-col gap-2">
            {budget.byKid.map((k) => {
              const share = budget.totalSpent > 0 ? Math.round((k.amount / budget.totalSpent) * 100) : 0;
              return (
                <div key={k.kidId}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-2">{k.kidName}</span>
                    <span className="font-semibold text-ink">€{k.amount}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                    <div className="h-full rounded-full bg-[#A8EDE2]" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {budget.byKid.length > 1 && (
            <p className="mt-2.5 text-[10.5px] text-ink-3">
              Le attività condivise tra più figli sono conteggiate per intero su ciascuno.
            </p>
          )}
        </div>
      )}

      {/* Per categoria */}
      {budget.byCategory.length > 0 && (
        <div className="rounded-2xl bg-white p-4">
          <div className="mb-2.5 font-poppins text-[13px] font-bold text-ink">Per categoria</div>
          <div className="flex flex-col gap-2">
            {budget.byCategory.map((c) => {
              const share = budget.totalSpent > 0 ? Math.round((c.amount / budget.totalSpent) * 100) : 0;
              return (
                <div key={c.label}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="text-ink-2">{c.label}</span>
                    <span className="font-semibold text-ink">€{c.amount}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EEF0F4]">
                    <div className="h-full rounded-full bg-[#F0EEFF]" style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {budget.totalSpent === 0 && (
        <div className="rounded-2xl bg-bg p-5 text-center text-[13px] text-ink-2">
          Non hai ancora nessuna prenotazione attiva questa stagione.
        </div>
      )}
    </div>
  );
}
