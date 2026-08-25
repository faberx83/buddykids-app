import { headers } from "next/headers";
import LoginForm from "./LoginForm";
import { tenantForHost, TENANT_CONFIG } from "@/lib/tenant";
import { resolveFeatureFlag } from "@/lib/feature-flags/resolve";
import { resolvePublishedDocumentForPublicRoute } from "@/lib/legal/gate";

export default async function LoginPage() {
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
  const legalGateEnabled = await resolveFeatureFlag({ flagName: "LEGAL_TERMS_GATE", tenant });
  const currentTermsDoc = legalGateEnabled
    ? await resolvePublishedDocumentForPublicRoute("terms")
    : null;

  return (
    <LoginForm
      tenant={tenant}
      appName={appName}
      themeColor={config.themeColor}
      legalGateEnabled={legalGateEnabled}
      currentTermsDoc={currentTermsDoc ? { id: currentTermsDoc.id, version: currentTermsDoc.version } : null}
    />
  );
}
