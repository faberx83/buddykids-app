import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getInquiriesForParent } from "@/lib/data/inquiries";

const STATUS_LABEL: Record<string, string> = {
  aperta: "In attesa di risposta",
  risposta: "Risposta ricevuta",
  chiusa: "Chiusa",
};

const STATUS_CLASS: Record<string, string> = {
  aperta: "bg-yellow-light text-[#9a6b00]",
  risposta: "bg-green-light text-green",
  chiusa: "bg-bg text-ink-3",
};

// "Le mie richieste" — ticketing semplice verso i centri (vedi
// ContactCenterButton nella scheda attività e lib/data/inquiries.ts). Un
// messaggio, una risposta per richiesta: qui il genitore vede lo storico e
// le eventuali risposte ricevute.
export default async function RichiestePage() {
  const inquiries = await getInquiriesForParent();

  return (
    <div className="animate-fade-in">
      <PageHeader title="Le mie richieste" backHref="/profile" />
      <div className="px-5 py-4">
        {inquiries.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Non hai ancora contattato nessun centro. Trovi il tasto &quot;Contatta il gestore&quot;
            nella scheda di ogni attività.
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          {inquiries.map((inq) => (
            <div key={inq.id} className="rounded-lg border border-[#E8EBF0] bg-white p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Link href={`/activity/${inq.activityId}`} className="text-[13px] font-bold text-ink">
                  {inq.activityName}
                </Link>
                <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_CLASS[inq.status]}`}>
                  {STATUS_LABEL[inq.status]}
                </span>
              </div>
              <p className="mb-2 text-xs text-ink-2">{inq.message}</p>
              {inq.reply && (
                <div className="rounded-md bg-sky-light p-2.5 text-xs text-ink">
                  <div className="mb-0.5 font-semibold text-sky">Risposta del centro</div>
                  {inq.reply}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
