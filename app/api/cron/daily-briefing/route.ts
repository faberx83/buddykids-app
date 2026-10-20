import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { runDailyBriefing } from "@/lib/data/daily-briefing";
import { sendBetaReportNoticeIfDue } from "@/lib/data/beta-report-notice";
import { isBriefingHour, romeNow } from "@/lib/nextgen/daily-briefing";

// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026). Chiamato SOLO da Vercel Cron
// (vercel.json), protetto da CRON_SECRET come gli altri cron.
//
// Orario: piano Hobby = un giro al giorno per voce, con precisione "entro
// l'ora" (es. "0 6 * * *" parte fra le 6:00 e le 6:59 UTC). Le voci sono DUE,
// 06 e 07 UTC, e si invia solo quando a Roma sono le 8: con l'ora legale
// risponde quella delle 06 UTC, con l'ora solare quella delle 07 UTC; l'altra
// non fa nulla. Così il buongiorno arriva sempre fra le 8:00 e le 8:59.
//
// Chi lo riceve: genitori con il buongiorno attivo in Profilo (migration_45)
// e la release "buongiorno-trama" accesa per loro.

export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected || !timingSafeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  if (!isBriefingHour(now)) {
    return NextResponse.json({ ok: true, skipped: "non sono le 8 a Roma", rome: romeNow(now) });
  }
  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Supabase non configurato (manca SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 });
  }
  const result = await runDailyBriefing(service, now, { source: "cron" });
  // Admin Beta Cockpit (20/10/2026): stesso giro delle 8, nessun nuovo
  // scheduler. Avviso "report pronto" al founder se una finestra si è chiusa.
  const betaReport = await sendBetaReportNoticeIfDue(service, now);
  return NextResponse.json({ ok: true, ...result, betaReport });
}
