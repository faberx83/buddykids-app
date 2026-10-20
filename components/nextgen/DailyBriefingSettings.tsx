"use client";

// TRAMA — IL BUONGIORNO DI TRAMA (20/10/2026). Riquadro in Profilo →
// Impostazioni → Preferenze: due interruttori (telefono, email) e "Mandamelo
// adesso" per vedere subito com'è. Salva a ogni tocco, come il resto della
// pagina. Compare solo con la release "buongiorno-trama" accesa e la
// migration_45 applicata (vedi la pagina).

import { useState } from "react";
import { sendDailyBriefingNowAction, updateDailyBriefingAction } from "@/app/actions/daily-briefing";
import { SETTINGS_CARD, SETTINGS_ERROR, SETTINGS_OK, SettingsSection, SwitchRow } from "@/components/nextgen/settings-v2";

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

  // 20/10/2026 — Impostazioni V2: stessa sezione e stesse righe del resto
  // della pagina (components/nextgen/settings-v2.tsx).
  return (
    <SettingsSection
      id="buongiorno-h"
      title="Il buongiorno di TRAMA"
      hint="Ogni mattina verso le 8: gli impegni di oggi, chi porta e chi ritira, e se la scuola chiude a breve. Se non c'è niente da dire non ti scriviamo."
    >
      <div className={`${SETTINGS_CARD} divide-y divide-[#F0F2F5]`}>
        <SwitchRow
          label="Sul telefono"
          hint="Una notifica con la giornata (servono le notifiche push)"
          checked={push}
          onChange={(v) => {
            setPush(v);
            void save({ push: v });
          }}
        />
        <SwitchRow
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
        className="flex min-h-[44px] items-center self-start text-[14px] font-semibold text-trama-accent-ink disabled:opacity-50"
      >
        <i className="ti ti-send mr-1.5" aria-hidden="true" />
        {busy ? "Invio…" : "Mandamelo adesso, per provarlo"}
      </button>
      {message && (
        <p role="status" className={SETTINGS_OK}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className={SETTINGS_ERROR}>
          {error}
        </p>
      )}
    </SettingsSection>
  );
}
