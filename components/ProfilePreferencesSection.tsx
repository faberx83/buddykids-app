"use client";

import { useState } from "react";
import type { Language, Theme } from "@/lib/data/profile";
import { updatePreferencesAction } from "@/app/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const languageLabels: Record<Language, string> = { it: "Italiano", en: "English" };

// Sezione "Preferenze" (dentro Impostazioni) — solo lingua e tema. Le
// notifiche sono una sottosezione separata (vedi ProfileNotificheSection),
// per coerenza con la struttura Impostazioni > Sicurezza/Preferenze/
// Notifiche/Privacy e account. Ogni scelta salva subito (nessun pulsante
// "Salva" separato).
export default function ProfilePreferencesSection({
  initialLanguage,
  initialTheme,
}: {
  initialLanguage: Language;
  initialTheme: Theme;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [theme, setTheme] = useState(initialTheme);
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

      <div className="mb-1">
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

      {error && <p className="mt-2 text-xs font-medium text-orange">{error}</p>}
    </div>
  );
}
