"use client";

// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026). Riquadro in Profilo →
// Impostazioni → Preferenze: due interruttori (telefono, email) e "Mandamelo
// adesso" per vedere subito com'è. Salva a ogni tocco, come il resto della
// pagina. Compare solo con la release "buongiorno-trama" accesa e la
// migration_45 applicata (vedi la pagina).

import { useState } from "react";
import { sendDailyBriefingNowAction, updateDailyBriefingAction } from "@/app/actions/daily-briefing";

export default function DailyBriefingSettings({
  initialPush,
  initialEmail,
  email,
}: {
  initialPush: boolean;
  initialEmail: boolean;
  email: string | null;
}) {
  const [push, setPush] = useState(initialPush);
  const [mail, setMail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(next: { push?: boolean; email?: boolean }) {
    setError(null);
    setMessage(null);
    const res = await updateDailyBriefingAction(next);
    if (res.error) {
      setError(res.error);
      if (next.push !== undefined) setPush(!next.push);
      if (next.email !== undefined) setMail(!next.email);
    }
  }

  async function sendNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await sendDailyBriefingNowAction().catch(() => null);
    setBusy(false);
    if (!res) return setError("Qualcosa non ha funzionato, riprova");
    if (!res.ok) return setError(res.error);
    if (res.empty && !res.push && !res.email) return setMessage("Oggi non c'è niente da dirti: nessun impegno, niente da decidere, nessuna chiusura vicina.");
    const where = [res.push ? "sul telefono" : null, res.email ? `per email a ${email ?? "te"}` : null].filter(Boolean).join(" e ");
    setMessage(where ? `Inviato ${where}. Se non arriva sul telefono, controlla che le notifiche siano attive.` : "Non è partito nulla: controlla le notifiche e l'email qui sopra.");
  }

  return (
    <section aria-labelledby="buongiorno-h" className="rounded-2xl border border-trama-line bg-white p-4">
      <h2 id="buongiorno-h" className="font-poppins text-[16px] font-semibold text-ink">
        Il buongiorno di TRAMA
      </h2>
      <p className="mt-1 text-[13.5px] leading-snug text-ink-2">
        Ogni mattina verso le 8: gli impegni di oggi, chi porta e chi ritira, e se la scuola chiude a breve. Se non c&apos;è niente da
        dire non ti scriviamo.
      </p>
      <div className="mt-3 flex flex-col">
        <Toggle
          label="Sul telefono"
          hint="Una notifica breve (servono le notifiche attive)"
          checked={push}
          onChange={(v) => {
            setPush(v);
            void save({ push: v });
          }}
        />
        <Toggle
          label="Per email"
          hint={email ? `Un riepilogo completo a ${email}` : "Un riepilogo completo alla tua email"}
          checked={mail}
          onChange={(v) => {
            setMail(v);
            void save({ email: v });
          }}
        />
      </div>
      <button
        type="button"
        disabled={busy || (!push && !mail)}
        onClick={sendNow}
        className="mt-3 flex min-h-[44px] items-center text-[14px] font-semibold text-trama-accent-ink disabled:opacity-50"
      >
        {busy ? "Invio…" : "Mandamelo adesso, per provarlo"}
      </button>
      {message && (
        <p role="status" className="mt-1 text-[13px] text-[#146B4F]">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-medium text-[#B3261E]">
          {error}
        </p>
      )}
    </section>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-[56px] items-center justify-between gap-3 border-t border-[#F0F2F5] py-2 first:border-t-0">
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold text-ink">{label}</span>
        <span className="text-[12.5px] text-ink-2">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 flex-shrink-0 accent-[#172A4D]" />
    </label>
  );
}
