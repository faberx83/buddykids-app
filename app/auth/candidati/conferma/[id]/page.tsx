import Link from "next/link";
import { getCandidacyStatusPublic } from "@/lib/data/center-leads";
import { TENANT_CONFIG } from "@/lib/tenant";

// Migrazione 21 — "Candidati come centro". Pagina di conferma raggiunta
// SUBITO dopo l'invio del form /auth/candidati, e ri-visitabile in
// qualunque momento dallo stesso link (l'id della riga center_leads,
// un UUID non indovinabile, funge da "token" opaco — nessuna colonna
// dedicata aggiunta, vedi supabase/migration_21_center_candidacy.sql).
// Nessun login richiesto: getCandidacyStatusPublic espone solo 3 campi non
// sensibili (mai admin_note/candidate_phone/altre candidature).
const STATUS_COPY: Record<string, { label: string; body: string; cls: string }> = {
  suggested: {
    label: "In revisione",
    body: "Il nostro team sta valutando la tua candidatura. Ti contatteremo all'email che ci hai indicato.",
    cls: "bg-orange-light text-trama-orange",
  },
  qualified: {
    label: "In valutazione avanzata",
    body: "La tua candidatura è in fase di valutazione avanzata. Ti contatteremo a breve.",
    cls: "bg-[#EEF0FF] text-trama-violet",
  },
  contacted: {
    label: "Ti abbiamo contattato",
    body: "Il nostro team ti ha già contattato per i prossimi passi.",
    cls: "bg-sky-light text-sky",
  },
  claimed: {
    label: "Approvata!",
    body: "La tua candidatura è stata approvata: il tuo centro è stato creato su TRAMA. Registrati ora con la stessa email indicata in candidatura per accedere al pannello Partner.",
    cls: "bg-green-light text-[#2d8f52]",
  },
  rejected: {
    label: "Non approvata",
    body: "Questa candidatura non è stata approvata. Se pensi sia un errore, scrivici direttamente.",
    cls: "bg-[#FBEAEA] text-[#C0392B]",
  },
  expired: {
    label: "Scaduta",
    body: "Questa candidatura è scaduta senza risposta. Puoi inviarne una nuova quando vuoi.",
    cls: "bg-[#F0F2F5] text-ink-2",
  },
};

export default async function CandidatiConfermaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidacy = await getCandidacyStatusPublic(id);
  const themeColor = TENANT_CONFIG.partner.themeColor;

  if (!candidacy) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-8 py-10 text-center">
        <h1 className="mb-2 text-xl font-bold text-ink">Candidatura non trovata</h1>
        <p className="mb-6 max-w-sm text-sm text-ink-2">
          Il link non è valido o la candidatura è stata rimossa. Puoi inviarne una nuova.
        </p>
        <Link
          href="/auth/candidati"
          className="rounded-lg px-5 py-3 text-sm font-bold text-white"
          style={{ background: themeColor }}
        >
          Candidati come centro
        </Link>
      </div>
    );
  }

  const copy = STATUS_COPY[candidacy.status] ?? STATUS_COPY.suggested;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-8 py-10 text-center">
      <div className="mb-4 flex flex-col items-center gap-1.5">
        <img src="/brand/trama-logo-mark-navy.png" alt="" aria-hidden="true" className="h-12 w-auto" />
        <img src="/brand/trama-wordmark.png" alt="TRAMA" className="h-5 w-auto" />
      </div>

      <h1 className="mb-1 text-lg font-bold text-ink">{candidacy.suggestedName}</h1>
      <span className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold ${copy.cls}`}>
        {copy.label}
      </span>
      <p className="mb-7 max-w-sm text-sm text-ink-2">{copy.body}</p>

      {candidacy.status === "claimed" ? (
        <Link
          href={`/auth/login?mode=signup${candidacy.candidateEmail ? `&email=${encodeURIComponent(candidacy.candidateEmail)}` : ""}`}
          className="rounded-lg px-5 py-3 text-sm font-bold text-white"
          style={{ background: themeColor }}
        >
          Registrati ora
        </Link>
      ) : (
        <p className="text-xs text-ink-3">
          Candidatura inviata il {new Date(candidacy.createdAt).toLocaleDateString("it-IT")}. Puoi tenere questo
          link per ricontrollare lo stato in futuro.
        </p>
      )}
    </div>
  );
}
