import FeatureFlagsAdminClient from "./FeatureFlagsAdminClient";
import { getFeatureFlagOverridesForAdmin } from "@/lib/data/feature-flag-overrides";
import { getReleasesForAdmin } from "@/lib/data/releases";
import { getFlagBulkHistoryAction } from "@/app/actions/flag-bulk";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — aggiunta
// getReleasesForAdmin() accanto alla lettura già esistente, in parallelo
// (Promise.all): stessa pagina, stesso route, nessuna nuova top-level page
// creata (istruzione esplicita di Fabrizio).
export default async function AdminFeatureFlagsPage() {
  // 13/11/2026: + storico delle operazioni in blocco (activity_log, sola lettura).
  const [entries, releases, history] = await Promise.all([
    getFeatureFlagOverridesForAdmin(),
    getReleasesForAdmin(),
    getFlagBulkHistoryAction(10),
  ]);
  return <FeatureFlagsAdminClient initialEntries={entries} initialReleases={releases} initialHistory={history} />;
}
