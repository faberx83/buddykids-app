import Link from "next/link";
import { getRecentDeployEvents } from "@/lib/data/deploy-events";
import { formatBuildLabel, getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

// TRAMA — ADMIN OPERATIVO (12/11/2026): Impostazioni → Stato sistema.
// Richiesta di Fabrizio: "Sposta deploy, branch e commit in 'Stato
// sistema'". Prima l'esito dell'ultimo deploy era un banner su ogni pagina
// Admin; ora il banner resta solo in "Oggi" e qui c'è lo storico (deploy_events,
// migration 33, scritto da deploy.sh) con ramo, commit, test ed esito, più la
// build servita adesso. Sola lettura (RLS: solo platform_admin).
function when(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export default async function AdminSistemaPage() {
  const events = await getRecentDeployEvents(20);
  const build = getBuildInfo();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Stato sistema</h1>
        <p className="mt-1 text-sm text-navy-text2">
          Build servita adesso: <span className="font-semibold text-white">{formatBuildLabel(build)}</span>. Gli ultimi lanci di{" "}
          <code>bash deploy.sh</code> con ramo, commit ed esito dei test.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#E8EBF0] bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#E8EBF0] text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Quando</th>
              <th className="px-4 py-2.5 font-medium">Esito</th>
              <th className="px-4 py-2.5 font-medium">Ramo</th>
              <th className="px-4 py-2.5 font-medium">Commit</th>
              <th className="px-4 py-2.5 font-medium">Test</th>
              <th className="px-4 py-2.5 font-medium">Messaggio</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[#F0F2F5] last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{when(e.createdAt)}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${e.status === "ok" ? "bg-green-light text-[#2d8f52]" : "bg-[#FBEAEA] text-[#C0392B]"}`}>
                    {e.status === "ok" ? "OK" : "KO"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-2">{e.branch ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-2">{e.commitSha ? e.commitSha.slice(0, 7) : "—"}</td>
                <td className="px-4 py-2.5 text-ink-2">{[e.testScope, e.testResult].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-2.5 text-ink-2">{e.message ?? "—"}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink-2">
                  Nessun deploy registrato (o tabella deploy_events non disponibile).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-navy-text2">
        Feature flag e release: <Link href="/admin/feature-flags" className="font-semibold text-white underline">Feature flag</Link>.
      </p>
    </div>
  );
}
