"use client";

import { useState } from "react";
import type { Language, Theme } from "@/lib/data/profile";
import { updatePreferencesAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const languageLabels: Record<Language, string> = { it: "Italiano", en: "English" };

// Sezione "Preferenze" del profilo personale — lingua, tema, notifiche.
// Ogni toggle salva subito (nessun pulsante "Salva" separato), coerente con
// il pattern già usato altrove nell'app per le impostazioni rapide.
export default function ProfilePreferencesSection({
  initialLanguage,
  initialTheme,
  initialNotifyEmail,
  initialNotifyPush,
  initialNotifySms,
}: {
  initialLanguage: Language;
  initialTheme: Theme;
  initialNotifyEmail: boolean;
  initialNotifyPush: boolean;
  initialNotifySms: boolean;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [theme, setTheme] = useState(initialTheme);
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
      <div className="mb-3">
        <div className="mb-1.5 text-xs font-semibold text-ink-2">Lingua</div>
        <div className="flex gap-2">
          {(Object.keys(languageLabels) as Language[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLanguage(l);
                save({ language: l });
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                language === l ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-bg text-ink-2"
              }`}
            >
              {languageLabels[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1.5 text-xs font-semibold text-ink-2">Tema</div>
        <div className="flex gap-2">
          {(["light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTheme(t);
                save({ theme: t });
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                theme === t ? "border-sky bg-sky text-white" : "border-[#E8EBF0] bg-bg text-ink-2"
              }`}
            >
              {t === "light" ? "Chiaro" : "Scuro"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1">
        <div className="mb-1.5 text-xs font-semibold text-ink-2">Notifiche</div>
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
      </div>

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
