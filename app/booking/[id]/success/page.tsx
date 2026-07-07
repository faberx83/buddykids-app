import { notFound } from "next/navigation";
import Link from "next/link";
import { getActivityBySlug } from "@/lib/data/activities";
import { getBookingSummary } from "@/lib/data/bookings";
import PhoneShell from "@/components/PhoneShell";

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
          <SRow
            label="Navetta"
            value={(summary?.shuttleIncluded ?? true) ? "Inclusa ✓" : "Non inclusa"}
          />
          <div className="mt-2 flex justify-between border-t border-[#E8EBF0] pt-2.5 text-[13px]">
            <span className="font-bold text-ink">Totale pagato</span>
            <span className="font-semibold text-sky">€{summary?.totalAmount ?? 592}</span>
          </div>
        </div>
        <p className="mb-4 text-[11px] text-ink-3">
          Pagamento simulato a scopo dimostrativo — nessun addebito reale è stato effettuato.
        </p>
        <Link
          href="/"
          className="mb-2.5 block w-full rounded-lg bg-sky py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC]"
        >
          Torna alla Home
        </Link>
        <Link
          href="/groups"
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
