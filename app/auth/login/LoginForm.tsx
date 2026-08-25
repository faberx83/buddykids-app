"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import TramaLoginHeader from "@/components/TramaLoginHeader";
import { friendlyAuthError } from "@/lib/auth-errors";
import { getInvitePreviewAction } from "@/app/actions/invites";
import { recordSignupLegalAcceptanceAction } from "@/app/actions/legal";
import type { InvitePreview } from "@/lib/data/invites";
import type { Tenant } from "@/lib/tenant";

type Mode = "login" | "signup" | "reset";

export default function LoginForm({
  tenant,
  appName,
  themeColor,
  legalGateEnabled = false,
  currentTermsDoc = null,
}: {
  tenant: Tenant;
  appName: string;
  themeColor: string;
  // PRE-MICRO-PILOT CLOSURE GATE (task #568, 25/08/2026) — risolti
  // server-side in page.tsx (mai qui: nessun Client Component deve leggere
  // feature_flag_overrides/legal_documents direttamente). Default a
  // false/null per restare compatibile con qualunque altro chiamante di
  // LoginForm che non passi ancora queste prop (nessuno oggi, ma
  // esplicito invece di un prop obbligatorio che romperebbe la build se
  // dimenticato altrove).
  legalGateEnabled?: boolean;
  currentTermsDoc?: { id: string; version: string } | null;
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
  // Migrazione 21 — "Candidati come centro": il link mandato al candidato
  // dopo l'approvazione Admin (pagina /auth/candidati/conferma/[id]) punta
  // qui con ?mode=signup&email=... per portarlo DIRETTAMENTE al form di
  // registrazione, con l'email già precompilata (deve coincidere con quella
  // indicata in candidatura perché il trigger handle_new_user() esteso
  // possa riconoscerla). Fuori da questo link specifico, il tenant Partner
  // NON mostra più un "Registrati" generico in modalità login (vedi sotto,
  // sostituito da un link a /auth/candidati) — quindi in pratica solo un
  // candidato già approvato arriva in modalità signup sul portale Partner.
  const modeParam = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(inviteParam || modeParam === "signup" ? "signup" : "login");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState(inviteParam || "");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // PRE-MICRO-PILOT CLOSURE GATE (task #568) — attivi SOLO quando
  // legalGateEnabled=true (oggi mai, in produzione, finché Fabrizio non
  // attiva un override). acceptTerms è OBBLIGATORIO per inviare il form in
  // modalità signup quando il gate è attivo; marketingConsent è SEMPRE
  // opzionale e non blocca mai l'invio, coerente col fatto che il
  // marketing è un consenso separato e mai precompilato.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (!inviteParam || !isSupabaseConfigured) return;
    getInvitePreviewAction(inviteParam).then(setInvitePreview);
  }, [inviteParam]);

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
      // PRE-MICRO-PILOT CLOSURE GATE (task #568) — fail-closed: con il gate
      // attivo, un signup senza Termini pubblicati o senza checkbox spuntato
      // non deve MAI procedere (mai un'accettazione finta). Con
      // legalGateEnabled=false (stato di produzione oggi) questi controlli
      // sono sempre no-op: il ramo esistente resta identico a prima.
      if (legalGateEnabled && !currentTermsDoc) {
        setLoading(false);
        return setError("Registrazione momentaneamente non disponibile. Riprova più tardi.");
      }
      if (legalGateEnabled && !acceptTerms) {
        setLoading(false);
        return setError("Devi accettare i Termini di Servizio per registrarti.");
      }

      const callbackUrl = next
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signUp({
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
      if (error) {
        setLoading(false);
        return setError(friendlyAuthError(error.message));
      }

      // Scrittura server-side dell'accettazione Termini (+ marketing se
      // spuntato), keyed sullo userId restituito DIRETTAMENTE da Supabase
      // Auth (mai un valore fornito da input utente) — vedi
      // app/actions/legal.ts e il commento su
      // acceptCurrentLegalDocumentAtSignupBootstrap in lib/legal/gate.ts sul
      // perché serve un bootstrap con service client qui (nessuna sessione
      // ancora attiva quando la conferma email è richiesta). Fail-soft di
      // proposito: un eventuale errore qui non deve bloccare/disfare
      // l'account già creato — solo silenziosamente non registrato,
      // recuperabile in un secondo momento (fuori scope oggi, gate OFF in
      // produzione).
      if (legalGateEnabled && data.user?.id) {
        await recordSignupLegalAcceptanceAction(data.user.id, marketingConsent);
      }

      setLoading(false);
      setMessage("Registrazione completata! Controlla la tua email per confermare l'account prima di accedere.");
      setPassword("");
    }
  }

  const isFamily = tenant === "family";
  const isAdmin = tenant === "admin";

  // REBRAND TRAMA — su richiesta esplicita di Fabrizio dopo aver provato la
  // prima versione ("vorrei l'animazione sempre all'inizio, poi la comparsa
  // dei campi"): l'animazione riparte ad OGNI visita di /auth/login, non più
  // una sola volta per sessione (si discosta qui dal Dev Handoff sez. 9, che
  // indicava "una sola volta per sessione" — l'istruzione diretta del
  // prodotto prevale). Valore derivato, non stato: niente sessionStorage,
  // niente rischio di mismatch SSR/client, l'header entra in animazione fin
  // dal primo render, sempre uguale a ogni caricamento della pagina.
  const animateHeader = isFamily;

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

  // Sprint correttivo (feedback Fabrizio): "voglio vedere l'icona, il claim
  // ma su base bianca" (genitori) e "su portale partner deve esserci claim
  // su base bianca" — prima genitori usava bg-trama-page (#FDFCFA, un
  // off-white caldo) e partner bg-bg (#F7F9FC, grigio chiaro): nessuno dei
  // due era bianco puro. Admin resta bg-navy (icona bianca su sfondo navy,
  // regola di brand invariata) — il claim li' era gia' presente nel codice
  // (vedi sotto, stesso paragrafo condiviso col ramo Partner).
  const content = (
    <div
      className={`flex min-h-screen flex-col items-center justify-center px-8 py-10 sm:min-h-0 sm:flex-1 ${
        isFamily ? "bg-white" : isAdmin ? "bg-navy" : "bg-white"
      }`}
    >
      {isFamily ? (
        <>
          <TramaLoginHeader animate={animateHeader} />
          {/* Gate C, settima ondata (29/07) — root cause di TC-127, MAI
              spiegato nelle sei ondate precedenti: dal REBRAND TRAMA Sprint
              2 (introduzione di TramaLoginHeader, task #180), il tenant
              famiglia mostra SOLO logo + wordmark + tagline fissa
              ("Organizing childhood. Together.") — la {heading} dinamica
              ("Accedi a TRAMA" / "Crea un account TRAMA" / "Recupera la
              password", già presente e invariata nel ramo Partner/Admin
              qui sotto) non è mai stata riportata quando l'header è stato
              animato. Bug reale, non solo del test: un genitore che passa
              a "Registrati" o arriva da un link d'invito non ha alcuna
              conferma testuale di essere in modalità creazione account.
              Riaggiunta qui, stessa animazione fade-up delle altre righe
              del tenant famiglia. */}
          <p
            className={`text-sm text-ink-2 ${animateHeader ? "trama-fade-up" : ""}`}
            style={animateHeader ? { animationDelay: "2.1s" } : undefined}
          >
            {heading}
          </p>
        </>
      ) : (
        <>
          {/* Badge emoji sostituito col vero logo TRAMA (brand kit): variante
              NAVY su sfondo chiaro (Partner), WHITE su sfondo navy (Admin) —
              coerente con la sidebar (DashboardLayout.tsx). */}
          <div className="mb-4 flex flex-col items-center gap-1.5">
            <img
              src={isAdmin ? "/brand/trama-logo-mark-white.png" : "/brand/trama-logo-mark-navy.png"}
              alt=""
              aria-hidden="true"
              className="h-12 w-auto"
            />
            <img
              src={isAdmin ? "/brand/trama-wordmark-white.png" : "/brand/trama-wordmark.png"}
              alt="TRAMA"
              className="h-5 w-auto"
            />
          </div>
          <h1 className={`mb-1 text-xl font-bold ${isAdmin ? "text-white" : "text-ink"}`}>
            {appName.replace(/^TRAMA\s*/i, "").trim() || appName}
          </h1>
          <p className={`text-[13px] ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>
            Organizing childhood. Together.
          </p>
          <p className={`mb-7 mt-3 text-sm ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>{heading}</p>
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
                  invitePreview.valid ? "bg-green-light text-[#2d8f52]" : "bg-orange-light text-trama-orange"
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
                {/* Fabrizio: "aggiungiamo l'opzione di visualizzare la
                    password in tutti i punti in cui è richiesta?" — icona
                    occhio che alterna type="password"/"text", stesso pattern
                    ripetuto in ProfileSecuritySection.tsx e
                    auth/reset-password/page.tsx. Il margin-bottom di
                    `inputClass` si sposta sul wrapper (l'input dentro non lo
                    porta più, `pr-11` fa spazio all'icona senza sovrapporsi
                    al testo digitato). */}
                <div className="relative mb-3">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass.replace("mb-3", "")} mb-0 pr-11`}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 ${
                      isAdmin ? "text-navy-text2" : "text-ink-3"
                    }`}
                  >
                    <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-lg`} />
                  </button>
                </div>
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

            {/* PRE-MICRO-PILOT CLOSURE GATE (task #568, 25/08/2026) — visibile
                SOLO se legalGateEnabled=true (mai in produzione oggi, finché
                Fabrizio non attiva un override — vedi lib/feature-flags/registry.ts).
                Un solo checkbox obbligatorio (Termini): la Privacy Notice è
                un link informativo, non un secondo checkbox — non è un
                consenso da spuntare (Art. 13 GDPR, è un'informativa). Il
                Marketing è sempre opzionale e non blocca mai l'invio. */}
            {mode === "signup" && legalGateEnabled && (
              <div className="mb-4">
                {!currentTermsDoc ? (
                  <p className="text-xs font-medium text-orange">
                    Registrazione momentaneamente non disponibile.
                  </p>
                ) : (
                  <>
                    <label className="mb-2 flex items-start gap-2 text-xs leading-snug text-ink-2">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-0.5"
                        required
                      />
                      <span>
                        Accetto i{" "}
                        <Link href="/terms" target="_blank" className="underline" style={{ color: themeColor }}>
                          Termini di Servizio
                        </Link>
                        . Leggi anche la{" "}
                        <Link href="/privacy" target="_blank" className="underline" style={{ color: themeColor }}>
                          Informativa Privacy
                        </Link>
                        .
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-xs leading-snug text-ink-2">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>Voglio ricevere comunicazioni commerciali (facoltativo).</span>
                    </label>
                  </>
                )}
              </div>
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
            tenant === "partner" && mode === "login" ? (
              // Fabrizio: "il registrati deve essere un 'candidati' per cui
              // deve far partire processo di onboarding" — sul portale
              // Partner non si può più creare un account "vuoto" (senza
              // centro) toggliando qui in modalità signup: si parte sempre
              // dal form di candidatura, che NON crea alcun account (vedi
              // app/auth/candidati/page.tsx). Un candidato già approvato
              // arriva invece in modalità signup direttamente da un link
              // dedicato (?mode=signup&email=..., vedi sopra).
              <Link
                href="/auth/candidati"
                className="mt-5 block w-full text-center text-xs font-medium"
                style={{ color: themeColor }}
              >
                Vuoi diventare un Centro Partner TRAMA? Candidati
              </Link>
            ) : (
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
            )
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
