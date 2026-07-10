// KPI Admin: analisi Presenze/Check-in cross-centro (proposta a Fabrizio
// insieme al pannello SLA Richieste e ai Preferiti come segnale di domanda).
// A differenza di lib/data/attendance-report.ts (un solo centro, lato
// Gestore), qui aggreghiamo TUTTI i centri per individuare chi si discosta
// dalla media piattaforma — non è detto sia un problema del centro (può
// essere un errore di registrazione), ma è un buon punto di partenza.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface CenterAttendanceStat {
  centerId: string;
  centerName: string;
  centerEmoji: string;
  totalRecords: number;
  assenteCount: number;
  inRitardoCount: number;
  // (assenti + in ritardo) / totale — stessa definizione usata in
  // attendance-report.ts lato Gestore.
  issueRate: number;
  // Quanto questo centro si discosta dalla media piattaforma, in punti
  // percentuali (positivo = peggio della media).
  deltaFromPlatformAvg: number;
}

export interface AttendanceAdminOverview {
  centers: CenterAttendanceStat[];
  platformIssueRate: number;
  hasData: boolean;
}

interface RawRow {
  status: "presente" | "assente" | "in_ritardo";
  date: string;
  activities: { center_id: string | null; centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null } | { center_id: string | null; centers: { name: string; emoji: string | null } | { name: string; emoji: string | null }[] | null }[] | null;
}

export async function getAttendanceOverviewForAdmin(): Promise<AttendanceAdminOverview> {
  const empty: AttendanceAdminOverview = { centers: [], platformIssueRate: 0, hasData: false };
  if (!isSupabaseConfigured) return empty;

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("attendance_records")
    .select("status, date, activities ( center_id, centers ( name, emoji ) )")
    .lte("date", today) // solo giorni già trascorsi, coerente col Registro/Report presenze del Gestore
    .limit(5000);

  if (error || !data) return empty;

  interface Acc {
    centerName: string;
    centerEmoji: string;
    total: number;
    assente: number;
    inRitardo: number;
  }
  const map = new Map<string, Acc>();

  for (const row of data as unknown as RawRow[]) {
    const activity = firstOf(row.activities);
    const centerId = activity?.center_id;
    if (!centerId) continue;
    const center = firstOf(activity?.centers);

    const existing = map.get(centerId) ?? {
      centerName: center?.name || "Centro",
      centerEmoji: center?.emoji || "🏫",
      total: 0,
      assente: 0,
      inRitardo: 0,
    };
    existing.total += 1;
    if (row.status === "assente") existing.assente += 1;
    if (row.status === "in_ritardo") existing.inRitardo += 1;
    map.set(centerId, existing);
  }

  if (map.size === 0) return empty;

  const totalRecordsPlatform = Array.from(map.values()).reduce((sum, a) => sum + a.total, 0);
  const totalIssuesPlatform = Array.from(map.values()).reduce((sum, a) => sum + a.assente + a.inRitardo, 0);
  const platformIssueRate = totalRecordsPlatform > 0 ? totalIssuesPlatform / totalRecordsPlatform : 0;

  const centers: CenterAttendanceStat[] = Array.from(map.entries())
    .map(([centerId, acc]) => {
      const issueRate = acc.total > 0 ? (acc.assente + acc.inRitardo) / acc.total : 0;
      return {
        centerId,
        centerName: acc.centerName,
        centerEmoji: acc.centerEmoji,
        totalRecords: acc.total,
        assenteCount: acc.assente,
        inRitardoCount: acc.inRitardo,
        issueRate,
        deltaFromPlatformAvg: (issueRate - platformIssueRate) * 100,
      };
    })
    // Prima i centri più fuori norma (peggio della media), a parità quello
    // con più dati raccolti (statisticamente più affidabile).
    .sort((a, b) => b.deltaFromPlatformAvg - a.deltaFromPlatformAvg || b.totalRecords - a.totalRecords);

  return { centers, platformIssueRate, hasData: true };
}
