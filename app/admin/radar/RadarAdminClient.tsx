"use client";

// TRAMA — RADAR (13/10/2026): coda admin minima. Nascondere una scoperta la
// toglie subito da Scopri e dai preferiti di tutti (decisione D3); si può
// sempre rimostrare. Nessuna cancellazione: le righe restano per audit.

import { useState } from "react";
import Link from "next/link";
import { setCommunityDiscoveryStatusAction } from "@/app/actions/radar";
import type { RadarAdminOverview } from "@/lib/data/radar";
import { formatCommunityAge, formatCommunityDates, formatCommunityPlace } from "@/lib/radar/community";

const RELEVANCE_LABEL: Record<string, string> = {
  relevant: "Pertinente",
  uncertain: "Dubbio",
  not_relevant: "Non pertinente",
};

const OUTCOME_LABEL: Record<string, string> = {
  pending: "In attesa",
  rejected: "Rifiutato",
  abandoned: "Abbandonato",
  matched_activity: "Collegato a un'attività",
  matched_curated: "Collegato a Scoperta TRAMA",
  matched_community: "Collegato a scoperta community",
  created_community: "Scoperta creata",
  reported_anyway: "Segnalato comunque",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function RadarAdminClient({ initial }: { initial: RadarAdminOverview }) {
  const [community, setCommunity] = useState(initial.community);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const duplicateIds = new Set(initial.duplicateGroups.flatMap((g) => g.ids));

  async function setStatus(id: string, status: "visible" | "hidden") {
    setBusyId(id);
    setError(null);
    const result = await setCommunityDiscoveryStatusAction(id, status);
    setBusyId(null);
    if (!result.ok) return setError(result.error);
    setCommunity((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Radar — scoperte della community</h1>
        <p className="text-sm text-ink-2">
          Scoperte segnalate dai genitori (visibili a tutti con &quot;Segnalato dalla community&quot;), possibili doppioni e invii da guardare.
        </p>
      </div>
      {error && <p className="mb-4 rounded-lg bg-[#FDECEA] px-3 py-2 text-sm font-semibold text-[#C0392B]">{error}</p>}

      <h2 className="mb-2 text-base font-bold text-ink">Scoperte community ({community.length})</h2>
      {initial.duplicateGroups.length > 0 && (
        <p className="mb-2 text-sm text-trama-orange">
          {initial.duplicateGroups.length} possibili doppioni (stesso titolo, organizzatore, comune e anno): sono segnati con ⚠️.
        </p>
      )}
      <div className="mb-8 overflow-x-auto rounded-lg border border-[#E4E8EF] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F7F8FA] text-xs uppercase text-ink-3">
            <tr>
              <th className="px-3 py-2">Scoperta</th>
              <th className="px-3 py-2">Dove / quando</th>
              <th className="px-3 py-2">Creata</th>
              <th className="px-3 py-2">Stato</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {community.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-3">
                  Nessuna scoperta ancora.
                </td>
              </tr>
            )}
            {community.map((c) => (
              <tr key={c.id} className="border-t border-[#F0F2F5] align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold text-ink">
                    {duplicateIds.has(c.id) && <span title="Possibile doppione">⚠️ </span>}
                    <Link href={`/nextgen/scoperta/${c.id}`} className="hover:underline" target="_blank">
                      {c.title}
                    </Link>
                  </div>
                  <div className="text-xs text-ink-2">{[c.organizerName, formatCommunityAge(c.ageMin, c.ageMax)].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-3 py-2 text-xs text-ink-2">
                  <div>{formatCommunityPlace(c) ?? "—"}</div>
                  <div>{formatCommunityDates(c) ?? "—"}</div>
                </td>
                <td className="px-3 py-2 text-xs text-ink-2">{when(c.createdAt)}</td>
                <td className="px-3 py-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      c.status === "visible" ? "bg-green-light text-[#2d8f52]" : "bg-[#F4F6FA] text-ink-3"
                    }`}
                  >
                    {c.status === "visible" ? "Visibile" : c.status === "hidden" ? "Nascosta" : "Unita"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {c.status === "visible" && (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void setStatus(c.id, "hidden")}
                      className="rounded-lg border border-[#D8DEE8] px-3 py-1 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      Nascondi
                    </button>
                  )}
                  {c.status === "hidden" && (
                    <button
                      type="button"
                      disabled={busyId === c.id}
                      onClick={() => void setStatus(c.id, "visible")}
                      className="rounded-lg border border-[#D8DEE8] px-3 py-1 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      Rimostra
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-base font-bold text-ink">Invii dubbi o rifiutati ({initial.submissions.length})</h2>
      <p className="mb-2 text-sm text-ink-2">Contenuti che il Radar non ha pubblicato. Nessuna foto viene conservata: solo i dati letti.</p>
      <div className="overflow-x-auto rounded-lg border border-[#E4E8EF] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F7F8FA] text-xs uppercase text-ink-3">
            <tr>
              <th className="px-3 py-2">Quando</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Cosa ha letto</th>
              <th className="px-3 py-2">Esito</th>
            </tr>
          </thead>
          <tbody>
            {initial.submissions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-ink-3">
                  Nessun invio da guardare.
                </td>
              </tr>
            )}
            {initial.submissions.map((s) => (
              <tr key={s.id} className="border-t border-[#F0F2F5] align-top">
                <td className="px-3 py-2 text-xs text-ink-2">{when(s.createdAt)}</td>
                <td className="px-3 py-2 text-xs text-ink-2">
                  {s.sourceType}
                  {s.analyzer && <div className="text-ink-3">{s.analyzer}</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="font-semibold text-ink">{s.title ?? "—"}</div>
                  {s.userNote && <div className="text-ink-2">Nota: {s.userNote}</div>}
                  {s.sourceUrl && (
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-trama-violet">
                      {s.sourceUrl}
                    </a>
                  )}
                  {s.warnings.length > 0 && <div className="text-ink-3">{s.warnings.join(", ")}</div>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="font-semibold text-ink">{RELEVANCE_LABEL[s.relevanceStatus] ?? s.relevanceStatus}</div>
                  <div className="text-ink-2">{OUTCOME_LABEL[s.outcome] ?? s.outcome}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
