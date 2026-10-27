"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitCenterCandidacyAction } from "@/app/actions/center-leads";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { checkEmail } from "@/lib/auth/email-check";

// Migrazione 21 — "Candidati come centro". Form PUBBLICO: nessun account
// viene creato inviandolo (vedi submitCenterCandidacyAction). Al successo
// si passa alla pagina di conferma /auth/candidati/conferma/[id], dove il
// candidato può ricontrollare lo stato della propria candidatura senza
// doversi registrare.
//
// 27/10/2026 (revisione del processo di candidatura, Fabrizio: "rivediamo il
// processo di candidatura… sistema quello first of all"): grafica della V2
// (come tramapp.it/benvenuto e /centri), cosa succede dopo spiegato prima di
// inviare, email controllata come nella lista d'attesa (refusi tipo
// "gmial.com"), campo nascosto anti-bot, provenienza (?da=…) conservata.
// Etichette e pulsante invariati (tests/gestore/candidati.spec.ts).
export default function CandidatiForm({ source = null }: { themeColor?: string; source?: string | null }) {
  const router = useRouter();
  const [centerName, setCenterName] = useState("");
  const [locality, setLocality] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-[12px] border border-trama-line bg-white px-4 py-3 text-[16px] text-ink outline-none focus:border-trama-primary";
  const labelClass = "mb-1.5 block text-[14px] font-semibold text-trama-navy";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuggestion(null);

    if (!isSupabaseConfigured) {
      setError("Supabase non è ancora configurato in questo ambiente.");
      return;
    }
    const check = checkEmail(email);
    if (!check.ok) {
      setError(check.message);
      if (check.suggestion) setSuggestion(check.suggestion);
      return;
    }

    setLoading(true);
    const res = await submitCenterCandidacyAction({
      centerName,
      locality: locality || undefined,
      email: check.email,
      phone: phone || undefined,
      description: description || undefined,
      source,
      website,
    });
    setLoading(false);

    if (res.error) return setError(res.error);
    if (res.id) router.push(`/auth/candidati/conferma/${res.id}`);
  }

  return (
    <div data-nav-v2 className="min-h-screen bg-trama-page text-ink">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pb-2 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <span className="flex items-center gap-2.5">
          <img src="/brand/trama-logo-mark.png" alt="" aria-hidden="true" className="h-8 w-auto" />
          <img src="/brand/trama-wordmark.png" alt="TRAMA" className="h-[18px] w-auto" />
        </span>
        <Link
          href="/auth/login"
          className="flex min-h-[44px] items-center rounded-full border border-trama-line bg-white px-4 text-[14px] font-semibold text-trama-navy"
        >
          Accedi
        </Link>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-[calc(40px+env(safe-area-inset-bottom,0px))] pt-6">
        <div className="flex flex-col gap-3">
          <span className="self-start rounded-full bg-trama-accent-soft px-3 py-1 text-[12.5px] font-bold text-trama-accent-ink">
            Per i centri
          </span>
          <h1 className="font-poppins text-[clamp(28px,7vw,36px)] font-semibold leading-[1.1] text-trama-navy">
            Candidate il vostro centro
          </h1>
          <p className="text-[16px] leading-relaxed text-ink-2">Due minuti, nessun account da creare adesso. Ecco cosa succede dopo:</p>
          <ol className="flex flex-col gap-2 text-[15px] leading-relaxed text-ink-2">
            {[
              "Vi arriva un'email di conferma, con il link per seguire la candidatura.",
              "Vi contattiamo noi, di solito con una breve telefonata.",
              "Approvata la candidatura, create l'accesso con la stessa email: il centro si collega da solo.",
            ].map((t, i) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-trama-primary text-[13px] font-semibold text-white">
                  {i + 1}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-4 rounded-2xl border border-trama-line bg-white p-5">
          <div>
            <label className={labelClass} htmlFor="cand-name">
              Nome del centro
            </label>
            <input
              id="cand-name"
              required
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              className={inputClass}
              placeholder="Es. Centro Estivo Girasole"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cand-locality">
              Città / zona
            </label>
            <input
              id="cand-locality"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className={inputClass}
              placeholder="Es. Milano, zona Navigli"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cand-email">
              Email di contatto
            </label>
            <input
              id="cand-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="nome@vostrocentro.it"
              aria-describedby="cand-email-hint"
            />
            <p id="cand-email-hint" className="mt-1.5 text-[13px] leading-snug text-ink-2">
              Sarà il vostro accesso a TRAMA: usate un indirizzo che leggete ogni giorno.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="cand-phone">
              Telefono (opzionale)
            </label>
            <input
              id="cand-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="Per sentirci più in fretta"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="cand-description">
              Raccontaci il tuo centro (opzionale)
            </label>
            <textarea
              id="cand-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Età dei bambini, attività, giorni (ponti, vacanze, pomeriggi), indirizzo"
            />
          </div>

          {/* Campo nascosto anti-bot (stesso trucco della lista d'attesa). */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="cand-website">Sito web</label>
            <input id="cand-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          {error && (
            <p role="alert" className="text-[14px] font-medium text-trama-orange">
              {error}
              {suggestion && (
                <>
                  {" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => {
                      setEmail(suggestion);
                      setError(null);
                      setSuggestion(null);
                    }}
                  >
                    Usa {suggestion}
                  </button>
                </>
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[52px] items-center justify-center rounded-[12px] bg-trama-primary px-6 text-[16px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
          >
            {loading ? "Invio…" : "Invia candidatura"}
          </button>
          <p className="text-[12.5px] leading-snug text-ink-2">
            Usiamo questi dati solo per valutare la candidatura e ricontattarvi.{" "}
            <Link href="/privacy" className="font-semibold text-trama-accent-ink">
              Informativa privacy
            </Link>
          </p>
        </form>

        <p className="text-center text-[14px] text-ink-2">
          Volete sapere di più prima?{" "}
          <a href="https://tramapp.it/centri" className="font-semibold text-trama-accent-ink">
            Come funziona per i centri
          </a>
        </p>
      </main>
    </div>
  );
}
