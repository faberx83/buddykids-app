// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Logica PURA dei voti 👍/👎
// sulle Novità "In arrivo" (testabile senza browser né Supabase).

export type AnnouncementVote = 1 | -1;

/** Tap sullo stesso pollice = ritiro il voto (0); sull'altro = cambio voto. */
export function nextVote(current: AnnouncementVote | 0, tapped: AnnouncementVote): AnnouncementVote | 0 {
  return current === tapped ? 0 : tapped;
}

export function voteTelemetryDetail(announcementId: string, vote: AnnouncementVote | 0): string {
  return `${announcementId}:${vote === 1 ? "up" : vote === -1 ? "down" : "none"}`;
}

/** Tabella inesistente (migration 40 non ancora applicata): Postgres 42P01 o PostgREST PGRST205. */
export function isMissingTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .* does not exist|Could not find the table/i.test(error.message ?? "")
  );
}
