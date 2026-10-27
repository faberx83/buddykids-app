import Link from "next/link";
import TramaThread from "@/components/nextgen/TramaThread";

// TRAMA — PAGINA PER I CENTRI (27/10/2026, P0 di claude/INIZIATIVA_partner_admin_v2.md).
// La destinazione della campagna verso i centri di Milano: il problema, cosa
// fa TRAMA, come funziona il pilota, il posto da "centro fondatore", domande
// frequenti, e la candidatura (lo stesso form di sempre, /auth/candidati).
// Stessa grafica della pagina di benvenuto delle famiglie. Promesse coerenti
// col prodotto di oggi: niente numeri di famiglie, niente "centri verificati",
// niente pagamenti in app. Solo la parte visiva: i dati restano in app/centri/page.tsx.

const PAINS = [
  {
    icon: "ti-message-dots",
    kicker: "Gestione",
    title: "Iscrizioni ancora su WhatsApp, Excel e moduli?",
    text: "Richieste, risposte, posti e presenze in un posto solo, dal telefono. Settimane intere o giorni singoli: accettate, proponete un'alternativa o mettete in lista d'attesa con un tocco.",
  },
  {
    icon: "ti-calendar-event",
    kicker: "Famiglie",
    title: "Vi cercano proprio quando la scuola chiude",
    text: "TRAMA parte dal calendario scolastico della famiglia e dalla sua settimana: ponti, vacanze, pomeriggi scoperti. Le vostre attività compaiono lì, vicino a casa, quando servono.",
  },
  {
    icon: "ti-bulb",
    kicker: "Offerta",
    title: "Aprite i giorni che le famiglie chiedono",
    text: "Nel pilota vi raccontiamo cosa cercano le famiglie della vostra zona (quali giorni, quali orari, quali età) per costruire l'offerta su richieste vere, prima di aprire.",
  },
];

const STEPS = [
  { t: "Vi candidate", d: "Due minuti: nome del centro, zona, un contatto. Nessun account da creare subito." },
  { t: "Vi chiamiamo", d: "Una telefonata di un quarto d'ora per conoscerci e capire cosa proponete." },
  { t: "Prima attività insieme", d: "Approvata la candidatura, create l'accesso e carichiamo insieme la prima attività, anche per pochi giorni." },
  { t: "Ricevete le richieste", d: "Una email e una notifica a ogni richiesta; rispondete dal portale dei centri." },
];

const FAQ = [
  {
    q: "Quanto costa?",
    a: "Per i centri fondatori il pilota è gratuito. Le condizioni per dopo le decidiamo insieme e, per voi, restano bloccate.",
  },
  {
    q: "Devo gestire pagamenti su TRAMA?",
    a: "No. In TRAMA non si paga nulla: iscrizione e pagamento li concordate direttamente con la famiglia, come fate oggi.",
  },
  {
    q: "Posso togliere o chiudere le mie attività quando voglio?",
    a: "Sì, dal portale dei centri: chiudete un giorno, cambiate i posti o togliete un'attività in qualsiasi momento.",
  },
  {
    q: "Chi vede i dati dei bambini?",
    a: "Vedete solo quello che serve per gestire la richiesta e la presenza. I dati restano su TRAMA e non si usano per altro.",
  },
  {
    q: "Funziona solo a Milano?",
    a: "Il pilota parte da Milano e dintorni. Se siete altrove candidatevi lo stesso: vi scriviamo quando arriviamo nella vostra zona.",
  },
];

