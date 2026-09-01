"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PilotStatus, PilotUserRow } from "@/lib/data/pilot-users";

// Wave 1 "Pilot Observability" — stesso stile a card/tabella già stabilito in
// app/admin/beta-invites/BetaInvitesAdminClient.tsx e nelle badge di stato di
// app/admin/one/page.tsx (Command Center): nessun linguaggio visivo nuovo.
// Filtro per stato lato client (dati già tutti letti server-side in una sola
// pagina — nessun round-trip aggiuntivo necessario per un pilot di questa
// scala, coerente col principio "leggibilità > sofisticazione, no CRM").

const STATUS_LABEL: Record<PilotStatus, { label: string; cls: string }> = {
  invited_registered: { label: "Registrato", cls: "bg-[#F0F2F5] text-ink-2" },
  onboarding: { label: "Onboarding in corso", cls: "bg-orange-light text-trama-orange" },
  activated: { label: "Attivato", cls: "bg-green-light text-[#2d8f52]" },
  returning: { label: "Tornato", cls: "bg-trama-lilac/25 text-trama-violet" },
  not_yet_active: { label: "Non ancora attivo", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

const ONBOARDING_LABEL: Record<PilotUserRow["onboardingStatus"], string> = {
  not_started: "Non iniziato",
  in_progress: "In corso",
  completed: "Completato",
  skipped: "Saltato",
};

const FILTERS: { key: "all" | PilotStatus; label: string }[] = [
  { key: "all", label: "Tutti gli stati" },
  { key: "invited_registered", label: STATUS_LABEL.invited_registered.label },
  { key: "onboarding", label: STATUS_LABEL.onboarding.label },
  { key: "not_yet_active", label: STATUS_LABEL.not_yet_active.label },
  { key: "activated", label: STATUS_LABEL.activated.label },
  { key: "returning", label: STATUS_LABEL.returning.label },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

export default function PilotAdminClient({
  users,
  lastSignInAvailable,
}: {
  users: PilotUserRow[];
  lastSignInAvailable: boolean;
}) {
  const [filter, setFilter] = useState<"all" | PilotStatus>("all");

  const filtered = useMemo(
    () => (filter === "all" ? users : users.filter((u) => u.status === filter)),
    [users, filter]
  );

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-navy-3 p-6 text-center">
        <p className="text-sm text-navy-text2">
          Nessun utente ancora nella Controlled Beta Cohort — appariranno qui non appena il primo invito Beta
          viene riscattato (vedi{" "}
          <a href="/admin/beta-invites" className="underline">
            Inviti Beta
          </a>
          ).
        </p>
      </div>
    );
  }

  return (
    <div>
      {!lastSignInAvailable && (
        <div className="mb-3 rounded-lg border border-orange-mid bg-orange-light p-3 text-xs text-ink">
          SUPABASE_SERVICE_ROLE_KEY non configurata in questo ambiente: &quot;Ultimo accesso&quot; e il segnale
          &quot;gruppo creato/aderito&quot; non sono disponibili qui, il resto della pagina funziona comunque.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key ? "bg-trama-violet text-white" : "border border-[#E8EBF0] bg-white text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-3 p-6 text-center">
          <p className="text-sm text-navy-text2">Nessun utente in questo stato.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
          <table className="w-full min-w-[860px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">Email</th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">Registrato</th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">Ruolo</th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">Cohort</th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">Onboarding</th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">
                  Prima attività
                </th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">
                  Ultima attività
                </th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">
                  Ultimo accesso
                </th>
                <th className="border-b border-[#E8EBF0] px-3 py-2 text-left font-semibold text-ink-2">Stato</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} data-testid={`pilot-user-${u.id}`}>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink">
                    <Link href={`/admin/one/pilot/${u.id}`} className="font-medium text-trama-violet underline">
                      {u.email ?? "—"}
                    </Link>
                    {u.fullName && <div className="text-[11px] text-ink-2">{u.fullName}</div>}
                  </td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">{formatDate(u.createdAt)}</td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">{u.role}</td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">
                    {u.cohortKeys.join(", ")}
                    {!u.cohortActive && (
                      <span className="ml-1 rounded-full bg-[#F0F2F5] px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
                        non attiva
                      </span>
                    )}
                  </td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">
                    {ONBOARDING_LABEL[u.onboardingStatus]}
                  </td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">
                    {u.firstMeaningfulActionAt ? (
                      <>
                        {u.firstMeaningfulActionLabel}
                        <div className="text-[11px] text-ink-3">{formatDate(u.firstMeaningfulActionAt)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">
                    {u.lastActivityAt ? (
                      <>
                        {u.lastActivityLabel}
                        <div className="text-[11px] text-ink-3">{formatDate(u.lastActivityAt)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2 text-ink-2">
                    {formatDateTime(u.lastSignInAt)}
                  </td>
                  <td className="border-b border-[#F0F2F5] px-3 py-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[u.status].cls}`}>
                      {STATUS_LABEL[u.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
