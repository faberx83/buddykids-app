import Link from "next/link";
import PushNotificationsPrompt from "@/components/PushNotificationsPrompt";
import DeployStatusBanner from "@/components/admin/DeployStatusBanner";
import { getLatestDeployEvent } from "@/lib/data/deploy-events";
import { getCommandCenterQueues, summarizeCommandCenterQueues } from "@/lib/data/command-center";
import { QueuePriority } from "@/lib/command-center/priority";
import { ageLabel, dueLabel } from "@/lib/admin-ops/queues";
import { daysBetween, romeTodayIso } from "@/lib/admin-ops/bookings";

// Code reali per l'Admin loggato (RLS e controllo platform_admin nei data
// layer): mai in cache.
export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): "Oggi", la home Admin. Richiesta di
// Fabrizio: "Fai del Command Center la home Admin e chiamala 'Oggi'. Ogni
// contatore apre la coda già filtrata e il conteggio deve corrispondere alle
// righe risultanti, a parità di filtri. Per ogni coda mostra chi deve agire,
// anzianità, eventuale scadenza e prossimo passo. Dai evidenza alle attività
// imminenti rimaste senza risposta." Iniziativa:
// claude/INIZIATIVA_admin_operativo.md.
//
// Prima: /admin era una dashboard su dati finti (ora /admin/demo) e il
// Command Center viveva in /admin/one solo con TRAMA_ONE_ENABLED. Ora le
// code sono qui, per ogni Admin; /admin/one rimanda qui. Le etichette delle
// code sono quelle di prima (tests/one/command-center.spec.ts). Il funnel del
// walkthrough è in Analisi e crescita. Il banner dell'ultimo deploy compare
// solo qui; lo storico è in Impostazioni → Stato sistema.
const PRIORITY_LABEL: Record<QueuePriority, string> = { alta: "Alta", media: "Media", bassa: "Bassa" };
const PRIORITY_CLASS: Record<QueuePriority, string> = {
  alta: "bg-[#FBEAEA] text-[#C0392B]",
  media: "bg-orange-light text-trama-orange",
  bassa: "bg-green-light text-[#2d8f52]",
};
const ACTOR_CLASS: Record<string, string> = {
  centro: "bg-[#E8F6FD] text-[#1C6E9E]",
  famiglia: "bg-[#F0EEFF] text-[#6F63C5]",
  trama: "bg-[#FFF3E0] text-[#8A4B00]",
};

export default async function AdminOggiPage() {
  const [queues, deployEvent] = await Promise.all([getCommandCenterQueues(), getLatestDeployEvent()]);
  const summary = summarizeCommandCenterQueues(queues);
  const today = romeTodayIso();
  const todayLabel = new Date(today + "T12:00:00Z").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const open = queues.filter((q) => q.count > 0);
  const empty = queues.filter((q) => q.count === 0);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Oggi</h1>
        <p className="mt-1 text-sm text-navy-text2">
          {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)} · {summary.totalOpen} elementi in sospeso su tutte le code
          {summary.criticalQueueCount > 0
            ? `, ${summary.criticalQueueCount} coda${summary.criticalQueueCount === 1 ? "" : "e"} in priorità alta`
            : ""}
          . I centri e le attività di prova non sono contati.
        </p>
      </div>

      <DeployStatusBanner event={deployEvent} />
      <PushNotificationsPrompt />

      {open.length === 0 ? (
        <div className="mb-6 rounded-lg border border-dashed border-navy-3 p-6 text-center">
          <p className="text-sm text-navy-text2">Niente da fare in nessuna coda.</p>
        </div>
      ) : (
        <div className="mb-6 grid gap-3" data-testid="oggi-queues">
          {open.map((q) => (
            <section
              key={q.key}
              data-queue={q.key}
              className={`rounded-lg border bg-white px-4 py-3 ${q.key === "bookings-imminent" ? "border-[#E8543E]" : "border-[#E8EBF0]"}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={q.href} className="text-sm font-semibold text-ink no-underline hover:underline">
                    {q.label}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ACTOR_CLASS[q.actor]}`}>{q.actorLabel}</span>
                    {q.detail && <span>{q.detail}</span>}
                  </div>
                  <div className="mt-1 text-xs text-ink-2">
                    <span className="font-semibold text-ink">Prossimo passo:</span> {q.nextStep}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${PRIORITY_CLASS[q.priority]}`}>{PRIORITY_LABEL[q.priority]}</span>
                  <Link
                    href={q.href}
                    aria-label={`Apri la coda ${q.label}: ${q.count}`}
                    className="min-w-[28px] text-right text-lg font-bold text-ink no-underline hover:underline"
                  >
                    {q.count}
                  </Link>
                </div>
              </div>
              {q.preview.length > 0 && (
                <ul className="mt-2 divide-y divide-[#F0F2F5] border-t border-[#F0F2F5]">
                  {q.preview.map((it) => {
                    const age = it.createdAt ? ageLabel(Math.max(0, daysBetween(it.createdAt, today))) : null;
                    const due = it.dueDate ? dueLabel(daysBetween(today, it.dueDate)) : null;
                    return (
                      <li key={it.id}>
                        <Link href={it.href} className="flex items-center justify-between gap-3 py-1.5 text-xs no-underline hover:bg-bg">
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{it.title}</span>
                            {it.sub && <span className="block truncate text-ink-2">{it.sub}</span>}
                          </span>
                          <span className="flex-shrink-0 text-right text-ink-2">
                            {due && <span className="block font-semibold text-[#C0392B]">data {due}</span>}
                            {age && <span className="block">arrivata {age}</span>}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <Link href={q.href} className="font-semibold text-sky">
                  Apri la coda ({q.count}) →
                </Link>
                {q.hiddenDemo > 0 && (
                  <span className="text-ink-3">
                    + {q.hiddenDemo} di prova non {q.hiddenDemo === 1 ? "contata" : "contate"}
                  </span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {empty.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-[13px] font-bold text-white">Code vuote</h2>
          <div className="flex flex-wrap gap-2">
            {empty.map((q) => (
              <Link key={q.key} href={q.href} className="rounded-full border border-navy-3 px-3 py-1 text-xs text-navy-text2 no-underline hover:text-white">
                {q.label} · 0
                {q.hiddenDemo > 0 ? ` (+${q.hiddenDemo} di prova)` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs">
        <Link href="/admin/beta" className="font-semibold text-white underline underline-offset-2">
          Beta Famiglie →
        </Link>
        <Link href="/admin/famiglie" className="font-semibold text-white underline underline-offset-2">
          Inviti e registrazioni →
        </Link>
        <Link href="/admin/sistema" className="font-semibold text-white underline underline-offset-2">
          Stato sistema →
        </Link>
      </div>
    </div>
  );
}
