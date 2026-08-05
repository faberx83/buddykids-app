import Link from "next/link";

// TRAMA ONE — gap segnalato da Fabrizio (05/08): la Home NEXTGEN non ha mai
// avuto un equivalente del prompt "Completa il tuo profilo" del Legacy
// (components/HomeProfilePrompt.tsx). Un neo-genitore su NEXTGEN atterra
// sull'Hero Card ("Organizzata al 0%") senza alcuna spinta a completare
// nome/ruolo o aggiungere i bambini — pur essendo un prerequisito reale per
// Planner, Ricerca e Consigliati (che oggi restano vuoti/generici senza
// bambini in anagrafica). Stessa fonte dati del Legacy
// (isParentProfileIncomplete + kids.length), stile riallineato al resto
// della Home NEXTGEN (Poppins, trama-violet, rounded-2xl) invece di
// riusare il componente Legacy (che usa token pre-rebrand come bg-sky-light).
export default function NextgenProfileCompletionPrompt({
  profileIncomplete,
  hasKids,
}: {
  profileIncomplete: boolean;
  hasKids: boolean;
}) {
  if (!profileIncomplete && hasKids) return null;

  return (
    <div className="rounded-2xl border border-trama-violet/15 bg-trama-lilac/15 p-5">
      <div className="mb-1.5 flex items-center gap-2">
        <i className="ti ti-sparkles text-lg text-trama-violet" />
        <span className="font-poppins text-base font-bold text-ink">Completa il tuo profilo</span>
      </div>
      <p className="mb-3 text-[13px] text-ink-2">
        Ci mancano un paio di informazioni per personalizzare Planner e consigli in base ai tuoi bambini.
      </p>
      <div className="flex flex-col gap-2">
        {profileIncomplete && (
          <Link
            href="/nextgen/profile?complete=1"
            className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-[13px] font-semibold text-ink active:scale-[0.99]"
          >
            Nome, cognome e ruolo (padre/madre/tutore)
            <i className="ti ti-chevron-right text-trama-violet" />
          </Link>
        )}
        {!hasKids && (
          <Link
            href="/nextgen/profile?addKid=1"
            className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-[13px] font-semibold text-ink active:scale-[0.99]"
          >
            Aggiungi i tuoi bambini
            <i className="ti ti-chevron-right text-trama-violet" />
          </Link>
        )}
      </div>
    </div>
  );
}
