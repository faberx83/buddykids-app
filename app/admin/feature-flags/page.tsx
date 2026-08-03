import FeatureFlagsAdminClient from "./FeatureFlagsAdminClient";
import { getFeatureFlagOverridesForAdmin } from "@/lib/data/feature-flag-overrides";

export default async function AdminFeatureFlagsPage() {
  const entries = await getFeatureFlagOverridesForAdmin();
  return <FeatureFlagsAdminClient initialEntries={entries} />;
}
