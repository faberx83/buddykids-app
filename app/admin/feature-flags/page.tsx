import FeatureFlagsAdminClient from "./FeatureFlagsAdminClient";
import { getFeatureFlagOverridesForAdmin } from "@/lib/data/feature-flag-overrides";
import { getReleasesForAdmin } from "@/lib/data/releases";

// TRAMA — INTERNAL PREVIEW / DARK RELEASE MODEL (10/09/2026) — aggiunta
// getReleasesForAdmin() accanto alla lettura già esistente, in parallelo
// (Promise.all): stessa pagina, stesso route, nessuna nuova top-level page
// creata (istruzione esplicita di Fabrizio).
export default async function AdminFeatureFlagsPage() {
  const [entries, releases] = await Promise.all([getFeatureFlagOverridesForAdmin(), getReleasesForAdmin()]);
  return <FeatureFlagsAdminClient initialEntries={entries} initialReleases={releases} />;
}
