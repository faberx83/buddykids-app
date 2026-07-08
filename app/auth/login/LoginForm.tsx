"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import { friendlyAuthError } from "@/lib/auth-errors";
import type { Tenant } from "@/lib/tenant";

type Mode = "login" | "signup" | "reset";

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
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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

  const content = (
    <div
      className={`flex min-h-screen flex-col items-center justify-center px-8 py-10 sm:min-h-0 sm:flex-1 ${
        isFamily ? "" : isAdmin ? "bg-navy" : "bg-bg"
      }`}
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white"
        style={{ background: themeColor }}
      >
        {isFamily ? "BK" : isAdmin ? "🛠️" : "🏫"}
      </div>
      <h1 className={`mb-1 text-xl font-bold ${isAdmin ? "text-white" : "text-ink"}`}>{appName}</h1>
      <p className={`mb-7 text-sm ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>{heading}</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <label className={`mb-1.5 block text-xs font-semibold ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`mb-4 w-full rounded-lg border-[1.5px] px-4 py-3 text-sm outline-none ${
            isAdmin
              ? "border-navy-3 bg-navy-2 text-white placeholder:text-navy-text2"
              : "border-[#E8EBF0] bg-[#F4F6FA]"
          }`}
          placeholder="tuamail@esempio.it"
        />

        {mode !== "reset" && (
          <>
            <label className={`mb-1.5 block text-xs font-semibold ${isAdmin ? "text-navy-text2" : "text-ink-2"}`}>
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`mb-4 w-full rounded-lg border-[1.5px] px-4 py-3 text-sm outline-none ${
                isAdmin
                  ? "border-navy-3 bg-navy-2 text-white placeholder:text-navy-text2"
                  : "border-[#E8EBF0] bg-[#F4F6FA]"
              }`}
              placeholder="••••••••"
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
          className="w-full rounded-lg py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: themeColor }}
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
          className="mt-5 text-xs font-medium"
          style={{ color: themeColor }}
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
          className="mt-5 text-xs font-medium"
          style={{ color: themeColor }}
        >
          Torna al login
        </button>
      )}

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
