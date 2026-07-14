"use client";

import { useRouter } from "next/navigation";

export default function PageHeader({
  title,
  backHref,
  onBack,
  showBrandIcon,
}: {
  title: string;
  backHref?: string;
  // Override esplicito del comportamento "indietro" — usato dai flussi
  // multi-step (es. Prenotazione) per tornare allo STEP precedente invece di
  // uscire subito dal flusso. Se assente, si torna al comportamento
  // storico (backHref se presente, altrimenti router.back()).
  onBack?: () => void;
  // Segnalazione di Fabrizio ("manca il logo in alto a sinistra" nelle
  // sezioni NEXTGEN, poi corretta: "non voglio un banner fisso, vorrei
  // un'icona di fianco al titolo"): mostra l'icona TRAMA A COLORI (regola di
  // Fabrizio: icona colorata SOLO lato genitore, navy lato gestore, bianca
  // su navy lato admin) accanto al titolo. Opt-in, default false — questo
  // componente è condiviso anche con LEGACY (Preferiti, Prenotazioni, ecc.)
  // e con l'account Gestore (app/center/account/*): nessuna di queste
  // schermate passa questa prop, quindi il loro aspetto resta invariato.
  // Solo le pagine NEXTGEN genitore la passano esplicitamente.
  showBrandIcon?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#F0F2F5] bg-white px-5 py-3.5">
      <button
        onClick={() => (onBack ? onBack() : backHref ? router.push(backHref) : router.back())}
        aria-label="Indietro"
        className="flex items-center text-[22px] text-ink"
      >
        <i className="ti ti-arrow-left" />
      </button>
      {showBrandIcon && (
        <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-5 w-auto flex-shrink-0" />
      )}
      <h3 className="text-base font-bold text-ink">{title}</h3>
    </div>
  );
}
