import "server-only";

// TRAMA — RELEASE CANDIDATE 20/11 (16/11/2026), Lotto A1. Richiesta di
// Fabrizio: "Una famiglia reale non autorizzata non possa inoltrare
// richieste verso attività DEMO… Non affidarti esclusivamente ai nomi".
// Legge i DATI (centers.is_demo dalla migration 63, is_test_fixture) col
// client di servizio; il nome resta solo come ripiego prima della migration.
// Collaudatore = stessa regola di lib/nextgen/demo-label.ts#isDemoTester e
// della funzione SQL public.can_simulate_demo(). Fail-closed: qualunque
// errore nel leggere → attività trattata come DEMO, utente come non
// collaudatore.

import { createServiceClient } from "@/lib/supabase/service";
import { getActiveCohortKeys } from "@/lib/beta-cohorts/membership";
import { isVersionToggleTestAccount } from "@/lib/dev/test-accounts";
import { demoRequestMode, isDemoCenterRecord, isDemoTester, looksLikeDemoNameForActivity, type DemoRequestMode } from "@/lib/nextgen/demo-label";

export interface DemoAccess {
  demo: boolean;
  tester: boolean;
  mode: DemoRequestMode;
}

type CenterRow = { name: string | null; is_test_fixture: boolean | null; is_demo?: boolean | null };

async function readActivityCenter(activityDbId: string): Promise<{ activityName: string | null; center: CenterRow | null } | "error"> {
  const service = createServiceClient();
  if (!service) return "error";
  const withDemo = await service
    .from("activities")
    .select("name, centers ( name, is_test_fixture, is_demo )")
    .eq("id", activityDbId)
    .maybeSingle();
  let data = withDemo.data as { name: string | null; centers: CenterRow | CenterRow[] | null } | null;
  if (withDemo.error) {
    // Migration 63 non ancora applicata: is_demo manca, ripiego su is_test_fixture + nome.
    const base = await service.from("activities").select("name, centers ( name, is_test_fixture )").eq("id", activityDbId).maybeSingle();
    if (base.error) return "error";
    data = base.data as typeof data;
  }
  if (!data) return { activityName: null, center: null };
  const center = Array.isArray(data.centers) ? (data.centers[0] ?? null) : data.centers;
  return { activityName: data.name, center };
}

/** failClosed (default): in caso di errore di lettura l'attività è trattata come DEMO. Per i soli testi passare false. */
export async function isDemoActivityById(activityDbId: string, opts: { failClosed?: boolean } = {}): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(activityDbId)) return false; // dati mock locali
  const row = await readActivityCenter(activityDbId);
  if (row === "error") return opts.failClosed ?? true;
  if (!row.center) return false;
  // Dopo la migration 63 decide il dato (is_demo / is_test_fixture): un'attività
  // vera con "test" nel nome non viene bloccata. Prima, ripiego sui nomi.
  if (typeof row.center.is_demo === "boolean") return row.center.is_demo || row.center.is_test_fixture === true;
  return (
    isDemoCenterRecord({ name: row.center.name, isTestFixture: row.center.is_test_fixture }) ||
    looksLikeDemoNameForActivity(row.activityName)
  );
}

export async function isDemoTesterUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const service = createServiceClient();
    if (!service) return false;
    const { data } = await service.from("profiles").select("role, email").eq("id", userId).maybeSingle();
    const cohortKeys = await getActiveCohortKeys(userId);
    return isDemoTester({
      role: (data as { role?: string | null } | null)?.role ?? null,
      isFabrizioTestAccount: isVersionToggleTestAccount((data as { email?: string | null } | null)?.email ?? null),
      cohortKeys,
    });
  } catch {
    return false;
  }
}

/** Nelle server action resta fail-closed (default); nelle pagine si passa failClosed: false, tanto l'azione ricontrolla. */
export async function getDemoAccess(
  activityDbId: string | null | undefined,
  userId: string | null | undefined,
  opts: { failClosed?: boolean } = {}
): Promise<DemoAccess> {
  if (!activityDbId) return { demo: false, tester: false, mode: "none" };
  const demo = await isDemoActivityById(activityDbId, opts);
  if (!demo) return { demo: false, tester: false, mode: "none" };
  const tester = await isDemoTesterUser(userId);
  return { demo, tester, mode: demoRequestMode(demo, tester) };
}
