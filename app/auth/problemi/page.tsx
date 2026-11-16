import type { Metadata } from "next";
import AccessProblemForm from "./AccessProblemForm";

// TRAMA — LOTTO P0 BETA READINESS (16/11/2026): "Problemi ad accedere?".
// Pagina PUBBLICA (proxy.ts esclude /auth/* dal role-gate, come
// /auth/candidati e /auth/reset-password). Nessun account richiesto: vedi
// app/actions/access-problem.ts e lib/nextgen/access-problem.ts.
export const metadata: Metadata = {
  title: "Problemi ad accedere? · TRAMA",
  robots: { index: false, follow: false },
};

export default function AccessProblemPage() {
  return <AccessProblemForm />;
}
