import "server-only";

// TRAMA ONE — Trust telemetry minima (Gap P1, PT-MVP-11 / A-MVP-07, Handbook
// Partner 1.1 / Admin 1.1). Vincolo esplicito della documentazione MVP
// Settembre 2026: nessuno score aggregato o "Partnership Level" va calcolato
// o mostrato al Partner (né in nessuna UI a MVP) — qui si raccolgono SOLO i
// segnali grezzi, a uso interno Admin. Il calcolo di uno score è Fase 2/3,
// esplicitamente FUORI SCOPE e non implementato in questo file.
//
// Riuso (CLAUDE.md §2, reuse-first):
//  - completezza onboarding -> lib/onboarding/data.ts::getChecklistCompletions
//    (già esistente, Sprint 1), qui solo trasformato in percentuale.
//  - SLA prenotazioni / richieste genitore -> lib/data/admin-bookings.ts e
//    lib/data/admin-inquiries.ts (già esistenti, Sprint 4), già aggregati
//    per centro: qui solo indicizzati per centerId, nessuna nuova query SLA.
//  - cancellazioni e freschezza contenuti sono i DUE segnali nuovi di questo
//    file, con lo stesso pattern query delle due funzioni sopra (query su
//    tabella con join activities.center_id, limit 3000, aggregazione in Map).
//
// Scala (stessa nota di app/admin/one/onboarding/page.tsx): pensato per la
// scala pilot (5-10 centri beta), non per un catalogo di migliaia di centri.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getBookingsSlaOverview } from "./admin-bookings";
import { getInquiriesSlaOverview } from "./admin-inquiries";
import { getChecklistCompletions } from "@/lib/onboarding/data";
import { ONBOARDING_CHECKLIST_REGISTRY } from "@/lib/onboarding/checklist-registry";

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface CenterTrustSignals {
  centerId: string;
  // Completezza onboarding (%): quota di voci della checklist completate (0-100).
  completenessPercent: number | null;
  // Freschezza contenuti: giorni dall'ULTIMA attività CREATA per questo
  // centro. LIMITE documentato: activities non ha una colonna updated_at,
  // quindi questo è un proxy solo sulla creazione di nuovi contenuti, non
  // sulla manutenzione di quelli esistenti (un'attività creata mesi fa e mai
  // aggiornata non si distingue da una tenuta volutamente stabile). null se
  // il centro non ha ancora nessuna attività.
  contentFreshnessDays: number | null;
  // SLA prenotazioni (riuso lib/data/admin-bookings.ts, nessuna nuova query).
  bookingAvgResponseHours: number | null;
  bookingPendingCount: number;
  // SLA richieste genitore (riuso lib/data/admin-inquiries.ts, nessuna nuova query).
  inquiryAvgResponseHours: number | null;
  inquiryOpenCount: number;
  // Cancellazioni per iniziativa del centro (NUOVO segnale).
  cancelledByCenterCount: number;
  totalBookingsIncludingCancelled: number;
  cancellationRatePercent: number | null;
}

interface CancellationRawRow {
  status: string;
  cancelled_by: "parent" | "center" | null;
  activities: { center_id: string | null } | { center_id: string | null }[] | null;
}

interface FreshnessRawRow {
  center_id: string | null;
  created_at: string;
}

async function getCancellationSignals(): Promise<Map<string, { cancelledByCenter: number; total: number }>> {
  const map = new Map<string, { cancelledByCenter: number; total: number }>();
  if (!isSupabaseConfigured) return map;

  const supabase = await createClient();
  // A differenza di getBookingsSlaOverview() (che esclude "cancelled" per
  // calcolare la SLA di risposta), qui servono ANCHE le prenotazioni
  // cancellate: il tasso di cancellazione si calcola su tutte le
  // prenotazioni, non solo su quelle attive.
  const { data, error } = await supabase
    .from("bookings")
    .select("status, cancelled_by, activities ( center_id )")
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error || !data) return map;

  for (const row of data as unknown as CancellationRawRow[]) {
    const activity = firstOf(row.activities);
    const centerId = activity?.center_id;
    if (!centerId) continue;

    const existing = map.get(centerId) ?? { cancelledByCenter: 0, total: 0 };
    existing.total += 1;
    if (row.status === "cancelled" && row.cancelled_by === "center") existing.cancelledByCenter += 1;
    map.set(centerId, existing);
  }

  return map;
}

