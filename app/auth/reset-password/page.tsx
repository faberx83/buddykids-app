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
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white"
          style={{ background: "linear-gradient(135deg,#4DAFEF,#3ECFB2)" }}
        >
          BK
        </div>
        <h1 className="mb-1 text-xl font-bold text-ink">Imposta una nuova password</h1>
        <p className="mb-7 text-sm text-ink-2">Scegli una nuova password per il tuo account</p>

        {done ? (
          <p className="text-sm font-medium text-green">Password aggiornata! Ti reindirizziamo…</p>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <label className="mb-1.5 block text-xs font-semibold text-ink-2">Nuova password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-4 w-full rounded-lg border-[1.5px] border-[#E8EBF0] bg-[#F4F6FA] px-4 py-3 text-sm outline-none focus:border-sky"
              placeholder="••••••••"
            />
            {error && <p className="mb-3 text-xs font-medium text-orange">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-sky py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#3A9FDC] disabled:opacity-60"
            >
              {loading ? "Salvo…" : "Salva nuova password"}
            </button>
          </form>
        )}
      </div>
    </PhoneShell>
  );
}
