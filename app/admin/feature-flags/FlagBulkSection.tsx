"use client";

// TRAMA — Feature flag: vista Per area / Per release e azioni in blocco
// (13/11/2026). Richiesta di Fabrizio: "Mi piace com'è oggi: conserva la
// matrice Anteprima interna / Pilot / Tutti, le release e i controlli
// singoli. Aggiungi organizzazione e operazioni in blocco nella stessa
// pagina." Iniziativa: claude/INIZIATIVA_flag_aree_blocco.md (Project).
//
// Sezione aggiuntiva: la matrice Release, le card Release e le schede
// override restano identiche. Qui solo lettura raggruppata, selezione e il
// flusso seleziona → pubblico → azione → anteprima → conferma.
// "Tutti" non è un pubblico disponibile in blocco (resta sui controlli singoli).

import { useMemo, useState } from "react";
import type { FeatureFlagAdminEntry } from "@/lib/data/feature-flag-overrides";
import type { ReleaseAdminEntry } from "@/lib/data/releases";
import { groupByArea, groupByRelease, matchesFlagSearch, type FlagGroup } from "@/lib/flag-admin/areas";
import { toBulkInputs, type BulkFlagView } from "@/lib/flag-admin/inputs";
import {
  AUDIENCE_COLUMNS,
  AUDIENCE_SUMMARY_LABEL,
  BULK_ACTIONS,
  BULK_AUDIENCES,
  effectiveAll,
  summarizeGroup,
  type AudienceColumn,
  type BulkAction,
  type BulkAudience,
  type BulkFlagStatus,
  type BulkPreview,
  type EffectiveState,
} from "@/lib/flag-admin/bulk";
import { applyFlagBulkAction, previewFlagBulkAction, type FlagBulkApplyResult, type FlagBulkHistoryRow } from "@/app/actions/flag-bulk";

type View = "area" | "release";

const SUMMARY_CLASS = {
  all_on: "bg-green-light text-[#2d8f52]",
  all_off: "bg-[#F0F2F5] text-ink-2",
  mixed: "bg-[#FFF7E6] text-[#9a6b00]",
} as const;

