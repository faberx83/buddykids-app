import "server-only";

// TRAMA — lettura dei "non serve" sulle chiusure (20/10/2026): vedi
// lib/nextgen/closure-not-needed.ts. Solo le righe per un figlio preciso
// (kid_id valorizzato) e di tipo "not_needed". Qualunque errore → nessun
// "non serve" (mai bloccare Planner, Home o promemoria).

import type { ClosureNotNeeded } from "@/lib/nextgen/closure-not-needed";

interface QueryClient {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        eq: (col: string, value: string) => {
          not: (col: string, op: string, value: null) => PromiseLike<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
}

export async function getClosureNotNeededForParent(client: unknown, parentId: string): Promise<ClosureNotNeeded[]> {
  try {
    const { data, error } = await (client as QueryClient)
      .from("school_calendar_overrides")
      .select("kid_id, week_start_date")
      .eq("parent_id", parentId)
      .eq("override_type", "not_needed")
      .not("kid_id", "is", null);
    if (error || !Array.isArray(data)) return [];
    return (data as { kid_id: string; week_start_date: string }[]).map((r) => ({ kidId: r.kid_id, weekStartDate: String(r.week_start_date).slice(0, 10) }));
  } catch {
    return [];
  }
}
