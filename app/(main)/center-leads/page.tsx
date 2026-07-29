import PageHeader from "@/components/PageHeader";
import { getMyCenterLeads } from "@/lib/data/center-leads";
import { CenterLeadStatus } from "@/lib/types";

// TRAMA ONE Build Sprint 5 — "I tuoi suggerimenti" (Genitore). Sola lettura
// delle proprie segnalazioni di centri non iscritti (J11). Condivisa tra
// LEGACY e NEXTGEN come le altre pagine sotto (main) — vedi
// app/(main)/presenze/page.tsx per lo stesso pattern (nessun backHref fisso,
// PageHeader ricade su router.back()).
const STATUS_LABEL: Record<CenterLeadStatus, string> = {
  suggested: "Ricevuta",
  qualified: "In valutazione",
  contacted: "Centro contattato",
  claimed: "Iscritto a TRAMA!",
  rejected: "Non proseguita",
  expired: "Scaduta",
};

const STATUS_STYLE: Record<CenterLeadStatus, string> = {
  suggested: "bg-[#EEF0FF] text-trama-violet",
  qualified: "bg-[#EEF0FF] text-trama-violet",
  contacted: "bg-trama-orange/15 text-trama-orange",
  claimed: "bg-partner/15 text-partner",
  rejected: "bg-[#F0F2F5] text-ink-2",
  expired: "bg-[#F0F2F5] text-ink-2",
};

export default async function CenterLeadsPage() {
  const leads = await getMyCenterLeads();

  return (
    <div className="animate-fade-in">
      <PageHeader title="I tuoi suggerimenti" />
      <div className="px-5 pt-4">
        <p className="mb-4 text-xs text-ink-2">
          Centri che hai segnalato perché non ancora su TRAMA. Verifichiamo ogni segnalazione prima di
          contattare il centro — nessuna scheda pubblica viene creata prima dell&apos;iscrizione reale.
        </p>

        {leads.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Non hai ancora segnalato nessun centro. Puoi farlo da Scopri, quando una ricerca non dà
            risultati.
          </p>
        )}

        {leads.length > 0 && (
          <div className="rounded-[14px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="divide-y divide-[#F0F2F5]">
              {leads.map((lead) => (
                <div key={lead.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">{lead.suggestedName}</div>
                    <div className="text-xs text-ink-2">
                      {lead.suggestedLocality ? `${lead.suggestedLocality} · ` : ""}
                      segnalato il {new Date(lead.createdAt).toLocaleDateString("it-IT")}
                    </div>
                    {lead.claimedCenterName && (
                      <div className="mt-1 text-xs font-semibold text-partner">
                        Ora trovi le sue attività come &quot;{lead.claimedCenterName}&quot;
                      </div>
                    )}
                    {lead.rewardStatus !== "not_applicable" && (
                      <div className="mt-1 text-[11px] text-ink-2">
                        Vantaggio: {lead.rewardStatus === "marked_eligible_manual" ? "in fase di verifica manuale" : lead.rewardStatus === "marked_paid_manual_offline" ? "riconosciuto" : "in revisione"}
                      </div>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[lead.status]}`}
                  >
                    {STATUS_LABEL[lead.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="h-4" />
    </div>
  );
}
