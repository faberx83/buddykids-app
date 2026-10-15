import { notFound } from "next/navigation";
import Link from "next/link";
import { getActivityBySlug } from "@/lib/data/activities";
import { getBookingSummary } from "@/lib/data/bookings";
import PhoneShell from "@/components/PhoneShell";
import BookingSuccessActions from "@/components/BookingSuccessActions";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { resolveFeatureFlag, resolveFeatureFlagVisibility } from "@/lib/feature-flags/resolve";
import { generateCorrelationId } from "@/lib/telemetry/correlation";

// FIX (FINAL MICRO-PILOT LIVE ACCEPTANCE, 01/09/2026 — segnalazione di
// Fabrizio): "Torna alla Home" dopo una prenotazione portava sempre a "/"
// (Home Legacy) anche per un utente NEXTGEN, che quindi "passava da
// Legacy prima di arrivare su NextGen" — /booking/[id] è condiviso tra
// Legacy e NextGen (nessuna route /nextgen/booking dedicata), quindi va
// risolto qui, non nel chiamante. Stesso resolver TRAMA_ONE_ENABLED già
// usato da app/nextgen/layout.tsx e app/admin/one/layout.tsx.
async function resolveHomeHref(): Promise<string> {
  if (!isSupabaseConfigured) return "/";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/";
  const enabled = await resolveFeatureFlag({
    flagName: "TRAMA_ONE_ENABLED",
    userId: user.id,
    role: "parent",
    tenant: "family",
    correlationId: generateCorrelationId(),
  });
  return enabled ? "/nextgen" : "/";
}

// 15/10/2026 — richiesta senza pagamento (Fabrizio: "Nessun pagamento, è una
// beta fake"): con BOOKINGS_V2_ENABLED la conferma diventa "Richiesta
// inviata" — niente "Totale pagato", niente "ufficialmente iscritto", niente
// emoji. Stesso flag e stesso fail-closed di app/booking/[id]/page.tsx.
async function resolveRequestV2(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const r = await resolveFeatureFlagVisibility({
      flagName: "BOOKINGS_V2_ENABLED",
      userId: user.id,
      role: "parent",
      tenant: "family",
      correlationId: generateCorrelationId(),
    });
    return r.enabled;
  } catch {
    return false;
  }
}

