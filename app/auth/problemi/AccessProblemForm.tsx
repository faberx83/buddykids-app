"use client";

// TRAMA — LOTTO P0 BETA READINESS (16/11/2026). Richiesta di Fabrizio:
// "Aggiungi nella schermata di login un link 'Problemi ad accedere?'".
// Modulo corto in grafica V2: cosa succede (scelta), due righe di testo,
// email facoltativa per la risposta, campo nascosto anti-programmi. Non
// chiede password né codici, e il testo avverte di non scriverli.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PhoneShell from "@/components/PhoneShell";
import { submitAccessProblemAction, type AccessProblemResult } from "@/app/actions/access-problem";
import { ACCESS_PROBLEM_KINDS, ACCESS_PROBLEM_MESSAGE_MAX } from "@/lib/nextgen/access-problem";

export default function AccessProblemForm() {
  const openedAt = useRef<number>(0);
  const [kind, setKind] = useState<string>("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    const res = await submitAccessProblemAction({
      kind,
      message,
      email,
      website,
      elapsedMs: openedAt.current ? Date.now() - openedAt.current : 0,
      fromPath: "/auth/login",
      viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
      standalone: typeof window !== "undefined" ? window.matchMedia?.("(display-mode: standalone)").matches ?? null : null,
      language: typeof navigator !== "undefined" ? navigator.language : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    }).catch((): AccessProblemResult => ({ ok: false, message: "Connessione assente o lenta. Riprova tra poco." }));
    setSending(false);
    if (res.ok) setDone(true);
    else setError(res.suggestion ? `${res.message} Forse intendevi ${res.suggestion}?` : res.message);
  }

  return (
    <PhoneShell>
      <div className="flex min-h-screen flex-col px-6 py-10 sm:min-h-0 sm:flex-1">
        <img src="/brand/trama-logo-mark-navy.png" alt="" aria-hidden="true" className="mb-5 h-12 w-auto self-start" />
        <h1 className="mb-1 font-poppins text-[22px] font-semibold text-ink">Problemi ad accedere?</h1>
        <p className="mb-6 text-[15px] leading-snug text-ink-2">
          Dicci cosa succede: lo leggiamo noi del team TRAMA. Se lasci l&apos;email ti rispondiamo lì.
        </p>

        {done ? (
          <div data-testid="access-problem-done" className="rounded-2xl border border-trama-line bg-white p-4">
            <p className="text-[15px] font-semibold text-ink">Grazie, l&apos;abbiamo ricevuta.</p>
            <p className="mt-1 text-[14px] leading-snug text-ink-2">
              {email.trim() ? "Ti scriviamo all'email che hai lasciato." : "Se vuoi una risposta, scrivici anche a privacy@tramapp.it."}
            </p>
            <Link href="/auth/login" className="mt-4 flex min-h-[48px] items-center justify-center rounded-[12px] bg-trama-primary text-[15px] font-semibold text-white">
              Torna all&apos;accesso
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" noValidate>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1.5 text-xs font-semibold text-ink-2">Cosa succede?</legend>
              {ACCESS_PROBLEM_KINDS.map((k) => (
                <label
                  key={k.value}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border px-3.5 text-[14px] ${kind === k.value ? "border-trama-primary bg-trama-accent-soft text-ink" : "border-trama-line bg-white text-ink-2"}`}
                >
                  <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="accent-trama-primary" />
                  {k.label}
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-2">Raccontaci in due righe</span>
              <textarea
                required
                rows={4}
                maxLength={ACCESS_PROBLEM_MESSAGE_MAX}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-[12px] border-[1.5px] border-trama-line bg-white px-4 py-3 text-[16px] outline-none focus:border-trama-primary"
                placeholder="Es. tocco il link dell'invito e la pagina dice che è scaduto"
              />
              <span className="text-[12px] text-ink-3">Non scrivere password o codici: non ci servono.</span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-2">La tua email (facoltativa, per risponderti)</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-[52px] w-full rounded-[12px] border-[1.5px] border-trama-line bg-white px-4 py-3 text-[16px] outline-none focus:border-trama-primary"
                placeholder="nome@email.it"
              />
            </label>

            {/* Campo nascosto: le persone non lo vedono, i programmi lo compilano. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Sito web
                <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
              </label>
            </div>

            {error && <p role="alert" className="text-[13px] font-medium text-orange">{error}</p>}

            <button
              type="submit"
              disabled={sending}
              className="min-h-[52px] w-full rounded-[12px] bg-trama-primary py-3.5 text-[16px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
            >
              {sending ? "Invio…" : "Invia"}
            </button>
            <p className="text-[12px] leading-snug text-ink-3">
              Usiamo quello che scrivi solo per aiutarti ad accedere e per migliorare TRAMA.
            </p>
            <Link href="/auth/login" className="flex min-h-[44px] items-center justify-center text-[14px] font-semibold text-trama-accent-ink">
              Torna all&apos;accesso
            </Link>
          </form>
        )}
      </div>
    </PhoneShell>
  );
}
