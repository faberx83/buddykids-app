import CandidatiForm from "./CandidatiForm";
import { TENANT_CONFIG } from "@/lib/tenant";
import { cleanSource } from "@/lib/landing/waitlist";

// Migrazione 21 — "Candidati come centro" (Fabrizio: "il registrati deve
// essere un 'candidati' per cui deve far partire processo di onboarding").
// Pagina PUBBLICA, raggiungibile senza login su qualunque sottodominio
// (proxy.ts esclude /auth/* dal role-gate e dal rewrite di tenant — nessuna
// modifica a proxy.ts necessaria, stesso motivo per cui /auth/login e
// /auth/reset-password funzionano già così). Nessun account viene creato
// qui: vedi app/actions/center-leads.ts, submitCenterCandidacyAction.
//
// Il branding è SEMPRE quello Partner, indipendentemente da quale
// sottodominio serve la richiesta (link condivisibile ovunque): questa
// pagina parla sempre a un potenziale gestore di centro, mai a un genitore
// — a differenza di /auth/login, non serve leggere l'host.
// 27/10/2026 (percorso dei centri del pilota): ?da=… (es. dalla pagina
// tramapp.it/centri o da una mail della campagna) arriva con la candidatura.
export default async function CandidatiPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.da) ? params.da[0] : params.da;
  return <CandidatiForm themeColor={TENANT_CONFIG.partner.themeColor} source={cleanSource(raw)} />;
}
