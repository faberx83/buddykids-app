import Link from "next/link";

export default function HomeProfilePrompt({
  profileIncomplete,
  hasKids,
}: {
  profileIncomplete: boolean;
  hasKids: boolean;
}) {
  if (!profileIncomplete && hasKids) return null;

  return (
    <div className="mx-5 mt-4 rounded-lg border border-[#E3F0FB] bg-sky-light p-4">
      <div className="mb-2 flex items-center gap-2">
        <i className="ti ti-sparkles text-lg text-sky" />
        <span className="text-sm font-bold text-ink">Completa il tuo profilo</span>
      </div>
      <p className="mb-3 text-xs text-ink-2">
        Ci mancano un paio di informazioni per mostrarti le attività più adatte a te e ai tuoi
        bambini.
      </p>
      <div className="space-y-1.5">
        {profileIncomplete && (
          <Link
            href="/profile?complete=1"
            className="flex items-center justify-between rounded-md bg-white px-3 py-2.5 text-xs font-semibold text-ink"
          >
            Nome, cognome e ruolo (padre/madre/tutore)
            <i className="ti ti-chevron-right text-sky" />
          </Link>
        )}
        {!hasKids && (
          <Link
            href="/profile?addKid=1"
            className="flex items-center justify-between rounded-md bg-white px-3 py-2.5 text-xs font-semibold text-ink"
          >
            Aggiungi i tuoi bambini
            <i className="ti ti-chevron-right text-sky" />
          </Link>
        )}
      </div>
    </div>
  );
}
