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

  // 20/10/2026 — NOVITÀ V2 (Fabrizio: "layout vecchio"): card con bordo
  // sottile e raggio 16, titoli di sezione come nelle altre pagine V2,
  // niente box colorati né sottolineature; stessi dati, stesse sezioni.
  return (
    <div className="flex flex-col pb-10">
      <NovitaSeenMarker unseenIds={unseenIds} />
      <PageHeader title="Novità TRAMA" showBrandIcon />
      <div className="flex flex-col gap-7 px-5 pt-4">
        {sorted.length === 0 && (
          <p className="rounded-2xl border border-trama-line bg-white px-4 py-5 text-center text-[14px] text-ink-2">Nessuna novità al momento.</p>
        )}

        {comingSoon.length > 0 && (
          <section aria-labelledby="novita-in-arrivo" className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h2 id="novita-in-arrivo" className="font-poppins text-[18px] font-semibold text-ink">
                In arrivo
              </h2>
              <p className="text-[13.5px] leading-snug text-ink-2">Ci stiamo lavorando. Dicci se ti servirebbero: decidiamo anche così cosa fare prima.</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {comingSoon.map((a) => (
                <li
                  key={a.id}
                  id={a.id}
                  data-testid="novita-coming-soon"
                  className="scroll-mt-20 rounded-2xl border border-trama-line bg-white px-4 py-3.5"
                >
                  <span className="inline-flex items-center rounded-full bg-trama-accent-soft px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-trama-accent-ink">
                    In arrivo
                  </span>
                  <p className="mt-2 text-[15px] font-semibold leading-snug text-ink">{a.userTitle}</p>
                  <p className="mt-1 text-[14px] leading-snug text-ink-2">{a.userBody}</p>
                  {votesAvailable && <AnnouncementVoteButtons announcementId={a.id} initialVote={votes[a.id] ?? 0} />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {available.length > 0 && (
          <section aria-labelledby="novita-disponibili" className="flex flex-col gap-2.5">
            <h2 id="novita-disponibili" className="font-poppins text-[18px] font-semibold text-ink">
              Già nell&apos;app
            </h2>
            <ul className="flex flex-col gap-2.5">
              {available.map((a) => (
                <li
                  key={a.id}
                  id={a.id}
                  data-testid="novita-available"
                  className="scroll-mt-20 rounded-2xl border border-trama-line bg-white"
                >
                  <a href={a.deepLink} className="flex items-start gap-3 px-4 py-3.5 active:bg-black/[0.03]">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[12.5px] text-ink-3">
                        Disponibile dal{" "}
                        {new Date(`${a.releasedAt}T00:00:00`).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="mt-1 text-[15px] font-semibold leading-snug text-ink">{a.userTitle}</span>
                      <span className="mt-1 text-[14px] leading-snug text-ink-2">{a.userBody}</span>
                      <span className="mt-2 text-[14px] font-semibold text-trama-accent-ink">Scopri la novità</span>
                    </span>
                    <i className="ti ti-chevron-right mt-1 flex-shrink-0 text-[18px] text-ink-3" aria-hidden="true" />
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
