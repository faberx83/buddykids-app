"use client";

import { useState } from "react";
import { CenterLeadItem, CenterLeadRewardStatus, CenterLeadStatus } from "@/lib/types";
import {
  approveCandidacyAction,
  claimCenterLeadAction,
  findPossibleDuplicateLeadsAction,
  markCenterLeadDuplicateAction,
  markCenterLeadRewardAction,
  updateCenterLeadStatusAction,
} from "@/app/actions/center-leads";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// TRAMA ONE Build Sprint 5 — coda Admin per il triage di CenterLead (J11).
// Pattern riusato 1:1 da app/admin/certifications/CertificationsAdminClient.tsx
// (stessa struttura sezioni per stato + azioni), applicato al nuovo dominio.

const STATUS_LABEL: Record<CenterLeadStatus, { label: string; cls: string }> = {
  suggested: { label: "Nuova", cls: "bg-orange-light text-trama-orange" },
  qualified: { label: "In valutazione", cls: "bg-[#EEF0FF] text-trama-violet" },
  contacted: { label: "Contattato", cls: "bg-sky-light text-sky" },
  claimed: { label: "Iscritto (claimed)", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Scartato", cls: "bg-[#FBEAEA] text-[#C0392B]" },
  expired: { label: "Scaduto", cls: "bg-[#F0F2F5] text-ink-2" },
};

const REWARD_LABEL: Record<CenterLeadRewardStatus, string> = {
  not_applicable: "—",
  pending_manual_review: "In revisione manuale",
  marked_eligible_manual: "Eleggibile (manuale)",
  marked_paid_manual_offline: "Erogato offline (manuale)",
};

export default function CenterLeadsAdminClient({
  initialLeads,
  centers,
}: {
  initialLeads: CenterLeadItem[];
  centers: { id: string; name: string }[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Record<string, CenterLeadItem[]>>({});
  const [claimPicker, setClaimPicker] = useState<Record<string, string>>({});
  const [rewardDraft, setRewardDraft] = useState<Record<string, string>>({});

  // Migrazione 21 — "Candidati come centro": stato locale SOLO per le
  // autocandidature (lead_type='self_candidacy'). Il form di approvazione è
  // prefillato con i dati della candidatura (nome/città/email/telefono già
  // noti) e chiede solo indirizzo+descrizione, che il candidato ha inserito
  // come testo libero in suggested_contact.
  const [candidacyOpen, setCandidacyOpen] = useState<Record<string, boolean>>({});
  const [candidacyDraft, setCandidacyDraft] = useState<Record<string, { city: string; address: string; description: string }>>({});
  const [approveMsg, setApproveMsg] = useState<Record<string, string>>({});

  function openCandidacyForm(lead: CenterLeadItem) {
    setCandidacyOpen((prev) => ({ ...prev, [lead.id]: true }));
    setCandidacyDraft((prev) => ({
      ...prev,
      [lead.id]: prev[lead.id] ?? {
        city: lead.suggestedLocality || "",
        address: "",
        description: lead.suggestedContact || "",
      },
    }));
  }

  async function approveCandidacy(lead: CenterLeadItem) {
    const draft = candidacyDraft[lead.id];
    if (!draft) return;
    setBusyId(lead.id);
    const res = await approveCandidacyAction(lead.id, {
      name: lead.suggestedName,
      city: draft.city,
      address: draft.address,
      description: draft.description,
      contactEmail: lead.candidateEmail || "",
      contactPhone: lead.candidatePhone || "",
      gestoreEmail: lead.candidateEmail,
    });
    setBusyId(null);

    if (res.error) {
      setApproveMsg((prev) => ({ ...prev, [lead.id]: `Errore: ${res.error}` }));
      return;
    }

    patchLead(lead.id, { status: "claimed", claimedCenterId: res.centerId, claimedCenterName: res.centerName });
    setCandidacyOpen((prev) => ({ ...prev, [lead.id]: false }));
    setApproveMsg((prev) => ({
      ...prev,
      [lead.id]: res.warning
        ? `Centro "${res.centerName}" creato. ${res.warning}`
        : `Centro "${res.centerName}" creato e gestore assegnato.`,
    }));
  }

  function patchLead(id: string, patch: Partial<CenterLeadItem>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function setStatus(id: string, status: Exclude<CenterLeadStatus, "claimed">) {
    setBusyId(id);
    const res = await updateCenterLeadStatusAction(id, status, noteDraft[id]);
    setBusyId(null);
    if (!res.error) patchLead(id, { status, adminNote: noteDraft[id]?.trim() || undefined });
  }

  async function checkDuplicates(lead: CenterLeadItem) {
    const res = await findPossibleDuplicateLeadsAction(lead.dedupeKey, lead.id);
    setDuplicates((prev) => ({ ...prev, [lead.id]: res.leads }));
  }

  async function markDuplicate(id: string, duplicateOfId: string) {
    setBusyId(id);
    const res = await markCenterLeadDuplicateAction(id, duplicateOfId);
    setBusyId(null);
    if (!res.error) patchLead(id, { status: "qualified", duplicateOf: duplicateOfId });
  }

  async function claim(id: string) {
    const centerId = claimPicker[id];
    if (!centerId) return;
    setBusyId(id);
    const res = await claimCenterLeadAction(id, centerId);
    setBusyId(null);
    if (!res.error) {
      const centerName = centers.find((c) => c.id === centerId)?.name;
      patchLead(id, { status: "claimed", claimedCenterId: centerId, claimedCenterName: centerName });
    }
  }

  async function markReward(id: string, status: "pending_manual_review" | "marked_eligible_manual" | "marked_paid_manual_offline") {
    const note = rewardDraft[id];
    if (!note?.trim()) return;
    setBusyId(id);
    const res = await markCenterLeadRewardAction(id, status, note);
    setBusyId(null);
    if (!res.error) patchLead(id, { rewardStatus: status, rewardNote: note.trim() });
  }

  const active = leads.filter((l) => l.status === "suggested" || l.status === "qualified" || l.status === "contacted");
  const resolved = leads.filter((l) => l.status === "claimed" || l.status === "rejected" || l.status === "expired");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">CenterLead — Segnalazioni referral</h1>
        <p className="text-sm text-navy-text2">
          Genitori che hanno segnalato un centro non ancora su TRAMA (J11). Nessuna riga qui crea mai
          un&apos;attività pubblica o prenotabile: solo dopo un claim collegato a un centro che ha
          completato l&apos;onboarding reale il centro diventa visibile ai genitori. Reward/commission
          restano annotazioni manuali — nessun calcolo o pagamento automatico (scope Sprint 5).
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le segnalazioni reali una volta
          collegato.
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Attive ({active.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {active.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">{lead.suggestedName}</span>
                    {lead.leadType === "self_candidacy" && (
                      <span className="rounded-full bg-[#EAF6FF] px-2 py-0.5 text-[10px] font-semibold text-sky">
                        Autocandidatura
                      </span>
                    )}
                  </div>
                  {lead.leadType === "self_candidacy" ? (
                    <div className="text-xs text-ink-2">
                      {lead.suggestedLocality || "località non indicata"} · {lead.candidateEmail}
                      {lead.candidatePhone ? ` · ${lead.candidatePhone}` : ""} · il{" "}
                      {new Date(lead.createdAt).toLocaleDateString("it-IT")}
                    </div>
                  ) : (
                    <div className="text-xs text-ink-2">
                      {lead.suggestedLocality || "località non indicata"} · segnalato da{" "}
                      {lead.suggestedByName || "genitore"} il {new Date(lead.createdAt).toLocaleDateString("it-IT")}
                    </div>
                  )}
                  {lead.suggestedContact && (
                    <div className="text-xs text-ink-2">
                      {lead.leadType === "self_candidacy" ? "Descrizione: " : "Contatto noto: "}
                      {lead.suggestedContact}
                    </div>
                  )}
                  {lead.duplicateOf && (
                    <div className="mt-1 text-xs font-semibold text-trama-orange">
                      Duplicato di un altro lead ({lead.duplicateOf.slice(0, 8)}…)
                    </div>
                  )}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[lead.status].cls}`}>
                  {STATUS_LABEL[lead.status].label}
                </span>
              </div>

              <input
                value={noteDraft[lead.id] ?? lead.adminNote ?? ""}
                onChange={(e) => setNoteDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                placeholder="Nota di triage (mai visibile al genitore)"
                className="w-full max-w-md rounded-md border border-[#E8EBF0] bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-sky"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatus(lead.id, "qualified")}
                  disabled={busyId === lead.id}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  Qualifica
                </button>
                <button
                  onClick={() => setStatus(lead.id, "contacted")}
                  disabled={busyId === lead.id}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  Segna contattato
                </button>
                <button
                  onClick={() => checkDuplicates(lead)}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  Cerca duplicati
                </button>
                <button
                  onClick={() => setStatus(lead.id, "rejected")}
                  disabled={busyId === lead.id}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  Scarta
                </button>
                <button
                  onClick={() => setStatus(lead.id, "expired")}
                  disabled={busyId === lead.id}
                  className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                >
                  Segna scaduto
                </button>
              </div>

              {duplicates[lead.id] && duplicates[lead.id].length > 0 && (
                <div className="rounded-md border border-dashed border-[#D8DEE8] bg-bg p-2 text-xs">
                  <div className="mb-1 font-semibold text-ink-2">Possibili duplicati (stesso nome+località):</div>
                  {duplicates[lead.id].map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span>
                        {d.suggestedName} — {STATUS_LABEL[d.status].label}
                      </span>
                      <button
                        onClick={() => markDuplicate(lead.id, d.id)}
                        className="font-semibold text-sky"
                      >
                        Aggrega qui
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {duplicates[lead.id] && duplicates[lead.id].length === 0 && (
                <div className="text-xs text-ink-2">Nessun altro lead con lo stesso nome+località.</div>
              )}

              {lead.leadType === "self_candidacy" ? (
                // Migrazione 21 — approvazione autocandidatura: crea DAVVERO
                // il centro (createCenterAndAssignAction, riusata da
                // approveCandidacyAction), prefillato dai dati della
                // candidatura. Diverso dal "Claim" sotto, che invece collega
                // un lead a un centro GIÀ esistente (referral genitore).
                <div className="border-t border-[#F0F2F5] pt-2">
                  {!candidacyOpen[lead.id] ? (
                    <button
                      onClick={() => openCandidacyForm(lead)}
                      className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Approva e crea centro
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-md border border-dashed border-[#D8DEE8] bg-bg p-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          value={candidacyDraft[lead.id]?.city ?? ""}
                          onChange={(e) =>
                            setCandidacyDraft((prev) => ({
                              ...prev,
                              [lead.id]: { ...prev[lead.id], city: e.target.value },
                            }))
                          }
                          placeholder="Città"
                          className="rounded-md border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                        />
                        <input
                          value={candidacyDraft[lead.id]?.address ?? ""}
                          onChange={(e) =>
                            setCandidacyDraft((prev) => ({
                              ...prev,
                              [lead.id]: { ...prev[lead.id], address: e.target.value },
                            }))
                          }
                          placeholder="Indirizzo"
                          className="rounded-md border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                        />
                      </div>
                      <textarea
                        value={candidacyDraft[lead.id]?.description ?? ""}
                        onChange={(e) =>
                          setCandidacyDraft((prev) => ({
                            ...prev,
                            [lead.id]: { ...prev[lead.id], description: e.target.value },
                          }))
                        }
                        rows={2}
                        placeholder="Descrizione del centro"
                        className="w-full resize-none rounded-md border border-[#E8EBF0] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => approveCandidacy(lead)}
                          disabled={busyId === lead.id}
                          className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Conferma creazione centro
                        </button>
                        <button
                          onClick={() => setCandidacyOpen((prev) => ({ ...prev, [lead.id]: false }))}
                          className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink"
                        >
                          Annulla
                        </button>
                        <span className="text-[11px] text-ink-2">
                          Se {lead.candidateEmail} non si è ancora registrato, il centro viene comunque
                          creato: il ruolo verrà assegnato in automatico alla sua prima registrazione con
                          questa email.
                        </span>
                      </div>
                    </div>
                  )}
                  {approveMsg[lead.id] && <p className="mt-1.5 text-xs font-medium text-ink-2">{approveMsg[lead.id]}</p>}
                </div>
              ) : (
                /* Claim: collega al centro reale che ha completato l'onboarding */
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F0F2F5] pt-2">
                  <select
                    value={claimPicker[lead.id] ?? ""}
                    onChange={(e) => setClaimPicker((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                    className="rounded-md border border-[#E8EBF0] bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="">Collega a un centro iscritto…</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => claim(lead.id)}
                    disabled={busyId === lead.id || !claimPicker[lead.id]}
                    className="rounded-md bg-partner px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Claim
                  </button>
                  <span className="text-[11px] text-ink-2">
                    Solo dopo che il centro ha completato l&apos;onboarding normale (Admin Review) — non
                    crea nulla di nuovo, collega solo due entità già esistenti.
                  </span>
                </div>
              )}
            </div>
          ))}
          {active.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Nessuna segnalazione attiva al momento.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Storico ({resolved.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {resolved.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink">{lead.suggestedName}</span>
                    {lead.leadType === "self_candidacy" && (
                      <span className="rounded-full bg-[#EAF6FF] px-2 py-0.5 text-[10px] font-semibold text-sky">
                        Autocandidatura
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-2">
                    {lead.claimedCenterName ? `Collegato a: ${lead.claimedCenterName}` : lead.suggestedLocality || ""}
                  </div>
                  {lead.leadType !== "self_candidacy" && (
                    <div className="mt-0.5 text-[11px] text-ink-2">
                      Reward: {REWARD_LABEL[lead.rewardStatus]}
                      {lead.rewardNote ? ` — ${lead.rewardNote}` : ""}
                    </div>
                  )}
                </div>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[lead.status].cls}`}>
                  {STATUS_LABEL[lead.status].label}
                </span>
              </div>

              {lead.status === "claimed" && lead.leadType !== "self_candidacy" && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[#F0F2F5] pt-2">
                  <input
                    value={rewardDraft[lead.id] ?? ""}
                    onChange={(e) => setRewardDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                    placeholder='Nota reward (es. "10% fino a 25€ segnato manualmente il gg/mm")'
                    className="w-full max-w-sm rounded-md border border-[#E8EBF0] bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                  />
                  <button
                    onClick={() => markReward(lead.id, "marked_eligible_manual")}
                    disabled={busyId === lead.id}
                    className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    Segna eleggibile
                  </button>
                  <button
                    onClick={() => markReward(lead.id, "marked_paid_manual_offline")}
                    disabled={busyId === lead.id}
                    className="rounded-md border border-[#E8EBF0] px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
                  >
                    Segna erogato offline
                  </button>
                </div>
              )}
            </div>
          ))}
          {resolved.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Nessuna segnalazione chiusa ancora.</p>
          )}
        </div>
      </div>
    </div>
  );
}
