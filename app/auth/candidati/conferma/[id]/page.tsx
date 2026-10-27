import Link from "next/link";
import { getCandidacyStatusPublic } from "@/lib/data/center-leads";
import { PARTNER_PUBLIC_ORIGIN, centersContactAddress, partnerSignupUrl } from "@/lib/centers/pilot-emails";
import { extractEmailAddress } from "@/lib/email";

// Migrazione 21 — "Candidati come centro". Pagina di conferma raggiunta
// SUBITO dopo l'invio del form /auth/candidati, e ri-visitabile in
// qualunque momento dallo stesso link (l'id della riga center_leads,
// un UUID non indovinabile, funge da "token" opaco — nessuna colonna
// dedicata aggiunta, vedi supabase/migration_21_center_candidacy.sql).
// Nessun login richiesto: getCandidacyStatusPublic espone solo campi non
// sensibili (mai admin_note/candidate_phone/altre candidature).
//
// 27/10/2026 (revisione del processo di candidatura):
// - grafica V2, come il form;
// - "Crea l'accesso" porta SEMPRE al portale dei centri (partner.tramapp.it),
//   anche se la candidatura è partita da tramapp.it: registrandosi sul sito
//   delle famiglie, dopo la conferma dell'email il gestore finiva nell'app
//   delle famiglie;
// - accesso già creato → "Entra nel portale" invece di "Crea l'accesso".
// Etichette di stato invariate (tests/gestore/candidati.spec.ts).
const STATUS_COPY: Record<string, { label: string; body: string; cls: string }> = {
  suggested: {
    label: "In revisione",
    body: "Abbiamo ricevuto la candidatura e la stiamo guardando. Vi contattiamo noi all'email che ci avete indicato, di solito con una breve telefonata.",
    cls: "bg-trama-accent-soft text-trama-accent-ink",
  },
  qualified: {
    label: "In valutazione avanzata",
    body: "La candidatura è in valutazione avanzata. Vi contattiamo a breve.",
    cls: "bg-trama-accent-soft text-trama-accent-ink",
  },
  contacted: {
    label: "Vi abbiamo contattato",
    body: "Vi abbiamo già scritto o chiamato per i prossimi passi.",
    cls: "bg-trama-accent-soft text-trama-accent-ink",
  },
  claimed: {
    label: "Approvata!",
    body: "Il vostro centro è su TRAMA. Create l'accesso al portale dei centri con la stessa email della candidatura: il centro si collega da solo.",
    cls: "bg-green-light text-[#2d8f52]",
  },
  rejected: {
    label: "Non approvata",
    body: "Questa candidatura non è stata approvata. Se pensate sia un errore, rispondete all'email di conferma.",
    cls: "bg-[#FBEAEA] text-[#C0392B]",
  },
  expired: {
    label: "Scaduta",
    body: "Questa candidatura è scaduta senza risposta. Potete inviarne una nuova quando volete.",
    cls: "bg-[#F0F2F5] text-ink-2",
  },
};

const BUTTON =
  "flex min-h-[52px] items-center justify-center rounded-[12px] bg-trama-primary px-6 text-[16px] font-semibold text-white active:bg-trama-primary-press";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-nav-v2 className="min-h-screen bg-trama-page text-ink">
      <header className="mx-auto flex max-w-xl items-center px-5 pb-2 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <span className="flex items-center gap-2.5">
          <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-8 w-auto" />
          <img src="/brand/trama-wordmark.png" alt="TRAMA" className="h-[18px] w-auto" />
        </span>
      </header>
      <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-[calc(40px+env(safe-area-inset-bottom,0px))] pt-8">
        {children}
      </main>
    </div>
  );
}

export default async function CandidatiConfermaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidacy = await getCandidacyStatusPublic(id);

  if (!candidacy) {
    return (
      <Shell>
        <h1 className="font-poppins text-[clamp(26px,6.4vw,32px)] font-semibold text-trama-navy">Candidatura non trovata</h1>
        <p className="text-[16px] leading-relaxed text-ink-2">
          Il link non è valido o la candidatura è stata rimossa. Potete inviarne una nuova.
        </p>
        <Link href="/auth/candidati" className={`${BUTTON} self-start`}>
          Candidati come centro
        </Link>
      </Shell>
    );
  }

  const copy = STATUS_COPY[candidacy.status] ?? STATUS_COPY.suggested;
  const contact = centersContactAddress(process.env, extractEmailAddress);
  const approved = candidacy.status === "claimed";
  const body =
    approved && candidacy.registered
      ? "Il vostro centro è su TRAMA e il vostro accesso è già collegato. Entrate nel portale dei centri per completare il profilo e creare la prima attività."
      : copy.body;

  return (
    <Shell>
      <div className="flex flex-col gap-3 rounded-2xl border border-trama-line bg-white p-6">
        <span className={`self-start rounded-full px-3 py-1 text-[13px] font-semibold ${copy.cls}`}>{copy.label}</span>
        <h1 className="font-poppins text-[clamp(24px,6vw,30px)] font-semibold leading-tight text-trama-navy">
          {candidacy.suggestedName}
        </h1>
        <p className="text-[16px] leading-relaxed text-ink-2">{body}</p>
        {approved ? (
          candidacy.registered ? (
            <a href={`${PARTNER_PUBLIC_ORIGIN}/auth/login`} className={`${BUTTON} mt-2 self-start`}>
              Entra nel portale
            </a>
          ) : (
            <a
              href={candidacy.candidateEmail ? partnerSignupUrl(candidacy.candidateEmail) : `${PARTNER_PUBLIC_ORIGIN}/auth/login?mode=signup`}
              className={`${BUTTON} mt-2 self-start`}
            >
              Crea l&apos;accesso
            </a>
          )
        ) : (
          <p className="text-[13.5px] leading-snug text-ink-2">
            Candidatura inviata il {new Date(candidacy.createdAt).toLocaleDateString("it-IT")}. Tenete questo link per
            ricontrollare lo stato: lo trovate anche nell&apos;email di conferma.
          </p>
        )}
      </div>
      {contact && (
        <p className="text-[14px] text-ink-2">
          Domande? Scrivete a{" "}
          <a href={`mailto:${contact}`} className="font-semibold text-trama-accent-ink">
            {contact}
          </a>
          .
        </p>
      )}
    </Shell>
  );
}
