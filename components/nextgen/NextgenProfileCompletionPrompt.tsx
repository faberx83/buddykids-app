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
//
// UNA SOLA CTA (feedback Fabrizio, 31/08): prima mostrava due righe separate
// che portavano comunque alla stessa pagina profilo (solo con un parametro
// diverso per auto-aprire l'editor giusto) — ridondante quando erano
// visibili insieme. Ora: se manca solo una cosa, la CTA resta specifica con
// lo stesso deep-link automatico di prima; se mancano ENTRAMBE, un'unica
// CTA generica porta al profilo senza auto-aprire nulla (l'header profilo e
// la sezione bambini sono comunque entrambi visibili in quella pagina,
// compilabili in una sola visita).
export default function NextgenProfileCompletionPrompt({
  profileIncomplete,
  hasKids,
}: {
  profileIncomplete: boolean;
  hasKids: boolean;
}) {
  if (!profileIncomplete && hasKids) return null;

  const bothMissing = profileIncomplete && !hasKids;

  const cta = bothMissing
    ? { href: "/nextgen/profile", label: "Completa il tuo profilo" }
    : profileIncomplete
      ? { href: "/nextgen/profile?complete=1", label: "Nome, cognome e ruolo (padre/madre/tutore)" }
      : { href: "/nextgen/profile?addKid=1", label: "Aggiungi i tuoi bambini" };

  return (
    <div className="rounded-2xl border border-trama-violet/15 bg-trama-lilac/15 p-5">
      <div className="mb-1.5 flex items-center gap-2">
        <i className="ti ti-sparkles text-lg text-trama-violet" />
        <span className="font-poppins text-base font-bold text-ink">Completa il tuo profilo</span>
      </div>
      <p className="mb-3 text-[13px] text-ink-2">
        Ci mancano un paio di informazioni per personalizzare Planner e consigli in base ai tuoi bambini.
      </p>
      <Link
        href={cta.href}
        className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-[13px] font-semibold text-ink active:scale-[0.99]"
      >
        {cta.label}
        <i className="ti ti-chevron-right text-trama-violet" />
      </Link>
    </div>
  );
}
