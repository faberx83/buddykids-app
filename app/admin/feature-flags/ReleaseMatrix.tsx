"use client";

// TRAMA — RELEASE: TABELLA (14/10/2026, richiesta Fabrizio: "una tabella con
// le feature per riga e in colonna le spunte su cosa è abilitato e dove").
// Una riga per funzionalità, raggruppate per release (le più recenti in
// alto); tre colonne cumulative Anteprima interna / Pilot / Tutti. Un click
// sulla casella cambia lo stato con la STESSA azione delle card
// (setFeatureVisibilityAction) e le stesse regole: conferma esplicita,
// "GLOBAL" scritto a mano per "Tutti", nessun controllo sulle funzionalità
// non pronte (releaseEligible false) o senza flag.
// Le card per release restano sotto (limiti noti, note, "Promuovi tutte").

import { useState } from "react";
import type { ReleaseAdminEntry, ReleaseFeatureAdminRow } from "@/lib/data/releases";
import {
  RELEASE_MATRIX_COLUMNS,
  RELEASE_VISIBILITY_BADGE_CLASS,
  RELEASE_VISIBILITY_LABEL,
  ReleaseMatrixColumn,
  isVisibleInColumn,
  matrixClickConfirmText,
  matrixClickTarget,
} from "@/lib/releases/visibility";
import { setFeatureVisibilityAction } from "@/app/actions/releases";

function MatrixRow({ feature }: { feature: ReleaseFeatureAdminRow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = Boolean(feature.releaseEligible && feature.flagName);

  async function handleCell(column: ReleaseMatrixColumn) {
    if (!editable || !feature.flagName) return;
    const target = matrixClickTarget(feature.visibility, column);
    let confirmText: string | undefined;
    if (target === "global") {
      const typed = window.prompt(`Rende "${feature.label}" visibile a TUTTI gli utenti. Scrivi GLOBAL per confermare:`);
      if (typed === null) return;
      confirmText = typed;
    } else if (!window.confirm(matrixClickConfirmText(feature.label, feature.visibility, target))) {
      return;
    }
    setError(null);
    setBusy(true);
    const res = await setFeatureVisibilityAction(feature.flagName, target, confirmText);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    window.location.reload();
  }

  const note = !feature.flagName ? "sempre attiva" : !feature.releaseEligible ? "non ancora disponibile" : null;

  return (
    <tr data-testid={`release-matrix-row-${feature.key}`} className="border-t border-[#F0F2F5]">
      <td className="py-2 pr-2 align-middle">
        <span className={`block text-xs leading-snug ${editable ? "text-ink" : "text-ink-3"}`}>{feature.label}</span>
        {note && <span className="block text-[10px] text-ink-3">{note}</span>}
        {error && <span className="block text-[10px] text-[#C0392B]">{error}</span>}
      </td>
      {RELEASE_MATRIX_COLUMNS.map((col) => {
        const on = isVisibleInColumn(feature.visibility, col.key);
        return (
          <td key={col.key} className="w-14 py-2 text-center sm:w-[72px] align-middle">
            <button
              type="button"
              onClick={() => handleCell(col.key)}
              disabled={!editable || busy}
              aria-pressed={on}
              aria-label={`${feature.label} — ${col.label}: ${on ? "attiva" : "spenta"}`}
              title={editable ? (on ? `Togli da ${col.label}` : `Accendi fino a ${col.label}`) : undefined}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors disabled:cursor-default ${
                on
                  ? editable
                    ? "bg-[#2DBA8C] text-white"
                    : "bg-[#CDEFE2] text-[#146B4F]"
                  : editable
                    ? "border-2 border-[#D5D9E0] bg-white text-transparent hover:border-trama-violet"
                    : "border border-dashed border-[#E3E6EC] bg-white text-transparent"
              } ${busy ? "opacity-50" : ""}`}
            >
              ✓
            </button>
          </td>
        );
      })}
    </tr>
  );
}

export default function ReleaseMatrix({ releases }: { releases: ReleaseAdminEntry[] }) {
  const ordered = [...releases].reverse();
  return (
    <div data-testid="release-matrix" className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="pb-2 text-left text-[11px] font-semibold text-ink-2">Funzionalità</th>
            {RELEASE_MATRIX_COLUMNS.map((col) => (
              <th key={col.key} className="w-14 pb-2 text-center text-[10.5px] sm:w-[72px] sm:text-[11px] font-semibold leading-tight text-ink-2">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        {ordered.map((release) => (
          <tbody key={release.id}>
            <tr className="bg-bg">
              <td colSpan={1 + RELEASE_MATRIX_COLUMNS.length} className="rounded-md px-2 py-1.5">
                <span className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-ink">{release.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${RELEASE_VISIBILITY_BADGE_CLASS[release.visibility]}`}>
                    {RELEASE_VISIBILITY_LABEL[release.visibility]}
                  </span>
                </span>
              </td>
            </tr>
            {release.features.map((f) => (
              <MatrixRow key={f.key} feature={f} />
            ))}
          </tbody>
        ))}
      </table>
      <p className="mt-2 text-[10px] text-ink-3">
        Le spunte sono cumulative: Pilot include l&apos;Anteprima interna, Tutti include tutto. Casella vuota = accendi
        fino a lì; casella spuntata = togli da lì in poi. &quot;Tutti&quot; chiede di scrivere GLOBAL.
      </p>
    </div>
  );
}
