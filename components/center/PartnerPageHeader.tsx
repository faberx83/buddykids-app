import TramaThread from "@/components/nextgen/TramaThread";

// TRAMA — PORTALE CENTRI V2 (29/10/2026). Fabrizio: "mi raccomando allinea
// font, logo ecc.". Titolo delle sezioni come nell'app famiglie V2
// (app/nextgen/prenotazioni/PrenotazioniV2Client.tsx): Poppins 24 semibold,
// il filo TRAMA sotto, una riga di sintesi, un'azione a destra.
export default function PartnerPageHeader({
  title,
  subtitle,
  action,
  badge,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Etichetta accanto al titolo (es. stato del centro). */
  badge?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-poppins text-[24px] font-semibold leading-tight text-ink">{title}</h1>
            {badge}
          </div>
          <TramaThread className="mt-1.5" />
        </div>
        {action}
      </div>
      {subtitle && <p className="text-[13.5px] leading-snug text-ink-2">{subtitle}</p>}
    </header>
  );
}
