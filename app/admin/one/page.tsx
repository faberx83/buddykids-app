import Link from "next/link";
import { getWalkthroughAdminSummary, getWalkthroughRestartCount } from "@/lib/walkthrough/data";
import { computeWalkthroughFunnel } from "@/lib/walkthrough/funnel";
import { getCommandCenterQueues, summarizeCommandCenterQueues } from "@/lib/data/command-center";
import { QueuePriority } from "@/lib/command-center/priority";

// Dipende dal ruolo dell'utente loggato (visibilità aggregata solo per
// platform_admin, applicata dalla RLS di tutorial_progress/onboarding/ecc.)
// — stessa motivazione delle altre pagine /one già forzate a dynamic.
export const dynamic = "force-dynamic";

// TRAMA ONE Build Sprint 6 (E08, ACR-001/008/015, DEC-51) — Command Center
// Admin: prima di questo sprint questa pagina era solo un placeholder con
// due link ("command center completo resta Sprint 6, fuori scope" — vedi
// git history). Ora aggrega le code operative già esistenti nei sette
// domini Admin (onboarding, prenotazioni, richieste, centri-lead,
// certificazioni, segnalazioni BETA, feature flag) in un'unica vista
// prioritizzata (lib/data/command-center.ts) — nessuna delle pagine per
// dominio viene toccata o sostituita, restano l'unico posto dove l'Admin
// AGISCE davvero (Separation of duties, Handbook Admin 1.1 §1.2): questa
// pagina è solo un punto di ingresso più rapido con priorità già calcolata.
const PRIORITY_LABEL: Record<QueuePriority, string> = { alta: "Alta", media: "Media", bassa: "Bassa" };
const PRIORITY_COLOR: Record<QueuePriority, { bg: string; fg: string }> = {
  alta: { bg: "#FDECEA", fg: "#C0392B" },
  media: { bg: "#FFF6E5", fg: "#B7791F" },
  bassa: { bg: "#EAF7EE", fg: "#2E7D46" },
};

export default async function OneAdminPage() {
  const [queues, walkthroughSummary, restartCount] = await Promise.all([
    getCommandCenterQueues(),
    getWalkthroughAdminSummary("welcome_parent"),
    getWalkthroughRestartCount("welcome_parent"),
  ]);
  const summary = summarizeCommandCenterQueues(queues);
  const funnel = computeWalkthroughFunnel(walkthroughSummary);

  return (
    <main style={{ padding: 24 }}>
      <h1>TRAMA ONE — Admin</h1>
      <p style={{ color: "#555", fontSize: 13, marginTop: 4 }}>
        Command Center: {summary.totalOpen} elementi in sospeso su tutte le code
        {summary.criticalQueueCount > 0
          ? `, ${summary.criticalQueueCount} coda${summary.criticalQueueCount === 1 ? "" : "e"} in priorità alta`
          : ""}
        .
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {queues.map((q) => {
          const colors = PRIORITY_COLOR[q.priority];
          return (
            <Link
              key={q.key}
              href={q.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 16px",
                border: "1px solid #E8EBF0",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                background: "#fff",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{q.label}</div>
                {q.detail && <div style={{ fontSize: 12, color: "#8A93A3", marginTop: 2 }}>{q.detail}</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: colors.bg,
                    color: colors.fg,
                  }}
                >
                  {PRIORITY_LABEL[q.priority]}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, minWidth: 28, textAlign: "right" }}>{q.count}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Walkthrough &quot;Benvenuto in TRAMA ONE&quot; — avanzamento e funnel (Sprint 6, hardening)
        </h2>
        <p style={{ fontSize: 12, color: "#8A93A3", marginBottom: 8 }}>
          &quot;Raggiunti&quot; = utenti arrivati almeno a questo step; &quot;Abbandono&quot; = persi rispetto allo
          step precedente (in corso, completato o saltato ma senza mai proseguire).
          {restartCount !== null
            ? ` Percorso ricominciato ${restartCount} volt${restartCount === 1 ? "a" : "e"} in totale.`
            : " Conteggio riavvii non disponibile (richiede migration_20_product_events.sql applicata)."}
        </p>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Step</th>
              <th style={thStyle}>Raggiunti</th>
              <th style={thStyle}>In corso</th>
              <th style={thStyle}>Completato</th>
              <th style={thStyle}>Saltato</th>
              <th style={thStyle}>Abbandono vs step prec.</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((s) => (
              <tr key={s.key}>
                <td style={tdStyle}>{s.title}</td>
                <td style={tdStyle}>{s.reached}</td>
                <td style={tdStyle}>{s.inProgress}</td>
                <td style={tdStyle}>{s.completed}</td>
                <td style={tdStyle}>{s.skipped}</td>
                <td style={tdStyle}>
                  {s.dropOffFromPrevious === null ? "—" : `${s.dropOffFromPrevious} (${s.dropOffRatePercent}%)`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 12px",
  borderBottom: "1px solid #E8EBF0",
  color: "#8A93A3",
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderBottom: "1px solid #F0F2F5",
};
