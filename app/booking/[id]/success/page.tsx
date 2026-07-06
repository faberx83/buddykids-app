import { notFound } from "next/navigation";
import Link from "next/link";
import { activities } from "@/lib/mock-data";
import PhoneShell from "@/components/PhoneShell";

export function generateStaticParams() {
  return activities.map((a) => ({ id: a.id }));
}

export default async function BookingSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) return notFound();

  return (
    <PhoneShell>
      <div className="flex h-full min-h-screen flex-col items-center justify-center px-7 py-8 text-center sm:min-h-0 sm:flex-1">
        <div className="animate-pop-in mb-5 flex h-[86px] w-[86px] items-center justify-center rounded-full bg-green-light text-[42px]">
          ✅
        </div>
        <div className="mb-2.5 text-xl font-bold text-ink">Prenotazione confermata!</div>
        <div className="mb-6 text-sm leading-[1.65] text-ink-2">
          Marco è ufficialmente iscritto a {activity.name}. Ci vediamo il 24 giugno! 🎉
        </div>
        <div className="mb-5 w-full rounded-lg bg-bg px-5 py-4 text-left">
          <SRow label="Attività" value={activity.name} />
          <SRow label="Bambino" value="Marco, 10 anni" />
          <SRow label="Settimane" value="24 giu – 12 lug" />
          <SRow label="Navetta" value="Inclusa ✓" />
          <div className="mt-2 flex justify-between border-t border-[#E8EBF0] pt-2.5 text-[13px]">
            <span className="font-bold text-ink">Totale pagato</span>
            <span className="font-semibold text-sky">€592</span>
          </div>
        </div>
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
