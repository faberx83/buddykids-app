"use client";

// TRAMA — "Chiedi un invito" (20/10/2026). La beta è solo su invito: chi
// arriva sulla pagina di benvenuto lascia l'email (più comune e numero di
// figli, facoltativi) e Fabrizio la ritrova in Admin → Lista d'attesa.
// Controlli: lib/landing/waitlist.ts; salvataggio: app/actions/waitlist.ts.

import { useState } from "react";
import Link from "next/link";
import { joinWaitlistAction } from "@/app/actions/waitlist";

const INPUT =
  "min-h-[52px] w-full rounded-[12px] border-[1.5px] border-trama-line bg-white px-4 text-[16px] text-ink outline-none focus:border-trama-primary";
const LABEL = "mb-1.5 block text-[13.5px] font-semibold text-ink";

export default function WaitlistForm({ source }: { source: string | null }) {
  const [email, setEmail] = useState("");
  const [comune, setComune] = useState("");
  const [kids, setKids] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // campo trappola, invisibile alle persone
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [done, setDone] = useState<"new" | "already" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuggestion(null);
    const res = await joinWaitlistAction({ email, comune, kidsCount: kids, note, source, consent, website }).catch(() => null);
    setBusy(false);
    if (!res) return setError("Qualcosa non ha funzionato. Riprova tra poco.");
    if (!res.ok) {
      setError(res.message);
      setSuggestion(res.suggestion ?? null);
      return;
    }
    setDone(res.already ? "already" : "new");
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-2 rounded-2xl border border-trama-line bg-white p-5" data-testid="waitlist-done">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E6F6F0] text-[#146B4F]">
          <i className="ti ti-check text-[20px]" aria-hidden="true" />
        </span>
        <p className="font-poppins text-[18px] font-semibold text-ink">
          {done === "already" ? "Sei già in lista." : "Grazie, sei in lista!"}
        </p>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Ti scriviamo a <b className="text-ink">{email.trim().toLowerCase()}</b> appena c&apos;è posto per la tua famiglia.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div>
        <label htmlFor="wl-email" className={LABEL}>
          La tua email
        </label>
        <input
          id="wl-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT}
          placeholder="nome@esempio.it"
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
        <div>
          <label htmlFor="wl-comune" className={LABEL}>
            Comune <span className="font-normal text-ink-2">(facoltativo)</span>
          </label>
          <input id="wl-comune" autoComplete="address-level2" value={comune} onChange={(e) => setComune(e.target.value)} className={INPUT} placeholder="Es. Milano" />
        </div>
        <div>
          <label htmlFor="wl-figli" className={LABEL}>
            Figli
          </label>
          <select id="wl-figli" value={kids} onChange={(e) => setKids(e.target.value)} className={INPUT}>
            <option value="">—</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4 o più</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="wl-note" className={LABEL}>
          Cosa ti piacerebbe organizzare? <span className="font-normal text-ink-2">(facoltativo)</span>
        </label>
        <textarea
          id="wl-note"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${INPUT} min-h-[96px] py-3`}
          placeholder="Es. i centri estivi di giugno, chi porta i bambini a calcio…"
        />
      </div>
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="wl-website">Non compilare questo campo</label>
        <input id="wl-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <label className="flex items-start gap-3 text-[14px] leading-snug text-ink-2">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#172A4D]" />
        <span>Potete scrivermi a questa email per mandarmi l&apos;invito a TRAMA.</span>
      </label>
      {error && (
        <p role="alert" className="text-[14px] font-medium text-[#B3261E]">
          {error}
        </p>
      )}
      {suggestion && (
        <button
          type="button"
          onClick={() => {
            setEmail(suggestion);
            setSuggestion(null);
            setError(null);
          }}
          className="flex min-h-[44px] items-center self-start text-[14px] font-semibold text-trama-accent-ink"
        >
          Usa {suggestion}
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-[52px] w-full rounded-[12px] bg-trama-primary text-[16px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
      >
        {busy ? "Un attimo…" : "Chiedi un invito"}
      </button>
      <p className="text-[12.5px] leading-relaxed text-ink-2">
        Usiamo la tua email solo per mandarti l&apos;invito. Se non entri in TRAMA la cancelliamo entro 12 mesi, e puoi chiederci di
        farlo prima scrivendo a privacy@tramapp.it. Leggi l&apos;
        <Link href="/privacy" className="font-semibold text-trama-accent-ink underline">
          Informativa privacy
        </Link>
        .
      </p>
    </form>
  );
}
