import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { tenantForHost, TENANT_CONFIG } from "@/lib/tenant";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { resolvePublishedDocumentForPublicRoute } from "@/lib/legal/gate";
import { cohortForBetaInviteCode } from "@/lib/legal/signup-cohort";

// Anteprima social (WhatsApp/etc.) per i link di invito Beta (?beta=CODICE,
// condivisi manualmente da Fabrizio — vedi app/actions/beta-invites.ts).
// Richiesta esplicita: la preview deve comunicare "TRAMA — Private Beta",
// MAI il valore del codice/token (né in title/description né nell'immagine
// — trama-private-beta.png è un asset STATICO, identico per ogni codice,
// generato una sola volta con next/og a partire dal logo ufficiale, non
// contiene alcun dato variabile). Condizionato SOLO alla presenza del
// parametro `beta`: un link di login normale, o un invito-sconto centro
// (?invite=CODICE), restano SENZA metadata Open Graph dedicati come oggi —
// nessun impatto su quei flussi.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const params = await searchParams;
  if (!params.beta) return {};

  const title = "TRAMA — Private Beta";
  const description = "Organizza attività, settimane e impegni dei tuoi figli in un unico posto.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/og/trama-private-beta.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og/trama-private-beta.png"],
    },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const headerList = await headers();
  const host = headerList.get("host") || "";
  const tenant = tenantForHost(host);
  const config = TENANT_CONFIG[tenant];
  const appName = config.title.split(" — ")[0];

  // PRE-MICRO-PILOT CLOSURE GATE (task #568, 25/08/2026) — pre-signup, nessun
  // account/userId esiste ancora: solo gli scope "global"/"environment"/
  // "tenant" del flag hanno senso qui (uno scope "user"/"cohort" non
  // potrebbe mai combaciare prima che un utente esista). resolveFeatureFlag()
  // risolve comunque sempre a false in modo sicuro se Supabase non è
  // configurato o se nessun override applicabile esiste — che è lo stato di
  // produzione oggi (nessun override è mai stato scritto per questo flag).
  //
  // TRAMA — LEGAL FLOW TECHNICAL CLOSURE BEFORE CONTENT (task #578,
  // 25/08/2026 sera): questa chiamata NON passava `tenant` — gap di wiring
  // (non un bug dell'engine, vedi lib/feature-flags/evaluate.ts), perché
  // rendeva IMPOSSIBILE configurare un rollout scoped a un solo tenant (es.
  // "family"-only) senza toccare il default globale. Aggiunto qui `tenant`
  // (già risolto sopra da tenantForHost(host)) per abilitare, quando
  // Fabrizio vorrà attivare il gate per un pilota ristretto, un override
  // scope="tenant" scope_value="family"/"partner"/"admin" con expires_at
  // valorizzato (mai un override globale permanente — stessa convenzione
  // già in uso altrove nel Feature Control Center, vedi
  // app/admin/layout.tsx#TRAMA_ONE_ENABLED). Nessun comportamento cambia
  // finché un simile override non viene scritto: oggi 0 override esistono
  // per LEGAL_TERMS_GATE, quindi il risultato resta identico (false).
  //
  // 16/10/2026 — release "Consensi e informative" accendibile anche solo al
  // Pilot: chi si registra da un link d'invito beta porta la sua coorte nel
  // codice (?beta=), e la usiamo qui (lib/legal/signup-cohort.ts).
  const betaCode = typeof params.beta === "string" ? params.beta : null;
  const signupCohort = betaCode ? await cohortForBetaInviteCode(betaCode) : null;
  const legalGateEnabled = await resolveFeatureFlag({
    flagName: "LEGAL_TERMS_GATE",
    tenant,
    extraCohortKeys: signupCohort ? [signupCohort] : [],
  });
  const currentTermsDoc = legalGateEnabled
    ? await resolvePublishedDocumentForPublicRoute("terms")
    : null;

  // 20/10/2026 — PAGINA DI BENVENUTO (release "pagina-benvenuto"). Chi apre
  // tramapp.it senza account arriva qui come /auth/login?next=/ (proxy.ts):
  // con la release a tutti lo si porta su /benvenuto, che spiega cos'è TRAMA.
  // Chi tocca "Accedi" (anche dalla pagina di benvenuto) apre /auth/login
  // senza next=/ e resta qui. Beta solo su invito: senza un link d'invito
  // il "Registrati" diventa "Chiedi un invito".
  const landingEnabled =
    tenant === "family" ? await resolveFeatureFlag({ flagName: "LANDING_PUBLIC_ENABLED", tenant }).catch(() => false) : false;
  const nextParam = typeof params.next === "string" ? params.next : null;
  if (landingEnabled && nextParam === "/" && !betaCode && !params.invite && !params.mode) redirect("/benvenuto");

  return (
    <LoginForm
      tenant={tenant}
      appName={appName}
      themeColor={config.themeColor}
      inviteOnly={landingEnabled}
      legalGateEnabled={legalGateEnabled}
      currentTermsDoc={currentTermsDoc ? { id: currentTermsDoc.id, version: currentTermsDoc.version } : null}
    />
  );
}
