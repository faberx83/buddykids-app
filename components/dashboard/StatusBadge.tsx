import { BookingStatus } from "@/lib/types";

const styles: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: { label: "Confermata", className: "bg-green-light text-[#2d8f52]" },
  pending: { label: "In attesa", className: "bg-yellow-light text-[#9a6b00]" },
  cancelled: { label: "Annullata", className: "bg-orange-light text-trama-orange" },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const s = styles[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.className}`}>
      {s.label}
    </span>
  );
}
