"use client";

import { useRouter } from "next/navigation";
import { useGlobalActionProgress } from "@/components/GlobalActionProgress";

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
  // TRAMA — GLOBAL ACTION PROGRESS · LIVE FIX (15/09/2026, §6 "PROGRAMMATIC
  // ROUTER.PUSH"). Layer condiviso identificato per la navigazione
  // "indietro": questo componente è montato da OGNI sotto-pagina NEXTGEN con
  // freccia indietro, quindi un solo runNavigation() qui copre backHref/
  // router.back() ovunque, senza toccare i singoli call site. Sicuro anche
  // fuori da /nextgen (LEGACY, Gestore): il hook no-op quando nessun
  // GlobalActionProgressProvider è montato sopra nell'albero.
  const { runNavigation } = useGlobalActionProgress();

  return (
    <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#F0F2F5] bg-white px-5 py-3.5">
      <button
        onClick={() => {
          if (onBack) {
            // onBack è un override opaco (usato dai flussi multi-step, es.
            // Prenotazione, per tornare allo STEP precedente): spesso è un
            // semplice cambio di stato locale, NON una navigazione reale —
            // segnalarla comunque violerebbe "PURE LOCAL UI → no progress"
            // (§4) e lascerebbe la barra visibile fino al safety timeout se
            // il pathname non cambia mai. Nessun runNavigation() qui.
            onBack();
            return;
          }
          // backHref/router.back() sono invece SEMPRE una navigazione reale
          // (cambio di rotta) — segnalata esplicitamente perché è un
          // router.push()/back() programmatico, non un click su <a href>
          // intercettabile dal listener in capture phase.
          runNavigation();
          if (backHref) router.push(backHref);
          else router.back();
        }}
        aria-label="Indietro"
        className="flex items-center text-[22px] text-ink"
      >
        <i className="ti ti-arrow-left" />
      </button>
      {showBrandIcon && (
        <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-5 w-auto flex-shrink-0" />
      )}
      {/* Audit font (31/08/2026, richiesta di Fabrizio: "titoli delle sezioni
          più grandi", "sono certo che [i font] non siano gli stessi
          ovunque"): confermato — i titoli "root" NEXTGEN (Home, Community,
          vedi HomeDashboardClient.tsx/CommunityListClient.tsx) usano
          <h1 className="font-poppins text-xl font-bold text-ink">, ma questo
          componente (che renderizza il titolo di OGNI sotto-pagina NEXTGEN
          con freccia indietro — "Planner", "Scopri attività", "Le mie
          richieste", ecc.) era rimasto a Inter text-base (16px), MAI
          Poppins: né lo stesso font né la stessa dimensione dei titoli
          "fratelli". Fix SOLO quando showBrandIcon=true (il segnale già
          stabilito in questo componente per "chi mi chiama è NEXTGEN
          genitore", vedi commento sopra) — LEGACY (Preferiti, Prenotazioni
          legacy, Modifica prenotazione, ecc.) e le pagine Account del
          Gestore (che condividono questo stesso componente ma non passano
          showBrandIcon) restano pixel-identiche a prima: nessuna regressione
          fuori dallo scope NEXTGEN genitore. text-lg (18px) = estremo
          inferiore del range Poppins 18-34px indicato nel brand kit
          (docs/trama-one/design-input/onboarding/01-brand/
          TRAMA_BRAND_SUMMARY_FOR_DESIGN.md) — scelto invece di text-xl (20px,
          uguale ai titoli root) per restare sicuro anche con i titoli più
          lunghi di questo componente ("Famiglia e logistica", "Le mie
          segnalazioni") in una barra compatta con freccia indietro. */}
      <h3
        className={
          showBrandIcon
            ? "font-poppins text-lg font-bold text-ink"
            : "text-base font-bold text-ink"
        }
      >
        {title}
      </h3>
    </div>
  );
}
