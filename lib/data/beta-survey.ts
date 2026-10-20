import "server-only";

// TRAMA — ADMIN BETA COCKPIT · Quale survey mostrare in Home a questo
// genitore (al massimo una). Dietro BETA_SURVEY_ENABLED (card Release);
// fail-closed: qualunque errore = nessuna survey, la Home resta com'è.

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { diffDays, romeDay } from "@/lib/beta-cockpit/dates";
import { dueSurvey, resolveSurveyConfig, SURVEYS, type SurveyDefinition } from "@/lib/beta-cockpit/survey";

export async function loadBetaSurveyForUser(userId: string): Promise<SurveyDefinition | null> {
  try {
    const flag = await resolveFeatureFlagVisibility({
      flagName: "BETA_SURVEY_ENABLED",
      userId,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    if (!flag.enabled) return null;

    const supabase = await createClient();
    const ids = SURVEYS.map((s) => s.id);
    const [profileRes, answeredRes, receiptsRes] = await Promise.all([
      supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
      supabase.from("beta_feedback").select("area").eq("parent_id", userId).in("area", ids),
      supabase.from("announcement_receipts").select("announcement_id, dismissed_at").eq("parent_id", userId).in("announcement_id", ids),
    ]);
    const createdAt = profileRes.data?.created_at as string | undefined;
    if (!createdAt) return null;

    // Le impostazioni sono leggibili solo dall'Admin: le legge il server, una riga.
    const service = createServiceClient();
    const settings = service ? await service.from("beta_cockpit_settings").select("survey_config").eq("id", 1).maybeSingle() : null;

    const now = new Date();
    return dueSurvey({
      registeredDaysAgo: diffDays(romeDay(createdAt), romeDay(now)),
      answered: new Set((answeredRes.data ?? []).map((r) => r.area as string)),
      snoozedAt: new Map(
        (receiptsRes.data ?? []).filter((r) => r.dismissed_at).map((r) => [r.announcement_id as string, r.dismissed_at as string])
      ),
      now,
      config: resolveSurveyConfig(settings?.data?.survey_config),
    });
  } catch {
    return null;
  }
}
