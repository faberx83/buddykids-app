"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import PhoneShell from "@/components/PhoneShell";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase non è configurato.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1500);
  }

  return (
    <PhoneShell>
      <div className="flex min-h-screen flex-col items-center justify-center px-8 py-10 sm:min-h-0 sm:flex-1">
        {/* 15/10/2026 — via il vecchio cerchio "BK" (BuddyKids): segno TRAMA
            blu notte (pagina comune a famiglie e centri, regola di brand:
            colorato solo lato genitore) e stessi campi/pulsante della pagina
            di accesso V2. */}
        <img src="/brand/trama-logo-mark-navy.png" alt="" aria-hidden="true" className="mb-5 h-14 w-auto" />
        <h1 className="mb-1 font-poppins text-[22px] font-semibold text-ink">Imposta una nuova password</h1>
        <p className="mb-7 text-[15px] text-ink-2">Scegli una nuova password per il tuo account</p>

        {done ? (
          <p className="text-sm font-medium text-green">Password aggiornata! Ti reindirizziamo…</p>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nuova password</label>
            <div className="relative mb-4">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[52px] w-full rounded-[12px] border-[1.5px] border-trama-line bg-white px-4 py-3 pr-11 text-[16px] outline-none focus:border-trama-primary"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3"
              >
                <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-lg`} />
              </button>
            </div>
            {error && <p className="mb-3 text-xs font-medium text-orange">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="min-h-[52px] w-full rounded-[12px] bg-trama-primary py-3.5 text-[16px] font-semibold text-white active:bg-trama-primary-press disabled:opacity-60"
            >
              {loading ? "Salvo…" : "Salva nuova password"}
            </button>
          </form>
        )}
      </div>
    </PhoneShell>
  );
}