const STATUS_BADGE: Record<BulkFlagStatus, { label: string; cls: string }> = {
  change: { label: "Cambia", cls: "bg-sky-light text-sky" },
  noop: { label: "Nessun cambio", cls: "bg-[#F0F2F5] text-ink-2" },
  blocked: { label: "Bloccata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
  excluded: { label: "Esclusa", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

function StateDot({ s, title }: { s: EffectiveState; title: string }) {
  return (
    <span
      title={`${title}: ${s.on ? "attiva" : "spenta"}${s.source === "default" ? " (default)" : s.source === "global" ? " (da Tutti)" : ""}`}
      className={`inline-block h-2.5 w-2.5 rounded-full ${s.on ? "bg-[#2d8f52]" : "bg-[#D5DAE1]"}`}
    />
  );
}

function stateText(s: EffectiveState): string {
  return `${s.on ? "attiva" : "spenta"}${s.source === "default" ? " · default" : s.source === "global" ? " · da Tutti" : ""}`;
}

export default function FlagBulkSection({
  entries,
  releases,
  history,
}: {
  entries: FeatureFlagAdminEntry[];
  releases: ReleaseAdminEntry[];
  history: FlagBulkHistoryRow[];
}) {
  const now = useMemo(() => new Date(), []);
  const flags = useMemo(() => toBulkInputs(entries), [entries]);
  const [view, setView] = useState<View>("area");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [audience, setAudience] = useState<BulkAudience | null>(null);
  const [action, setAction] = useState<BulkAction | null>(null);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [staleNotice, setStaleNotice] = useState(false);
  const [result, setResult] = useState<FlagBulkApplyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => flags.filter((f) => matchesFlagSearch(f, query)), [flags, query]);
  const groups: FlagGroup<BulkFlagView>[] = useMemo(() => {
    if (view === "area") return groupByArea(visible);
    const src = [...releases].reverse().map((r) => ({
      id: r.id,
      label: r.label,
      flagNames: r.features.map((f) => f.flagName).filter((n): n is string => Boolean(n)),
    }));
    return groupByRelease(visible, src);
  }, [view, visible, releases]);

  function resetFlow() {
    setPreview(null);
    setStaleNotice(false);
    setResult(null);
    setError(null);
  }

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
    resetFlow();
  }

  function selectGroup(items: BulkFlagView[], on: boolean) {
    const next = new Set(selected);
    for (const i of items) {
      if (on) next.add(i.flagName);
      else next.delete(i.flagName);
    }
    setSelected(next);
    resetFlow();
  }

  async function askPreview() {
    if (!audience || !action || selected.size === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setStaleNotice(false);
    const res = await previewFlagBulkAction(Array.from(selected), audience, action);
    setBusy(false);
    if (res.error) setError(res.error);
    else setPreview(res.preview ?? null);
  }

  async function confirm() {
    if (!preview || !audience || !action) return;
    setBusy(true);
    setError(null);
    const res = await applyFlagBulkAction(Array.from(selected), audience, action, preview.fingerprint);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.stale) {
      // Lo stato è cambiato: mostro la nuova anteprima, serve una nuova conferma.
      setPreview(res.preview ?? null);
      setStaleNotice(true);
      return;
    }
    setResult(res);
  }

  const canPreview = selected.size > 0 && audience !== null && action !== null && !busy;

  return (
    <section data-testid="flag-bulk-section" className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EBF0] px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-ink">Organizza e agisci in blocco</h2>
          <p className="text-xs text-ink-2">
            Raggruppa i flag, selezionali e applica un&apos;azione solo ad Anteprima interna o Pilot. &quot;Tutti&quot; resta sui controlli singoli.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-bg p-1 text-xs font-semibold" role="tablist">
          {(["area", "release"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              data-testid={`flag-view-${v}`}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 ${view === v ? "bg-white text-ink shadow-sm" : "text-ink-2"}`}
            >
              {v === "area" ? "Per area" : "Per release"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome, funzione o descrizione"
          data-testid="flag-bulk-search"
          className="mb-3 w-full rounded-md border border-[#E8EBF0] px-3 py-1.5 text-sm"
        />

        {groups.length === 0 && <p className="text-xs text-ink-2">Nessun flag corrisponde alla ricerca.</p>}

        {groups.map((g) => {
          const summary = summarizeGroup(g.items, now);
          const allSelected = g.items.every((i) => selected.has(i.flagName));
          return (
            <details key={g.key} data-testid={`flag-group-${g.key}`} className="mb-2 rounded-md border border-[#E8EBF0]">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <span className="font-bold text-ink">{g.label}</span>
                <span className="text-xs text-ink-2">{g.items.length} flag</span>
                <span className="ml-auto flex flex-wrap gap-1">
                  {AUDIENCE_COLUMNS.map((c) => {
                    const s = summary[c.key];
                    return (
                      <span key={c.key} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUMMARY_CLASS[s.state]}`}>
                        {c.label}: {AUDIENCE_SUMMARY_LABEL[s.state]}
                        {s.state === "mixed" ? ` ${s.on}/${s.total}` : ""}
                      </span>
                    );
                  })}
                </span>
              </summary>
              <div className="border-t border-[#E8EBF0] px-3 py-2">
                {g.hint && <p className="mb-2 text-[11px] text-ink-2">{g.hint}</p>}
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => selectGroup(g.items, e.target.checked)}
                    data-testid={`flag-group-select-${g.key}`}
                  />
                  Seleziona tutte le visibili ({g.items.length})
                </label>
                <ul className="divide-y divide-[#F0F2F5]">
                  {g.items.map((f) => {
                    const eff = effectiveAll(f.defaultValue, f.overrides, now);
                    return (
                      <li key={f.flagName} className="flex flex-wrap items-center gap-2 py-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={selected.has(f.flagName)}
                          onChange={() => toggle(f.flagName)}
                          data-testid={`flag-select-${f.flagName}`}
                          aria-label={`Seleziona ${f.flagName}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-ink">{f.label}</span>{" "}
                          <span className="font-mono text-[10px] text-ink-2">{f.flagName}</span>
                          {!f.releaseEligible && <span className="ml-1 text-[10px] text-[#C0392B]">fuori dalle release</span>}
                        </span>
                        <span className="flex items-center gap-1.5" aria-label="Stato per pubblico">
                          {AUDIENCE_COLUMNS.map((c) => (
                            <StateDot key={c.key} s={eff[c.key]} title={c.label} />
                          ))}
                        </span>
                        <a href={`#flag-${f.flagName}`} className="text-[11px] font-semibold text-sky">
                          override ↓
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}
        <p className="mt-1 text-[10px] text-ink-2">Pallini: Anteprima interna · Pilot · Tutti (verde = attiva).</p>
      </div>

      <div data-testid="flag-bulk-bar" className="border-t border-[#E8EBF0] bg-bg px-4 py-3 text-xs">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span data-testid="flag-bulk-count" className="font-bold text-ink">
            {selected.size} {selected.size === 1 ? "flag selezionato" : "flag selezionati"}
          </span>
          {selected.size > 0 && (
            <button type="button" className="text-[11px] font-semibold text-sky" onClick={() => { setSelected(new Set()); resetFlow(); }}>
              Svuota selezione
            </button>
          )}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">Pubblico:</span>
          {BULK_AUDIENCES.map((a) => (
            <label key={a.key} className="flex items-center gap-1">
              <input
                type="radio"
                name="flag-bulk-audience"
                checked={audience === a.key}
                onChange={() => { setAudience(a.key); resetFlow(); }}
                data-testid={`flag-bulk-audience-${a.key}`}
              />
              {a.label}
            </label>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">Azione:</span>
          {BULK_ACTIONS.map((a) => (
            <label key={a.key} className="flex items-center gap-1" title={a.hint}>
              <input
                type="radio"
                name="flag-bulk-action"
                checked={action === a.key}
                onChange={() => { setAction(a.key); resetFlow(); }}
                data-testid={`flag-bulk-action-${a.key}`}
              />
              {a.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={!canPreview}
          onClick={askPreview}
          data-testid="flag-bulk-preview"
          className="rounded-md bg-sky px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy && !preview ? "Calcolo…" : "Mostra anteprima"}
        </button>
        {error && <p className="mt-2 text-[#C0392B]">{error}</p>}
      </div>

      {preview && !result && (
        <div data-testid="flag-bulk-preview-panel" className="border-t border-[#E8EBF0] px-4 py-3 text-xs">
          {staleNotice && (
            <p data-testid="flag-bulk-stale" className="mb-2 rounded-md bg-[#FFF7E6] px-3 py-2 font-semibold text-[#9a6b00]">
              Lo stato dei flag è cambiato dopo l&apos;anteprima: niente è stato scritto. Rivedi l&apos;anteprima aggiornata qui sotto e conferma di nuovo.
            </p>
          )}
          <p className="mb-2 font-semibold text-ink">
            Anteprima per {BULK_AUDIENCES.find((a) => a.key === preview.audience)?.label} — {BULK_ACTIONS.find((a) => a.key === preview.action)?.label}:{" "}
            {preview.counts.change} cambiano, {preview.counts.noop} già così, {preview.counts.blocked} bloccate, {preview.counts.excluded} escluse.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-ink-2">
                  <th className="py-1 pr-2">Flag</th>
                  <th className="py-1 pr-2">Esito</th>
                  {AUDIENCE_COLUMNS.map((c) => (
                    <th key={c.key} className="py-1 pr-2">{c.label} prima → dopo</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.flags.map((p) => (
                  <tr key={p.flagName} data-testid={`flag-bulk-row-${p.flagName}`} className="border-t border-[#F0F2F5] align-top">
                    <td className="py-1.5 pr-2">
                      <div className="font-semibold text-ink">{p.label}</div>
                      <div className="font-mono text-[10px] text-ink-2">{p.flagName}</div>
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[p.status].cls}`}>{STATUS_BADGE[p.status].label}</span>
                      <div className="mt-1 text-ink">{p.outcome}</div>
                      {[p.reason, ...p.expiries, ...p.conflicts, ...p.dependencies].filter(Boolean).map((n, i) => (
                        <div key={i} className="mt-0.5 text-[11px] text-ink-2">• {n}</div>
                      ))}
                    </td>
                    {AUDIENCE_COLUMNS.map((c) => {
                      const changed = p.before[c.key as AudienceColumn].on !== p.after[c.key as AudienceColumn].on;
                      return (
                        <td key={c.key} className={`py-1.5 pr-2 ${changed ? "font-bold text-ink" : "text-ink-2"}`}>
                          {stateText(p.before[c.key as AudienceColumn])} → {stateText(p.after[c.key as AudienceColumn])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || preview.counts.change === 0}
              onClick={confirm}
              data-testid="flag-bulk-confirm"
              className="rounded-md bg-trama-violet px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? "Applico…" : `Conferma ${preview.counts.change} ${preview.counts.change === 1 ? "modifica" : "modifiche"}`}
            </button>
            <button type="button" onClick={resetFlow} className="text-[11px] font-semibold text-ink-2">
              Annulla
            </button>
            {preview.counts.change === 0 && <span className="text-ink-2">Niente da scrivere: nessun flag cambia.</span>}
          </div>
        </div>
      )}

      {result && (
        <div data-testid="flag-bulk-result" className="border-t border-[#E8EBF0] px-4 py-3 text-xs">
          <p className={`mb-2 font-semibold ${result.complete ? "text-[#2d8f52]" : "text-[#C0392B]"}`}>
            {result.complete
              ? `Fatto: ${result.outcomes?.length ?? 0} ${result.outcomes?.length === 1 ? "modifica applicata" : "modifiche applicate"}.`
              : "Operazione non completata: nessuna modifica parziale lasciata senza dirlo, vedi esito per flag."}
            {result.historyLogged === false && (result.outcomes?.length ?? 0) > 0 ? " Attenzione: non è stato possibile registrarla nello storico." : ""}
          </p>
          <ul>
            {(result.outcomes ?? []).map((o, i) => (
              <li key={i}>
                {o.ok ? "✓" : "✗"} {o.flagName}
                {o.error ? ` — ${o.error}` : ""}
                {o.rolledBack ? " (riportata com'era)" : ""}
              </li>
            ))}
          </ul>
          {(result.recovery ?? []).length > 0 && (
            <div className="mt-2 rounded-md bg-[#FBEAEA] px-3 py-2 text-[#C0392B]">
              <p className="font-semibold">Da sistemare a mano:</p>
              {(result.recovery ?? []).map((r, i) => (
                <p key={i}>• {r}</p>
              ))}
            </div>
          )}
          <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded-md border border-[#E8EBF0] px-3 py-1 font-semibold text-ink">
            Ricarica la pagina
          </button>
        </div>
      )}

      <details className="border-t border-[#E8EBF0] px-4 py-2 text-xs" data-testid="flag-bulk-history">
        <summary className="cursor-pointer font-semibold text-ink">Storico operazioni in blocco ({history.length})</summary>
        {history.length === 0 ? (
          <p className="py-1 text-ink-2">Nessuna operazione registrata.</p>
        ) : (
          <ul className="py-1">
            {history.map((h, i) => (
              <li key={i} className="py-0.5">
                <span className="text-ink-2">{new Date(h.createdAt).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}</span>{" "}
                {h.complete ? "✓" : "✗"} {BULK_AUDIENCES.find((a) => a.key === h.audience)?.label ?? h.audience} ·{" "}
                {BULK_ACTIONS.find((a) => a.key === h.bulkAction)?.label ?? h.bulkAction} ·{" "}
                {h.flags.filter((f) => f.status === "change").map((f) => f.flag).join(", ") || "nessun cambio"}
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
