import { notFound } from "next/navigation";
import Link from "next/link";
import { getPilotUserDetail } from "@/lib/data/pilot-users";

// Dipende dal ruolo dell'utente loggato (is_platform_admin(), stessa
// motivazione di app/admin/one/pilot/page.tsx) — nessuna cache statica.
export const dynamic = "force-dynamic";

// TRAMA — drill-down per utente (01/09/2026, richiesto da Fabrizio: "Ultimo
// accesso" in tabella sembrava poco aggiornato perché riflette solo il
// login, non l'uso reale). Nessuna nuova tabella/migration: stesse 3 fonti
// dati già usate da getPilotUsers() (kids/bookings/group_members), lette qui
// per un solo utente e mostrate come timeline invece che come solo
// min/max — vedi lib/data/pilot-users.ts#getPilotUserDetail per il dettaglio.
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  invited_registered: { label: "Registrato", cls: "bg-[#F0F2F5] text-ink-2" },
  onboarding: { label: "Onboarding in corso", cls: "bg-orange-light text-trama-orange" },
  activated: { label: "Attivato", cls: "bg-green-light text-[#2d8f52]" },
  returning: { label: "Tornato", cls: "bg-trama-lilac/25 text-trama-violet" },
  not_yet_active: { label: "Non ancora attivo", cls: "bg-[#FBEAEA] text-[#C0392B]" },
};

const ONBOARDING_LABEL: Record<string, string> = {
  not_started: "Non iniziato",
  in_progress: "In corso",
  completed: "Completato",
  skipped: "Saltato",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

export default async function PilotUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getPilotUserDetail(id);

  if (!user) return notFound();

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/one/pilot" className="text-xs font-semibold text-trama-violet">
          ← Torna a Pilota — Nuovi utenti
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{user.email ?? "—"}</h1>
          {user.fullName && <p className="mt-0.5 text-sm text-navy-text2">{user.fullName}</p>}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_LABEL[user.status]?.cls ?? ""}`}
        >
          {STATUS_LABEL[user.status]?.label ?? user.status}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-[11px] font-semibold text-ink-2">Registrato</div>
          <div className="mt-1 text-sm text-ink">{formatDateTime(user.createdAt)}</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-[11px] font-semibold text-ink-2">Ruolo</div>
          <div className="mt-1 text-sm text-ink">{user.role}</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-[11px] font-semibold text-ink-2">Onboarding</div>
          <div className="mt-1 text-sm text-ink">{ONBOARDING_LABEL[user.onboardingStatus] ?? user.onboardingStatus}</div>
        </div>
        <div className="rounded-lg border border-[#E8EBF0] bg-white p-3">
          <div className="text-[11px] font-semibold text-ink-2">Ultimo accesso</div>
          <div className="mt-1 text-sm text-ink">{formatDateTime(user.lastSignInAt)}</div>
        </div>
      </div>

      <div className="mb-3">
        <h2 className="text-sm font-bold text-white">Storico attività</h2>
        <p className="mt-0.5 text-xs text-navy-text2">
          Bambini aggiunti, prenotazioni create, gruppi creati/uniti — più recente in alto. Nessun nome o
          dettaglio dell&apos;attività/bambino/gruppo, solo il tipo di azione e quando è avvenuta.
        </p>
      </div>

      {user.timeline.length === 0 ? (
        <div className="rounded-lg border border-dashed border-navy-3 p-6 text-center">
          <p className="text-sm text-navy-text2">Nessuna attività significativa ancora registrata per questo utente.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#F0F2F5] rounded-lg border border-[#E8EBF0] bg-white">
          {user.timeline.map((event, i) => (
            <li key={`${event.at}-${i}`} className="flex items-center justify-between px-3 py-2.5 text-[13px]">
              <span className="font-medium text-ink">{event.label}</span>
              <span className="text-ink-2">{formatDateTime(event.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