export default function CentriView({ candidatiHref, contactEmail }: { candidatiHref: string; contactEmail: string | null }) {
  return (
    <div data-nav-v2 className="min-h-screen bg-trama-page text-ink" data-testid="centri">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pb-2 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <Link href="/benvenuto" className="flex items-center gap-2.5" aria-label="TRAMA">
          <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-8 w-auto" />
          <img src="/brand/trama-wordmark.png" alt="TRAMA" className="h-[18px] w-auto" />
        </Link>
        <a
          href="https://partner.tramapp.it/auth/login"
          className="flex min-h-[44px] items-center rounded-full border border-trama-line bg-white px-4 text-[14px] font-semibold text-trama-navy"
        >
          Accesso centri
        </a>
      </header>

      <main>
        <section className="mx-auto flex max-w-5xl flex-col gap-5 px-5 pb-14 pt-8 md:pt-16">
          <span className="self-start rounded-full bg-trama-accent-soft px-3 py-1 text-[12.5px] font-bold text-trama-accent-ink">
            Per i centri · pilota a Milano
          </span>
          <h1 className="max-w-[18ch] text-balance font-poppins text-[clamp(32px,8vw,50px)] font-semibold leading-[1.05] tracking-[-0.02em] text-trama-navy">
            Le famiglie organizzano la settimana su TRAMA. Fatevi trovare quando serve.
          </h1>
          <TramaThread />
          <p className="max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
            Centri estivi, ludoteche, scuole di sport, musica e arte per bambini: cerchiamo pochi centri fondatori per il pilota di
            quest&apos;inverno, dal ponte di dicembre alle vacanze di Natale.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={candidatiHref}
              className="flex min-h-[52px] items-center justify-center rounded-[12px] bg-trama-primary px-6 text-[16px] font-semibold text-white active:bg-trama-primary-press"
            >
              Candidate il vostro centro
            </Link>
            <a href="#come" className="flex min-h-[52px] items-center justify-center px-2 text-[15px] font-semibold text-trama-accent-ink">
              Come funziona il pilota
            </a>
          </div>
        </section>

        <section aria-labelledby="perche-h" className="border-t border-trama-line bg-white">
          <div className="mx-auto max-w-5xl px-5 py-14 md:py-20">
            <h2 id="perche-h" className="font-poppins text-[clamp(26px,6.4vw,36px)] font-semibold text-trama-navy">
              Cosa cambia per il vostro centro
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {PAINS.map((p) => (
                <article key={p.title} className="flex flex-col gap-3 rounded-[20px] bg-trama-page p-6">
                  <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-trama-accent-ink">
                    <i className={`ti ${p.icon} text-[16px]`} aria-hidden="true" />
                    {p.kicker}
                  </span>
                  <h3 className="font-poppins text-[20px] font-semibold leading-[1.2] text-trama-navy">{p.title}</h3>
                  <p className="text-[15.5px] leading-relaxed text-ink-2">{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="come" aria-labelledby="come-h" className="mx-auto max-w-5xl scroll-mt-4 px-5 py-14 md:py-20">
          <h2 id="come-h" className="font-poppins text-[clamp(26px,6.4vw,36px)] font-semibold text-trama-navy">
            Come funziona il pilota
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.t} className="flex flex-col gap-2 rounded-[20px] border border-trama-line bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-trama-primary font-poppins text-[15px] font-semibold text-white">
                  {i + 1}
                </span>
                <span className="font-poppins text-[18px] font-semibold text-trama-navy">{step.t}</span>
                <span className="text-[15px] leading-relaxed text-ink-2">{step.d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="fondatori-h" className="bg-trama-primary">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-12 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/70">Centri fondatori</span>
              <h2 id="fondatori-h" className="font-poppins text-[clamp(22px,5.6vw,30px)] font-semibold leading-tight text-white">
                Gratuito per tutto il pilota. Condizioni bloccate anche dopo.
              </h2>
              <p className="max-w-[56ch] text-[15px] leading-relaxed text-white/80">
                In cambio vi chiediamo qualche parere su cosa migliorare: le prossime funzioni del portale le decidiamo con voi. Posti
                limitati a Milano e dintorni.
              </p>
            </div>
            <Link
              href={candidatiHref}
              className="flex min-h-[52px] flex-shrink-0 items-center justify-center self-start rounded-[12px] bg-white px-6 text-[16px] font-semibold text-trama-navy md:self-center"
            >
              Candidatevi
            </Link>
          </div>
        </section>

        <section aria-labelledby="faq-h" className="mx-auto max-w-3xl px-5 py-14 md:py-20">
          <h2 id="faq-h" className="font-poppins text-[clamp(26px,6.4vw,36px)] font-semibold text-trama-navy">
            Domande frequenti
          </h2>
          <div className="mt-6 flex flex-col gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-trama-line bg-white p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-poppins text-[17px] font-semibold text-trama-navy">
                  {f.q}
                  <i className="ti ti-chevron-down text-[18px] text-ink-2 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{f.a}</p>
              </details>
            ))}
          </div>
          {contactEmail && (
            <p className="mt-6 text-[15px] leading-relaxed text-ink-2">
              Altre domande? Scrivete a{" "}
              <a href={`mailto:${contactEmail}`} className="font-semibold text-trama-accent-ink">
                {contactEmail}
              </a>
              : vi rispondiamo noi, non un bot.
            </p>
          )}
        </section>
      </main>

      <footer className="mx-auto flex max-w-5xl flex-col gap-4 border-t border-trama-line px-5 pb-[calc(32px+env(safe-area-inset-bottom,0px))] pt-8 text-[14px] text-ink-2">
        <nav aria-label="Informazioni" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/benvenuto" className="min-h-[32px] font-semibold text-ink">
            TRAMA per le famiglie
          </Link>
          <Link href="/privacy" className="min-h-[32px] font-semibold text-ink">
            Informativa privacy
          </Link>
          <Link href="/terms" className="min-h-[32px] font-semibold text-ink">
            Termini di servizio
          </Link>
        </nav>
        <p className="text-[12.5px]">© 2026 TRAMA · Organizing childhood. Together.</p>
      </footer>
    </div>
  );
}
