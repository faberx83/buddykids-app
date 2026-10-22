import { NextResponse, type NextRequest } from "next/server";
import { familyInviteDestination } from "@/lib/public-links";

// TRAMA — LINK D'INVITO "DENTRO L'APP" (22/10/2026). Stessa chiave dei link
// corti /i/<chiave> (app/i/[key]), ma sotto /nextgen: su Android, con TRAMA
// installata, il link apre l'app invece del browser (l'app prende solo gli
// indirizzi del suo spazio, /nextgen). Il login, se serve, lo chiede già
// proxy.ts, che poi torna qui con ?next=. Non legge né mostra dati.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const dest = familyInviteDestination(decodeURIComponent(key)) ?? "/nextgen";
  const res = NextResponse.redirect(new URL(dest, request.nextUrl.origin), 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
