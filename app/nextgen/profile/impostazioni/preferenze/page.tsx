import PreferenzeView from "@/components/PreferenzeView";
import WalkthroughRestartButton from "@/components/WalkthroughRestartButton";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";
import { getTutorialDefinition } from "@/lib/walkthrough/registry";
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
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: authProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      const realRole = (authProfile?.role as Role) ?? "parent";
      showReplay =
        realRole === "parent" &&
        (await resolveFeatureFlag({
          flagName: "TRAMA_ONE_ENABLED",
          userId: user.id,
          role: realRole,
          tenant: "family",
          correlationId: generateCorrelationId(),
        }));
    }
  }
  const carousel = getTutorialDefinition("parent_beta_onboarding");
  const tour = getTutorialDefinition("discover_book_parent");

  return (
    <div>
      <PreferenzeView showBrandIcon />
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
