"use client";

import { useState } from "react";
import { FeatureFlagAdminEntry, FeatureFlagOverrideRow, FeatureFlagOverrideStatus } from "@/lib/data/feature-flag-overrides";
import {
  createFeatureFlagOverrideAction,
  deleteFeatureFlagOverrideAction,
  extendFeatureFlagOverrideAction,
  updateFeatureFlagOverrideAction,
} from "@/app/actions/feature-flag-overrides";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getFeatureCatalog, FeatureStatus, FeatureCatalogEntry } from "@/lib/feature-registry/catalog";

// TRAMA ONE Build Sprint 6 (backlog vincolante P1, "Feature flag override
// expiry") — visibilità e gestione Admin degli override. Prima di questa
// pagina l'unico modo di vedere/gestire un override era una query SQL
// manuale — esattamente come TC-N409 (Gate C, ottava ondata) è nato: un
// override scaduto senza che nessuno se ne accorgesse. Pattern UI riusato da
// app/admin/center-leads/CenterLeadsAdminClient.tsx (stesso stile di
// sezioni/badge/pulsanti).

const STATUS_LABEL: Record<FeatureFlagOverrideStatus, { label: string; cls: string }> = {
  active: { label: "Attivo", cls: "bg-green-light text-[#2d8f52]" },
  expiring_soon: { label: "In scadenza (<72h)", cls: "bg-orange-light text-trama-orange" },
  expired: { label: "Scaduto", cls: "bg-[#FBEAEA] text-[#C0392B]" },
  no_expiry: { label: "Senza scadenza", cls: "bg-[#F0F2F5] text-ink-2" },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

// TRAMA ONE — Sezione 4 (Admin Feature Control Center). Estende questa
// pagina, già dotata di CRUD/RBAC/audit per gli override, con una vista
// SOLA LETTURA sul Feature Registry canonico (Sezione 5,
// lib/feature-registry/catalog.ts): "cosa esiste, dove vive, in che stato
// è" per OGNI funzionalità rilevante — non solo quelle dietro un flag
// risolvibile. Nessuna azione qui modifica il catalogo: è descrittivo,
// popolato leggendo il codice reale (vedi FEATURE_INVENTORY_COMPLETE.md).
const CATALOG_STATUS_LABEL: Record<FeatureStatus, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-green-light text-[#2d8f52]" },
  beta_gated: { label: "Beta gated", cls: "bg-sky-light text-sky" },
  coming_soon: { label: "In arrivo", cls: "bg-yellow-light text-[#9a6b00]" },
  hidden_no_nav: { label: "Nascosta (no nav)", cls: "bg-[#F0F2F5] text-ink-2" },
  mock_fallback: { label: "Mock/demo fallback", cls: "bg-orange-light text-trama-orange" },
};

const CATALOG_AREA_LABEL: Record<string, string> = {
  parent: "Genitore",
  partner: "Gestore",
  admin: "Admin",
  cross_tenant: "Cross-tenant",
};

function FeatureCatalogSection() {
  const catalog = getFeatureCatalog();
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const areas = ["all", "parent", "partner", "admin", "cross_tenant"];
  const visible = areaFilter === "all" ? catalog : catalog.filter((e) => e.area === areaFilter);
  const statusOrder: FeatureStatus[] = ["live", "beta_gated", "mock_fallback", "coming_soon", "hidden_no_nav"];

  return (
    <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white">
      <div className="border-b border-[#E8EBF0] px-4 py-3">
        <div className="text-sm font-bold text-ink">Catalogo funzionalità (sola lettura)</div>
        <p className="mt-0.5 text-xs text-ink-2">
          Registro canonico di ogni funzionalità rilevante — gated da flag o no — con lo stato reale
          verificato leggendo il codice. Descrittivo: nessuna azione qui attiva o disattiva nulla (per
          quello, usa gli override sopra o sotto).
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
                areaFilter === a ? "border-sky bg-sky-light text-sky" : "border-[#E8EBF0] text-ink-2"
              }`}
            >
              {a === "all" ? "Tutte le aree" : CATALOG_AREA_LABEL[a] ?? a}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-[#F0F2F5]">
        {statusOrder.map((status) => {
          const rows = visible.filter((e) => e.status === status);
          if (rows.length === 0) return null;
          return (
            <div key={status} className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${CATALOG_STATUS_LABEL[status].cls}`}>
                  {CATALOG_STATUS_LABEL[status].label}
                </span>
                <span className="text-[11px] text-ink-2">{rows.length} funzionalità</span>
              </div>
              <div className="space-y-2">
                {rows.map((entry: FeatureCatalogEntry) => (
                  <div key={entry.key} className="rounded-md bg-bg px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{entry.label}</span>
                      <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-ink-2">
                        {CATALOG_AREA_LABEL[entry.area] ?? entry.area}
                      </span>
                      {entry.flagName && (
                        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-ink-2">
                          flag: {entry.flagName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-2">{entry.description}</p>
                    <p className="mt-0.5 text-[10px] text-ink-3">{entry.sourceFiles.join(" · ")}</p>
                    {entry.note && (
                      <p className="mt-1 text-[11px] font-medium text-trama-orange">{entry.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="px-4 py-4 text-center text-sm text-ink-2">Nessuna voce per quest&apos;area.</p>
        )}
      </div>
    </div>
  );
}

export default function FeatureFlagsAdminClient({ initialEntries }: { initialEntries: FeatureFlagAdminEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [newOverrideDraft, setNewOverrideDraft] = useState<
    Record<string, { scopeType: string; scopeValue: string; enabled: boolean; expiresAt: string }>
  >({});

  function patchOverride(flagName: string, id: string, patch: Partial<FeatureFlagOverrideRow>) {
    setEntries((prev) =>
      prev.map((e) =>
        e.flagName !== flagName
          ? e
          : {
              ...e,
              overrides: e.overrides.map((o) => (o.id === id ? { ...o, ...patch } : o)),
              hasAlert: e.overrides
                .map((o) => (o.id === id ? { ...o, ...patch } : o))
                .some((o) => o.enabled && (o.status === "expiring_soon" || o.status === "expired")),
            }
      )
    );
  }

  function removeOverride(flagName: string, id: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.flagName !== flagName
          ? e
          : {
              ...e,
              overrides: e.overrides.filter((o) => o.id !== id),
              hasAlert: e.overrides.filter((o) => o.id !== id).some((o) => o.enabled && (o.status === "expiring_soon" || o.status === "expired")),
            }
      )
    );
  }

  async function extend(flagName: string, id: string, hours: number) {
    setBusyId(id);
    const res = await extendFeatureFlagOverrideAction(id, hours);
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [id]: res.error! }));
      return;
    }
    const newExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    patchOverride(flagName, id, { expiresAt: newExpiresAt, status: "active" });
  }

  async function toggleEnabled(flagName: string, row: FeatureFlagOverrideRow) {
    setBusyId(row.id);
    const res = await updateFeatureFlagOverrideAction({ id: row.id, enabled: !row.enabled, expiresAt: row.expiresAt });
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [row.id]: res.error! }));
      return;
    }
    patchOverride(flagName, row.id, { enabled: !row.enabled });
  }

  async function clearExpiry(flagName: string, row: FeatureFlagOverrideRow) {
    setBusyId(row.id);
    const res = await updateFeatureFlagOverrideAction({ id: row.id, enabled: row.enabled, expiresAt: null });
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [row.id]: res.error! }));
      return;
    }
    patchOverride(flagName, row.id, { expiresAt: null, status: "no_expiry" });
  }

  async function remove(flagName: string, id: string) {
    setBusyId(id);
    const res = await deleteFeatureFlagOverrideAction(id);
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [id]: res.error! }));
      return;
    }
    removeOverride(flagName, id);
  }

  async function createOverride(flagName: string) {
    const draft = newOverrideDraft[flagName] ?? { scopeType: "global", scopeValue: "", enabled: true, expiresAt: "" };
    setBusyId(`new-${flagName}`);
    const res = await createFeatureFlagOverrideAction({
      flagName,
      scopeType: draft.scopeType,
      scopeValue: draft.scopeType === "global" ? null : draft.scopeValue,
      enabled: draft.enabled,
      expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
    });
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [`new-${flagName}`]: res.error! }));
      return;
    }
    setNewOverrideDraft((prev) => ({ ...prev, [flagName]: { scopeType: "global", scopeValue: "", enabled: true, expiresAt: "" } }));
    // Ricarica semplice: la Server Action ha già fatto revalidatePath, ma per
    // vedere subito la nuova riga senza attendere un refresh di navigazione
    // ricarichiamo la pagina — pattern accettabile per una pagina Admin a
    // basso traffico, coerente con l'assenza di altri meccanismi di realtime
    // nel repository.
    window.location.reload();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Feature flag — Override</h1>
        <p className="text-sm text-navy-text2">
          Registry versionato nel codice (lib/feature-flags/registry.ts); gli override runtime persistiti
          qui sotto restano l&apos;unico modo di attivare un flag per ambiente/utente/ruolo/tenant/coorte.
          Un override <strong>scaduto</strong> torna silenziosamente al default sicuro (mai un errore
          visibile) — è esattamente così che TC-N409 si è manifestato: un override dimenticato è scaduto
          senza che nessuno se ne accorgesse. I badge sotto rendono visibile questo caso PRIMA che diventi
          un incidente.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai gli override reali una volta collegato.
        </div>
      )}

      <FeatureCatalogSection />

      {entries.map((entry) => {
        const draft = newOverrideDraft[entry.flagName] ?? { scopeType: "global", scopeValue: "", enabled: true, expiresAt: "" };
        return (
          <div key={entry.flagName} className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#E8EBF0] px-4 py-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  {entry.flagName}
                  {entry.hasAlert && (
                    <span className="rounded-full bg-[#FBEAEA] px-2 py-0.5 text-[11px] font-semibold text-[#C0392B]">
                      ⚠ Verificare scadenza
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-ink-2">{entry.description}</div>
                <div className="mt-0.5 text-[11px] text-ink-2">
                  Default se nessun override applicabile: <strong>{String(entry.defaultValue)}</strong> · Scope
                  ammessi: {entry.allowedScopes.join(", ")}
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#F0F2F5]">
              {entry.overrides.map((row) => (
                <div key={row.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-bg px-2 py-1 text-xs font-semibold text-ink">
                      {row.scopeType}
                      {row.scopeValue ? `: ${row.scopeValue}` : ""}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.enabled ? "bg-green-light text-[#2d8f52]" : "bg-[#F0F2F5] text-ink-2"}`}>
                      {row.enabled ? "enabled" : "disabled"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[row.status].cls}`}>
                      {STATUS_LABEL[row.status].label}
                    </span>
                    <span className="text-xs text-ink-2">Scadenza: {formatDateTime(row.expiresAt)}</span>
                  </div>
                  <div className="text-[11px] text-ink-2">
                    Creato da {row.createdByEmail ?? "—"} il {formatDateTime(row.createdAt)} · ultima modifica di{" "}
                    {row.updatedByEmail ?? "—"} il {formatDateTime(row.updatedAt)}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleEnabled(entry.flagName, row)}
                      disabled={busyId === row.id}
                      className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      {row.enabled ? "Disattiva" : "Attiva"}
                    </button>
                    <button
                      onClick={() => extend(entry.flagName, row.id, 24)}
                      disabled={busyId === row.id}
                      className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      +24h
                    </button>
                    <button
                      onClick={() => extend(entry.flagName, row.id, 24 * 7)}
                      disabled={busyId === row.id}
                      className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      +7gg
                    </button>
                    {row.expiresAt && (
                      <button
                        onClick={() => clearExpiry(entry.flagName, row)}
                        disabled={busyId === row.id}
                        className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                      >
                        Rimuovi scadenza
                      </button>
                    )}
                    <button
                      onClick={() => remove(entry.flagName, row.id)}
                      disabled={busyId === row.id}
                      className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-[#C0392B] disabled:opacity-60"
                    >
                      Elimina
                    </button>
                  </div>
                  {errorById[row.id] && <div className="text-xs text-[#C0392B]">{errorById[row.id]}</div>}
                </div>
              ))}
              {entry.overrides.length === 0 && (
                <p className="px-4 py-4 text-center text-sm text-ink-2">
                  Nessun override — il flag risolve sempre al default ({String(entry.defaultValue)}).
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[#F0F2F5] bg-bg px-4 py-3">
              <select
                value={draft.scopeType}
                onChange={(e) =>
                  setNewOverrideDraft((prev) => ({ ...prev, [entry.flagName]: { ...draft, scopeType: e.target.value } }))
                }
                className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
              >
                {entry.allowedScopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
              {draft.scopeType !== "global" && (
                <input
                  value={draft.scopeValue}
                  onChange={(e) =>
                    setNewOverrideDraft((prev) => ({ ...prev, [entry.flagName]: { ...draft, scopeValue: e.target.value } }))
                  }
                  placeholder="valore (userId/ruolo/tenant/coorte/ambiente)"
                  className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
                />
              )}
              <label className="flex items-center gap-1.5 text-xs text-ink">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setNewOverrideDraft((prev) => ({ ...prev, [entry.flagName]: { ...draft, enabled: e.target.checked } }))
                  }
                />
                enabled
              </label>
              <input
                type="datetime-local"
                value={draft.expiresAt}
                onChange={(e) =>
                  setNewOverrideDraft((prev) => ({ ...prev, [entry.flagName]: { ...draft, expiresAt: e.target.value } }))
                }
                className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
                title="Scadenza (vuoto = nessuna)"
              />
              <button
                onClick={() => createOverride(entry.flagName)}
                disabled={busyId === `new-${entry.flagName}`}
                className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Aggiungi override
              </button>
              {errorById[`new-${entry.flagName}`] && (
                <div className="w-full text-xs text-[#C0392B]">{errorById[`new-${entry.flagName}`]}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
