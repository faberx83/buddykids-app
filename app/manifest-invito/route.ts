// TRAMA — ICONA CON L'INVITO DENTRO (20/11/2026).
// Fabrizio: "come è possibile che Greta sia finita lì se ha il mio link?
// Verifica perché forse non gira qualcosa". Causa (log Vercel + eventi): chi
// apre il link d'invito e mette TRAMA sulla schermata Home PRIMA di
// registrarsi, poi la apre dall'icona: l'icona parte da "/" (start_url del
// manifest famiglie), senza codice → /benvenuto → "Chiedi un invito". Su
// iPhone l'icona non vede nemmeno la memoria di Safari.
// Rimedio: la pagina /auth/login?beta=CODICE dichiara questo manifest, uguale
// a quello delle famiglie ma con start_url che riporta il codice. Il codice
// non è un segreto (è nel link che la persona ha già) e non si salva nulla.

import { NextResponse } from "next/server";
import { normalizeBetaCode } from "@/lib/beta-cohorts/code";
import { manifestForInvite } from "@/lib/beta-cohorts/invite-manifest";

export function GET(request: Request) {
  const code = normalizeBetaCode(new URL(request.url).searchParams.get("beta"));
  return new NextResponse(JSON.stringify(manifestForInvite(code)), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
