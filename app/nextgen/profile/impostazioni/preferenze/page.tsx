import PreferenzeView from "@/components/PreferenzeView";
import WalkthroughRestartButton from "@/components/WalkthroughRestartButton";
import DailyBriefingSettings from "@/components/nextgen/DailyBriefingSettings";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getTutorialDefinition } from "@/lib/walkthrough/registry";
import { PARENT_ONBOARDING_TUTORIAL_KEY } from "@/lib/nextgen/onboarding-slides";
import { ONBOARDING_V2_TUTORIAL_KEY } from "@/lib/nextgen/onboarding-v2";
import { Role } from "@/lib/types";

// TRAMA ONE (24/08/2026) — guscio NEXTGEN-native per "Preferenze", stesso
// pattern di app/nextgen/prenotazioni (task #524): chiude uno dei rimandi
// legacy segnalati da Fabrizio ("nel profilo, sotto impostazioni, ci sono
// ancora rimandi al legacy"). Eredita bottom nav/layout NEXTGEN venendo da
// dentro app/nextgen/*.
//
// FINAL PRE-FREEZE WAVE (sez. 19/24, 08/09/2026) — "PARENT PROFILE: sezione
// AIUTO E GUIDA — 'Rivedi introduzione TRAMA' / 'Avvia tour guidato'". Prima
// di questa wave NESSUNA pagina Parent esponeva un modo per far ripartire
// carousel/tour dopo la prima sessione (a differenza del Partner, che aveva
// già il proprio bottone da agosto — vedi WalkthroughRestartButton.tsx).
// Stesso gate TRAMA_ONE_ENABLED/tenant "family" già usato in
// app/nextgen/layout.tsx per decidere se montare carousel/Spotlight in
// prima battuta: un bottone per riavviare un percorso che l'utente non
// vedrà mai (flag off) sarebbe solo rumore, non un errore.
export default async function NextgenPreferenzePage() {
  let showReplay = false;
  // 20/10/2026 — "Il buongiorno di TRAMA" (release "buongiorno-trama"): null =
  // non mostrare (release spenta o migration_45 non applicata).
  let briefing: { push: boolean; email: boolean; address: string | null } | null = null;
  // ONBOARDING V2 (14/10/2026): con il flag acceso si riavvia la versione nuova.
  let onboardingV2Enabled = false;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const briefingOn = await resolveFeatureFlag({
        flagName: "DAILY_BRIEFING_ENABLED",
        userId: user.id,
        tenant: "family",
        correlationId: generateCorrelationId(),
      }).catch(() => false);
      if (briefingOn) {
        const { data: b, error: bErr } = await supabase
          .from("profiles")
          .select("email, daily_briefing_push, daily_briefing_email")
          .eq("id", user.id)
          .maybeSingle();
        if (!bErr && b) {
          briefing = {
            push: Boolean(b.daily_briefing_push),
            email: Boolean(b.daily_briefing_email),
            address: (b.email as string | null) ?? user.email ?? null,
          };
        }
      }
      const { data: authProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const realRole = (authProfile?.role as Role) ?? "parent";
      // FAMILY-FIRST BETA PASS (07/10/2026): anche l'Admin piattaforma (stesso
      // gate di app/nextgen/layout.tsx per il carousel).
      showReplay =
        (realRole === "parent" || realRole === "platform_admin") &&
        (await resolveFeatureFlag({
          flagName: "TRAMA_ONE_ENABLED",
          userId: user.id,
          role: realRole,
          tenant: "family",
          correlationId: generateCorrelationId(),
        }));
      if (showReplay) {
        onboardingV2Enabled = await resolveFeatureFlag({
          flagName: "ONBOARDING_V2_ENABLED",
          userId: user.id,
          role: realRole,
          tenant: "family",
          correlationId: generateCorrelationId(),
        }).catch(() => false);
      }
    }
  }
  const carousel = getTutorialDefinition(onboardingV2Enabled ? ONBOARDING_V2_TUTORIAL_KEY : PARENT_ONBOARDING_TUTORIAL_KEY);
  const tour = getTutorialDefinition("discover_book_parent");

  return (
    <div>
      <PreferenzeView showBrandIcon />
      {briefing && (
        <div className="px-5 pb-5">
          <DailyBriefingSettings initialPush={briefing.push} initialEmail={briefing.email} email={briefing.address} />
        </div>
      )}
      {showReplay && (
        <div className="space-y-3 px-5 pb-5">
          <div className="text-xs font-semibold text-ink-2">Aiuto e guida</div>
          {carousel && (
            <WalkthroughRestartButton
              tutorialKey={carousel.key}
              tutorialTitle={carousel.title}
              sectionLabel="Introduzione a TRAMA"
              description="Le schermate di benvenuto che spiegano perché TRAMA ti serve e come pensarla — utili se vuoi rivederle da capo."
              actionLabel="Rivedi introduzione TRAMA"
              restartedMessage="Introduzione riavviata: riparte dalla prima schermata al prossimo accesso alla Home."
            />
          )}
          {tour && (
            <WalkthroughRestartButton
              tutorialKey={tour.key}
              tutorialTitle={tour.title}
              sectionLabel="Tour guidato"
              description={`"${tour.title}" ti accompagna passo passo alla prossima navigazione — utile se vuoi rivederlo da capo o se lo hai saltato per errore.`}
              actionLabel="Avvia tour guidato"
              restartedMessage="Tour riavviato: riparte dal primo passo alla prossima navigazione."
            />
          )}
        </div>
      )}
    </div>
  );
}
