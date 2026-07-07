"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import { ComingSoonBadge } from "@/components/StatusBadge";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
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

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      router.push("/");
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (error) return setError(error.message);
      setMessage("Controlla la tua email per confermare la registrazione!");
    }
  }

  return (
    <PhoneShell>
    <div className="flex min-h-screen flex-col items-center justify-center px-8 py-10 sm:min-h-0 sm:flex-1">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white"
        style={{ background: "linear-gradient(135deg,#4DAFEF,#3ECFB2)" }}
      >
        BK
      </div>
      <h1 className="mb-1 text-xl font-bold text-ink">BuddyKids</h1>
      <p className="mb-7 text-sm text-ink-2">
        {mode === "login" ? "Accedi al tuo account" : "Crea un nuovo account"}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border-[1.5px] border-[#E8EBF0] bg-[#F4F6FA] px-4 py-3 text-sm outline-none focus:border-sky"
          placeholder="tuamail@esempio.it"
        />
        <label className="mb-1.5 block text-xs font-semibold text-ink-2">Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border-[1.5px] border-[#E8EBF0] bg-[#F4F6FA] px-4 py-3 text-sm outline-none focus:border-sky"
          placeholder="••••••••"
        />

        {mode === "login" && (
          <div className="mb-4 flex items-center gap-1.5 text-xs font-medium text-ink-3 opacity-70">
            Password dimenticata?
            <ComingSoonBadge />
          </div>
        )}

        {error && <p className="mb-3 text-xs font-medium text-orange">{error}</p>}
        {message && <p className="mb-3 text-xs font-medium text-green">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
        >
          {loading ? "Attendere…" : mode === "login" ? "Accedi" : "Registrati"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-5 text-xs font-medium text-sky"
      >
        {mode === "login"
          ? "Non hai un account? Registrati"
          : "Hai già un account? Accedi"}
      </button>

      {!isSupabaseConfigured && (
        <p className="mt-8 max-w-sm text-center text-[11px] leading-relaxed text-ink-3">
          Supabase non è ancora collegato. Imposta le chiavi in{" "}
          <code className="rounded bg-bg px-1 py-0.5">.env.local</code> per abilitare
          l&apos;autenticazione reale.
        </p>
      )}
    </div>
    </PhoneShell>
  );
}
