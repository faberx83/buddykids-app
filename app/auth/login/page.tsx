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
  // account/userId esiste ancora: solo gli scope "global"/"environment" del
  // flag hanno senso qui (uno scope "user"/"cohort" non potrebbe mai
  // combaciare prima che un utente esista). resolveFeatureFlag() risolve
  // comunque sempre a false in modo sicuro se Supabase non è configurato o
  // se nessun override applicabile esiste — che è lo stato di produzione
  // oggi (nessun override "global" è mai stato scritto per questo flag).
  const legalGateEnabled = await resolveFeatureFlag({ flagName: "LEGAL_TERMS_GATE" });
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
