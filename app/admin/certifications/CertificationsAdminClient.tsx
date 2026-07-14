"use client";

import { useState } from "react";
import { CertificationItem } from "@/lib/types";
import { getCertificationDocumentUrlAction, reviewCertificationAction } from "@/app/actions/certifications";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STATUS_LABEL: Record<CertificationItem["status"], { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-orange-light text-[#d4622a]" },
  approved: { label: "Approvata", cls: "bg-green-light text-[#2d8f52]" },
  rejected: { label: "Rifiutata", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

export default function CertificationsAdminClient({
  initialCertifications,
}: {
  initialCertifications: CertificationItem[];
}) {
  const [certifications, setCertifications] = useState(initialCertifications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  async function review(id: string, approve: boolean) {
    setBusyId(id);
    const result = await reviewCertificationAction(id, approve, noteDraft[id]);
    setBusyId(null);
    if (!result.error) {
      setCertifications((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: approve ? "approved" : "rejected" } : c))
      );
    }
  }

  async function viewDocument(path: string) {
    const result = await getCertificationDocumentUrlAction(path);
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
  }

  const pending = certifications.filter((c) => c.status === "pending");
  const resolved = certifications.filter((c) => c.status !== "pending");

  return (
    <div>
      <div className="mb-6">
        {/* FIX CONTRASTO ADMIN: text-ink==bg-navy, vedi analytics/page.tsx */}
        <h1 className="text-xl font-bold text-white">Certificazioni servizio</h1>
        <p className="text-sm text-navy-text2">
          Richieste dei centri per certificare un servizio specifico (es. &quot;Istruttori
          certificati FISE per equitazione&quot;) — approvale solo dopo aver verificato il
          documento allegato (se presente); una volta approvate diventano un badge visibile ai
          genitori nella scheda attività.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-5 rounded-lg border border-orange-mid bg-orange-light p-4 text-sm text-ink">
          Supabase non è collegato in questo ambiente: qui vedrai le richieste reali una volta
          collegato.
        </div>
      )}

      <div className="mb-5 rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          In attesa ({pending.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {pending.map((c) => (
            <div key={c.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{c.label}</div>
                <div className="text-xs text-ink-2">
                  {c.activityName} · {c.centerName}
                </div>
                {c.documentPath && (
                  <button
                    type="button"
                    onClick={() => viewDocument(c.documentPath!)}
                    className="mt-1 text-xs font-semibold text-sky"
                  >
                    <i className="ti ti-file-text" /> Vedi documento allegato
                  </button>
                )}
                <input
                  value={noteDraft[c.id] ?? ""}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder="Nota facoltativa (es. motivo del rifiuto)"
                  className="mt-2 w-full max-w-sm rounded-md border border-[#E8EBF0] bg-bg px-2.5 py-1.5 text-xs outline-none focus:border-sky"
                />
              </div>
              <button
                onClick={() => review(c.id, true)}
                disabled={busyId === c.id}
                className="rounded-md bg-partner px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                Approva
              </button>
              <button
                onClick={() => review(c.id, false)}
                disabled={busyId === c.id}
                className="rounded-md border border-[#E8EBF0] px-3.5 py-2 text-xs font-semibold text-ink disabled:opacity-60"
              >
                Rifiuta
              </button>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">
              Nessuna richiesta in attesa al momento.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#E8EBF0] bg-white">
        <div className="border-b border-[#E8EBF0] px-4 py-3 text-sm font-bold text-ink">
          Storico ({resolved.length})
        </div>
        <div className="divide-y divide-[#F0F2F5]">
          {resolved.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{c.label}</div>
                <div className="text-xs text-ink-2">
                  {c.activityName} · {c.centerName}
                </div>
                {c.status === "rejected" && c.adminNote && (
                  <div className="mt-0.5 text-[11px] text-ink-3">Motivo: {c.adminNote}</div>
                )}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[c.status].cls}`}>
                {STATUS_LABEL[c.status].label}
              </span>
            </div>
          ))}
          {resolved.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-2">Ancora nessuna richiesta risolta.</p>
          )}
        </div>
      </div>
    </div>
  );
}
