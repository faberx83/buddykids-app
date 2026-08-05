"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { submitCenterCandidacyAction } from "@/app/actions/center-leads";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Migrazione 21 — "Candidati come centro". Form PUBBLICO: nessun account
// viene creato inviandolo (vedi submitCenterCandidacyAction). Al successo
// si passa alla pagina di conferma /auth/candidati/conferma/[id], dove il
// candidato può ricontrollare lo stato della propria candidatura senza
// doversi registrare.
export default function CandidatiForm({ themeColor }: { themeColor: string }) {
  const router = useRouter();
  const [centerName, setCenterName] = useState("");
  const [locality, setLocality] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "mb-3 w-full rounded-lg border-[1.5px] border-[#E8EBF0] bg-[#F4F6FA] px-4 py-3 text-sm outline-none";
  const labelClass = "mb-1.5 block text-xs font-semibold text-ink-2";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError("Supabase non è ancora configurato in questo ambiente.");
      return;
    }

    setLoading(true);
    const res = await submitCenterCandidacyAction({
      centerName,
      locality: locality || undefined,
      email,
      phone: phone || undefined,
      description: description || undefined,
    });
    setLoading(false);

    if (res.error) return setError(res.error);
    if (res.id) router.push(`/auth/candidati/conferma/${res.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-8 py-10">
      <div className="mb-4 flex flex-col items-center gap-1.5">
        <img
          src="/brand/trama-logo-mark-navy.png"
          alt=""
          aria-hidden="true"
          className="h-12 w-auto"
        />
        <img src="/brand/trama-wordmark.png" alt="TRAMA" className="h-5 w-auto" />
      </div>
      <h1 className="mb-1 text-xl font-bold text-ink">Candidati come Centro Partner</h1>
      <p className="mb-7 mt-1 max-w-sm text-center text-sm text-ink-2">
        Raccontaci il tuo centro: il nostro team lo rivede e ti ricontatta per completare
        l&apos;attivazione su TRAMA.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
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

        <label className={labelClass} htmlFor="cand-email">
          Email di contatto
        </label>
        <input
          id="cand-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="La tua email — userai questa per registrarti dopo l'approvazione"
        />

        <label className={labelClass} htmlFor="cand-phone">
          Telefono (opzionale)
        </label>
        <input
          id="cand-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          placeholder="Numero di telefono"
        />

        <label className={labelClass} htmlFor="cand-description">
          Raccontaci il tuo centro (opzionale)
        </label>
        <textarea
          id="cand-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder="Età dei bambini, attività proposte, indirizzo, ecc."
        />

        {error && <p className="mb-3 text-xs font-medium text-orange">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: themeColor }}
        >
          {loading ? "Invio…" : "Invia candidatura"}
        </button>
      </form>

      <Link href="/auth/login" className="mt-5 text-center text-xs font-medium" style={{ color: themeColor }}>
        Hai già un account? Accedi
      </Link>
    </div>
  );
}
