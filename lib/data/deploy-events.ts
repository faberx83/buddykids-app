// Banner "ultimo deploy" nell'app Admin — vedi
// supabase/migration_33_deploy_events.sql e
// app/internal/deploy-notify/route.ts per il resto della feature.
//
// A differenza dell'endpoint interno (che usa la service_role key), questa
// lettura passa dal client Supabase NORMALE (lib/supabase/server.ts): resta
// soggetta alla RLS "solo platform_admin legge" — coerente con
// app/admin/layout.tsx, che già verifica il ruolo prima di renderizzare
// qualunque contenuto Admin, ma non fa mai male avere anche la RLS come
// seconda barriera indipendente dal codice applicativo.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface DeployEvent {
  id: string;
  status: "ok" | "ko";
  branch: string | null;
  commitSha: string | null;
  testScope: string | null;
  testResult: string | null;
  message: string | null;
  createdAt: string;
}

interface RawDeployEventRow {
  id: string;
  status: string;
  branch: string | null;
  commit_sha: string | null;
  test_scope: string | null;
  test_result: string | null;
  message: string | null;
  created_at: string;
}

// Ritorna null se: Supabase non configurato, nessun evento ancora
// registrato, utente non platform_admin (RLS), o
// supabase/migration_33_deploy_events.sql non ancora applicata (tabella
// inesistente) — in TUTTI questi casi il banner semplicemente non appare,
// nessun errore mostrato al genitore/gestore/admin.
export async function getLatestDeployEvent(): Promise<DeployEvent | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deploy_events")
    .select("id, status, branch, commit_sha, test_scope, test_result, message, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as RawDeployEventRow;
  return {
    id: row.id,
    status: row.status === "ok" ? "ok" : "ko",
    branch: row.branch,
    commitSha: row.commit_sha,
    testScope: row.test_scope,
    testResult: row.test_result,
    message: row.message,
    createdAt: row.created_at,
  };
}
