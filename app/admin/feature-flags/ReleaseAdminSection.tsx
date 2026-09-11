"use client";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026), RIDISEGNATO
// l'11/09/2026 (RELEASE CONTROL HARDENING, richiesta Fabrizio dopo l'uso
// reale su Calendar Export).
//
// Cambi rispetto alla versione precedente:
// 1) I controlli di promozione sono ora PER FEATURE (una riga per feature
//    dentro la card Release), non più un unico set di bottoni per l'intera
//    release — §A3: "voglio poter controllare una singola feature senza
//    dover necessariamente promuovere l'intero bundle".
// 2) Ogni feature mostra l'intera scaletta reversibile ammessa dal suo
//    stato attuale (ladderButtonsForVisibility), non solo "il prossimo
//    passo" — §A2: "la UI semplificata deve diventare reversibile".
// 3) Una feature NON releaseEligible (placeholder/incompleta) non ha MAI
//    controlli di promozione — solo lo stato "○ Non ancora disponibile" in
//    sola lettura.
// 4) Bottone di comodo release-level "Promuovi tutte le funzionalità
//    pronte" — agisce SOLO sulle feature eligible, SOLO in avanti (mai una
//    retrocessione), mostrato solo se c'è almeno qualcosa da promuovere.
//
// Deliberatamente NESSUN concetto tecnico qui (scope_type/cohort_key non
// compaiono mai in questa sezione) — la UI tecnica completa resta invariata
// più sotto in questa stessa pagina (BatchBetaControls/FeatureCatalogSection).

import { useState } from "react";
import { ReleaseAdminEntry } from "@/lib/data/releases";
import type { ReleaseFeatureAdminRow } from "@/lib/data/releases";
import {
  RELEASE_VISIBILITY_LABEL,
  RELEASE_VISIBILITY_BADGE_CLASS,
  ladderButtonsForVisibility,
  ReleaseLadderButton,
  ReleaseLadderButtonKind,
} from "@/lib/releases/visibility";
import { setFeatureVisibilityAction, promoteAllEligibleReleaseFeaturesAction } from "@/app/actions/releases";

const TARGET_AUDIENCE_LABEL: Record<string, string> = {
  parent: "Famiglie",
  partner: "Gestori",
  admin: "Admin",
  cross_tenant: "Trasversale",
};

const BUTTON_KIND_CLASS: Record<ReleaseLadderButtonKind, string> = {
  primary: "rounded-md bg-trama-violet px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60",
  secondary: "rounded-md border border-[#E8EBF0] px-2.5 py-1 text-[11px] font-semibold text-ink disabled:opacity-60",
  tertiary: "rounded-md px-2.5 py-1 text-[11px] font-semibold text-[#C0392B] disabled:opacity-60",
};

