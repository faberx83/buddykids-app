// TRAMA — PORTALE CENTRI V2 (29/10/2026). Fabrizio: "mi raccomando allinea
// font, logo ecc.". Titolo delle sezioni come nell'app famiglie V2
// (app/nextgen/prenotazioni/PrenotazioniV2Client.tsx): Poppins 24 semibold,
// il filo TRAMA sotto, una riga di sintesi, un'azione a destra.
// 29/10/2026, Fabrizio: "anche le lineette sotto il nome delle sezioni, usa il
// colore della palette dei portali partner": stessi quattro tratti delle
// famiglie (lunghezze 16, 10, 13, 8), in petrolio e senape.
export const PARTNER_THREAD: { color: string; width: number }[] = [
  { color: "#0E5A63", width: 16 },
  { color: "#D9A93C", width: 10 },
  { color: "#5E9A9F", width: 13 },
  { color: "#8A6410", width: 8 },
];

export function PartnerThread({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" data-testid="partner-thread" className={`flex items-center gap-[3px] ${className}`}>
      {PARTNER_THREAD.map((t) => (
        <span key={t.color} className="block h-[4px] rounded-full" style={{ width: t.width, background: t.color }} />
      ))}
    </span>
  );
}

export default function PartnerPageHeader({
  title,
  subtitle,
  action,
  badge,
  testId,
  titleTestId,
}: {
  title: string;
  /** data-testid dell'intestazione e del titolo (test browser del profilo). */
  testId?: string;
  titleTestId?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Etichetta accanto al titolo (es. stato del centro). */
  badge?: React.ReactNode;
}) {
  return (
    <header data-testid={testId} className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 data-testid={titleTestId} className="break-words font-poppins text-[24px] font-semibold leading-tight text-ink">
              {title}
            </h1>
            {badge}
          </div>
          <PartnerThread className="mt-1.5" />
        </div>
        {action}
      </div>
      {subtitle && <p className="text-[13.5px] leading-snug text-ink-2">{subtitle}</p>}
    </header>
  );
}
