import Link from "next/link";
import { ONBOARDING_SLIDES } from "@/lib/nextgen/onboarding-slides";
import LandingPhone from "@/components/landing/LandingPhone";
import WaitlistForm from "@/components/landing/WaitlistForm";
import TramaThread from "@/components/nextgen/TramaThread";

// TRAMA — PAGINA DI BENVENUTO (20/10/2026): solo la parte visiva, senza
// accessi a dati (quelli restano in app/benvenuto/page.tsx). Testi e
// schermate demo riusano il carosello di primo ingresso.

const SECTION_TONES = ["#F66B5E", "#F6A623", "#2DBA8C", "#6F63C5"];

export default function BenvenutoView({ loggedIn, source }: { loggedIn: boolean; source: string | null }) {
  return (
    <div data-nav-v2 className="min-h-screen bg-trama-page text-ink" data-testid="benvenuto">
      {/* Intestazione */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-2 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <span className="flex items-center gap-2.5">
          <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-8 w-auto" />
          <img src="/brand/trama-wordmark.png" alt="TRAMA" className="h-[18px] w-auto" />
        </span>
        <Link
          href={loggedIn ? "/nextgen" : "/auth/login"}
          className="flex min-h-[44px] items-center rounded-full border border-trama-line bg-white px-4 text-[14px] font-semibold text-trama-navy"
        >
          {loggedIn ? "Vai all'app" : "Accedi"}
        </Link>
      </header>

      <main>
        {/* Apertura */}
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-14 pt-8 md:grid-cols-[minmax(0,1fr)_auto] md:pt-16">
          <div className="flex flex-col gap-5">
            <span className="self-start rounded-full bg-trama-accent-soft px-3 py-1 text-[12.5px] font-bold text-trama-accent-ink">
              Beta gratuita · su invito
            </span>
            <h1 className="text-balance font-poppins text-[clamp(34px,8.5vw,52px)] font-semibold leading-[1.05] tracking-[-0.02em] text-trama-navy">
              Il tempo dei tuoi figli, organizzato.
            </h1>
            <TramaThread />
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-ink-2">
              Attività, settimane, chi porta e chi ritira, ponti e vacanze scolastiche: tutto in un posto solo, insieme a chi ti
              aiuta.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="#invito"
                className="flex min-h-[52px] items-center justify-center rounded-[12px] bg-trama-primary px-6 text-[16px] font-semibold text-white active:bg-trama-primary-press"
              >
                Chiedi un invito
              </a>
              {!loggedIn && (
                <Link href="/auth/login" className="flex min-h-[52px] items-center justify-center px-2 text-[15px] font-semibold text-trama-accent-ink">
                  Hai già un account? Accedi
                </Link>
              )}
            </div>
          </div>
          {/* Il marchio, non un telefono: le quattro schermate vere arrivano subito sotto. */}
          <div aria-hidden="true" className="relative hidden justify-center py-4 md:flex">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-trama-accent opacity-10 blur-[70px]" />
            <img src="/brand/trama-logo-mark.png" alt="" className="relative w-[320px] motion-safe:animate-[trama-onb-float_2.8s_ease-in-out_infinite]" />
          </div>
        </section>

        {/* Cosa fa: le quattro schermate del primo ingresso */}
        <section aria-labelledby="cosa-h" className="border-t border-trama-line bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-14 px-5 py-14 md:gap-20 md:py-20">
            <h2 id="cosa-h" className="sr-only">
              Cosa puoi fare con TRAMA
            </h2>
            {ONBOARDING_SLIDES.map((s, i) => (
              <article key={s.key} className={`flex flex-col items-center gap-8 md:flex-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                <div className="flex flex-1 flex-col gap-3">
                  <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em]" style={{ color: SECTION_TONES[i] }}>
                    <span aria-hidden="true" className="h-[3px] w-6 rounded-full" style={{ background: SECTION_TONES[i] }} />
                    {s.eyebrow}
                  </span>
                  <h3 className="text-balance font-poppins text-[clamp(26px,6.4vw,36px)] font-semibold leading-[1.1] text-trama-navy">
                    {s.titleBefore}
                    <span className="text-trama-accent-ink">{s.titleHighlight}</span>
                    {s.titleAfter}
                  </h3>
                  <p className="max-w-[44ch] text-[16px] leading-relaxed text-ink-2">{s.body}</p>
                  <p className="text-[14px] text-ink-2">{s.note}</p>
                </div>
                <LandingPhone visual={s.visual} tilt={i % 2 === 0 ? -8 : 8} />
              </article>
            ))}

            <article className="flex flex-col gap-3 rounded-[20px] bg-trama-page p-6 md:p-8">
              <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-trama-accent-ink">
                <i className="ti ti-school text-[16px]" aria-hidden="true" />
                Ponti e vacanze
              </span>
              <h3 className="font-poppins text-[clamp(24px,6vw,32px)] font-semibold leading-[1.1] text-trama-navy">
                La scuola chiude? Lo sai prima.
              </h3>
              <p className="max-w-[60ch] text-[16px] leading-relaxed text-ink-2">
                Indichi la scuola dei tuoi figli e TRAMA ti mostra in anticipo ponti, vacanze e giorni di chiusura, con un promemoria
                quando c&apos;è ancora qualcosa da organizzare. Per ora dove il calendario scolastico è già disponibile.
              </p>
            </article>
          </div>
        </section>

        {/* Come si entra */}
        <section aria-labelledby="come-h" className="mx-auto max-w-5xl px-5 py-14 md:py-20">
          <h2 id="come-h" className="font-poppins text-[clamp(26px,6.4vw,36px)] font-semibold text-trama-navy">
            Come si entra
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { t: "Chiedi un invito", d: "Ci lasci la tua email qui sotto: bastano dieci secondi." },
              { t: "Ti scriviamo", d: "Stiamo aprendo TRAMA a poche famiglie alla volta: appena c'è posto ricevi il link per entrare." },
              { t: "Organizzi la settimana", d: "Aggiungi i figli e i loro impegni, poi decidi con chi ti aiuta chi porta e chi ritira." },
            ].map((step, i) => (
              <li key={step.t} className="flex flex-col gap-2 rounded-[20px] border border-trama-line bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-trama-primary font-poppins text-[15px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="font-poppins text-[18px] font-semibold text-trama-navy">{step.t}</span>
                <span className="text-[15px] leading-relaxed text-ink-2">{step.d}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 max-w-[70ch] text-[14.5px] leading-relaxed text-ink-2">
            TRAMA è gratuita durante la beta. In TRAMA non si paga nulla: le iscrizioni alle attività le concordi direttamente con il
            centro.
          </p>
        </section>

        {/* Lista d'attesa */}
        <section id="invito" aria-labelledby="invito-h" className="scroll-mt-4 border-t border-trama-line bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-5 py-14 md:grid-cols-2 md:py-20">
            <div className="flex flex-col gap-3">
              <h2 id="invito-h" className="font-poppins text-[clamp(28px,7vw,40px)] font-semibold leading-[1.1] text-trama-navy">
                Vuoi provarla?
              </h2>
              <TramaThread />
              <p className="max-w-[40ch] text-[16px] leading-relaxed text-ink-2">
                Lasciaci la tua email: ti mandiamo l&apos;invito appena c&apos;è posto. Se hai già ricevuto un link d&apos;invito, aprilo
                dal telefono e crea il tuo account da lì.
              </p>
            </div>
            <WaitlistForm source={source} />
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-col gap-4 px-5 pb-[calc(32px+env(safe-area-inset-bottom,0px))] pt-10 text-[14px] text-ink-2">
        <p>
          Gestisci un centro estivo o un&apos;attività per bambini?{" "}
          <Link href="/auth/candidati" className="font-semibold text-trama-accent-ink underline">
            Candidati come partner
          </Link>
        </p>
        <nav aria-label="Informazioni" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/privacy" className="min-h-[32px] font-semibold text-ink">
            Informativa privacy
          </Link>
          <Link href="/terms" className="min-h-[32px] font-semibold text-ink">
            Termini di servizio
          </Link>
          <a href="mailto:privacy@tramapp.it" className="min-h-[32px] font-semibold text-ink">
            privacy@tramapp.it
          </a>
        </nav>
        <p className="text-[12.5px]">© 2026 TRAMA · Organizing childhood. Together.</p>
      </footer>
    </div>
  );
}
