import PageHeader from "@/components/PageHeader";
import { getVisibleAnnouncementsForCurrentParent } from "@/lib/data/announcements";
import { getMyAnnouncementVotes } from "@/lib/data/announcement-votes";
import { isComingSoon } from "@/lib/announcements/catalog";
import { AnnouncementVoteButtons, FeedbackInviteCard, NovitaSeenMarker } from "@/components/nextgen/NovitaClientParts";

// TRAMA — FAMILY-FIRST BETA PASS (07/10/2026). Due stati distinti:
//  - "In arrivo": evoluzioni realmente pianificate, senza date e senza CTA
//    verso la funzione (non esiste ancora), con 👍/👎 per raccogliere consenso
//    (solo se la tabella dei voti esiste, migration 40);
//  - "Disponibile": funzioni rilasciate, con la CTA che porta alla funzione.
// Aprire la pagina segna come lette le voci visibili (badge della campanella
// spento). In fondo, "Hai un'idea per TRAMA?" apre il pannello feedback:
// Novità = TRAMA → utente, feedback = utente → TRAMA, due cose distinte.
export default async function NovitaPage() {
  const announcements = await getVisibleAnnouncementsForCurrentParent();
  const sorted = [...announcements].sort((a, b) => (a.releasedAt < b.releasedAt ? 1 : -1));
  const comingSoon = sorted.filter((a) => isComingSoon(a));
  const available = sorted.filter((a) => !isComingSoon(a));
  const { available: votesAvailable, votes } = await getMyAnnouncementVotes(comingSoon.map((a) => a.id));
  const unseenIds = sorted.filter((a) => !a.isSeen).map((a) => a.id);

  return (
    <div className="animate-fade-in">
      <NovitaSeenMarker unseenIds={unseenIds} />
      <PageHeader title="Novità TRAMA" showBrandIcon />
      <div className="flex flex-col gap-5 px-5 pb-6 pt-4">
        {sorted.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#D8DEE8] bg-white p-5 text-center text-sm text-ink-2">
            Nessuna novità al momento.
          </p>
        )}

        {comingSoon.length > 0 && (
          <section aria-labelledby="novita-in-arrivo">
            <h2 id="novita-in-arrivo" className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
              In arrivo
            </h2>
            <ul className="flex flex-col gap-3">
              {comingSoon.map((a) => (
                <li
                  key={a.id}
                  id={a.id}
                  data-testid="novita-coming-soon"
                  className="scroll-mt-20 rounded-lg border border-[#F3E2C4] bg-[#FFFBF4] p-3.5"
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0D6] px-2 py-0.5 text-[10.5px] font-bold text-[#9A5B00]">
                    <i className="ti ti-hourglass text-[11px]" aria-hidden="true" />
                    In arrivo
                  </span>
                  <p className="mt-1.5 text-[13.5px] font-bold text-ink">{a.userTitle}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{a.userBody}</p>
                  {votesAvailable && <AnnouncementVoteButtons announcementId={a.id} initialVote={votes[a.id] ?? 0} />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {available.length > 0 && (
          <section aria-labelledby="novita-disponibili">
            <h2 id="novita-disponibili" className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
              Disponibili
            </h2>
            <ul className="flex flex-col gap-3">
              {available.map((a) => (
                <li
                  key={a.id}
                  id={a.id}
                  data-testid="novita-available"
                  className="scroll-mt-20 rounded-lg border border-[#F0F2F5] bg-white p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-light px-2 py-0.5 text-[10.5px] font-bold text-[#2d8f52]">
                      <i className="ti ti-circle-check text-[11px]" aria-hidden="true" />
                      Disponibile
                    </span>
                    <span className="text-[11px] font-semibold text-ink-3">
                      {new Date(`${a.releasedAt}T00:00:00`).toLocaleDateString("it-IT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] font-bold text-ink">{a.userTitle}</p>
                  <p className="mt-1 text-[12.5px] leading-snug text-ink-2">{a.userBody}</p>
                  <a
                    href={a.deepLink}
                    className="mt-2 inline-block text-[12px] font-semibold text-trama-violet underline underline-offset-2"
                  >
                    Scopri la novità
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <FeedbackInviteCard />
      </div>
    </div>
  );
}