export default async function BookingSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bookingId?: string }>;
}) {
  const { id } = await params;
  const { bookingId } = await searchParams;
  const activity = await getActivityBySlug(id);
  if (!activity) return notFound();

  const summary = bookingId ? await getBookingSummary(bookingId) : null;
  const homeHref = await resolveHomeHref();
  // Segnalazione di Fabrizio (01/09/2026, "grafica legacy" residua): il
  // bottone "Torna alla Home" restava sky anche per un utente NEXTGEN.
  // homeHref è già il segnale server-side risolto sopra (TRAMA_ONE_ENABLED)
  // — lo riusiamo qui invece di richiamare resolveFeatureFlag una seconda
  // volta, stesso principio già seguito dal link "Invita amici" sotto.
  const nextgen = homeHref === "/nextgen";
  const accentBg = nextgen ? "bg-trama-violet" : "bg-sky";
  const accentHoverBg = nextgen ? "hover:bg-[#594F9E]" : "hover:bg-[#3A9FDC]";
  const requestV2 = nextgen && (await resolveRequestV2());

  if (requestV2) {
    return (
      <PhoneShell>
        <div
          data-nav-v2=""
          className="flex h-full min-h-screen flex-col justify-center px-6 py-8 sm:min-h-0 sm:flex-1"
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-trama-accent-soft text-trama-accent-ink">
            <i className="ti ti-send text-[30px]" aria-hidden="true" />
          </div>
          <h1 className="mb-2 font-poppins text-[26px] font-semibold leading-tight text-ink">Richiesta inviata</h1>
          <p className="mb-6 text-[15px] leading-relaxed text-ink-2">
            {summary ? `${summary.kidNames} · ${activity.name}. ` : `${activity.name}. `}
            Il centro la vede adesso: ti avvisiamo appena risponde. Intanto la trovi in Prenotazioni come “In attesa
            del centro”.
          </p>
          {summary && (
            <div className="mb-6 w-full rounded-2xl border border-trama-line bg-white px-4 py-3">
              <SRow label="Attività" value={activity.name} />
              <SRow label="Per" value={summary.kidNames} />
              <SRow label="Quando" value={summary.weeksLabel} />
              {summary.preServiceIncluded && <SRow label="Ingresso anticipato" value="Richiesto" />}
              {summary.postServiceIncluded && <SRow label="Uscita posticipata" value="Richiesta" />}
              {summary.mealIncluded && <SRow label="Mensa" value="Richiesta" />}
              {summary.shuttleIncluded && <SRow label="Navetta" value="Richiesta" />}
              <div className="mt-2 flex justify-between border-t border-trama-line pt-2.5 text-[13.5px]">
                <span className="font-semibold text-ink">Costo indicativo</span>
                <span className="font-semibold text-ink">€{summary.totalAmount}</span>
              </div>
              <p className="pt-2 text-[12.5px] leading-snug text-ink-3">Nessun pagamento adesso.</p>
            </div>
          )}
          <Link
            href="/nextgen/prenotazioni"
            className="mb-2.5 flex min-h-[52px] w-full items-center justify-center rounded-[12px] bg-trama-primary text-[16px] font-semibold text-white active:bg-trama-primary-press"
          >
            Vai a Prenotazioni
          </Link>
          <Link
            href="/nextgen"
            className="flex min-h-[52px] w-full items-center justify-center rounded-[12px] border border-trama-line bg-white text-[16px] font-semibold text-ink active:bg-black/[0.04]"
          >
            Torna alla Home
          </Link>
        </div>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div className="flex h-full min-h-screen flex-col items-center justify-center px-7 py-8 text-center sm:min-h-0 sm:flex-1">
        <div className="animate-pop-in mb-5 flex h-[86px] w-[86px] items-center justify-center rounded-full bg-green-light text-[42px]">
          ✅
        </div>
        <div className="mb-2.5 text-xl font-bold text-ink">Prenotazione confermata!</div>
        <div className="mb-6 text-sm leading-[1.65] text-ink-2">
          {summary
            ? `${summary.kidNames} è ufficialmente iscritto/a a ${activity.name}. Ci vediamo presto! 🎉`
            : `Sei ufficialmente iscritto a ${activity.name}. Ci vediamo presto! 🎉`}
        </div>
        <div className="mb-5 w-full rounded-lg bg-bg px-5 py-4 text-left">
          <SRow label="Attività" value={activity.name} />
          <SRow label="Bambino/i" value={summary?.kidNames ?? "Marco, 10 anni"} />
          <SRow label="Settimane" value={summary?.weeksLabel ?? "24 giu – 12 lug"} />
          {/* FEATURE servizi extra (segnalazione Fabrizio 04/09/2026) — solo
              i servizi REALMENTE scelti, non più un'unica riga "Navetta"
              sempre presente: prima di questa feature la navetta era
              inclusa/addebitata automaticamente, mai una vera scelta. */}
          {summary?.preServiceIncluded && <SRow label="Ingresso anticipato" value="Incluso ✓" />}
          {summary?.postServiceIncluded && <SRow label="Uscita posticipata" value="Incluso ✓" />}
          {summary?.mealIncluded && <SRow label="Mensa" value="Inclusa ✓" />}
          {summary?.shuttleIncluded && <SRow label="Navetta" value="Inclusa ✓" />}
          <div className="mt-2 flex justify-between border-t border-[#E8EBF0] pt-2.5 text-[13px]">
            <span className="font-bold text-ink">Totale pagato</span>
            <span className="font-semibold text-sky">€{summary?.totalAmount ?? 592}</span>
          </div>
        </div>
        <p className="mb-4 text-[11px] text-ink-3">
          Pagamento simulato a scopo dimostrativo — nessun addebito reale è stato effettuato.
        </p>
        <BookingSuccessActions
          activityName={summary?.activityName ?? activity.name}
          kidNames={summary?.kidNames ?? "Marco, 10 anni"}
          weeksLabel={summary?.weeksLabel ?? "Settimana 4 (24 giu–28 giu)"}
          startDate={summary?.startDate ?? null}
          endDate={summary?.endDate ?? null}
        />
        <Link
          href={homeHref}
          className={`mb-2.5 block w-full rounded-lg ${accentBg} py-3.5 text-sm font-bold text-white transition-colors ${accentHoverBg}`}
        >
          Torna alla Home
        </Link>
        <Link
          href={homeHref === "/nextgen" ? "/nextgen/groups" : "/groups"}
          className="block w-full rounded-lg bg-green-light py-3.5 text-sm font-bold text-[#2d8f52] transition-colors hover:bg-[#d4f0de]"
        >
          🤝 Invita amici al gruppo
        </Link>
      </div>
    </PhoneShell>
  );
}

function SRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