function FeatureRow({ feature }: { feature: ReleaseFeatureAdminRow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [globalConfirmText, setGlobalConfirmText] = useState("");

  const buttons: ReleaseLadderButton[] = feature.releaseEligible && feature.flagName ? ladderButtonsForVisibility(feature.visibility) : [];

  async function handleClick(button: ReleaseLadderButton) {
    if (!feature.flagName) return;
    if (button.requiresGlobalConfirm) {
      setShowGlobalConfirm(true);
      return;
    }
    if (!window.confirm(`"${button.label}" per "${feature.label}"?`)) return;
    setError(null);
    setBusy(true);
    const res = await setFeatureVisibilityAction(feature.flagName, button.target);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    window.location.reload();
  }

  async function handleGlobalConfirm() {
    if (!feature.flagName) return;
    setError(null);
    if (globalConfirmText.trim().toUpperCase() !== "GLOBAL") {
      setError('Scrivi "GLOBAL" per confermare — questa azione rende la funzionalità visibile a TUTTI gli utenti.');
      return;
    }
    setBusy(true);
    const res = await setFeatureVisibilityAction(feature.flagName, "global", globalConfirmText);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setGlobalConfirmText("");
    setShowGlobalConfirm(false);
    window.location.reload();
  }

  return (
    <li className="border-b border-[#F0F2F5] py-2 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs text-ink">
          <span className={feature.releaseEligible ? "text-trama-violet" : "text-ink-3"}>{feature.releaseEligible ? "●" : "○"}</span>{" "}
          {feature.label}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            feature.releaseEligible ? RELEASE_VISIBILITY_BADGE_CLASS[feature.visibility] : "bg-[#F0F2F5] text-ink-3"
          }`}
        >
          {feature.releaseEligible ? RELEASE_VISIBILITY_LABEL[feature.visibility].toUpperCase() : "NON ANCORA DISPONIBILE"}
        </span>
      </div>

      {buttons.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {buttons.map((b) => (
            <button key={b.target} onClick={() => handleClick(b)} disabled={busy} className={BUTTON_KIND_CLASS[b.kind]}>
              {b.label}
            </button>
          ))}
        </div>
      )}

      {showGlobalConfirm && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-trama-violet/30 bg-bg p-2">
          <span className="text-[10px] text-ink">
            Rende <strong>{feature.label}</strong> visibile a TUTTI gli utenti. Scrivi <strong>&quot;GLOBAL&quot;</strong>:
          </span>
          <input
            value={globalConfirmText}
            onChange={(e) => setGlobalConfirmText(e.target.value)}
            placeholder='Scrivi "GLOBAL"'
            className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1 text-[11px]"
          />
          <button onClick={handleGlobalConfirm} disabled={busy} className={BUTTON_KIND_CLASS.primary}>
            Conferma
          </button>
          <button
            onClick={() => {
              setShowGlobalConfirm(false);
              setGlobalConfirmText("");
              setError(null);
            }}
            disabled={busy}
            className={BUTTON_KIND_CLASS.secondary}
          >
            Annulla
          </button>
        </div>
      )}

      {error && <div className="mt-1 text-[11px] text-[#C0392B]">{error}</div>}
    </li>
  );
}

function ReleaseCard({ release }: { release: ReleaseAdminEntry }) {
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Bottone di comodo mostrato SOLO se c'è davvero qualcosa da promuovere in
  // blocco (almeno una feature eligible ancora a DISATTIVATO) — evita
  // rumore quando non ha alcun effetto.
  const hasPromotable = release.features.some((f) => f.releaseEligible && f.visibility === "disabled");

  async function handlePromoteAllEligible() {
    if (!window.confirm(`Portare in Anteprima Interna tutte le funzionalità pronte di "${release.label}"?`)) return;
    setBulkError(null);
    setBulkBusy(true);
    const res = await promoteAllEligibleReleaseFeaturesAction(release.id);
    setBulkBusy(false);
    if (res.error) {
      setBulkError(res.error);
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
        <ul className="mt-1">
          {release.features.map((f) => (
            <FeatureRow key={f.key} feature={f} />
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

      {hasPromotable && (
        <div className="mt-3 border-t border-[#F0F2F5] pt-3">
          <button
            onClick={handlePromoteAllEligible}
            disabled={bulkBusy}
            className="rounded-md bg-sky px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Promuovi tutte le funzionalità pronte
          </button>
          <p className="mt-1 text-[10px] text-ink-3">
            Porta in Anteprima Interna solo le funzionalità realmente implementate e non ancora attivate — mai le
            placeholder, mai una funzionalità già più avanti nel ciclo di vita.
          </p>
          {bulkError && <div className="mt-1 text-[11px] text-[#C0392B]">{bulkError}</div>}
        </div>
      )}
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
          stesso stadio. Ogni funzionalità ha i propri controlli — promuoverne una non promuove automaticamente le
          altre della stessa release.
        </p>
      </div>
      {initialReleases.map((release) => (
        <ReleaseCard key={release.id} release={release} />
      ))}
    </div>
  );
}
