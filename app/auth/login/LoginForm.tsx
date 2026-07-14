"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import TramaLoginHeader from "@/components/TramaLoginHeader";
import { friendlyAuthError } from "@/lib/auth-errors";
import { getInvitePreviewAction } from "@/app/actions/invites";
import type { InvitePreview } from "@/lib/data/invites";
import type { Tenant } from "@/lib/tenant";

type Mode = "login" | "signup" | "reset";

// REBRAND TRAMA Sprint 2 — l'animazione d'ingresso dell'header (vedi
// TramaLoginHeader.tsx) va riprodotta "una sola volta per sessione" (Dev
// Handoff sez. 9), non ad ogni visita di /auth/login nella stessa sessione
// browser. L'header stesso (fili+wordmark+tagline) resta sempre visibile:
// solo l'animazione di comparsa è "una tantum", non l'header in sé.
const INTRO_SESSION_KEY = "trama-login-intro-seen";

export default function LoginForm({
  tenant,
  appName,
  themeColor,
}: {
  tenant: Tenant;
  appName: string;
  themeColor: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pagina a cui tornare dopo il login (es. un link di invito a un Gruppo
  // aperto senza essere ancora autenticati) — impostato da proxy.ts.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") ? rawNext : null;
  // Codice invito del Gestore (link ?invite=CODICE mandato a un potenziale
  // genitore) — se presente si parte già in modalità "Registrati" e si mostra
  // un'anteprima dello sconto offerto.
  const inviteParam = searchParams.get("invite");
  const [mode, setMode] = useState<Mode>(inviteParam ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteParam || "");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Default SSR-safe: false (sessionStorage non è leggibile lato server, e
  // partire da "false" sia su server che al primo render client evita un
  // mismatch di hydration). Controlla SOLO se l'header entra con l'animazione
  // o già "a posto" — il form è sempre presente, in entrambi i casi.
  const [animateHeader, setAnimateHeader] = useState(false);

  useEffect(() => {
    if (!inviteParam || !isSupabaseConfigured) return;
    getInvitePreviewAction(inviteParam).then(setInvitePreview);
  }, [inviteParam]);

  // Solo tenant "family" (il mockup 5a è la schermata di ingresso genitore).
  // Marcata "vista" in sessionStorage al mount, non alla chiusura, così un
  // refresh a metà animazione non la ripropone. Effect intenzionalmente
  // "una tantum" (mount-only): cambiare modalità coi link in fondo al form
  // NON deve far ripartire l'animazione.
  useEffect(() => {
    if (tenant !== "family") return;
    try {
      if (sessionStorage.getItem(INTRO_SESSION_KEY)) return;
      sessionStorage.setItem(INTRO_SESSION_KEY, "1");
      // sessionStorage esiste solo lato client e va per forza letto qui, in
      // questo effetto "one-shot" al mount (stesso pattern di InstallPrompt.tsx).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnimateHeader(true);
    } catch {
      // sessionStorage non disponibile (es. contesto privacy molto restrittivo):
      // niente animazione, header statico — degradazione sicura.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isSupabaseConfigured) {
      setError(
        "Supabase non è ancora configurato. Aggiungi NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY nel file .env.local."
      );
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      setLoading(false);
      if (error) return setError(friendlyAuthError(error.message));
      setMessage("Ti abbiamo inviato un'email con il link per reimpostare la password.");
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setError(friendlyAuthError(error.message));
      router.push(next || "/");
      router.refresh();
    } else {
      const callbackUrl = next
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl,
          // Letto dal trigger handle_new_user() lato DB: se il codice esiste,
          // attivo e non scaduto, collega automaticamente lo sconto invito
          // al nuovo profilo (vedi supabase/schema.sql).
          data: inviteCode.trim() ? { invite_code: inviteCode.trim() } : undefined,
        },
      });
      setLoading(false);
      if (error) return setError(friendlyAuthError(error.message));
      setMessage("Registrazione completata! Controlla la tua email per confermare l'account prima di accedere.");
      setPassword("");
    }
  }

  const isFamily = tenant === "family";
  const isAdmin = tenant === "admin";

  const heading =
    mode === "login" ? `Accedi a ${appName}` : mode === "signup" ? `Crea un account ${appName}` : "Recupera la password";

  // Etichette dei campi: per il tenant famiglia restano nel DOM per
  // accessibilità/Playwright (getByLabel continua a funzionare) ma nascoste
  // visivamente — la tagline animata sopra il form basta a comunicare il
  // contesto, coerente con lo screenshot di riferimento (niente etichette
  // visibili sopra i campi, solo placeholder). Per Admin/Gestore restano
  // visibili come prima (nessuna modifica lì).
  const labelClass = isFamily
    ? "sr-only"
    : `mb-1.5 block text-xs font-semibold ${isAdmin ? "text-navy-text2" : "text-ink-2"}`;
  const inputClass = `mb-3 w-full border-[1.5px] px-4 py-3 text-sm outline-none ${
    isFamily
      ? "rounded-full border-trama-navy/15 bg-white"
      : isAdmin
      ? "rounded-lg border-navy-3 bg-navy-2 text-white placeholder:text-navy-text2"
      : "rounded-lg border-[#E8EBF0] bg-[#F4F6FA]"
  }`;

  const content = (
    <div
      className={`flex min-h-screen flex-col items-center justify-center px-8 py-10 sm:min-h-0 sm:flex-1 ${
        isFamily ? "bg-trama-page" : isAdmin ? "bg-navy" : "bg-bg"
      }`}
    >
      {isFamily ? (
        <TramaLoginHeader animate={animateHeader} />
      ) : (
        <>
          <div
            className="mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white"
            style={{ background: themeColor }}
          >
            {isAdmin ? "🛠️" : "🏫"}
          </div>
          <h1 className={`mb-1 text-xl font-bold ${isAdmin ? "text-white" : "text-ink"}`}>{appName}</h1>
          <p className={`mb-7 text-sm ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>{heading}</p>
        </>
      )}

      {/* REBRAND TRAMA — il form (campi + CTA + link modalità) sta SEMPRE
          sotto l'header animato, sulla stessa schermata: niente più uno step
          "intro" separato con CTA proprie (richiesta esplicita di Fabrizio,
          con screenshot: "i campi di accesso devono apparire sotto il logo
          animato e non su una pagina successiva"). Per il tenant famiglia,
          l'intero blocco entra in fade-up insieme alla tagline quando
          l'header è animato (stesso timing del Dev Handoff: CTA a 2.3s). */}
      <div
        className={`w-full max-w-sm ${isFamily && animateHeader ? "trama-fade-up" : ""}`}
        style={isFamily && animateHeader ? { animationDelay: "2.3s" } : undefined}
      >
        <form onSubmit={handleSubmit} className="w-full">
            {mode === "signup" && invitePreview && (
              <div
                className={`mb-4 rounded-lg px-3.5 py-3 text-xs font-medium ${
                  invitePreview.valid ? "bg-green-light text-[#2d8f52]" : "bg-orange-light text-[#d4622a]"
                }`}
              >
                {invitePreview.valid
                  ? `🎁 ${invitePreview.centerName} ti offre uno sconto del ${invitePreview.discountPercent}% sulla tua prima prenotazione — verrà applicato automaticamente registrandoti con questo codice.`
                  : "Questo codice invito non è (più) valido — puoi comunque registrarti normalmente."}
              </div>
            )}

            {mode === "signup" && (
              <>
                <label htmlFor="login-invite-code" className={labelClass}>
                  Codice invito (opzionale)
                </label>
                <input
                  id="login-invite-code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  className={inputClass}
                  placeholder="Codice invito (opzionale)"
                />
              </>
            )}

            <label htmlFor="login-email" className={labelClass}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Email"
            />

            {mode !== "reset" && (
              <>
                <label htmlFor="login-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Password"
                />
              </>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setMessage(null);
                }}
                className={`mb-4 text-xs font-medium ${isAdmin ? "text-navy-text2" : "text-ink-3"}`}
              >
                Password dimenticata?
              </button>
            )}

            {error && <p className="mb-3 text-xs font-medium text-orange">{error}</p>}
            {message && <p className="mb-3 text-xs font-medium text-green">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${
                isFamily ? "rounded-full bg-trama-violet" : "rounded-lg"
              }`}
              style={{ background: isFamily ? undefined : themeColor }}
            >
              {loading
                ? "Attendere…"
                : mode === "login"
                ? "Accedi"
                : mode === "signup"
                ? "Registrati"
                : "Invia link di recupero"}
            </button>
          </form>

          {mode !== "reset" ? (
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
                setMessage(null);
              }}
              className={`mt-5 w-full text-center text-xs font-medium ${isFamily ? "text-trama-violet" : ""}`}
              style={{ color: isFamily ? undefined : themeColor }}
            >
              {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
            </button>
          ) : (
            <button
              onClick={() => {
                setMode("login");
                setError(null);
                setMessage(null);
              }}
              className={`mt-5 w-full text-center text-xs font-medium ${isFamily ? "text-trama-violet" : ""}`}
              style={{ color: isFamily ? undefined : themeColor }}
            >
              Torna al login
            </button>
          )}
      </div>

      {!isSupabaseConfigured && (
        <p className={`mt-8 max-w-sm text-center text-[11px] leading-relaxed ${isAdmin ? "text-navy-text2" : "text-ink-3"}`}>
          Supabase non è ancora collegato. Imposta le chiavi in{" "}
          <code className="rounded bg-bg px-1 py-0.5 text-ink">.env.local</code> per abilitare
          l&apos;autenticazione reale.
        </p>
      )}
    </div>
  );

  if (isFamily) {
    return <PhoneShell>{content}</PhoneShell>;
  }
  return content;
}
