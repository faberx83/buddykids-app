import Link from "next/link";
import { getWalkthroughAdminSummary } from "@/lib/walkthrough/data";

// Dipende dal ruolo dell'utente loggato (visibilità aggregata solo per
// platform_admin, applicata dalla RLS di tutorial_progress) — stessa
// motivazione delle altre pagine /one già forzate a dynamic.
export const dynamic = "force-dynamic";

// TRAMA ONE — Admin. Sprint 0: shell/foundation. Sprint 1: coda di revisione
// onboarding centri + visibilità minima sul motore Walkthrough, collegate da
// qui (command center completo resta Sprint 6, fuori scope).
export default async function OneAdminPage() {
  const walkthroughSummary = await getWalkthroughAdminSummary("welcome_parent");

  return (
    <main style={{ padding: 24 }}>
      <h1>TRAMA ONE — Admin</h1>
      <p>
        <Link href="/admin/one/onboarding" style={{ color: "#2E86DE", fontWeight: 600 }}>
          Vai alla revisione onboarding centri →
        </Link>
      </p>

      <div style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          Walkthrough &quot;Benvenuto in TRAMA ONE&quot; — avanzamento (visibilità minima)
        </h2>
        <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Step</th>
              <th style={thStyle}>In corso</th>
              <th style={thStyle}>Completato</th>
              <th style={thStyle}>Saltato</th>
            </tr>
          </thead>
          <tbody>
            {walkthroughSummary.map((s) => (
              <tr key={s.key}>
                <td style={tdStyle}>{s.title}</td>
                <td style={tdStyle}>{s.inProgress}</td>
                <td style={tdStyle}>{s.completed}</td>
                <td style={tdStyle}>{s.skipped}</td>
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
