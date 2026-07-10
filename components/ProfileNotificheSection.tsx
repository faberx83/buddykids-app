"use client";

import { useState } from "react";
import { updatePreferencesAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Sottosezione "Notifiche" (dentro Impostazioni) — email/push/SMS, separata
// da "Preferenze" (lingua/tema) per coerenza con la struttura richiesta:
// Impostazioni > Sicurezza / Preferenze / Notifiche / Privacy e account.
export default function ProfileNotificheSection({
  initialNotifyEmail,
  initialNotifyPush,
  initialNotifySms,
}: {
  initialNotifyEmail: boolean;
  initialNotifyPush: boolean;
  initialNotifySms: boolean;
}) {
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [notifyPush, setNotifyPush] = useState(initialNotifyPush);
  const [notifySms, setNotifySms] = useState(initialNotifySms);
  const [error, setError] = useState<string | null>(null);

  async function save(update: Parameters<typeof updatePreferencesAction>[0]) {
    setError(null);
    if (!isSupabaseConfigured) return;
    const result = await updatePreferencesAction(update);
    if (result.error) setError(result.error);
  }

  return (
    <div className="rounded-lg bg-white p-3.5">
      <ToggleRow
        label="Notifiche email"
        checked={notifyEmail}
        onChange={(v) => {
          setNotifyEmail(v);
          save({ notifyEmail: v });
        }}
      />
      <ToggleRow
        label="Notifiche push"
        checked={notifyPush}
        onChange={(v) => {
          setNotifyPush(v);
          save({ notifyPush: v });
        }}
      />
      <ToggleRow
        label="Notifiche SMS"
        checked={notifySms}
        onChange={(v) => {
          setNotifySms(v);
          save({ notifySms: v });
        }}
      />
      {error && <p className="mt-2 text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1.5 text-sm text-ink">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-sky"
      />
    </label>
  );
}
