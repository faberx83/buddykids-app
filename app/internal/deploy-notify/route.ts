import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Endpoint interno chiamato da deploy.sh a fine esecuzione (ok o ko), per
// alimentare il banner "ultimo deploy" nell'app Admin (app/admin/layout.tsx
// + components/admin/DeployStatusBanner.tsx). Stesso pattern esatto di
// app/internal/beta-pipeline/route.ts: GET-only (deploy.sh chiama con un
// semplice `curl`, nessun bisogno di header/body custom), fuori da /api
// (stessa euristica di scarto silenzioso già documentata in
// beta-pipeline/route.ts — qui non è strettamente necessaria dato che curl
// non ha quel problema, ma resta coerente con la convenzione del resto del
// progetto per gli endpoint "di automazione"), protetto da un secret
// condiviso passato come query param (DEPLOY_NOTIFY_SECRET, variabile
// d'ambiente separata sia dalla service_role key sia da
// PIPELINE_AUTOMATION_SECRET — cambiala su Vercel in qualsiasi momento se
// sospetti sia stata esposta).
//
// Usa la service_role key (lib/supabase/service.ts): questo endpoint non è
// collegato a nessuna sessione utente reale (deploy.sh gira sulla macchina
// di Fabrizio, non nel browser), quindi l'unica autorizzazione possibile è
// il secret — bypassa le RLS di deploy_events di proposito, esattamente
// come farebbe un admin autenticato.
//
// migration_32... e migration_33_deploy_events.sql NON sono state applicate
// da questa sessione: finché Fabrizio non le esegue, questo endpoint
// risponde 500 "tabella inesistente" — deploy.sh tratta quella risposta
// come "notifica non riuscita" e stampa un avviso, ma NON blocca né fa
// fallire il deploy stesso (vedi deploy.sh, la chiamata è "best effort").

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.DEPLOY_NOTIFY_SECRET;
  if (!expected || !secret || !timingSafeEqual(secret, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  if (status !== "ok" && status !== "ko") {
    return NextResponse.json({ error: "parametro 'status' non valido (usa ok oppure ko)" }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase non configurato (manca SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }

  const branch = req.nextUrl.searchParams.get("branch");
  const commitSha = req.nextUrl.searchParams.get("commit");
  const testScope = req.nextUrl.searchParams.get("testScope");
  const testResult = req.nextUrl.searchParams.get("testResult");
  const message = req.nextUrl.searchParams.get("message");

  const { error } = await supabase.from("deploy_events").insert({
    status,
    branch,
    commit_sha: commitSha,
    test_scope: testScope,
    test_result: testResult,
    message,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
