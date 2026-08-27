"use client";

import { useState } from "react";
import { BetaInviteCodeRow } from "@/lib/data/beta-invites";
import { BetaInviteCodeState } from "@/lib/beta-invites/eligibility";
import {
  createBetaInviteCodeAction,
  updateBetaInviteCodeAction,
  deleteBetaInviteCodeAction,
} from "@/app/actions/beta-invites";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Codici invito Beta (public.beta_invite_codes, migration_30) — Admin CRUD.
// Riusa lo stile di app/admin/feature-flags/FeatureFlagsAdminClient.tsx
// (card per riga, badge di stato, azioni inline) invece di inventare un
// secondo linguaggio visivo. Richiesta di Fabrizio: un solo codice
// riutilizzabile condiviso manualmente via WhatsApp — questa UI però
// supporta comunque codici multipli/scadenze/limiti fin da subito (costo
// marginale nullo avendo già una pagina Admin, nessun secondo sistema).

const STATE_LABEL: Record<BetaInviteCodeState, { label: string; cls: string }> = {
  redeemable: { label: "Attivo e utilizzabile", cls: "bg-green-light text-[#2d8f52]" },
  inactive: { label: "Disattivato", cls: "bg-[#F0F2F5] text-ink-2" },
  expired: { label: "Scaduto", cls: "bg-[#FBEAEA] text-[#C0392B]" },
  exhausted: { label: "Utilizzi esauriti", cls: "bg-orange-light text-trama-orange" },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BetaInvitesAdminClient({ initialCodes }: { initialCodes: BetaInviteCodeRow[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newMaxRedemptions, setNewMaxRedemptions] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null);

  async function handleCreate() {
    setCreateError(null);
    setLastCreatedLink(null);
    if (!newCode.trim()) {
      setCreateError("Inserisci un codice (es. TRAMABETA26)");
      return;
    }
    setCreateBusy(true);
    const res = await createBetaInviteCodeAction({
      code: newCode,
      label: newLabel || null,
      cohortKey: "trama-one-controlled-beta",
      maxRedemptions: newMaxRedemptions.trim() ? Number(newMaxRedemptions) : null,
      expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null,
    });
    setCreateBusy(false);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    setNewCode("");
    setNewLabel("");
    setNewMaxRedemptions("");
    setNewExpiresAt("");
    setLastCreatedLink(res.inviteLink ?? null);
    window.location.reload();
  }

  async function toggleActive(row: BetaInviteCodeRow) {
    setBusyId(row.id);
    const res = await updateBetaInviteCodeAction({
      id: row.id,
      active: !row.active,
      maxRedemptions: row.maxRedemptions,
      expiresAt: row.expiresAt,
    });
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [row.id]: res.error! }));
      return;
    }
    window.location.reload();
  }

  async function updateExpiry(row: BetaInviteCodeRow, expiresAtLocal: string) {
    setBusyId(row.id);
    const expiresAt = expiresAtLocal ? new Date(expiresAtLocal).toISOString() : null;
    const res = await updateBetaInviteCodeAction({
      id: row.id,
      active: row.active,
      maxRedemptions: row.maxRedemptions,
      expiresAt,
    });
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [row.id]: res.error! }));
      return;
    }
    window.location.reload();
  }

  async function remove(id: string) {
    if (!window.confirm("Eliminare definitivamente questo codice invito? Le iscrizioni Beta già avvenute con questo codice NON vengono rimosse.")) return;
    setBusyId(id);
    const res = await deleteBetaInviteCodeAction(id);
    setBusyId(null);
    if (res.error) {
      setErrorById((prev) => ({ ...prev, [id]: res.error! }));
      return;
    }
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  function copyLink(row: BetaInviteCodeRow) {
    const link = `${window.location.protocol}//${window.location.host.replace(/^admin\./, "")}/auth/login?beta=${row.code}`;
    navigator.clipboard?.writeText(link);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 2000);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Codici invito Beta</h1>
        <p className="text-sm text-navy-text2">
          Un genitore che si registra da un link <code>?beta=CODICE</code> viene iscritto automaticamente alla
          cohort Beta (stesso meccanismo che oggi governa Spotlight e Onboarding Carousel) — zero passaggi manuali
          in SQL. Il link va condiviso manualmente (es. WhatsApp): nessun invio automatico avviene da questa pagina.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai i codici reali una volta collegato.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-[#E8EBF0] bg-white p-4">
        <div className="text-sm font-bold text-ink">Nuovo codice</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Codice (es. TRAMABETA26)"
            className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
          />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Etichetta interna (opzionale, solo per te)"
            className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
          />
          <input
            value={newMaxRedemptions}
            onChange={(e) => setNewMaxRedemptions(e.target.value)}
            type="number"
            min={1}
            placeholder="Max utilizzi (vuoto = illimitati)"
            className="w-56 rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
          />
          <input
            value={newExpiresAt}
            onChange={(e) => setNewExpiresAt(e.target.value)}
            type="datetime-local"
            className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
            title="Scadenza (vuoto = nessuna)"
          />
          <button
            onClick={handleCreate}
            disabled={createBusy}
            className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            Crea codice
          </button>
        </div>
        {createError && <div className="mt-2 text-xs text-[#C0392B]">{createError}</div>}
        {lastCreatedLink && (
          <div className="mt-2 rounded-md bg-green-light px-3 py-2 text-xs text-[#2d8f52]">
            Codice creato — link da condividere: <strong>{lastCreatedLink}</strong>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="divide-y divide-[#F0F2F5]">
          {codes.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 px-4 py-3" data-testid={`beta-invite-${row.code}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md bg-bg px-2 py-1 text-xs font-mono font-semibold text-ink">{row.code}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATE_LABEL[row.state].cls}`}>
                  {STATE_LABEL[row.state].label}
                </span>
                {row.label && <span className="text-xs text-ink-2">{row.label}</span>}
                <span className="text-xs text-ink-2">
                  Utilizzi: {row.redeemedCount}
                  {row.maxRedemptions !== null ? ` / ${row.maxRedemptions}` : " (illimitati)"}
                </span>
                <span className="text-xs text-ink-2">Scadenza: {formatDateTime(row.expiresAt)}</span>
              </div>
              <div className="text-[11px] text-ink-2">
                Creato da {row.createdByEmail ?? "—"} il {formatDateTime(row.createdAt)}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => copyLink(row)}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  {copiedId === row.id ? "Copiato ✓" : "Copia link invito"}
                </button>
                <button
                  onClick={() => toggleActive(row)}
                  disabled={busyId === row.id}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  {row.active ? "Disattiva" : "Riattiva"}
                </button>
                <input
                  type="datetime-local"
                  defaultValue={toDatetimeLocalValue(row.expiresAt)}
                  onBlur={(e) => updateExpiry(row, e.target.value)}
                  className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
                  title="Modifica scadenza (vuoto = nessuna), salva uscendo dal campo"
                />
                <button
                  onClick={() => remove(row.id)}
                  disabled={busyId === row.id}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-[#C0392B] disabled:opacity-60"
                >
                  Elimina
                </button>
              </div>
              {errorById[row.id] && <div className="text-xs text-[#C0392B]">{errorById[row.id]}</div>}
            </div>
          ))}
          {codes.length === 0 && (
            <p className="px-4 py-4 text-center text-sm text-ink-2">Nessun codice invito Beta ancora creato.</p>
          )}
        </div>
      </div>
    </div>
  );
}