async function getFreshnessSignals(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!isSupabaseConfigured) return map;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select("center_id, created_at")
    .order("created_at", { ascending: false })
    .limit(3000);

  if (error || !data) return map;

  const now = Date.now();
  const latestMsByCenterId = new Map<string, number>();
  for (const row of data as unknown as FreshnessRawRow[]) {
    if (!row.center_id) continue;
    const createdMs = new Date(row.created_at).getTime();
    const existing = latestMsByCenterId.get(row.center_id);
    if (existing === undefined || createdMs > existing) latestMsByCenterId.set(row.center_id, createdMs);
  }

  for (const [centerId, latestMs] of latestMsByCenterId.entries()) {
    map.set(centerId, (now - latestMs) / (1000 * 60 * 60 * 24));
  }

  return map;
}

/**
 * Trust telemetry minima per un set di centri — uso Admin-only (es.
 * /admin/one/onboarding). Ritorna SOLO segnali grezzi, MAI uno score
 * aggregato o un "Partnership Level": vincolo esplicito MVP Settembre 2026
 * (score/livello sono Fase 2/3, fuori scope, non implementati qui).
 */
export async function getTrustSignalsForCenters(
  centerIds: string[]
): Promise<Map<string, CenterTrustSignals>> {
  const result = new Map<string, CenterTrustSignals>();
  if (!isSupabaseConfigured || centerIds.length === 0) return result;

  const [bookingsSla, inquiriesSla, cancellationMap, freshnessMap, checklistResults] = await Promise.all([
    getBookingsSlaOverview(),
    getInquiriesSlaOverview(),
    getCancellationSignals(),
    getFreshnessSignals(),
    Promise.all(centerIds.map(async (id) => ({ id, items: await getChecklistCompletions(id) }))),
  ]);

  const bookingByCenterId = new Map(bookingsSla.centers.map((c) => [c.centerId, c]));
  const inquiryByCenterId = new Map(inquiriesSla.centers.map((c) => [c.centerId, c]));
  const checklistByCenterId = new Map(checklistResults.map((r) => [r.id, r.items]));
  const registrySize = ONBOARDING_CHECKLIST_REGISTRY.length;

  for (const centerId of centerIds) {
    const booking = bookingByCenterId.get(centerId);
    const inquiry = inquiryByCenterId.get(centerId);
    const cancellation = cancellationMap.get(centerId);
    const checklist = checklistByCenterId.get(centerId) ?? [];
    const completedCount = checklist.filter((c) => c.completed).length;

    result.set(centerId, {
      centerId,
      completenessPercent: registrySize > 0 ? Math.round((completedCount / registrySize) * 100) : null,
      contentFreshnessDays: freshnessMap.get(centerId) ?? null,
      bookingAvgResponseHours: booking?.avgResponseHours ?? null,
      bookingPendingCount: booking?.pendingCount ?? 0,
      inquiryAvgResponseHours: inquiry?.avgResponseHours ?? null,
      inquiryOpenCount: inquiry?.openCount ?? 0,
      cancelledByCenterCount: cancellation?.cancelledByCenter ?? 0,
      totalBookingsIncludingCancelled: cancellation?.total ?? 0,
      cancellationRatePercent:
        cancellation && cancellation.total > 0
          ? Math.round((cancellation.cancelledByCenter / cancellation.total) * 100)
          : null,
    });
  }

  return result;
}
