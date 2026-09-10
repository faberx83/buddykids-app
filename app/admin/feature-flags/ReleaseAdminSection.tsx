"use client";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026)
//
// Sezione "Release" — vista SEMPLIFICATA per Fabrizio: nome, descrizione,
// target, feature incluse, visibilità corrente, 3 azioni in linguaggio
// naturale. Deliberatamente NESSUN concetto tecnico qui (scope_type/
// cohort_key non compaiono mai in questa sezione) — la UI tecnica completa
// (override per override, con scope/coorte espliciti) resta invariata più
// sotto in questa stessa pagina (BatchBetaControls/FeatureCatalogSection/
// entries.map), per chi ne ha bisogno.
//
// Stesso pattern di stato/errore/reload di FeatureFlagsAdminClient.tsx
// (busyId/errorById, window.location.reload() dopo un'azione riuscita — la
// Server Action ha già fatto revalidatePath, il reload serve solo a
// mostrare subito il nuovo stato senza attendere una navigazione, stessa
// scelta già accettata lì per una pagina Admin a basso traffico).

import { useState } from "react";
import { ReleaseAdminEntry } from "@/lib/data/releases";
import { ReleaseVisibility, RELEASE_VISIBILITY_LABEL, RELEASE_VISIBILITY_BADGE_CLASS } from "@/lib/releases/visibility";
import {
  promoteReleaseToPilotAction,
  promoteReleaseToGlobalAction,
  demoteReleaseToInternalAction,
} from "@/app/actions/releases";

const TARGET_AUDIENCE_LABEL: Record<string, string> = {
  parent: "Famiglie",
  partner: "Gestori",
  admin: "Admin",
  cross_tenant: "Trasversale",
};

function canPromoteToPilot(visibility: ReleaseVisibility): boolean {
  return visibility !== "pilot" && visibility !== "global";
}
function canPromoteToGlobal(visibility: ReleaseVisibility): boolean {
  return visibility !== "global";
}
function canDemoteToInternal(visibility: ReleaseVisibility): boolean {
  return visibility === "pilot" || visibility === "global" || visibility === "mixed";
}

function ReleaseCard({ release }: { release: ReleaseAdminEntry }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalConfirmText, setGlobalConfirmText] = useState("");
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);

  async function handlePromoteToPilot() {
    if (!window.confirm(`Rendere "${release.label}" visibile alla coorte Pilot?`)) return;
    setError(null);
    setBusy(true);
    const res = await promoteReleaseToPilotAction(release.id);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    window.location.reload();
  }

  async function handlePromoteToGlobal() {
    setError(null);
    if (globalConfirmText.trim().toUpperCase() !== "GLOBAL") {
      setError('Scrivi "GLOBAL" nel campo di conferma per procedere — questa azione rende la funzionalità visibile a TUTTI gli utenti.');
      return;
    }
    setBusy(true);
    const res = await promoteReleaseToGlobalAction(release.id, globalConfirmText);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setGlobalConfirmText("");
    setShowGlobalConfirm(false);
    window.location.reload();
  }

  async function handleDemoteToInternal() {
    if (!window.confirm(`Riportare "${release.label}" a SOLO interno (kill switch)? Gli utenti Pilot/tutti smetteranno di vederla.`)) return;
    setError(null);
    setBusy(true);
    const res = await demoteReleaseToInternalAction(release.id);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div data-testid={`release-card-${release.id}`} className="mb-4 rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-ink">{release.label}</div>
          <p className="mt-0.5 text-xs text-ink-2">{release.shortDescription}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {release.targetAudience.map((a) => (
              <span key={a} className="rounded bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
                {TARGET_AUDIENCE_LABEL[a] ?? a}
              </span>
            ))}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${RELEASE_VISIBILITY_BADGE_CLASS[release.visibility]}`}>
          {RELEASE_VISIBILITY_LABEL[release.visibility]}
        </span>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-semibold text-ink-2">Funzionalità incluse</div>
        <ul className="mt-1 space-y-0.5">
          {release.features.map((f) => (
            <li key={f.key} className="text-xs text-ink">
              • {f.label}
            </li>
          ))}
        </ul>
        {release.unknownFeatureKeys.length > 0 && (
          <p className="mt-1 text-[11px] font-medium text-[#C0392B]">
            Chiavi non trovate nel Feature Catalog: {release.unknownFeatureKeys.join(", ")} — verificare lib/feature-registry/catalog.ts.
          </p>
        )}
      </div>

      {release.knownLimitations && release.knownLimitations.length > 0 && (
        <div className="mt-2 rounded-md bg-[#FFF7E6] px-3 py-2 text-[11px] text-[#9a6b00]">
          {release.knownLimitations.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      {release.notes && <p className="mt-2 text-[11px] italic text-ink-2">{release.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#F0F2F5] pt-3">
        {canPromoteToPilot(release.visibility) && (
          <button
            onClick={handlePromoteToPilot}
            disabled={busy}
            className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Abilita al Pilot
          </button>
        )}
        {canPromoteToGlobal(release.visibility) && !showGlobalConfirm && (
          <button
            onClick={() => setShowGlobalConfirm(true)}
            disabled={busy}
            className="rounded-md bg-trama-violet px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Rendi disponibile a tutti
          </button>
        )}
        {canDemoteToInternal(release.visibility) && (
          <button
            onClick={handleDemoteToInternal}
            disabled={busy}
            className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-bold text-[#C0392B] disabled:opacity-60"
          >
            Riporta a solo interno
          </button>
        )}
      </div>

      {showGlobalConfirm && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-trama-violet/30 bg-bg p-2.5">
          <span className="text-[11px] text-ink">
            Questa azione rende <strong>{release.label}</strong> visibile a TUTTI gli utenti. Scrivi{" "}
            <strong>&quot;GLOBAL&quot;</strong> per confermare:
          </span>
          <input
            value={globalConfirmText}
            onChange={(e) => setGlobalConfirmText(e.target.value)}
            placeholder='Scrivi "GLOBAL"'
            className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
          />
          <button
            onClick={handlePromoteToGlobal}
            disabled={busy}
            className="rounded-md bg-trama-violet px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Conferma
          </button>
          <button
            onClick={() => {
              setShowGlobalConfirm(false);
              setGlobalConfirmText("");
              setError(null);
            }}
            disabled={busy}
            className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink-2 disabled:opacity-60"
          >
            Annulla
          </button>
        </div>
      )}

      {error && <div className="mt-2 text-xs text-[#C0392B]">{error}</div>}
    </div>
  );
}

export default function ReleaseAdminSection({ initialReleases }: { initialReleases: ReleaseAdminEntry[] }) {
  if (initialReleases.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-bold text-ink">Release</div>
        <p className="mt-0.5 text-xs text-ink-2">
          Cosa contiene ciascuna release e chi la vede oggi — deriva sempre dagli override sotto, non è mai uno stato
          scritto a mano. &quot;Rilascio parziale&quot; significa che le funzionalità incluse non sono tutte allo
          stesso stadio.
        </p>
      </div>
      {initialReleases.map((release) => (
        <ReleaseCard key={release.id} release={release} />
      ))}
    </div>
  );
}
